# Graphify + Obsidian

Knowledge graph del repo para Cursor (menos grepping a ciegas) y vault Obsidian.

## Requisitos

```bash
brew install python@3.12 pipx   # si hace falta
pipx install graphifyy
```

## Uso

```bash
graphify update .                         # rebuild AST (gratis)
./scripts/graphify-export-obsidian.sh     # vault en graphify-out/obsidian/
graphify query "auth cookie flow"
graphify path "loadConfig" "generateScript"
graphify god-nodes
```

- Cursor: regla `.cursor/rules/graphify.mdc` (`alwaysApply`)
- Hooks: post-commit / post-checkout regeneran el grafo
- Ignore: `.graphifyignore`

Abrir vault: Obsidian → **Open folder as vault** → `graphify-out/obsidian`.
