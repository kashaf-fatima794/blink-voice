import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// ================= SETTINGS =================
const SCAN_MS = 900;
const START_DELAY_MS = 2500;
const COOLDOWN_MS = 700;
const LONG_BLINK_MS = 450;
let EAR_THRESHOLD = 0.2;      // calibration ke baad khud set hota hai
const ALERT_MS = 10000;
const CONFIRM_MS = 5000;      // SOS se pehle cancel karne ka waqt
const NTFY_TOPIC = "blinkvoice-sos-k7x92q";
// ============================================

const PHRASES = [
  { icon: "✅", en: "Yes", ur: "Haan", urdu: "جی ہاں", say: "Yes", sayUrdu: "جی ہاں", sayRoman: "Haan" },
  { icon: "❌", en: "No", ur: "Nahi", urdu: "نہیں", say: "No", sayUrdu: "نہیں", sayRoman: "Nahi" },
  { icon: "💧", en: "Water", ur: "Pani", urdu: "پانی", say: "I need water", sayUrdu: "مجھے پانی چاہیے", sayRoman: "Mujhe pani chahiye" },
  { icon: "🆘", en: "SOS", ur: "Madad", urdu: "مدد", say: "Emergency! I need help immediately!", sayUrdu: "ایمرجنسی! مجھے فوراً مدد چاہیے!", sayRoman: "Emergency! Mujhe fauran madad chahiye!", emergency: "sos", cls: "sos" },
  { icon: "😣", en: "Pain", ur: "Dard", urdu: "درد", say: "I am in pain", sayUrdu: "مجھے درد ہے", sayRoman: "Mujhe dard hai" },
  { icon: "🚻", en: "Washroom", ur: "Washroom", urdu: "واش روم", say: "I need the washroom", sayUrdu: "مجھے واش روم جانا ہے", sayRoman: "Mujhe washroom jana hai" },
  { icon: "👨‍👩‍👦", en: "Call family", ur: "Ghar walay", urdu: "گھر والے", say: "Please call my family", sayUrdu: "براہ مہربانی میرے گھر والوں کو بلائیں", sayRoman: "Meherbani karke mere ghar walon ko bulayen", emergency: "family" },
  { icon: "🙏", en: "Thank you", ur: "Shukriya", urdu: "شکریہ", say: "Thank you", sayUrdu: "شکریہ", sayRoman: "Shukriya" },
];

const BASE_EN = ("i you we they he she it the a and to of in is are was need want please help water food " +
  "pain doctor nurse medicine tea hungry thirsty tired cold hot sleep home family son daughter wife " +
  "husband mother father brother sister call come here there now today tomorrow yes no thank thanks " +
  "good bad better fine sorry okay hello how what when where why who can will would could my me your " +
  "with for not very much more less little bed chair light fan window door bathroom washroom move turn " +
  "off on stop wait love feel feeling happy sad scared hurt head back leg arm chest stomach breathe " +
  "bring give take open close see hear talk say tell know think like go be have do get make time " +
  "morning night day").split(" ");
const BASE_UR = ("میں آپ ہم وہ یہ ہے ہیں تھا مجھے چاہیے پانی کھانا چائے دوا ڈاکٹر نرس درد سر پیٹ سینہ ٹانگ بازو " +
  "گھر بیٹا بیٹی بیوی شوہر امی ابو بھائی بہن بلاؤ آؤ یہاں وہاں اب آج کل ہاں نہیں شکریہ براہ مہربانی مدد " +
  "ٹھیک ٹھنڈا گرم نیند تھکا بھوک پیاس بستر کرسی بتی پنکھا کھڑکی دروازہ واش روم بند کھولو رکو انتظار " +
  "پیار خوش اداس ڈر سانس دو لاؤ دیکھو سنو بولو کیا کیوں کب کہاں کون کیسے بہت زیادہ کم تھوڑا").split(" ");
const STARTERS_EN = ["i", "please", "need", "thank"];
const STARTERS_UR = ["مجھے", "براہ", "میں", "شکریہ"];

