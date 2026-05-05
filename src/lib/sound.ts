// Lightweight WebAudio sounds — no assets needed.
let ctx: AudioContext | null = null;
function ac() {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.08) {
  const a = ac(); if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(gain, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start(); o.stop(a.currentTime + dur);
}

export const sfx = {
  click: () => tone(880, 0.06, "square", 0.04),
  place: () => { tone(520, 0.08, "triangle", 0.05); setTimeout(() => tone(720, 0.08, "triangle", 0.05), 60); },
  miss: () => tone(220, 0.18, "sine", 0.06),
  hit: () => { tone(180, 0.12, "sawtooth", 0.1); setTimeout(() => tone(90, 0.18, "sawtooth", 0.1), 80); },
  sunk: () => {
    const a = ac(); if (!a) return;
    [400, 300, 200, 120].forEach((f, i) => setTimeout(() => tone(f, 0.18, "sawtooth", 0.12), i * 90));
  },
  win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.2, "triangle", 0.08), i * 110)),
  lose: () => [330, 247, 196, 165].forEach((f, i) => setTimeout(() => tone(f, 0.25, "sine", 0.08), i * 140)),
};
