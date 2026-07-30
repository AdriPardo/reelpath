#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PY="${GRAPHIFY_PYTHON:-$HOME/Library/Application Support/pipx/venvs/graphifyy/bin/python}"
if [[ ! -x "$PY" ]]; then
  PY="$(command -v python3)"
fi
exec "$PY" - <<'PY'
import json
from pathlib import Path
from networkx.readwrite import json_graph
from graphify.export import to_obsidian, to_canvas

analysis = json.loads(Path("graphify-out/.graphify_analysis.json").read_text())
labels_raw = (
    json.loads(Path("graphify-out/.graphify_labels.json").read_text())
    if Path("graphify-out/.graphify_labels.json").exists()
    else {}
)
data = json.loads(Path("graphify-out/graph.json").read_text())
try:
    G = json_graph.node_link_graph(data, edges="links")
except TypeError:
    G = json_graph.node_link_graph(data)

communities = {int(k): v for k, v in analysis["communities"].items()}
cohesion = {int(k): v for k, v in analysis.get("cohesion", {}).items()}
labels = {int(k): v for k, v in labels_raw.items()}

out = Path("graphify-out/obsidian")
out.mkdir(parents=True, exist_ok=True)
(out / ".obsidian").mkdir(exist_ok=True)
(out / ".obsidian" / "app.json").write_text(
    json.dumps({"graphShowOrphans": False, "alwaysUpdateLinks": True}, indent=2)
)
(out / ".obsidian" / "core-plugins.json").write_text(
    json.dumps(
        {
            "file-explorer": True,
            "global-search": True,
            "graph": True,
            "backlink": True,
            "outgoing-link": True,
            "tag-pane": True,
            "page-preview": True,
            "canvas": True,
            "command-palette": True,
        },
        indent=2,
    )
)

n = to_obsidian(
    G,
    communities,
    str(out),
    community_labels=labels or None,
    cohesion=cohesion or None,
)
to_canvas(G, communities, str(out / "graph.canvas"), community_labels=labels or None)
print(f"Obsidian vault: {n} notes in graphify-out/obsidian/")
print("Open that folder as a vault in Obsidian.")
PY
