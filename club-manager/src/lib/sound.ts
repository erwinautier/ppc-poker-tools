/** Sons de l'horloge (Web Audio, sans fichier) et annonce vocale en français. */
let ctx: AudioContext | null = null;
const KEY = 'ppc-club-son';

export interface SoundPrefs { on: boolean; voice: boolean; volume: number }

export function soundPrefs(): SoundPrefs {
  try { return { on: false, voice: true, volume: 0.7, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; }
  catch { return { on: false, voice: true, volume: 0.7 }; }
}
export function saveSoundPrefs(p: SoundPrefs) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* préférence perdue, sans gravité */ }
}
/** À appeler depuis un clic : les navigateurs bloquent le son sinon. */
export function unlock() {
  ctx ??= new AudioContext();
  void ctx.resume();
}

function beep(freq: number, dur: number, delay: number, type: OscillatorType = 'sine') {
  const { volume } = soundPrefs();
  if (!ctx || volume <= 0) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = type; o.frequency.value = freq;
  const t = ctx.currentTime + delay;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(volume * 0.6, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.02);
}

export const sounds = {
  minute: () => { beep(880, 0.18, 0); beep(880, 0.18, 0.28); },
  countdown: () => beep(660, 0.12, 0),
  level: () => { beep(523, 0.9, 0, 'triangle'); beep(659, 0.9, 0.16, 'triangle'); beep(784, 1.2, 0.32, 'triangle'); },
  pause: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.4, i * 0.18, 'triangle')),
  knockout: () => { beep(330, 0.25, 0, 'triangle'); beep(220, 0.5, 0.18, 'triangle'); },
};

export function say(text: string) {
  const p = soundPrefs();
  if (!p.voice || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'fr-FR';
  u.volume = Math.min(1, p.volume + 0.2);
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
