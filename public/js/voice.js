// Ovoz: mikrofondan yozish (jimlikni o'zi aniqlab to'xtaydi) va javobni ovoz chiqarib o'qish.

const TARGET_RATE = 16000;
const SILENCE_END_MS = 1400; // gapdan keyingi shuncha jimlik — savol tugadi
const NO_SPEECH_MS = 8000; // shuncha vaqt hech narsa aytilmasa bekor qilinadi
const MAX_MS = 30000;

let audioCtx = null;
/** Umumiy AudioContext (birinchi bosishda ochiladi — brauzer talabi). */
export function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended' && !audioCtx.userPaused) audioCtx.resume().catch(() => {});
  return audioCtx;
}

function encodeWav(chunks, total, inRate) {
  // Bir kanalga yig'ib, 16 kHz ga tushiramiz (o'rtacha olish bilan)
  const ratio = inRate / TARGET_RATE;
  const outLen = Math.floor(total / ratio);
  const flat = new Float32Array(total);
  let off = 0;
  for (const c of chunks) {
    flat.set(c, off);
    off += c.length;
  }
  const buf = new ArrayBuffer(44 + outLen * 2);
  const view = new DataView(buf);
  const text = (pos, str) => [...str].forEach((ch, i) => view.setUint8(pos + i, ch.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + outLen * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, TARGET_RATE, true);
  view.setUint32(28, TARGET_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, outLen * 2, true);
  for (let i = 0; i < outLen; i++) {
    const a = Math.floor(i * ratio);
    const b = Math.min(total, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = a; j < b; j++) sum += flat[j];
    const sample = Math.max(-1, Math.min(1, b > a ? sum / (b - a) : 0));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

function toBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export class Recorder {
  constructor() {
    this.active = false;
  }

  /**
   * Yozishni boshlaydi. Natija: base64 WAV (16 kHz mono) yoki gap eshitilmasa null.
   * @param {{ onLevel?: (v: number) => void }} opts
   * @returns {Promise<string|null>}
   */
  async record({ onLevel } = {}) {
    if (this.active) throw new Error('busy');
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('mic-unavailable');
    this.active = true;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      this.active = false;
      throw new Error('mic-denied', { cause: err });
    }

    const ctx = getAudioContext();
    if (!this.workletReady) {
      await ctx.audioWorklet.addModule('/js/recorder-worklet.js');
      this.workletReady = true;
    }
    const source = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, 'recorder');
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(node).connect(mute).connect(ctx.destination);

    const chunks = [];
    let total = 0;
    let elapsed = 0;
    let voiced = 0;
    let lastVoice = 0;
    let noise = 0.01;
    let level = 0;

    return new Promise((resolve) => {
      const finish = (send, manual = false) => {
        if (!this.active) return;
        this.active = false;
        this.finish = null;
        node.port.onmessage = null;
        source.disconnect();
        node.disconnect();
        mute.disconnect();
        stream.getTracks().forEach((tr) => tr.stop());
        onLevel?.(0);
        // Qo'lda to'xtatilganda yozuv baribir yuboriladi (jim gapirgan bo'lishi mumkin)
        const spoke = manual ? elapsed > 400 : voiced >= 200;
        resolve(send && spoke ? toBase64(encodeWav(chunks, total, ctx.sampleRate)) : null);
      };
      this.finish = finish;

      node.port.onmessage = (e) => {
        const frame = e.data;
        chunks.push(frame);
        total += frame.length;
        const ms = (frame.length / ctx.sampleRate) * 1000;
        elapsed += ms;

        let sum = 0;
        for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
        const rms = Math.sqrt(sum / frame.length);
        // Dastlabki 300 ms — fon shovqinini o'lchash
        // (yuqori chegara bor: odam darhol gapira boshlasa ham bo'sag'a oshib ketmaydi)
        if (elapsed < 300) noise = Math.min(0.03, Math.max(noise, rms));
        const threshold = Math.max(0.018, noise * 2.5);
        if (rms > threshold) {
          voiced += ms;
          lastVoice = elapsed;
        }
        level += (Math.min(1, rms * 9) - level) * 0.25;
        onLevel?.(level);

        const started = voiced >= 200;
        if (started && elapsed - lastVoice > SILENCE_END_MS) finish(true);
        else if (!started && elapsed > NO_SPEECH_MS) finish(false);
        else if (elapsed > MAX_MS) finish(true);
      };
    });
  }

  /** Qo'lda to'xtatish: send=true bo'lsa yozilgani yuboriladi. */
  stop(send = true) {
    this.finish?.(send, true);
  }
}

export class Speaker {
  constructor() {
    this.playing = false;
    this.paused = false;
    this.token = 0;
  }

  /**
   * Matnni o'qib beradi. provider: 'gemini' (server TTS) | 'browser' | 'off'.
   * Server TTS ishlamasa brauzer ovoziga o'tadi.
   */
  async speak(text, lang, provider, { onLevel, signal } = {}) {
    this.stop();
    if (provider === 'off' || !text) return;
    const token = ++this.token;
    this.playing = true;
    this.paused = false;
    try {
      if (provider === 'gemini') {
        try {
          await this.playServer(text, token, onLevel, signal);
          return;
        } catch (err) {
          if (token !== this.token || signal?.aborted) return;
          console.warn('Server TTS ishlamadi, brauzer ovoziga oʻtildi:', err.message);
        }
      }
      await this.playBrowser(text, lang, token, onLevel);
    } finally {
      if (token === this.token) {
        this.playing = false;
        this.paused = false;
        onLevel?.(0);
      }
    }
  }

  async playServer(text, token, onLevel, signal) {
    const res = await fetch('/api/tts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal,
    });
    if (!res.ok) throw new Error(`TTS ${res.status}`);
    const ctx = getAudioContext();
    const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
    if (token !== this.token) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser).connect(ctx.destination);
    const samples = new Uint8Array(analyser.fftSize);
    this.source = source;

    await new Promise((resolve) => {
      let raf = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i++) {
          const v = (samples[i] - 128) / 128;
          sum += v * v;
        }
        onLevel?.(Math.min(1, Math.sqrt(sum / samples.length) * 4.5));
        raf = requestAnimationFrame(tick);
      };
      source.onended = () => {
        cancelAnimationFrame(raf);
        if (this.source === source) this.source = null;
        resolve();
      };
      source.start();
      tick();
    });
  }

  playBrowser(text, lang, token, onLevel) {
    const synth = window.speechSynthesis;
    if (!synth) return Promise.resolve();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      const voices = synth.getVoices();
      const voice = voices.find((v) => v.lang.toLowerCase().startsWith(lang)) ||
        (lang === 'uz' ? voices.find((v) => /^(tr|kk|az)/i.test(v.lang)) : null);
      if (voice) u.voice = voice;
      u.lang = voice?.lang || lang;
      const timer = setInterval(() => {
        if (!this.paused) onLevel?.(0.25 + Math.random() * 0.5);
      }, 90);
      const done = () => {
        clearInterval(timer);
        resolve();
      };
      u.onend = done;
      u.onerror = done;
      this.utterance = u;
      synth.speak(u);
      // Ba'zi tizimlarda ovoz yo'q bo'lsa onend kelmaydi — zaxira taymer
      setTimeout(() => token === this.token && this.utterance === u && !synth.speaking && done(), 1500);
    });
  }

  togglePause() {
    if (!this.playing) return false;
    this.paused = !this.paused;
    const ctx = getAudioContext();
    if (this.source) {
      ctx.userPaused = this.paused;
      if (this.paused) ctx.suspend();
      else ctx.resume();
    } else if (window.speechSynthesis) {
      if (this.paused) window.speechSynthesis.pause();
      else window.speechSynthesis.resume();
    }
    return this.paused;
  }

  stop() {
    this.token++;
    const ctx = audioCtx;
    if (ctx?.userPaused) {
      ctx.userPaused = false;
      ctx.resume().catch(() => {});
    }
    if (this.source) {
      try { this.source.stop(); } catch { /* allaqachon to'xtagan */ }
      this.source = null;
    }
    if (this.utterance) {
      this.utterance = null;
      window.speechSynthesis?.cancel();
    }
    this.playing = false;
    this.paused = false;
  }
}
