"""talk: speak text aloud on this Mac with the local Kokoro-82M model.

Usage:
  talk "some text"            speak in the background, return immediately
  echo "text" | talk          same, text from stdin
  talk --stop                 stop whatever is playing
  talk --out f.wav --no-play  synthesize to a file only (foreground)
  talk --print-clean          print the cleaned text and exit (no audio)

Env: TALK_VOICE (default af_heart), TALK_SPEED (default 1.05).
"""

import argparse
import os
import re
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path

DATA = Path(os.environ.get("TALK_HOME", Path.home() / ".claude-talk"))
DATA.mkdir(parents=True, exist_ok=True)
PID_FILE = DATA / "play.pid"
LOG_FILE = DATA / "talk.log"
MODEL_ID = "mlx-community/Kokoro-82M-bf16"
VOICE = os.environ.get("TALK_VOICE", "af_heart")
SPEED = float(os.environ.get("TALK_SPEED", "1.05"))

EMOJI = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF⬀-⯿️‍]"
)


def clean(text: str) -> str:
    """Safety net: strip anything that sounds bad when read by a TTS model."""
    t = text.replace("\r\n", "\n")
    t = re.sub(r"```.*?```", " ", t, flags=re.S)  # fenced code blocks
    t = re.sub(r"!\[([^\]]*)\]\([^)]*\)", r"\1", t)  # images -> alt text
    t = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", t)  # links -> link text
    t = re.sub(r"https?://\S+", "a link", t)
    t = re.sub(r"`([^`]*)`", r"\1", t)  # inline code -> its text
    t = re.sub(r"^\s*\|?\s*:?-{3,}.*$", " ", t, flags=re.M)  # table rules
    t = t.replace("|", ", ")
    t = re.sub(r"^\s{0,3}#{1,6}\s*", "", t, flags=re.M)  # headings
    t = re.sub(r"^\s*>\s?", "", t, flags=re.M)  # quotes
    t = re.sub(r"^\s*(?:[-*+•]|\d+[.)])\s+", "", t, flags=re.M)  # list markers
    t = re.sub(r"(\*\*|__|\*|~~)", "", t)  # emphasis
    t = re.sub(r"(?<!\w)_(?!\w)", " ", t)
    t = EMOJI.sub("", t)
    t = re.sub(r"[✅⏳❌→←↑↓]", " ", t)
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r" *\n *", "\n", t)
    t = re.sub(r"\n{2,}", "\n", t)
    return t.strip()


def stop() -> bool:
    """Kill the background speaker (its whole process group). Returns True if one was running."""
    try:
        pid = int(PID_FILE.read_text().strip())
    except (OSError, ValueError):
        return False
    try:
        os.killpg(pid, signal.SIGTERM)
        stopped = True
    except ProcessLookupError:
        stopped = False
    try:
        PID_FILE.unlink()
    except OSError:
        pass
    return stopped


def _hub_cache() -> Path:
    try:
        from huggingface_hub.constants import HF_HUB_CACHE

        return Path(HF_HUB_CACHE)
    except Exception:
        return Path.home() / ".cache/huggingface/hub"


SNAPSHOTS = _hub_cache() / "models--mlx-community--Kokoro-82M-bf16" / "snapshots"


def load_model():
    if SNAPSHOTS.is_dir() and any(SNAPSHOTS.iterdir()):
        os.environ["HF_HUB_OFFLINE"] = "1"  # cached: never touch the network
    import warnings

    warnings.filterwarnings("ignore")
    from mlx_audio.tts.utils import load

    return load(MODEL_ID)


def voice_arg():
    # The pipeline otherwise fetches voices from a second repo (prince-canuma/Kokoro-82M);
    # the mlx-community snapshot already ships every voice, so point at it directly.
    for snap in sorted(SNAPSHOTS.glob("*")):
        f = snap / "voices" / f"{VOICE}.safetensors"
        if f.exists():
            return str(f)
    return VOICE


def synth_chunks(model, text):
    import numpy as np

    lang = VOICE[0] if VOICE[:1] in "abefhijpz" else "a"  # af_/am_ = US, bf_/bm_ = UK
    for r in model.generate(text, voice=voice_arg(), speed=SPEED, lang_code=lang, split_pattern=r"\n+"):
        yield np.asarray(r.audio).reshape(-1)


def write_wav(path, audio, sr):
    import soundfile as sf

    sf.write(str(path), audio, sr)


def run_worker(text_file: Path):
    """Background process: synthesize chunk by chunk and play each as soon as it is ready."""
    import queue
    import threading

    text = text_file.read_text()
    text_file.unlink(missing_ok=True)
    model = load_model()
    tmp = Path(tempfile.mkdtemp(prefix="talk-"))
    q: "queue.Queue[Path | None]" = queue.Queue()

    def player():
        while True:
            f = q.get()
            if f is None:
                return
            subprocess.run(["afplay", str(f)], check=False)
            f.unlink(missing_ok=True)

    t = threading.Thread(target=player)
    t.start()
    for i, audio in enumerate(synth_chunks(model, text)):
        f = tmp / f"{i:04d}.wav"
        write_wav(f, audio, model.sample_rate)
        q.put(f)
    q.put(None)
    t.join()
    try:
        tmp.rmdir()
    except OSError:
        pass
    try:
        if PID_FILE.read_text().strip() == str(os.getpid()):
            PID_FILE.unlink()
    except OSError:
        pass


def main():
    p = argparse.ArgumentParser(prog="talk", description="Speak text with local Kokoro-82M.")
    p.add_argument("text", nargs="*")
    p.add_argument("--stop", action="store_true", help="stop current playback")
    p.add_argument("--out", help="write a WAV file instead of playing")
    p.add_argument("--no-play", action="store_true", help="with --out: do not play")
    p.add_argument("--print-clean", action="store_true", help="print cleaned text and exit")
    p.add_argument("--_worker", help=argparse.SUPPRESS)
    a = p.parse_args()

    if a._worker:
        run_worker(Path(a._worker))
        return

    if a.stop:
        print("stopped" if stop() else "nothing playing")
        return

    raw = " ".join(a.text) if a.text else ("" if sys.stdin.isatty() else sys.stdin.read())
    text = clean(raw)
    if a.print_clean:
        print(text)
        return
    if not text:
        sys.exit("talk: no text to speak")

    if a.out:
        import numpy as np

        t0 = time.time()
        model = load_model()
        audio = np.concatenate(list(synth_chunks(model, text)))
        write_wav(a.out, audio, model.sample_rate)
        print(f"wrote {a.out} ({len(audio) / model.sample_rate:.1f}s audio in {time.time() - t0:.1f}s)")
        if not a.no_play:
            subprocess.run(["afplay", a.out], check=False)
        return

    stop()  # a new /talk interrupts the previous one
    fd, tf = tempfile.mkstemp(prefix="talk-", suffix=".txt")
    with os.fdopen(fd, "w") as f:
        f.write(text)
    log = open(LOG_FILE, "a")
    proc = subprocess.Popen(
        [sys.executable, "-I", str(Path(__file__).resolve()), "--_worker", tf],
        stdin=subprocess.DEVNULL,
        stdout=log,
        stderr=log,
        start_new_session=True,  # own process group, so --stop can kill player + afplay
        env={**os.environ, "PYTHONWARNINGS": "ignore"},
    )
    PID_FILE.write_text(str(proc.pid))
    words = len(text.split())
    print(f"speaking {words} words (about {max(1, round(words / 160 * 60))}s). Stop: talk --stop")


if __name__ == "__main__":
    main()
