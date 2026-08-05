#!/usr/bin/env bash
# Tunes the clear-handoff skill's description for triggering accuracy.
# Run this from a terminal where `claude` is logged in - the Cowork sandbox is not.
#
#   bash run-trigger-test.sh
#
# Keep this script next to SKILL.md and trigger-eval.json.

set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The skill-creator lives in a temp plugin cache whose hash changes between
# installs, so resolve it rather than hardcoding the path.
CREATOR="$(find /var/folders -type d -path '*/skills/skill-creator' 2>/dev/null | head -1)"
if [ -z "$CREATOR" ]; then
  echo "Could not find the skill-creator plugin directory. Is the plugin installed?" >&2
  exit 1
fi
echo "Using skill-creator at: $CREATOR"

cd "$CREATOR"
python3 -m scripts.run_loop \
  --eval-set "$HERE/trigger-eval.json" \
  --skill-path "$HERE" \
  --model claude-opus-5 \
  --max-iterations 4 \
  --results-dir "$HERE/optimizer-results" \
  --verbose

echo
echo "Done. The winning description is 'best_description' in the JSON above,"
echo "and an HTML report opened in your browser. Paste the description back to"
echo "Claude and say: update the clear-handoff skill description to this."
