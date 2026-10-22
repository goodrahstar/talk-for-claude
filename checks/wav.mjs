// Minimal WAV reader shared by the gate checks: PCM16 or float32.
import { readFileSync } from "node:fs";

export function readWav(path) {
  const fail = (m) => { throw new Error(m); };
  const b = readFileSync(path);
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WAVE") fail("not a WAV file");
  let off = 12, fmt, data;
  while (off + 8 <= b.length) {
    const id = b.toString("ascii", off, off + 4), size = b.readUInt32LE(off + 4);
    if (id === "fmt ") fmt = { code: b.readUInt16LE(off + 8), ch: b.readUInt16LE(off + 10), sr: b.readUInt32LE(off + 12), bits: b.readUInt16LE(off + 22) };
    if (id === "data") data = b.subarray(off + 8, off + 8 + size);
    off += 8 + size + (size % 2);
  }
  if (!fmt || !data) fail("WAV missing fmt or data chunk");
  const bytes = fmt.bits / 8, n = Math.floor(data.length / bytes);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = fmt.code === 3 ? data.readFloatLE(i * bytes) : data.readInt16LE(i * bytes) / 32768;
    sum += v * v;
  }
  return { sampleRate: fmt.sr, seconds: n / fmt.ch / fmt.sr, rms: Math.sqrt(sum / Math.max(1, n)) };
}

