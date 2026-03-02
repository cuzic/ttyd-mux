#!/bin/bash
# ttyd-mux shell integration for Bash
#
# This script emits OSC 633 control sequences to enable block UI features.
# Source this file in your .bashrc or run it in your bash session.
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
#   source /path/to/bash.sh
#   # or add to .bashrc:
#   # if [ -n "$TTYD_MUX_NATIVE" ]; then source /path/to/bash.sh; fi

# Only enable if running in ttyd-mux native terminal
# The terminal sets TTYD_MUX_NATIVE=1
if [ -z "$TTYD_MUX_NATIVE" ]; then
    return 2>/dev/null || exit 0
fi

# Prevent double-sourcing
if [ -n "$__TTYD_MUX_SHELL_INTEGRATION__" ]; then
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
__ttyd_mux_preexec() {
    __ttyd_mux_osc_633 "C"
}

# Command finished (D;exitcode)
__ttyd_mux_precmd() {
    local exit_code=$?
    __ttyd_mux_osc_633 "D;$exit_code"
    __ttyd_mux_send_cwd
    __ttyd_mux_prompt_start
}

# Send command line (E;commandline)
__ttyd_mux_send_command() {
    local cmd="$1"
    # Escape special characters in the command
    cmd="${cmd//\\/\\\\}"
    cmd="${cmd//$'\n'/\\n}"
    cmd="${cmd//;/\\;}"
    __ttyd_mux_osc_633 "E;$cmd"
}

# Store the original PROMPT_COMMAND
__ttyd_mux_original_prompt_command="$PROMPT_COMMAND"

# Set up precmd (runs before each prompt)
PROMPT_COMMAND='__ttyd_mux_precmd; '"$__ttyd_mux_original_prompt_command"

# DEBUG trap for preexec (runs before each command)
# This captures the command being executed
__ttyd_mux_debug_trap() {
    # Skip if not the first command in the pipeline
    if [ -n "$COMP_LINE" ]; then
        return
    fi

    # Skip if this is a prompt command
    if [[ "$BASH_COMMAND" == "__ttyd_mux_precmd"* ]]; then
        return
    fi

    # Get the current command
    local current_command="$BASH_COMMAND"

    # Send the command line
    __ttyd_mux_send_command "$current_command"

    # Signal pre-execution
    __ttyd_mux_preexec
}

# Set up the DEBUG trap
trap '__ttyd_mux_debug_trap' DEBUG

# Modify PS1 to include prompt end marker
# This runs after PS1 is displayed but before user input
__ttyd_mux_setup_ps1() {
    # Append prompt end marker to PS1 if not already there
    if [[ "$PS1" != *'\[\033]633;B\007\]'* ]]; then
        PS1="${PS1}\[\033]633;B\007\]"
    fi
}

# Send initial state
__ttyd_mux_send_cwd
__ttyd_mux_prompt_start
__ttyd_mux_setup_ps1

# Re-setup PS1 if it changes (e.g., by starship or other prompt tools)
PROMPT_COMMAND="$PROMPT_COMMAND"'; __ttyd_mux_setup_ps1'