const EN_ROWS = ["abcdefg", "hijklmn", "opqrstu", "vwxyz.?"];
const UR_ROWS = ["ابپتٹثج", "چحخدڈذر", "ڑزژسشصض", "طظعغفقک", "گلمنوہھ", "یےءں۔؟،"];
const PUNCT = /[.?۔؟،]/;
const isUrdu = (s) => /[\u0600-\u06FF]/.test(s);

// ---- storage ----
function load(k, d = {}) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
const freq = load("bv_freq");
const next = load("bv_next");
const cfg = Object.assign({ sos: "", family: "", lang: "en", dark: false, size: 0, thr: 0 }, load("bv_cfg", {}));
if (cfg.thr > 0.05 && cfg.thr < 0.4) EAR_THRESHOLD = cfg.thr;
let lang = cfg.lang === "ur" ? "ur" : "en";

const $ = (id) => document.getElementById(id);
const video = $("cam"), pill = $("pill"), outputEl = $("output"), kbEl = $("kb");
const historyEl = $("history"), toastEl = $("toast"), fillEl = $("blinkfill"), modeTag = $("modeTag");

// ---- state ----
let mode = "quick";
let text = "";
let screen, rowEls = [];
let stage = "row";
let rowIdx = 0, colIdx = 0;
let lastSwitch = 0, scanStartAt = Infinity, pausedUntil = 0;
let closedSince = null, needReopen = false;
let saved = 0, chars = 0, sent = 0, firstAt = 0;
let landmarker = null;
let calib = null, pending = null;

// ---- theme (dark / bada text) ----
const SIZE_NAMES = ["Normal", "Bada", "Bahut bada"];
const SIZE_VALS = [1, 1.25, 1.5];
function applyTheme() {
  document.body.classList.toggle("dark", !!cfg.dark);
  document.documentElement.style.setProperty("--fs", SIZE_VALS[cfg.size] || 1);
  $("darkBtn").textContent = cfg.dark ? "☀ Light" : "🌙 Dark";
  $("sizeBtn").textContent = "Aa " + SIZE_NAMES[cfg.size || 0];
}
$("darkBtn").addEventListener("click", () => { cfg.dark = !cfg.dark; save("bv_cfg", cfg); applyTheme(); });
$("sizeBtn").addEventListener("click", () => { cfg.size = ((cfg.size || 0) + 1) % 3; save("bv_cfg", cfg); applyTheme(); });
applyTheme();

// ---- language ----
function toggleLang() {
  lang = lang === "en" ? "ur" : "en";
  cfg.lang = lang; save("bv_cfg", cfg);
}
$("langBtn").addEventListener("click", () => { toggleLang(); render(); });

// ---- speech ----
let voices = [];
function loadVoices() { voices = speechSynthesis.getVoices(); }
loadVoices();
speechSynthesis.onvoiceschanged = loadVoices;
const hasUrduVoice = () => voices.some((v) => /^ur/i.test(v.lang));

function pickVoice(l) {
  if (l === "ur") return voices.find((v) => /^ur/i.test(v.lang)) || null;
  const en = voices.filter((v) => /^en/i.test(v.lang));
  return en.find((v) => v.localService) || en[0] || voices.find((v) => v.localService) || voices[0] || null;
}

function speakNow(t, l = "en") {
  try {
    loadVoices();
    if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
    setTimeout(() => {
      const u = new SpeechSynthesisUtterance(t);
      const v = pickVoice(l);
      if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = l === "ur" ? "ur-PK" : "en-US"; }
      u.rate = 0.95;
      u.volume = 1;
      u.onerror = (e) => { toastEl.textContent = "Voice error: " + e.error; };
      speechSynthesis.speak(u);
      speechSynthesis.resume();
    }, 150);
  } catch (e) { toastEl.textContent = "Voice error: " + e.message; }
}

function speak(t, l) {
  if (!t.trim()) return;
  l = l || (isUrdu(t) ? "ur" : "en");
  speakNow(t, l);
  toastEl.textContent = "🔊 " + t + (l === "ur" && !hasUrduVoice() ? "  (Urdu voice installed nahi)" : "");
  sent++;
  const li = document.createElement("li");
  li.textContent = t;
  historyEl.prepend(li);
  while (historyEl.children.length > 5) historyEl.lastChild.remove();
}

