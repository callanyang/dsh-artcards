#!/usr/bin/env bash
set -euo pipefail

plugin_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
profile="web"
profile_dir="${DSH_HOME:-${HOME}/.dsh}/profiles/${profile}"
manifest="${profile_dir}/package.json"
package_spec="link:${plugin_dir}"

if command -v dsh >/dev/null 2>&1; then
  dsh plugin --profile "${profile}" add "${package_spec}"
else
  if ! command -v node >/dev/null 2>&1; then
    echo "dsh-artcards: Node.js 22 or newer is required" >&2
    exit 1
  fi
  node "${plugin_dir}/scripts/profile-manifest.mjs" init "${manifest}" "${profile}"
  if command -v pnpm >/dev/null 2>&1; then
    pnpm --dir "${profile_dir}" add "${package_spec}"
  elif command -v corepack >/dev/null 2>&1; then
    corepack pnpm --dir "${profile_dir}" add "${package_spec}"
  else
    echo "dsh-artcards: pnpm is required; run 'corepack enable' first" >&2
    exit 1
  fi
  node "${plugin_dir}/scripts/profile-manifest.mjs" add "${manifest}" "${profile}"
fi

echo "dsh-artcards installed. Restart 'dsh web' and refresh the page."
