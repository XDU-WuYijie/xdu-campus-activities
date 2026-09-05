#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$ROOT_DIR/scripts/bootstrap.sh"
npm --prefix "$ROOT_DIR/frontend" run build
exec npm --prefix "$ROOT_DIR/frontend" start
