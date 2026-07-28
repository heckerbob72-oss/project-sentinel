#!/usr/bin/env python3
"""Bootstrap and run the Project Sentinel backend and frontend together.

Usage:
    python3 run.py
    python3 run.py --setup
    python3 run.py --backend-port 8010 --frontend-port 3010
"""
from __future__ import annotations

import argparse
import logging
import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

EXIT_SUCCESS = 0
EXIT_FAILURE = 1
EXIT_CONFIG = 2
PROJECT_ROOT = Path(__file__).resolve().parent
BACKEND_ROOT = PROJECT_ROOT / "backend"
FRONTEND_ROOT = PROJECT_ROOT / "frontend"
VENV_ROOT = BACKEND_ROOT / ".venv"
logger = logging.getLogger("sentinel-runner")


def create_parser() -> argparse.ArgumentParser:
    """Create the command-line parser."""
    parser = argparse.ArgumentParser(
        description="Set up and run the Project Sentinel backend and frontend."
    )
    parser.add_argument("--backend-port", type=int, default=8000)
    parser.add_argument("--frontend-port", type=int, default=3000)
    parser.add_argument(
        "--setup",
        action="store_true",
        help="Reinstall Python and Node dependencies even if already present.",
    )
    parser.add_argument("--no-seed", action="store_true", help="Skip database seeding.")
    parser.add_argument("--no-reload", action="store_true", help="Disable Uvicorn auto-reload.")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Validate configuration and dependencies without starting servers.",
    )
    return parser


def configure_logging() -> None:
    """Configure concise launcher output."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")


def configure_signal_handlers() -> None:
    """Route terminal-close signals through normal supervised shutdown."""
    def handle_shutdown(signum: int, frame: object) -> None:
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, handle_shutdown)
    if hasattr(signal, "SIGHUP"):
        signal.signal(signal.SIGHUP, handle_shutdown)


def load_env(path: Path) -> dict[str, str]:
    """Load a simple dotenv file without adding a runtime dependency."""
    loaded: dict[str, str] = {}
    if not path.exists():
        logger.warning("%s is missing; the app will use built-in defaults", path.name)
        return loaded

    for line_number, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        if "=" not in line:
            raise ValueError(f"Invalid .env entry on line {line_number}: expected KEY=VALUE")
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            raise ValueError(f"Invalid .env entry on line {line_number}: empty key")
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        loaded[key] = value
        os.environ.setdefault(key, value)
    return loaded


def run_command(command: list[str], cwd: Path) -> None:
    """Run a setup command and fail on a non-zero exit."""
    logger.info("Running: %s", " ".join(command))
    subprocess.run(command, cwd=cwd, env=os.environ.copy(), check=True)


def backend_python() -> Path:
    """Return the virtual environment's Python executable path."""
    executable = "python.exe" if sys.platform == "win32" else "python"
    return VENV_ROOT / ("Scripts" if sys.platform == "win32" else "bin") / executable