// phrase kis zubaan mein bolna hai
function phraseSay(p) {
  if (lang === "ur") return hasUrduVoice() ? { text: p.sayUrdu, l: "ur" } : { text: p.sayRoman, l: "en" };
  return { text: p.say, l: "en" };
}

$("testVoice").addEventListener("click", () => {
  loadVoices();
  if (lang === "ur" && hasUrduVoice()) {
    toastEl.textContent = "Urdu voice mil gayi";
    speakNow("یہ آواز کا ٹیسٹ ہے", "ur");
  } else {
    const v = pickVoice("en");
    toastEl.textContent = voices.length === 0
      ? "Is browser mein koi voice installed nahi hai"
      : "Voices: " + voices.length + " | Using: " + (v ? v.name : "default") + (lang === "ur" ? " | Urdu voice nahi mili" : "");
    speakNow(lang === "ur" ? "Urdu voice installed nahi hai. Roman Urdu English awaaz mein bolunga." : "Hello. Voice test is working.", "en");
  }
});

// ---- beep + siren ----
let audioCtx = null, sirenTimer = null, sirenOsc = null;
function getCtx() {
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  audioCtx.resume();
  return audioCtx;
}
function beep(freq, ms) {
  try {
    const ctx = getCtx();
    const o = ctx.createOscillator(), g = ctx.createGain();
    g.gain.value = 0.15;
    o.frequency.value = freq;
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + ms / 1000);
  } catch {}
}
function startSiren() {
  try {
    const ctx = getCtx();
    stopSiren();
    sirenOsc = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0.25;
    sirenOsc.type = "square";
    sirenOsc.connect(g); g.connect(ctx.destination);
    sirenOsc.start();
    let hi = false;
    sirenTimer = setInterval(() => { hi = !hi; sirenOsc.frequency.value = hi ? 900 : 600; }, 450);
  } catch {}
}
function stopSiren() {
  clearInterval(sirenTimer);
  try { sirenOsc && sirenOsc.stop(); } catch {}
  sirenOsc = null;
}

// ---- friend ko notification (ntfy) ----
async function notifyFriend(kind) {
  const title = kind === "family" ? "BlinkVoice: Family call request" : "BlinkVoice: SOS EMERGENCY";
  const msg = kind === "family"
    ? "Your contact is asking you to call them."
    : "EMERGENCY! Your contact needs help immediately.";
  const send = (body, extra = {}) =>
    fetch("https://ntfy.sh/" + NTFY_TOPIC, {
      method: "POST",
      body,
      headers: { Title: title, Priority: "urgent", Tags: "rotating_light", ...extra },
    }).catch(() => {});

  send(msg);
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const url = `https://maps.google.com/?q=${p.coords.latitude},${p.coords.longitude}`;
        send("Location: " + url, { Click: url });
      },
      () => {},
      { timeout: 5000 }
    );
  }
}

