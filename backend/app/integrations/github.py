"""Read-only GitHub repository ingestion for the project-import flow.

Only public, unauthenticated GitHub REST API calls are made (repo metadata,
languages, contributors, README). Everything returned is real data straight
from GitHub — nothing here fabricates facts; that stays true to the app's
"explainable by design" contract.
"""
from __future__ import annotations

import base64
import re
import ssl

import httpx
import truststore

from ..core.exceptions import SentinelError

_GITHUB_API = "https://api.github.com"

# Verify TLS certs against the OS-native trust store rather than certifi's
# bundled CAs. This is required to work behind corporate TLS-inspecting
# proxies (e.g. Zscaler) whose root CA is trusted by the OS but isn't in
# certifi's bundle.
_SSL_CONTEXT = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
_REPO_URL_RE = re.compile(
    r"^(?:https?://github\.com/)?(?P<owner>[\w.-]+)/(?P<repo>[\w.-]+?)(?:\.git)?/?$"
)
_HEADING_RE = re.compile(r"^#{1,3}\s+(.{3,120})$", re.MULTILINE)


def parse_repo_slug(repo_url: str) -> tuple[str, str]:
    match = _REPO_URL_RE.match(repo_url.strip())
    if not match:
        raise SentinelError(
            "invalid_github_url",
            f"'{repo_url}' doesn't look like a GitHub repo URL or 'owner/repo'.",
            suggested_action="Use a form like https://github.com/owner/repo or owner/repo.",
        )
    return match.group("owner"), match.group("repo")


def fetch_github_repo(repo_url: str, *, timeout: float = 6.0) -> dict:
    """Fetch metadata, languages, contributors, and README headings for a public repo."""
    owner, repo = parse_repo_slug(repo_url)
    base = f"{_GITHUB_API}/repos/{owner}/{repo}"

    try:
        with httpx.Client(
            timeout=timeout,
            headers={"Accept": "application/vnd.github+json"},
            verify=_SSL_CONTEXT,
            follow_redirects=True,
        ) as client:
            repo_resp = client.get(base)
            if repo_resp.status_code == 404:
                raise SentinelError(
                    "github_repo_not_found",
                    f"GitHub repo '{owner}/{repo}' was not found (or is private).",
                    suggested_action="Check the URL and make sure the repo is public.",
                )
            if repo_resp.status_code == 403:
                raise SentinelError(
                    "github_rate_limited",
                    "GitHub's unauthenticated API rate limit was hit.",
                    suggested_action="Wait a few minutes and try again, or use text/file import instead.",
                )
            repo_resp.raise_for_status()
            repo_json = repo_resp.json()

            languages: dict[str, int] = {}
            lang_resp = client.get(f"{base}/languages")
            if lang_resp.status_code == 200:
                languages = lang_resp.json()

            contributors: list[dict] = []
            contrib_resp = client.get(f"{base}/contributors", params={"per_page": 8})
            if contrib_resp.status_code == 200:
                contributors = [
                    {"login": c.get("login", ""), "contributions": c.get("contributions", 0)}
                    for c in contrib_resp.json()
                    if c.get("type") == "User"
                ]

            readme_text = ""
            readme_resp = client.get(f"{base}/readme", headers={"Accept": "application/vnd.github.raw"})
            if readme_resp.status_code == 200:
                content_type = readme_resp.headers.get("content-type", "")
                if "json" in content_type:
                    payload = readme_resp.json()
                    readme_text = base64.b64decode(payload.get("content", "")).decode("utf-8", errors="ignore")
                else:
                    readme_text = readme_resp.text
    except httpx.RequestError as exc:
        raise SentinelError(
            "github_unreachable",
            "Couldn't reach GitHub right now.",
            details={"error": str(exc)},
            suggested_action="Check connectivity and try again, or use text/file import instead.",
        ) from exc

    headings = [h.strip(" #") for h in _HEADING_RE.findall(readme_text)][:12]

    return {
        "owner": owner,
        "repo": repo,
        "full_name": repo_json.get("full_name", f"{owner}/{repo}"),
        "description": repo_json.get("description") or "",
        "topics": repo_json.get("topics", []),
        "html_url": repo_json.get("html_url", f"https://github.com/{owner}/{repo}"),
        "primary_language": repo_json.get("language") or "",
        "languages": languages,
        "contributors": contributors,
        "readme_headings": headings,
        "stargazers_count": repo_json.get("stargazers_count", 0),
        "open_issues_count": repo_json.get("open_issues_count", 0),
    }
