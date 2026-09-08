#!/usr/bin/env bash

if [[ ${1:-} == route ]]; then
    shift
    exec "${WANGLAB_RELAY_NODE:-node}" "$HOME/.local/lib/wanglab-model-relays/cli.mjs" "$@"
fi

# CC Switch 5.9.3 drops bracketed paste events in its terminal input reducer.
if [[ -t 0 && -t 1 ]]; then
    printf '\033[?2004l' > /dev/tty 2>/dev/null || true
fi

exec -a cc-switch "$HOME/.local/lib/cc-switch/cc-switch-bin" "$@"
