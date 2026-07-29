#!/bin/bash
# Sincroniza skills del proyecto con commits PINNEADOS (sin HEAD flotante).
# Pins: .cursor/skill-pins.json
# - https://github.com/evanca/flutter-ai-rules → .skills/
# - https://github.com/emilkowalski/skill → .skills/emil-design-eng/
# - https://github.com/Leonxlnx/taste-skill → .cursor/skills/* (+ taste/redesign en .skills/)
# - https://github.com/pbakaus/impeccable → .cursor/skills/impeccable/
# Fallback sin red: .skills-vendor/ y .cursor/skills-vendor/

set -euo pipefail

flutter_repo="https://github.com/evanca/flutter-ai-rules.git"
emil_repo="https://github.com/emilkowalski/skill.git"
taste_repo="https://github.com/Leonxlnx/taste-skill.git"
impeccable_repo="https://github.com/pbakaus/impeccable.git"
pins_file=".cursor/skill-pins.json"
flutter_cache=".skills/.flutter-ai-rules-head"
emil_cache=".skills/.emil-skill-head"
taste_cache=".cursor/.taste-skill-head"
impeccable_cache=".cursor/.impeccable-skill-head"
tmp_dir=""

taste_skills_in_dot_skills=(
  taste-skill
  redesign-skill
  gpt-tasteskill
)

cleanup() {
  if [[ -n "${tmp_dir:-}" && -d "$tmp_dir" ]]; then
    rm -rf "$tmp_dir"
  fi
}
trap cleanup EXIT

mkdir -p .skills .cursor/skills

# Copia árbol sin seguir symlinks (evita escape de path).
safe_copy_tree() {
  local src="$1" dest="$2"
  mkdir -p "$dest"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete --safe-links --exclude '.git' "$src"/ "$dest"/
  else
    # Fallback: find + cp -P (no dereference)
    (
      cd "$src"
      find . -type d -exec mkdir -p "$dest/{}" \;
      find . \( -type f -o -type l \) -exec cp -P {} "$dest/{}" \;
    )
  fi
}

read_pin() {
  local key="$1"
  if [[ ! -f "$pins_file" ]]; then
    echo "sync-skills: falta $pins_file — no se clona remoto (solo vendor fallback)" >&2
    return 1
  fi
  # JSON mínimo sin jq: "key": "sha"
  local sha
  sha="$(grep -E "\"$key\"" "$pins_file" | head -1 | sed -E 's/.*:[[:space:]]*\"([0-9a-fA-F]+)\".*/\1/')"
  if [[ ! "$sha" =~ ^[0-9a-fA-F]{40}$ ]]; then
    echo "sync-skills: pin inválido para $key" >&2
    return 1
  fi
  printf '%s' "$sha"
}

cached_head() {
  local f="$1"
  if [[ -f "$f" ]]; then
    tr -d '\n\r' < "$f"
  fi
}

needs_sync() {
  local pin="$1" cache="$2"
  local local
  local="$(cached_head "$cache")"
  [[ "$pin" != "$local" ]]
}

ensure_tmp() {
  if [[ -z "${tmp_dir:-}" ]]; then
    tmp_dir="$(mktemp -d)"
  fi
}

# Clone shallow + checkout commit pinneado; verifica SHA.
clone_pinned() {
  local repo="$1" dest="$2" pin="$3"
  git -c core.hooksPath=/dev/null clone --filter=blob:none --no-checkout "$repo" "$dest"
  git -C "$dest" -c core.hooksPath=/dev/null fetch --depth 1 origin "$pin"
  git -C "$dest" -c core.hooksPath=/dev/null checkout --force "$pin"
  local got
  got="$(git -C "$dest" rev-parse HEAD)"
  if [[ "$got" != "$pin" ]]; then
    echo "sync-skills: SHA mismatch want=$pin got=$got" >&2
    return 1
  fi
}

sync_flutter_ai_rules() {
  local pin
  pin="$(read_pin flutter-ai-rules)" || return 0

  tmp_dir="$(mktemp -d)"
  clone_pinned "$flutter_repo" "$tmp_dir/flutter" "$pin"
  safe_copy_tree "$tmp_dir/flutter/skills" .skills
  printf '%s\n' "$pin" > "$flutter_cache"
  rm -rf "$tmp_dir"
  tmp_dir=""
}

sync_emil_design_eng() {
  local pin
  pin="$(read_pin emil-skill)" || return 0

  ensure_tmp
  clone_pinned "$emil_repo" "$tmp_dir/emil" "$pin"
  rm -rf .skills/emil-design-eng
  safe_copy_tree "$tmp_dir/emil/skills/emil-design-eng" .skills/emil-design-eng
  printf '%s\n' "$pin" > "$emil_cache"
}

