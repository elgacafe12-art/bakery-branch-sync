// Synthesized notification tones via Web Audio API.
// Distinct patterns per priority; no external assets required.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx?.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function beep(freq: number, durationMs: number, when: number, type: OscillatorType = "sine", gain = 0.15) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + when);
  g.gain.setValueAtTime(0, c.currentTime + when);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + when + durationMs / 1000);
  osc.connect(g).connect(c.destination);
  osc.start(c.currentTime + when);
  osc.stop(c.currentTime + when + durationMs / 1000 + 0.05);
}

export type SoundPriority = "critical" | "normal" | "reminder";

export function playNotificationSound(priority: SoundPriority = "normal") {
  const c = getCtx();
  if (!c) return;
  if (priority === "critical") {
    // Two urgent high beeps
    beep(880, 180, 0, "square", 0.18);
    beep(660, 180, 0.22, "square", 0.18);
    beep(880, 260, 0.46, "square", 0.2);
  } else if (priority === "reminder") {
    // Soft two-tone
    beep(520, 160, 0, "triangle", 0.12);
    beep(440, 200, 0.18, "triangle", 0.12);
  } else {
    // Pleasant ascending chime
    beep(660, 140, 0, "sine", 0.14);
    beep(880, 220, 0.14, "sine", 0.14);
  }
}

// Some browsers require a user gesture before the AudioContext will play.
export function primeAudio() {
  getCtx();
}
