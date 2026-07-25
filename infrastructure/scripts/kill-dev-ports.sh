#!/usr/bin/env bash
# Libera puertos y procesos huérfanos de AutoTube en desarrollo local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

kill_port() {
  local port=$1
  local pids
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Liberando puerto $port (PID: $pids)"
    kill -TERM $pids 2>/dev/null || true
    sleep 0.3
    kill -9 $pids 2>/dev/null || true
  fi
}

for port in 4000 3000 3001; do
  kill_port "$port"
done

# tsx watch / concurrently que quedaron colgados tras Ctrl+C
patterns=(
  "concurrently.*autotube"
  "tsx watch.*autotube/backend/api"
  "tsx watch.*autotube/worker"
  "dotenv.*tsx watch.*index.ts"
)

for pattern in "${patterns[@]}"; do
  pids=$(pgrep -f "$pattern" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Terminando procesos huérfanos: $pids"
    kill -TERM $pids 2>/dev/null || true
    sleep 0.5
    kill -9 $pids 2>/dev/null || true
  fi
done

echo "Puertos y procesos dev listos."