sync_taste_skills() {
  local pin name skill_dir
  pin="$(read_pin taste-skill)" || return 0

  ensure_tmp
  if [[ ! -d "$tmp_dir/taste" ]]; then
    clone_pinned "$taste_repo" "$tmp_dir/taste" "$pin"
  fi
  if [[ ! -d "$tmp_dir/taste/skills" ]]; then
    echo "sync-skills: taste-skill sin carpeta skills/" >&2
    return 1
  fi

  for skill_dir in "$tmp_dir/taste/skills"/*/; do
    [[ -d "$skill_dir" ]] || continue
    [[ -f "$skill_dir/SKILL.md" ]] || continue
    name="$(basename "$skill_dir")"
    rm -rf ".cursor/skills/$name"
    safe_copy_tree "$skill_dir" ".cursor/skills/$name"
  done

  for name in "${taste_skills_in_dot_skills[@]}"; do
    if [[ -d "$tmp_dir/taste/skills/$name" ]]; then
      rm -rf ".skills/$name"
      safe_copy_tree "$tmp_dir/taste/skills/$name" ".skills/$name"
    fi
  done

  printf '%s\n' "$pin" > "$taste_cache"
}

sync_impeccable() {
  local pin
  pin="$(read_pin impeccable)" || return 0

  ensure_tmp
  if [[ ! -d "$tmp_dir/impeccable" ]]; then
    clone_pinned "$impeccable_repo" "$tmp_dir/impeccable" "$pin"
  fi
  if [[ ! -d "$tmp_dir/impeccable/.cursor/skills/impeccable" ]]; then
    echo "sync-skills: impeccable sin .cursor/skills/impeccable" >&2
    return 1
  fi
  rm -rf .cursor/skills/impeccable
  safe_copy_tree "$tmp_dir/impeccable/.cursor/skills/impeccable" .cursor/skills/impeccable
  printf '%s\n' "$pin" > "$impeccable_cache"
}

sync_dot_skills_vendor_fallback() {
  [[ -d .skills-vendor ]] || return 0
  for vendored in .skills-vendor/*/; do
    [[ -d "$vendored" ]] || continue
    local name
    name="$(basename "$vendored")"
    [[ -f "$vendored/SKILL.md" ]] || continue
    if [[ ! -f ".skills/$name/SKILL.md" ]]; then
      rm -rf ".skills/$name"
      safe_copy_tree "$vendored" ".skills/$name"
    fi
  done
}

sync_cursor_skills_vendor_fallback() {
  local src
  for src in .cursor/skills-vendor/*/; do
    [[ -d "$src" ]] || continue
    local name
    name="$(basename "$src")"
    [[ -f "$src/SKILL.md" ]] || continue
    if [[ ! -f ".cursor/skills/$name/SKILL.md" ]]; then
      rm -rf ".cursor/skills/$name"
      safe_copy_tree "$src" ".cursor/skills/$name"
    fi
  done
}

restore_dot_skills_after_flutter() {
  local name
  if [[ ! -f .skills/emil-design-eng/SKILL.md ]]; then
    sync_emil_design_eng || true
  fi
  for name in "${taste_skills_in_dot_skills[@]}"; do
    if [[ -d ".cursor/skills/$name" ]]; then
      rm -rf ".skills/$name"
      safe_copy_tree ".cursor/skills/$name" ".skills/$name"
    fi
  done
}

flutter_pin="$(read_pin flutter-ai-rules 2>/dev/null || true)"
emil_pin="$(read_pin emil-skill 2>/dev/null || true)"
taste_pin="$(read_pin taste-skill 2>/dev/null || true)"
impeccable_pin="$(read_pin impeccable 2>/dev/null || true)"

flutter_stale=0
emil_stale=0
taste_stale=0
impeccable_stale=0
if [[ -n "${flutter_pin:-}" ]] && needs_sync "$flutter_pin" "$flutter_cache"; then flutter_stale=1; fi
if [[ -n "${emil_pin:-}" ]] && needs_sync "$emil_pin" "$emil_cache"; then emil_stale=1; fi
if [[ -n "${taste_pin:-}" ]] && needs_sync "$taste_pin" "$taste_cache"; then taste_stale=1; fi
if [[ -n "${impeccable_pin:-}" ]] && needs_sync "$impeccable_pin" "$impeccable_cache"; then impeccable_stale=1; fi

if [[ "$flutter_stale" -eq 0 && "$emil_stale" -eq 0 && "$taste_stale" -eq 0 && "$impeccable_stale" -eq 0 ]]; then
  exit 0
fi

if [[ "$flutter_stale" -eq 1 ]]; then
  sync_flutter_ai_rules
fi

if [[ "$emil_stale" -eq 1 ]]; then
  sync_emil_design_eng
fi

if [[ "$taste_stale" -eq 1 ]]; then
  sync_taste_skills
fi

if [[ "$impeccable_stale" -eq 1 ]]; then
  sync_impeccable
fi

if [[ "$flutter_stale" -eq 1 ]]; then
  restore_dot_skills_after_flutter
fi

sync_dot_skills_vendor_fallback
sync_cursor_skills_vendor_fallback
