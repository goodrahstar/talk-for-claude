---
name: talk
description: Speak Claude's previous reply out loud, rewritten for listening, with a local Kokoro-82M voice on your Mac.
argument-hint: "[stop | setup | short | what to focus on]"
disable-model-invocation: true
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/talk *), Bash("${CLAUDE_PLUGIN_ROOT}/bin/talk" *)
---

Speak your previous reply to the user out loud so they can listen instead of read.

The talk tool is `"${CLAUDE_PLUGIN_ROOT}/bin/talk"`. Always call it by that full quoted path.

Arguments: "$ARGUMENTS"

## 0. Handle control arguments

- `stop`: run `"${CLAUDE_PLUGIN_ROOT}/bin/talk" --stop`, reply with one line, stop.
- `setup`: run `"${CLAUDE_PLUGIN_ROOT}/bin/talk" --setup` with a 600000 ms timeout, then report the last line it printed.

## 1. Make sure the voice is installed

Run `"${CLAUDE_PLUGIN_ROOT}/bin/talk" --doctor`.

- `READY`: continue.
- `NOT_READY`: tell the user in one line that this is a one-time setup of about 2 to 4 minutes, then run `"${CLAUDE_PLUGIN_ROOT}/bin/talk" --setup` with a 600000 ms timeout. If it fails, show the error line and stop. It needs an Apple Silicon Mac and `uv` (`brew install uv`).

## 2. Pick the text

Take YOUR most recent reply before this command: your own message text, not tool output, not this command. If there is no earlier reply, say so in one line and stop.

## 3. Rewrite it for the ear

Write a spoken version. It must sound like a calm, friendly person talking, not a document being read.

- Open with the main point or the next action, in one plain sentence.
- First person and contractions: "I fixed...", "you'll want to...".
- Short sentences. Commas and full stops make the pauses, so use them.
- No markdown at all: no bullets, headings, bold, tables, emoji, arrows or symbols.
- Lists become speech: "First..., then..., and last...". At most four items; group the rest.
- Tables: say the two or three rows that matter, in words.
- Never read code, commands, file paths or URLs character by character. Say what they do: "run the test command", "the config file". Name a file only when needed, the way a person would ("server dot js").
- Spell out units and abbreviations: "gigabytes", "milliseconds", "for example". Round numbers the way people speak them.
- Roughly 40 to 200 words. If the reply was long, cover only what matters most and end with "the details are on screen".
- If the arguments ask for a focus (for example `short` or `just the steps`), follow it.
- Do not add facts, opinions or advice that were not in the original reply.

## 4. Speak it

Run this with the Bash tool, replacing the placeholder with your spoken version. Keep the quoted heredoc marker exactly as shown so the shell does not interpret the text:

```
"${CLAUDE_PLUGIN_ROOT}/bin/talk" <<'TALK_EOF'
<spoken version here>
TALK_EOF
```

It returns immediately and plays in the background. A new `/talk` interrupts the previous one.

Then reply with one short line only, for example: "Speaking now, about 40 seconds. `/talk stop` to stop." Do not print the spoken text in chat.
