#!/usr/bin/env bash
#
# Build locally and publish a ready-to-run branch for cPanel.
#
# The `deploy` branch carries the compiled output (dist/ and server-dist/) that
# is gitignored on main. That is deliberate: shared hosting often has no SSH and
# limited memory, so the server should never have to build anything. Deploying
# becomes "git pull" and a restart.
#
#   ./scripts/release.sh              # publish to origin/deploy
#   ./scripts/release.sh staging      # publish to origin/staging
#
set -euo pipefail

BRANCH="${1:-deploy}"
SOURCE="$(git rev-parse --abbrev-ref HEAD)"

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "You have uncommitted changes. Commit or stash them first." >&2
  exit 1
fi

echo "==> Building from '$SOURCE'"
npm run build

echo "==> Publishing to '$BRANCH'"
git checkout -B "$BRANCH"
# dist/ and server-dist/ are gitignored on main, so force-add them here.
git add -f dist server-dist
git commit -q -m "Release from $SOURCE ($(git rev-parse --short "$SOURCE")) — $(date -u '+%Y-%m-%d %H:%M UTC')" || {
  echo "Nothing new to release."
  git checkout -q "$SOURCE"
  exit 0
}
git push -f origin "$BRANCH"
git checkout -q "$SOURCE"

echo
echo "==> Published origin/$BRANCH"
echo "    On cPanel: Git Version Control → Manage → Update from Remote,"
echo "    then Setup Node.js App → Restart."
