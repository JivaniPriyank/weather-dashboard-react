// Pronunciation with the browser's built-in German voice.
const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
let germanVoice = null;

function pickVoice() {
  if (!synth) return;
  const voices = synth.getVoices();
  germanVoice =
    voices.find((v) => /^de(-|_|$)/i.test(v.lang) && v.localService) ||
    voices.find((v) => /^de(-|_|$)/i.test(v.lang)) ||
    null;
}
if (synth) {
  pickVoice();
  if (typeof synth.onvoiceschanged !== "undefined") synth.onvoiceschanged = pickVoice;
}

export const canSpeak = !!synth;

export function say(text) {
  if (!synth || !text) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "de-DE";
  u.rate = 0.9;
  if (germanVoice) u.voice = germanVoice;
  synth.speak(u);
}

export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatDate(iso, withTime = false) {
  if (!iso) return "";
  const d = new Date(iso);
  const opts = { day: "numeric", month: "short", year: "numeric" };
  if (withTime) Object.assign(opts, { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleString("en-GB", opts);
}

export function plural(n, word, many) {
  return `${n} ${n === 1 ? word : many || word + "s"}`;
}