def ensure_backend(force_setup: bool) -> Path:
    """Create the backend virtual environment and install dependencies when needed."""
    python = backend_python()
    if not python.exists():
        logger.info("Creating backend virtual environment")
        run_command([sys.executable, "-m", "venv", str(VENV_ROOT)], PROJECT_ROOT)

    probe = subprocess.run(
        [str(python), "-c", "import fastapi, httpx, sqlalchemy, truststore, uvicorn"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if force_setup or probe.returncode != 0:
        run_command(
            [str(python), "-m", "pip", "install", "-r", "requirements-local.txt"],
            BACKEND_ROOT,
        )
    return python


def ensure_frontend(force_setup: bool) -> str:
    """Install frontend dependencies when needed and return the npm executable."""
    npm = shutil.which("npm")
    if not npm:
        raise RuntimeError("npm was not found. Install Node.js 18+ (Node.js 20 recommended).")
    if force_setup or not (FRONTEND_ROOT / "node_modules").is_dir():
        run_command([npm, "install"], FRONTEND_ROOT)
    return npm


def process_group_options() -> dict[str, object]:
    """Return platform-specific options for an isolated child process group."""
    process_options: dict[str, object] = {}
    if sys.platform != "win32":
        process_options["process_group"] = 0
    return process_options


def start_process(command: list[str], cwd: Path) -> subprocess.Popen[bytes]:
    """Start a watchdog that owns and supervises one server process."""
    logger.info("Starting: %s", " ".join(command))
    watchdog_command = [
        sys.executable,
        str(Path(__file__).resolve()),
        "--supervised-child",
        str(os.getpid()),
        str(cwd),
        *command,
    ]
    return subprocess.Popen(
        watchdog_command,
        cwd=PROJECT_ROOT,
        env=os.environ.copy(),
        **process_group_options(),
    )


def stop_process(process: subprocess.Popen[bytes]) -> None:
    """Stop a child and any reload-server descendants."""
    if process.poll() is not None:
        return
    if sys.platform == "win32":
        process.terminate()
    else:
        os.killpg(process.pid, signal.SIGTERM)
    try:
        process.wait(timeout=8)
    except subprocess.TimeoutExpired:
        if sys.platform == "win32":
            process.kill()
        else:
            os.killpg(process.pid, signal.SIGKILL)
        process.wait()


def run_supervised_child(parent_pid: int, cwd: Path, command: list[str]) -> int:
    """Run one server and stop it if its launcher exits for any reason."""
    configure_signal_handlers()
    server = subprocess.Popen(
        command,
        cwd=cwd,
        env=os.environ.copy(),
        **process_group_options(),
    )
    try:
        while server.poll() is None and os.getppid() == parent_pid:
            time.sleep(0.5)
        return server.returncode or EXIT_SUCCESS
    except KeyboardInterrupt:
        return 130
    finally:
        stop_process(server)


def supervise(processes: list[subprocess.Popen[bytes]]) -> int:
    """Wait until interrupted or either server exits, then stop both."""
    try:
        while all(process.poll() is None for process in processes):
            time.sleep(0.5)
    except KeyboardInterrupt:
        logger.info("Stopping Project Sentinel")
        return 130
    finally:
        for process in reversed(processes):
            stop_process(process)

    failed = next((process.returncode for process in processes if process.returncode), 0)
    if failed:
        logger.error("A server exited unexpectedly with code %s", failed)
    return failed or EXIT_SUCCESS


def run(args: argparse.Namespace) -> int:
    """Set up dependencies and run both development servers."""
    env = load_env(PROJECT_ROOT / ".env")
    python = ensure_backend(args.setup)
    npm = ensure_frontend(args.setup)

    if env.get("LLM_PROVIDER", "mock").lower() == "groq" and not env.get("GROQ_API_KEY"):
        logger.warning("GROQ_API_KEY is empty; language tasks will use the offline mock provider")

    if not args.no_seed:
        run_command([str(python), "-m", "app.seed.run_seed"], BACKEND_ROOT)

    if args.check:
        logger.info("Configuration, backend imports, frontend dependencies, and seed completed")
        return EXIT_SUCCESS

    if args.backend_port != 8000 or "NEXT_PUBLIC_API_URL" not in os.environ:
        os.environ["NEXT_PUBLIC_API_URL"] = (
            f"http://localhost:{args.backend_port}/api/v1"
        )
    backend_command = [
        str(python),
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "0.0.0.0",
        "--port",
        str(args.backend_port),
    ]
    if not args.no_reload:
        backend_command.append("--reload")

    frontend_command = [npm, "run", "dev", "--", "--port", str(args.frontend_port)]
    logger.info("Backend API: http://localhost:%s/docs", args.backend_port)
    logger.info("Frontend:    http://localhost:%s", args.frontend_port)
    logger.info("Demo login: pm@sentinel.dev / pm123456")
    processes: list[subprocess.Popen[bytes]] = []
    try:
        processes.append(start_process(backend_command, BACKEND_ROOT))
        processes.append(start_process(frontend_command, FRONTEND_ROOT))
        return supervise(processes)
    except Exception:
        for process in reversed(processes):
            stop_process(process)
        raise


def main() -> int:
    """Parse arguments and return a process exit code."""
    configure_logging()
    configure_signal_handlers()
    try:
        return run(create_parser().parse_args())
    except KeyboardInterrupt:
        return 130
    except (OSError, ValueError, subprocess.CalledProcessError, RuntimeError) as exc:
        logger.error("%s", exc)
        return EXIT_CONFIG


if __name__ == "__main__":
    if len(sys.argv) >= 5 and sys.argv[1] == "--supervised-child":
        sys.exit(run_supervised_child(int(sys.argv[2]), Path(sys.argv[3]), sys.argv[4:]))
    sys.exit(main())