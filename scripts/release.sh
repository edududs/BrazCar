#!/usr/bin/env bash
# Cuts a release locally: next SemVer from the commits, CHANGELOG.md, release commit, annotated tag.
# It never pushes. See docs/runbooks/close-step.md.
#
#   scripts/release.sh --dry-run   show the next version and its notes, change nothing
#   scripts/release.sh             create the release commit and the tag
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

die() {
    echo "release: $*" >&2
    exit 1
}

dry_run=0
[[ "${1:-}" == "--dry-run" ]] && dry_run=1

command -v git-cliff >/dev/null || die "git-cliff is not installed (https://git-cliff.org)"
[[ "$(git branch --show-current)" == "main" ]] || die "releases are cut from main"
[[ -z "$(git status --porcelain)" ]] || die "the working tree is not clean"

last="$(git describe --tags --abbrev=0 --match 'v[0-9]*' 2>/dev/null || true)"
next="$(git cliff --bumped-version 2>/dev/null)"
[[ -n "$next" ]] || die "could not compute the next version"
[[ "$next" != "$last" ]] || die "nothing to release since $last"

notes="$(git cliff --unreleased --tag "$next" --strip all 2>/dev/null)"

if ((dry_run)); then
    echo "last: ${last:-none}  next: $next"
    echo
    echo "$notes"
    exit 0
fi

# The version lives in the tag. The backend package follows it, the API reads it from the package,
# and the contract and the generated front types are rebuilt so they carry the same number (D-082).
# The front's package.json follows it too: the build shows it and compares it with the floor (D-105).
(cd backend && uv version "${next#v}" >/dev/null && uv run poe openapi >/dev/null)
(cd web && node -e '
    const fs = require("node:fs");
    const manifest = JSON.parse(fs.readFileSync("package.json", "utf8"));
    manifest.version = process.argv[1];
    fs.writeFileSync("package.json", JSON.stringify(manifest, null, 2) + "\n");
' "${next#v}" && yarn gen:api >/dev/null)
git cliff --tag "$next" --output CHANGELOG.md 2>/dev/null

git add CHANGELOG.md backend/pyproject.toml backend/uv.lock contract/openapi.json web/package.json web/src/shared/adapters/api/schema.d.ts
git commit --quiet -m "chore(release): $next"

# The tag message is the notes alone: the release workflow publishes it as the release body, and a
# subject line repeating the version would show up there. --cleanup=verbatim keeps the markdown
# headings, which git would otherwise drop as comments.
printf '%s\n' "$notes" | sed '/./,$!d' | git tag --annotate "$next" --file - --cleanup=verbatim

echo "release: $next committed and tagged locally."
echo "release: to publish, the owner runs: git push --follow-tags"
