#!/usr/bin/env bash
#
# Compatibility wrapper for the unified Python launcher.
#
# Usage: bash run.sh [run.py options]
#
set -euo pipefail

cd "$(dirname "$0")"
exec python3 run.py "$@"
