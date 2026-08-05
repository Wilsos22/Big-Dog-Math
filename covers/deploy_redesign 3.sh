#!/usr/bin/env bash
set -e
REPO="/Users/steelewilson/Documents/Website prototype"
WT="/tmp/bdm-main-worktree"

echo "[1/6] Cleaning any old worktree..."
cd "$REPO"
git worktree remove -f "$WT" 2>/dev/null || true
rm -rf "$WT"

echo "[2/6] Creating temporary worktree on main..."
git fetch origin main
git worktree add "$WT" origin/main

echo "[3/6] Unzipping redesign covers..."
rm -rf /tmp/nrz
unzip -o "$REPO/covers/Notion covers redesign.zip" -d /tmp/nrz > /dev/null

echo "[4/6] Copying PNGs into worktree public/lesson-covers/..."
mkdir -p "$WT/public/lesson-covers/M1" "$WT/public/lesson-covers/M2"
cp /tmp/nrz/covers/M1/*.png "$WT/public/lesson-covers/M1/"
cp /tmp/nrz/covers/M2/*.png "$WT/public/lesson-covers/M2/"

echo "[5/6] Committing + pushing to main..."
cd "$WT"
git checkout -b add-redesigned-covers
git add public/lesson-covers/M1 public/lesson-covers/M2
git commit -m "Add redesigned M1+M2 lesson covers (82 PNGs)"
git push origin add-redesigned-covers:main

echo "[6/6] Cleaning up worktree..."
cd "$REPO"
git worktree remove -f "$WT"

echo ""
echo "Done. 82 PNGs pushed to origin/main. Wait ~60s for Vercel."
echo "Your codex branch (unstaged edits) was NOT touched."