// ---- emergency (confirm countdown + alert) ----
let alertTimer = null;
function dial(num) {
  if (!num) return;
  const a = document.createElement("a");
  a.href = "tel:" + num.replace(/\s+/g, "");
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function startPending(kind, phrase) {
  pending = { kind, phrase, endAt: performance.now() + CONFIRM_MS, shown: 0 };
  $("confirmWho").textContent = kind === "family" ? "FAMILY ALERT" : "SOS EMERGENCY";
  $("confirmNum").textContent = Math.ceil(CONFIRM_MS / 1000);
  $("confirm").style.display = "flex";
  speakNow("Emergency in five seconds. Close your eyes to cancel.", "en");
}
function cancelPending(now = performance.now()) {
  if (!pending) return;
  pending = null;
  $("confirm").style.display = "none";
  fillEl.style.width = "0%";
  closedSince = null;
  needReopen = true;
  pausedUntil = now + 800;
  lastSwitch = pausedUntil;
  speakNow(lang === "ur" ? "Alert cancel ho gaya" : "Cancelled", "en");
  toastEl.textContent = "✖ Alert cancel kar diya";
}
function firePending(now) {
  const p = pending;
  pending = null;
  $("confirm").style.display = "none";
  fillEl.style.width = "0%";
  closedSince = null;
  emergency(p.kind, p.phrase);
}
function tickPending(now, v) {
  const left = pending.endAt - now;
  const n = Math.max(0, Math.ceil(left / 1000));
  if (pending.shown !== n) { pending.shown = n; $("confirmNum").textContent = n; beep(700, 120); }
  if (blinkCheck(now, v)) { cancelPending(now); return; }
  if (left <= 0) firePending(now);
}
$("cancelBtn").addEventListener("click", () => cancelPending());

function emergency(kind, phrase) {
  const num = kind === "family" ? cfg.family : cfg.sos;
  const who = kind === "family" ? "Calling family" : "Emergency alert sent";
  $("alertText").textContent = who + (num ? ": " + num : " (number set nahi hai)");
  $("callLink").href = num ? "tel:" + num.replace(/\s+/g, "") : "#";
  $("alert").style.display = "flex";
  if (kind === "sos") startSiren();
  const s = phraseSay(phrase);
  speak(s.text, s.l);
  notifyFriend(kind);
  dial(num);
  pausedUntil = performance.now() + ALERT_MS;
  clearTimeout(alertTimer);
  alertTimer = setTimeout(dismissAlert, ALERT_MS);
}
function dismissAlert() {
  $("alert").style.display = "none";
  stopSiren();
  clearTimeout(alertTimer);
  pausedUntil = performance.now() + 500;
  lastSwitch = performance.now() + 500;
}
$("dismiss").addEventListener("click", dismissAlert);

// ---- suggestions ----
const score = (w, prev) => (freq[w] || 0) * 10 + ((next[prev] || {})[w] || 0) * 20;
function currentPartial() { const m = text.match(/(\S*)$/); return m ? m[1].toLowerCase() : ""; }
function suggest() {
  const U = lang === "ur";
  const partial = currentPartial();
  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const prev = partial ? words[words.length - 2] : words[words.length - 1];
  const all = [...new Set([...(U ? BASE_UR : BASE_EN), ...Object.keys(freq)])].filter((w) => isUrdu(w) === U);
  let c = partial ? all.filter((w) => w.startsWith(partial) && w !== partial) : all.filter((w) => score(w, prev) > 0);
  c.sort((a, b) => score(b, prev) - score(a, prev));
  if (!partial) for (const s of (U ? STARTERS_UR : STARTERS_EN)) if (!c.includes(s)) c.push(s);
  return c.slice(0, 4);
}
function learn(word, prev) {
  word = word.toLowerCase().replace(/[^\p{L}]/gu, "");
  if (word.length < 2) return;
  freq[word] = (freq[word] || 0) + 1;
  if (prev) { next[prev] = next[prev] || {}; next[prev][word] = (next[prev][word] || 0) + 1; }
  save("bv_freq", freq); save("bv_next", next);
}
function finishWord() {
  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length && !text.endsWith(" ")) learn(words[words.length - 1], words[words.length - 2]);
}

