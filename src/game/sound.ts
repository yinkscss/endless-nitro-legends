// Small game sounds made in the browser, so a game has sound with no audio files to download.
// Browsers only allow sound after the player has tapped or pressed something; before that these do nothing.

let audio: AudioContext | null = null;
let muted = false;

try {
  muted = window.localStorage.getItem("game-muted") === "1";
} catch {
  /* storage is blocked: sound stays on */
}

function context(): AudioContext | null {
  if (muted) return null;
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    return audio;
  } catch {
    return null;
  }
}

/** One note. frequency in Hz, seconds long. slideTo bends the pitch (up for a jump, down for a hit). */
export function tone(frequency: number, seconds = 0.12, options: { type?: OscillatorType; slideTo?: number; volume?: number; delay?: number } = {}) {
  const ctx = context();
  if (!ctx) return;
  const start = ctx.currentTime + (options.delay ?? 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = options.type ?? "square";
  osc.frequency.setValueAtTime(frequency, start);
  if (options.slideTo) osc.frequency.exponentialRampToValueAtTime(options.slideTo, start + seconds);
  gain.gain.setValueAtTime(options.volume ?? 0.12, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + seconds);
}

/** Ready-made sounds. Call them from the game: sfx.jump(), sfx.coin(). */
export const sfx = {
  jump: () => tone(320, 0.14, { slideTo: 640 }),
  coin: () => {
    tone(880, 0.07);
    tone(1320, 0.12, { delay: 0.07 });
  },
  hit: () => tone(200, 0.2, { type: "sawtooth", slideTo: 60 }),
  tap: () => tone(520, 0.05, { type: "triangle" }),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, { delay: i * 0.1, type: "triangle" })),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.18, { delay: i * 0.13, type: "triangle" })),
};

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    window.localStorage.setItem("game-muted", value ? "1" : "0");
  } catch {
    /* fine */
  }
}
