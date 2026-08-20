#!/usr/bin/env bash
set -euo pipefail

plugin_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
profile="web"
profile_dir="${DSH_HOME:-${HOME}/.dsh}/profiles/${profile}"
manifest="${profile_dir}/package.json"

if ! node "${plugin_dir}/scripts/profile-manifest.mjs" has "${manifest}" "${profile}"; then
  echo "dsh-artcards is not installed."
  exit 0
fi

if command -v dsh >/dev/null 2>&1; then
  dsh plugin --profile "${profile}" remove dsh-artcards
else
  if command -v pnpm >/dev/null 2>&1; then
    pnpm --dir "${profile_dir}" remove dsh-artcards
  elif command -v corepack >/dev/null 2>&1; then
    corepack pnpm --dir "${profile_dir}" remove dsh-artcards
  else
    echo "dsh-artcards: pnpm is required; run 'corepack enable' first" >&2
    exit 1
  fi
  node "${plugin_dir}/scripts/profile-manifest.mjs" remove "${manifest}" "${profile}"
fi

echo "dsh-artcards removed. Restart 'dsh web' and refresh the page."
