---
name: talk
description: Use when the user says "talk", "/talk", "read it out", "say it out loud" or "I'd rather listen". Rewrites Claude's previous reply for listening and gives a one-tap player that speaks it in the browser (Kokoro-82M, with the device voice as fallback).
---

# talk (claude.ai version)

The user wants to listen to your previous reply instead of reading it.

## 1. Pick the text

Take YOUR most recent reply before this request: your own message, not tool output. If there is no earlier reply, say so in one line and stop. If the user named a focus ("short", "just the steps"), follow it.

## 2. Rewrite it for the ear

- Open with the main point or the next action, in one plain sentence.
- First person and contractions. Short sentences. Commas and full stops make the pauses.
- No markdown: no bullets, headings, bold, tables, emoji, arrows or symbols.
- Lists become speech: "First..., then..., and last...". At most four items.
- Tables: say the two or three rows that matter, in words.
- Never read code, commands, file paths or URLs character by character. Say what they do.
- Spell out units and abbreviations. Round numbers the way people speak them.
- Roughly 40 to 200 words. If the reply was long, cover what matters most and end with "the details are above".
- Do not add facts, opinions or advice that were not in the original reply.

## 3. Build the player

Read `player.html` from this skill's folder. Replace the string `"__TALK_TEXT__"` (including its quotes) with your spoken version encoded as a JSON string, with every `</` escaped so it cannot close the script tag. In Python:

```python
import json, pathlib
html = pathlib.Path("player.html").read_text()
encoded = json.dumps(spoken_text).replace("</", "<\\/")
html = html.replace('"__TALK_TEXT__"', encoded, 1)
```

Change nothing else in the file.

Show the result as an HTML artifact titled "Talk".

## 4. Reply

One short line only: "Press Play to listen." Do not repeat the spoken text in chat.
