#!/usr/bin/env bash
# Install the grill skill for Claude Code, Codex and any agent that reads ~/.agents/skills.
#
#   curl -fsSL https://raw.githubusercontent.com/DJGrey/grill/main/install.sh | bash
#
# Run it again to update. From a clone, ./install.sh links that clone instead.
#
#   --uninstall        remove the links and the Claude Code permission rule
#   --no-permissions   don't touch ~/.claude/settings.json
#
# What it does:
#   - clones the repo to ~/.grill (or updates it), unless you run it from a clone
#   - links skills/grill-ui into ~/.claude/skills, ~/.codex/skills and ~/.agents/skills
#   - allows the grill UI's script in ~/.claude/settings.json, so it opens without a prompt
set -euo pipefail

REPO_URL="${GRILL_REPO:-https://github.com/DJGrey/grill.git}"
CLONE_DIR="${GRILL_HOME:-$HOME/.grill}"

uninstall=false
permissions=true
for arg in "$@"; do
  case "$arg" in
    --uninstall) uninstall=true ;;
    --no-permissions) permissions=false ;;
    -h|--help) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option $arg" >&2; exit 2 ;;
  esac
done

say() { printf '%s\n' "$*"; }
warn() { printf '! %s\n' "$*" >&2; }

# ── find or fetch the repo ────────────────────────────────────────────────

self="${BASH_SOURCE[0]:-}"
if [ -n "$self" ] && [ -f "$self" ] && [ -f "$(dirname "$self")/skills/grill-ui/SKILL.md" ]; then
  repo="$(cd "$(dirname "$self")" && pwd)"
elif $uninstall; then
  repo="$CLONE_DIR"
else
  command -v git >/dev/null 2>&1 || { warn "git is missing. Install it, then run this again."; exit 1; }
  if [ -d "$CLONE_DIR/.git" ]; then
    say "Updating $CLONE_DIR"
    git -C "$CLONE_DIR" pull --ff-only --quiet
  else
    say "Downloading grill to $CLONE_DIR"
    git clone --quiet --depth 1 "$REPO_URL" "$CLONE_DIR"
  fi
  repo="$CLONE_DIR"
fi

skill="$repo/skills/grill-ui"
script="$skill/scripts/grill.mjs"

targets=()
for tool in "$HOME/.claude" "$HOME/.codex" "$HOME/.agents"; do
  [ -d "$tool" ] && targets+=("$tool/skills")
done
[ ${#targets[@]} -eq 0 ] && targets=("$HOME/.claude/skills")

# Both paths an agent might use to call the script: through the link, and the real one.
rules=("Bash(node $script:*)" "Bash(node $HOME/.claude/skills/grill-ui/scripts/grill.mjs:*)")

edit_permissions() { # add|remove
  local settings="$HOME/.claude/settings.json"
  $permissions || return 0
  [ -d "$HOME/.claude" ] || return 0
  command -v node >/dev/null 2>&1 || { warn "Skipped the Claude Code permission rule (needs node)."; return 0; }
  node - "$1" "$settings" "${rules[@]}" <<'JS' || warn "Couldn't update $settings. Claude Code will ask before it opens the grill UI."
const fs = require('fs');
const [mode, file, ...rules] = process.argv.slice(2);
let settings = {};
if (fs.existsSync(file)) {
  try { settings = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { console.error(`! ${file} isn't valid JSON, so it was left alone.`); process.exit(1); }
}
const allow = (settings.permissions ||= {}).allow ||= [];
const before = allow.length;
if (mode === 'add') allow.push(...rules.filter((r) => !allow.includes(r)));
else settings.permissions.allow = allow.filter((r) => !rules.includes(r));
if (settings.permissions.allow.length !== before) {
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`);
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  console.log(mode === 'add' ? `  allowed the grill UI in ${file}` : `  removed the grill UI rule from ${file}`);
}
JS
}

# ── uninstall ─────────────────────────────────────────────────────────────

if $uninstall; then
  for target in "${targets[@]}"; do
    link="$target/grill-ui"
    if [ -L "$link" ] && [ "$(readlink "$link")" = "$skill" ]; then rm "$link"; say "  removed $link"; fi
  done
  edit_permissions remove
  if [ "$repo" = "$CLONE_DIR" ]; then say "Uninstalled. Delete $CLONE_DIR to remove the files too."; else say "Uninstalled."; fi
  exit 0
fi

# ── install ───────────────────────────────────────────────────────────────

if command -v node >/dev/null 2>&1; then
  major="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$major" -lt 18 ]; then warn "Node $(node -v) is too old. The grill UI needs Node 18 or newer."; fi
else
  warn "Node is missing. The grill UI needs Node 18 or newer (https://nodejs.org, or brew install node)."
fi

chmod +x "$script"
# Before it was renamed, the skill was linked as "grill".
for target in "${targets[@]}"; do
  old="$target/grill"
  if [ -L "$old" ] && [ "$(readlink "$old")" = "$repo/skills/grill" ]; then rm "$old"; fi
done
backup="$HOME/.grill-backup/$(date +%Y%m%d-%H%M%S)"
for target in "${targets[@]}"; do
  mkdir -p "$target"
  link="$target/grill-ui"
  if [ -L "$link" ] && [ "$(readlink "$link")" = "$skill" ]; then say "  ok $link"; continue; fi
  if [ -L "$link" ]; then
    rm "$link"
  elif [ -e "$link" ]; then
    tool="$(basename "$(dirname "$target")")"
    mkdir -p "$backup/${tool#.}"
    mv "$link" "$backup/${tool#.}/"
    say "  moved your old $link to $backup"
  fi
  ln -s "$skill" "$link"
  say "  linked $link"
done
edit_permissions add

say ""
say "Done. Restart your agent, then ask it to grill you on something (or type /grill-ui in Claude Code)."
