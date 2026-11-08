#!/usr/bin/env bash
set -euo pipefail
zephyr_dir="${ZEPHYR_HOME:-$HOME/.cache/applyflow-zephyr}"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec "$zephyr_dir/llama.cpp/build/bin/llama-server" -m "$zephyr_dir/model.gguf" --host 127.0.0.1 --port 8081 -c 4096 -t 2 -np 1 --alias zephyr --jinja --chat-template-file "$script_dir/zephyr-chat.jinja" --no-cache-prompt --log-disable
