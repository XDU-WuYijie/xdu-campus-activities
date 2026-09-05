#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v node >/dev/null 2>&1; then
  printf '缺少 Node.js，需要 20.19+ 或 22.12+。\n' >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  printf '缺少 npm，请先安装与 Node.js 配套的 npm。\n' >&2
  exit 1
fi

node -e '
const [major, minor] = process.versions.node.split(".").map(Number)
if (!((major === 20 && minor >= 19) || major >= 22)) {
  console.error(`需要 Node.js 20.19+ 或 22.12+，当前为 ${process.version}`)
  process.exit(1)
}
'

printf '根据 frontend/package-lock.json 安装前端依赖...\n'
npm --prefix "$ROOT_DIR/frontend" ci
printf '前端依赖安装完成。\n'
