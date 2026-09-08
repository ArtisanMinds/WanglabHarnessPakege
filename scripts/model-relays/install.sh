#!/usr/bin/env bash
set -euo pipefail
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
destination="$HOME/.local/lib/wanglab-model-relays"
bin_dir="$HOME/.local/bin"
backup_dir="$HOME/.local/state/wanglab-model-relays/backups/$(date +%Y%m%d-%H%M%S)-$$"

test -x "$HOME/.local/lib/cc-switch/cc-switch-bin"
node --input-type=module -e 'import { DatabaseSync } from "node:sqlite"; if (typeof DatabaseSync !== "function") process.exit(1);'
npm ci --prefix "$source_dir" --ignore-scripts --no-audit --no-fund
npm test --prefix "$source_dir"
install -d -m 0700 "$backup_dir"
for file in "$bin_dir/cc-switch" "$bin_dir/wanglab-local-model-relays.mjs"; do
    if [[ -f $file ]]; then cp -p -- "$file" "$backup_dir/"; fi
done
if [[ -d $destination ]]; then cp -a -- "$destination" "$backup_dir/library"; fi

install -d -m 0755 "$destination" "$bin_dir"
for file in providers.mjs relay.mjs cli.mjs package.json package-lock.json; do
    install -m 0644 "$source_dir/$file" "$destination/$file"
done
npm ci --prefix "$destination" --ignore-scripts --no-audit --no-fund
install -m 0755 "$source_dir/entry.mjs" "$bin_dir/wanglab-local-model-relays.mjs"
install -m 0755 "$source_dir/cc-switch-wrapper.sh" "$bin_dir/cc-switch"
systemctl --user restart wanglab-local-model-relays.service
ready=false
for attempt in {1..20}; do
    if curl --fail --silent --max-time 2 http://127.0.0.1:15724/health >/dev/null &&
       curl --fail --silent --max-time 2 http://127.0.0.1:15725/health >/dev/null &&
       curl --fail --silent --max-time 2 http://127.0.0.1:15726/health >/dev/null; then
        ready=true
        break
    fi
    sleep 1
done
if ! $ready; then
    echo "Relay health check failed. Previous files: $backup_dir" >&2
    exit 1
fi
echo "Model routes installed. Previous files: $backup_dir"
echo 'Select suppliers: cc-switch route deepseek / cc-switch route grok'