// ---- screens ----
function buildScreen() {
  const U = lang === "ur";
  if (mode === "quick") {
    const items = PHRASES.map((p) => ({
      label: p.icon + " " + (U ? p.urdu : p.en),
      sub: U ? p.en : p.ur,
      type: "phrase", p, cls: p.cls,
    }));
    items.push({ label: U ? "⌨ ٹائپ" : "⌨ Type", type: "mode", value: "type" });
    items.push({ label: U ? "🌐 English" : "🌐 اردو", type: "lang" });
    return { linear: true, rows: [items] };
  }
  const rows = [];
  const sug = suggest();
  if (sug.length) rows.push(sug.map((w) => ({ label: w, type: "word", value: w, cls: "sug" })));
  (U ? UR_ROWS : EN_ROWS).forEach((r) =>
    rows.push([...r].map((ch) => ({
      label: U ? ch : ch.toUpperCase(),
      type: PUNCT.test(ch) ? "punct" : "char",
      value: ch,
    })))
  );
  rows.push([
    { label: U ? "خالی جگہ" : "SPACE", type: "space", cls: "wide" },
    { label: U ? "⌫ مٹاؤ" : "⌫ DEL", type: "del" },
    { label: U ? "🔊 بولو" : "🔊 SPEAK", type: "speak", cls: "wide" },
    { label: U ? "🗑 صاف" : "🗑 CLEAR", type: "clear" },
    { label: U ? "⚡ فوری" : "⚡ QUICK", type: "mode", value: "quick" },
    { label: U ? "🌐 EN" : "🌐 اردو", type: "lang" },
  ]);
  return { linear: false, rows };
}

function render() {
  screen = buildScreen();
  kbEl.innerHTML = ""; rowEls = [];
  screen.rows.forEach((items) => {
    const r = document.createElement("div");
    r.className = "row" + (screen.linear ? " linear" : "");
    const keys = items.map((it) => {
      const k = document.createElement("div");
      k.className = "key" + (it.cls ? " " + it.cls : "");
      k.dir = "auto";
      k.innerHTML = `<span>${it.label}</span>` + (it.sub ? `<small>${it.sub}</small>` : "");
      r.appendChild(k);
      return k;
    });
    if (!screen.linear) {
      const b = document.createElement("div");
      b.className = "key back"; b.textContent = "↩";
      r.appendChild(b); keys.push(b);
    }
    kbEl.appendChild(r);
    rowEls.push({ row: r, keys, items });
  });
  stage = screen.linear ? "col" : "row";
  rowIdx = 0; colIdx = 0;
  const U = lang === "ur";
  modeTag.textContent = mode === "type" ? (U ? "ٹائپنگ" : "Typing") : (U ? "فوری جملے" : "Quick phrases");
  paint(); drawText(); drawStats();
}

function paint() {
  rowEls.forEach((r, ri) => {
    r.row.classList.toggle("active-row", !screen.linear && ri === rowIdx);
    r.keys.forEach((k, ki) => k.classList.toggle("active", stage === "col" && ri === rowIdx && ki === colIdx));
  });
}

