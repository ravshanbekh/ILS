/**
 * Klaviatura ovozlari — Web Audio bilan brauzerda yaratiladi (fayl yo'q).
 * CodeType (github.com/itxona40-rgb/codetyping) beep() funksiyasidan ko'chirildi.
 *   kind: 0 — oddiy harf, 1 — xato, 2 — combo/rekord, 3 — probel, 4 — Enter
 */
export type SoundProfile = 'soft' | 'mech' | 'mem' | 'piano' | 'drop';
export const SOUND_PROFILES: [string, SoundProfile][] = [
  ['Yumshoq', 'soft'],
  ['Mexanik', 'mech'],
  ['Membrana', 'mem'],
  ['Melodiya', 'piano'],
  ['Tomchi', 'drop'],
];
const PN = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3];

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;

function ctx(volume: number) {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    ac = ac || new AC();
    if (ac.state === 'suspended') void ac.resume();
    if (!master) {
      master = ac.createGain();
      const cp = ac.createDynamicsCompressor();
      cp.threshold.value = -10;
      cp.knee.value = 12;
      cp.ratio.value = 4;
      master.connect(cp);
      cp.connect(ac.destination);
      noise = ac.createBuffer(1, (ac.sampleRate * 0.2) | 0, ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
    }
    master.gain.value = volume;
    return ac;
  } catch {
    return null;
  }
}

export function playKey(kind: 0 | 1 | 2 | 3 | 4, profile: SoundProfile, volume = 0.8, ch?: string) {
  const a = ctx(volume);
  if (!a || !master || !noise) return;
  const m = master;
  const nb = noise;
  const t0 = a.currentTime + 0.002;
  const j = () => 0.92 + Math.random() * 0.16;
  const tone = (ty: OscillatorType, f1: number, f2: number, d: number, v: number, dl = 0) => {
    const t = t0 + dl;
    const x = a.createOscillator();
    const g = a.createGain();
    x.type = ty;
    x.frequency.setValueAtTime(f1, t);
    if (f2 !== f1) x.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    x.connect(g);
    g.connect(m);
    x.start(t);
    x.stop(t + d + 0.02);
  };
  const nz = (ty: BiquadFilterType, f: number, q: number, d: number, v: number) => {
    const x = a.createBufferSource();
    const h = a.createBiquadFilter();
    const g = a.createGain();
    x.buffer = nb;
    h.type = ty;
    h.frequency.value = f;
    h.Q.value = q;
    g.gain.setValueAtTime(v, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    x.connect(h);
    h.connect(g);
    g.connect(m);
    x.start(t0, Math.random() * 0.1);
    x.stop(t0 + d + 0.01);
  };
  if (kind === 1) {
    tone('sine', 150 * j(), 85, 0.16, 0.3);
    nz('lowpass', 500, 0.7, 0.05, 0.12);
    return;
  }
  if (kind === 2) {
    [784, 988, 1319].forEach((f, k) => tone('sine', f, f, 0.3, 0.1, k * 0.07));
    return;
  }
  const sp = kind >= 3;
  if (profile === 'mech') {
    nz('bandpass', (sp ? 2000 : 3400) * j(), 1.1, 0.02, 0.28);
    tone('sine', (sp ? 150 : 270) * j(), sp ? 72 : 130, sp ? 0.11 : 0.065, 0.3);
  } else if (profile === 'mem') {
    nz('bandpass', 1900 * j(), 0.8, 0.04, sp ? 0.7 : 0.55);
    tone('triangle', (sp ? 260 : 420) * j(), sp ? 150 : 210, 0.06, 0.2);
  } else if (profile === 'piano') {
    const f = sp ? (kind === 4 ? 98 : 131) : PN[(ch ? ch.charCodeAt(0) : 0) % PN.length];
    tone('sine', f, f, sp ? 0.4 : 0.32, sp ? 0.28 : 0.2);
    tone('triangle', f * 2, f * 2, 0.18, 0.035);
  } else if (profile === 'drop') {
    const f = sp ? 380 : 600 + Math.random() * 350;
    tone('sine', f, f * 1.7, 0.09, 0.24);
  } else if (sp) {
    tone('sine', (kind === 4 ? 120 : 135) * j(), 62, 0.16, 0.45);
    nz('lowpass', 700, 0.7, 0.05, 0.2);
  } else {
    tone('sine', 200 * j(), 95, 0.09, 0.4);
    nz('lowpass', 1400, 0.7, 0.03, 0.18);
  }
}
