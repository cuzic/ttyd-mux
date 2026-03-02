#!/bin/zsh
# ttyd-mux shell integration for Zsh
#
# This script emits OSC 633 control sequences to enable block UI features.
# Source this file in your .zshrc or run it in your zsh session.
#
# OSC 633 Sequences (VS Code terminal integration compatible):
#   A - Prompt start
#   B - Prompt end (command start)
#   C - Pre-execution (right before command runs)
#   D;exitcode - Command finished with exit code
#   E;commandline - Explicit command line
#   P;Key=Value - Property (e.g., Cwd)
#
# Usage:
#   source /path/to/zsh.sh
#   # or add to .zshrc:
#   # if [ -n "$TTYD_MUX_NATIVE" ]; then source /path/to/zsh.sh; fi

# Only enable if running in ttyd-mux native terminal
# The terminal sets TTYD_MUX_NATIVE=1
if [[ -z "$TTYD_MUX_NATIVE" ]]; then
    return 2>/dev/null || exit 0
fi

# Prevent double-sourcing
if [[ -n "$__TTYD_MUX_SHELL_INTEGRATION__" ]]; then
    return 2>/dev/null || exit 0
fi
export __TTYD_MUX_SHELL_INTEGRATION__=1

# OSC escape sequence helpers
__ttyd_mux_osc_633() {
    printf '\033]633;%s\007' "$1"
}

# Send current working directory
__ttyd_mux_send_cwd() {
    __ttyd_mux_osc_633 "P;Cwd=$PWD"
}

# Prompt start (A)
__ttyd_mux_prompt_start() {
    __ttyd_mux_osc_633 "A"
}

# Prompt end / command start (B)
__ttyd_mux_prompt_end() {
    __ttyd_mux_osc_633 "B"
}

# Pre-execution (C) - right before command runs
# Also sends the command line (E)
__ttyd_mux_preexec() {
    local cmd="$1"
    # Escape special characters in the command
    cmd="${cmd//\\/\\\\}"
    cmd="${cmd//$'\n'/\\n}"
    cmd="${cmd//;/\\;}"
    __ttyd_mux_osc_633 "E;$cmd"
    __ttyd_mux_osc_633 "C"
}

# Command finished (D;exitcode) and prompt start (A)
__ttyd_mux_precmd() {
    local exit_code=$?
    __ttyd_mux_osc_633 "D;$exit_code"
    __ttyd_mux_send_cwd
    __ttyd_mux_prompt_start
}

# Add hooks to zsh
autoload -Uz add-zsh-hook

add-zsh-hook precmd __ttyd_mux_precmd
add-zsh-hook preexec __ttyd_mux_preexec

# Add prompt end marker to PROMPT
# Using %{ %} for zsh prompt escaping (doesn't count towards prompt length)
__ttyd_mux_setup_prompt() {
    # Check if prompt end marker is already in PROMPT
    if [[ "$PROMPT" != *'%{]633;B%}'* ]]; then
        # Append the prompt end marker
        PROMPT="${PROMPT}%{$(printf '\033]633;B\007')%}"
    fi
}

# Handle RPROMPT similarly if present
__ttyd_mux_setup_rprompt() {
    if [[ -n "$RPROMPT" && "$RPROMPT" != *'%{]633;'* ]]; then
        # RPROMPT doesn't need special handling for block UI
        :
    fi
}

# Send initial state
__ttyd_mux_send_cwd
__ttyd_mux_prompt_start

# Setup prompts
__ttyd_mux_setup_prompt

# Re-setup prompt on precmd in case prompt managers change it
add-zsh-hook precmd __ttyd_mux_setup_prompt