function drawText() {
  const disp = text.replace(/(^\s*|[.?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bi\b/g, "I");
  outputEl.dir = "auto";
  outputEl.classList.toggle("empty", !disp);
  outputEl.textContent = "";
  outputEl.append(document.createTextNode(disp || (lang === "ur" ? "یہاں آپ کا جملہ بنے گا" : "Yahan tumhara sentence banega")));
  if (disp) { const c = document.createElement("span"); c.className = "caret"; outputEl.append(c); }
}

function drawStats() {
  const mins = firstAt ? (performance.now() - firstAt) / 60000 : 0;
  const wpm = mins > 0.15 ? text.length / 5 / mins : 0;
  $("sWpm").textContent = wpm.toFixed(1);
  $("sSaved").textContent = saved;
  $("sChars").textContent = chars;
  $("sSent").textContent = sent;
}
setInterval(drawStats, 1000);

// ---- actions ----
function act(it) {
  if (!firstAt) firstAt = performance.now();
  switch (it.type) {
    case "char": text += it.value; chars++; break;
    case "punct": finishWord(); text = text.trimEnd() + it.value + " "; chars++; break;
    case "space": if (text && !text.endsWith(" ")) { finishWord(); text += " "; chars++; } break;
    case "del": text = text.slice(0, -1); break;
    case "clear": text = ""; toastEl.textContent = ""; break;
    case "word": {
      const p = currentPartial();
      const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const prev = p ? words[words.length - 2] : words[words.length - 1];
      text = text.slice(0, text.length - p.length) + it.value + " ";
      learn(it.value, prev);
      saved += Math.max(0, it.value.length - p.length);
      chars += it.value.length - p.length + 1;
      break;
    }
    case "speak": speak(text.trim()); break;
    case "phrase":
      if (it.p.emergency) startPending(it.p.emergency, it.p);
      else { const s = phraseSay(it.p); speak(s.text, s.l); }
      break;
    case "mode": mode = it.value; break;
    case "lang": toggleLang(); break;
  }
}

function select() {
  const r = rowEls[rowIdx];
  if (stage === "row") { stage = "col"; colIdx = 0; paint(); return; }
  const item = r.items[colIdx];
  if (!item) { stage = "row"; paint(); return; }
  act(item);
  render();
}
function step() {
  if (stage === "row") rowIdx = (rowIdx + 1) % rowEls.length;
  else colIdx = (colIdx + 1) % rowEls[rowIdx].keys.length;
  paint();
}

// ---- blink math ----
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function ear(lm, idx) {
  const [p1, p2, p3, p4, p5, p6] = idx.map((i) => lm[i]);
  return (dist(p2, p6) + dist(p3, p5)) / (2 * dist(p1, p4));
}
const LEFT_EYE = [362, 385, 387, 263, 373, 380];
const RIGHT_EYE = [33, 160, 158, 133, 153, 144];

function setPill(t, cls) { pill.textContent = t; pill.className = "tag " + (cls || ""); }

// lamba blink poora hua to true
function blinkCheck(now, v) {
  if (v < EAR_THRESHOLD && !needReopen) {
    if (closedSince === null) closedSince = now;
    const held = now - closedSince;
    fillEl.style.width = Math.min(100, (held / LONG_BLINK_MS) * 100) + "%";
    if (held >= LONG_BLINK_MS) { closedSince = null; fillEl.style.width = "0%"; return true; }
  } else {
    if (v >= EAR_THRESHOLD) needReopen = false;
    closedSince = null; fillEl.style.width = "0%";
  }
  return false;
}

function trigger(now) {
  select();
  pausedUntil = Math.max(pausedUntil, now + COOLDOWN_MS);
  lastSwitch = pausedUntil;
  needReopen = true;
  closedSince = null;
  fillEl.style.width = "0%";
}

// ---- calibration ----
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

function startCalibration() {
  if (!landmarker) return;
  const now = performance.now();
  pending = null; $("confirm").style.display = "none";
  calib = { phase: "open", t0: now, open: [], closed: [] };
  $("calib").style.display = "flex";
  $("calTitle").textContent = "Step 1: Aankhein KHULI rakho";
  $("calText").textContent = "Screen ki taraf seedha dekho aur aankhein normal khuli rakho.";
  speakNow("Look at the screen with your eyes open.", "en");
}
function endCalib(now) {
  calib = null;
  $("calib").style.display = "none";
  scanStartAt = now + START_DELAY_MS;
  lastSwitch = scanStartAt;
  needReopen = true;
  closedSince = null;
  fillEl.style.width = "0%";
}
function finishCalib(now) {
  const c = calib;
  c.phase = "done"; c.t0 = now;
  if (c.open.length < 8 || c.closed.length < 8) {
    $("calTitle").textContent = "Calibration nahi hui";
    $("calText").textContent = "Chehra poora nahi mila. Roshni theek karo, seedha baitho, aur 🎯 Calibrate dobara dabao. Abhi purani setting chalegi.";
    $("calCount").textContent = "!";
    return;
  }
  const o = med(c.open), cl = med(c.closed);
  if (o - cl < 0.06) {
    $("calTitle").textContent = "Fark kam tha";
    $("calText").textContent = "Khuli aur band aankh mein fark kam nikla (khuli " + o.toFixed(2) + ", band " + cl.toFixed(2) + "). Camera ke thoda qareeb baitho aur dobara try karo.";
    $("calCount").textContent = "!";
    return;
  }
  const thr = Math.min(0.35, Math.max(0.1, cl + (o - cl) * 0.5));
  EAR_THRESHOLD = thr;
  cfg.thr = +thr.toFixed(3);
  save("bv_cfg", cfg);
  $("calTitle").textContent = "✅ Calibration ho gayi";
  $("calText").textContent = "Khuli aankh: " + o.toFixed(2) + " | Band aankh: " + cl.toFixed(2) + " | Threshold: " + thr.toFixed(2);
  $("calCount").textContent = "✓";
  speakNow("Calibration complete.", "en");
}
function runCalib(now, v) {
  const c = calib, el = now - c.t0;
  if (c.phase === "open") {
    if (el > 1000 && v !== null) c.open.push(v);
    $("calCount").textContent = Math.max(0, Math.ceil((4000 - el) / 1000));
    if (el >= 4000) {
      c.phase = "closed"; c.t0 = now;
      beep(880, 250);
      $("calTitle").textContent = "Step 2: Ab aankhein BAND karo";
      $("calText").textContent = "Dusri beep ki awaaz tak aankhein band rakho.";
      speakNow("Close your eyes.", "en");
    }
  } else if (c.phase === "closed") {
    if (el > 1800 && v !== null) c.closed.push(v);
    $("calCount").textContent = Math.max(0, Math.ceil((4500 - el) / 1000));
    if (el >= 4500) { beep(880, 300); finishCalib(now); }
  } else if (c.phase === "done") {
    if (el >= 2500) endCalib(now);
  }
}
$("calBtn").addEventListener("click", startCalibration);
$("calSkip").addEventListener("click", () => endCalib(performance.now()));

// ---- keyboard (Space = blink, Esc = cancel/dismiss) ----
window.addEventListener("keydown", (e) => {
  if (e.target && e.target.tagName === "INPUT") return;
  if (e.code === "Escape") {
    if (pending) cancelPending();
    else if (calib) endCalib(performance.now());
    else dismissAlert();
    return;
  }
  if (e.code === "Space") {
    e.preventDefault();
    const now = performance.now();
    if (pending) { cancelPending(now); return; }
    if (calib) return;
    if (now >= scanStartAt && now >= pausedUntil) trigger(now);
  }
});

async function begin() {
  render();
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  await new Promise((r) => (video.onloadeddata = r));

  const fileset = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm");
  landmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    },
    runningMode: "VIDEO",
    numFaces: 1,
  });

  if (cfg.thr > 0) {
    scanStartAt = performance.now() + START_DELAY_MS;
    lastSwitch = scanStartAt;
  } else {
    startCalibration(); // pehli baar khud
  }

  function loop() {
    const now = performance.now();
    const result = landmarker.detectForVideo(video, now);
    const hasFace = result.faceLandmarks.length > 0;
    let v = null;
    if (hasFace) {
      const lm = result.faceLandmarks[0];
      v = (ear(lm, LEFT_EYE) + ear(lm, RIGHT_EYE)) / 2;
    }

    if (calib) {
      setPill("Calibration", "scan");
      runCalib(now, v);
    } else if (pending) {
      setPill("SOS countdown", "warn");
      tickPending(now, v === null ? 1 : v);
    } else if (!hasFace) {
      closedSince = null; fillEl.style.width = "0%";
      lastSwitch = Math.max(lastSwitch, now);
      setPill("Chehra nahi mil raha", "warn");
    } else if (now < scanStartAt) {
      setPill("Tayyar ho jao...", "");
    } else if (now < pausedUntil) {
      setPill("Selected ✓", "wait");
    } else {
      setPill(stage === "row" ? "Row scanning" : "Letter scanning", "scan");
      if (now - lastSwitch >= SCAN_MS && closedSince === null) { step(); lastSwitch = now; }
      if (blinkCheck(now, v)) trigger(now);
    }
    requestAnimationFrame(loop);
  }
  loop();
}

// ---- Start screen ----
$("sosNum").value = cfg.sos;
$("famNum").value = cfg.family;
$("startBtn").addEventListener("click", () => {
  cfg.sos = $("sosNum").value.trim();
  cfg.family = $("famNum").value.trim();
  save("bv_cfg", cfg);
  $("start").style.display = "none";
  try { getCtx(); } catch {}
  speakNow("Ready", "en");
  begin().catch((e) => { setPill("Error: " + e.message, "warn"); console.error(e); });
});