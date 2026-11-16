// Markaziy zarrachalar animatsiyasi. Holatga qarab shakl o'zgaradi:
// idle — aeroport logosi (public/img/logo.png), listening — ovozga javob beruvchi halqa,
// thinking — aylanuvchi shar (cobe yer shari bo'lsa, u ko'rinadi — thinkglobe.js),
// speaking — o'sha logo; uning bir qism zarrachalari javob ovoziga qarab atrofga sochilib, yana yig'iladi.

const COLORS = {
  idle: [1.0, 0.78, 0.2],
  listening: [0.22, 0.84, 1.0],
  thinking: [0.75, 0.82, 1.0],
  speaking: [1.0, 0.8, 0.24],
};

const VERT = `
attribute vec2 aPos;
attribute vec2 aStyle; // x: o'lcham, y: yorqinlik
uniform vec2 uRes;
varying float vAlpha;
void main() {
  vec2 clip = (aPos / uRes) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = aStyle.x;
  vAlpha = aStyle.y;
}`;

const FRAG = `
precision mediump float;
uniform vec3 uColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.12, d) * vAlpha;
  gl_FragColor = vec4(uColor * a, a);
}`;

const SCATTER_SHARE = 0.45; // gapirayotganda halqa zarrachalarining qancha qismi logodan sochiladi
const SCATTER_FROM = 0.5; // markazdan shu masofadan (radius ulushi) uzoqdagilar — logo halqasi; ichidagi samolyot joyida qoladi
const LOGO_URL = '/img/logo.png';
const LOGO_SCALE = 0.94; // logo rasm chetigacha chizilgan — biroz kichraytiramiz

/** To'ldirilgan piksellar ro'yxatidan (x, y juftliklari, S o'lchamli kvadratda) tasodifiy nuqtalar: -1..1 oralig'ida. */
function samplePoints(filled, S, count, scale = 1) {
  const out = new Float32Array(count * 2);
  const n = filled.length / 2;
  for (let i = 0; i < count; i++) {
    const k = Math.floor(Math.random() * n) * 2;
    out[i * 2] = ((filled[k] + Math.random() - S / 2) / (S / 2)) * scale;
    out[i * 2 + 1] = ((filled[k + 1] + Math.random() - S / 2) / (S / 2)) * scale;
  }
  return out;
}

function filledPixels(ctx, S) {
  const data = ctx.getImageData(0, 0, S, S).data;
  const filled = [];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) if (data[(y * S + x) * 4 + 3] > 120) filled.push(x, y);
  }
  return filled;
}

/** Aeroport logosi (shaffof fonli PNG) shaklidagi nuqtalar. Rasm yuklanmasa — null. */
function logoPoints(count) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const S = 512;
        const c = document.createElement('canvas');
        c.width = c.height = S;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, S, S);
        const filled = filledPixels(ctx, S);
        resolve(filled.length > 2000 ? samplePoints(filled, S, count, LOGO_SCALE) : null);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = LOGO_URL;
  });
}

/** Zaxira emblema (globus to'ri + samolyot): logo rasmi yuklangunicha yoki yuklanmasa ishlatiladi. */
function emblemPoints(count) {
  const S = 420;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.translate(S / 2, S / 2);
  ctx.strokeStyle = ctx.fillStyle = '#fff';
  ctx.lineCap = 'round';

  // Globus: tashqi aylana, meridianlar va parallellar
  const R = 188;
  ctx.lineWidth = 15;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 11;
  for (const rx of [R * 0.36, R * 0.74]) {
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, R, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const y of [-R * 0.52, 0, R * 0.52]) {
    const half = Math.sqrt(R * R - y * y);
    ctx.beginPath();
    ctx.moveTo(-half, y);
    ctx.lineTo(half, y);
    ctx.stroke();
  }

  // Markazni tozalab, samolyot uchun joy ochamiz
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.56, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // Samolyot (yuqori-o'ngga qaragan)
  ctx.rotate(Math.PI / 4);
  ctx.scale(1.28, 1.28);
  ctx.beginPath();
  ctx.moveTo(0, -74);
  ctx.bezierCurveTo(7, -66, 8, -52, 8, -40);
  ctx.lineTo(8, -16);
  ctx.lineTo(70, 22);
  ctx.lineTo(70, 36);
  ctx.lineTo(8, 16);
  ctx.lineTo(7, 46);
  ctx.lineTo(26, 62);
  ctx.lineTo(26, 72);
  ctx.lineTo(0, 62);
  ctx.lineTo(-26, 72);
  ctx.lineTo(-26, 62);
  ctx.lineTo(-7, 46);
  ctx.lineTo(-8, 16);
  ctx.lineTo(-70, 36);
  ctx.lineTo(-70, 22);
  ctx.lineTo(-8, -16);
  ctx.lineTo(-8, -40);
  ctx.bezierCurveTo(-8, -52, -7, -66, 0, -74);
  ctx.fill();

  return samplePoints(filledPixels(ctx, S), S, count);
}

export class ParticleField {
  constructor(canvas) {
    this.canvas = canvas;
    this.mode = 'idle';
    this.level = 0; // 0..1 — mikrofon yoki nutq balandligi
    this.smooth = 0;
    this.color = [...COLORS.idle];
    this.focus = null; // { cy, r } CSS piksellarida — setFocus() orqali beriladi

    this.gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true });
    this.count = this.gl ? 18000 : 4500;
    if (!this.gl) this.ctx2d = canvas.getContext('2d');

    const n = this.count;
    this.pos = new Float32Array(n * 2);
    this.seed = new Float32Array(n * 4);
    this.style = new Float32Array(n * 2);
    this.emblem = emblemPoints(n);
    logoPoints(n).then((points) => {
      if (points) this.emblem = points;
    });
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 4; k++) this.seed[i * 4 + k] = Math.random();
    }

    if (this.gl) this.initGl();
    this.resize();
    for (let i = 0; i < n; i++) {
      this.pos[i * 2] = Math.random() * this.w;
      this.pos[i * 2 + 1] = Math.random() * this.h;
    }
    window.addEventListener('resize', () => this.resize());
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  initGl() {
    const gl = this.gl;
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    this.uRes = gl.getUniformLocation(prog, 'uRes');
    this.uColor = gl.getUniformLocation(prog, 'uColor');

    this.posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    this.styleBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.styleBuf);
    const aStyle = gl.getAttribLocation(prog, 'aStyle');
    gl.enableVertexAttribArray(aStyle);
    gl.vertexAttribPointer(aStyle, 2, gl.FLOAT, false, 0, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE); // qo'shiluvchi yorug'lik
    gl.clearColor(0, 0, 0, 0);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.w = this.canvas.clientWidth * dpr;
    this.h = this.canvas.clientHeight * dpr;
    this.canvas.width = Math.max(1, Math.round(this.w));
    this.canvas.height = Math.max(1, Math.round(this.h));
    if (this.gl) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      this.gl.uniform2f(this.uRes, this.w, this.h);
    }
    for (let i = 0; i < this.count; i++) {
      this.style[i * 2] = (1.2 + this.seed[i * 4 + 3] * 1.9) * dpr;
      this.style[i * 2 + 1] = 0.36 + this.seed[i * 4 + 2] * 0.6;
    }
    if (this.gl) {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.styleBuf);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, this.style, this.gl.STATIC_DRAW);
    }
  }

  /** Shakl markazi (y) va radiusi, CSS piksellarida. */
  setFocus(cy, r) {
    this.focus = { cy, r };
  }

  setMode(mode) {
    if (COLORS[mode]) this.mode = mode;
  }

  setLevel(v) {
    this.level = Math.max(0, Math.min(1, v || 0));
  }

  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const t = now / 1000;
    this.smooth += (this.level - this.smooth) * Math.min(1, dt * 14);
    const target = COLORS[this.mode];
    for (let k = 0; k < 3; k++) this.color[k] += (target[k] - this.color[k]) * Math.min(1, dt * 4);

    const { pos, seed, emblem, count, w, h, mode } = this;
    const cx = w / 2;
    const cy = this.focus ? this.focus.cy * this.dpr : h * 0.42;
    const R = this.focus ? this.focus.r * this.dpr : Math.min(w * 0.4, h * 0.33);
    const lv = this.smooth;
    const TAU = Math.PI * 2;
    const follow = mode === 'idle' ? 2.2 : 5;

    for (let i = 0; i < count; i++) {
      const u = seed[i * 4];
      const v = seed[i * 4 + 1];
      const q = seed[i * 4 + 2];
      let tx;
      let ty;
      if (mode === 'idle') {
        const breathe = 1 + Math.sin(t * 0.7) * 0.012;
        tx = cx + emblem[i * 2] * R * breathe + Math.sin(t * 1.3 + u * 40) * R * 0.006;
        ty = cy + emblem[i * 2 + 1] * R * breathe + Math.cos(t * 1.1 + v * 40) * R * 0.006;
      } else if (mode === 'listening') {
        const a = u * TAU + t * 0.25;
        const wave = 0.5 + 0.5 * Math.sin(a * 7 + t * 5) * Math.sin(a * 3 - t * 2.2);
        const r = R * (0.6 + lv * 0.42 * wave + (v * v - 0.1) * (0.07 + lv * 0.2) + Math.sin(t * 2 + q * 30) * 0.008);
        tx = cx + Math.cos(a) * r;
        ty = cy + Math.sin(a) * r;
      } else if (mode === 'thinking') {
        const theta = u * TAU + t * 1.1;
        const phi = Math.acos(2 * v - 1);
        const rr = R * 0.62 * (0.94 + q * 0.06);
        const x = Math.sin(phi) * Math.cos(theta);
        const z = Math.sin(phi) * Math.sin(theta);
        const y = Math.cos(phi);
        // Biroz egilgan o'q atrofida aylanish
        tx = cx + (x * 0.94 + y * 0.34) * rr;
        ty = cy + (y * 0.94 - x * 0.34) * rr + z * rr * 0.05;
      } else {
        // Logo joyida turadi va ovoz bilan biroz "nafas oladi"
        const ex = emblem[i * 2];
        const ey = emblem[i * 2 + 1];
        const pulse = 1 + lv * 0.045;
        let x = ex * pulse;
        let y = ey * pulse;
        const d = Math.hypot(ex, ey);
        if (q < SCATTER_SHARE && d > SCATTER_FROM) {
          // Logo halqasidan sochiluvchi zarrachalar (markazdagi samolyot buzilmaydi): markazdan tashqariga,
          // har biri o'z chastotasida — ovoz baland bo'lsa uzoqqa uchadi, pasaysa yoki to'xtasa logoga qaytib yig'iladi.
          const a = Math.atan2(ey, ex);
          const beat = 0.5 + 0.5 * Math.sin(t * (2.6 + u * 7) + v * 50);
          const reach = lv * (0.15 + 0.85 * beat) * (0.35 + (q / SCATTER_SHARE) * 1.05);
          const swirl = Math.sin(t * 1.7 + u * 30) * lv * 0.06; // ozgina yon tomonga buriladi
          x += Math.cos(a) * reach - Math.sin(a) * swirl;
          y += Math.sin(a) * reach + Math.cos(a) * swirl;
        } else {
          // Qolganlari logoni ushlab turadi — faqat mayda titrash
          x += Math.sin(t * 9 + u * 60) * lv * 0.012;
          y += Math.cos(t * 8 + v * 60) * lv * 0.012;
        }
        tx = cx + x * R;
        ty = cy + y * R;
      }
      // Har bir zarracha o'z tezligida nishonga intiladi — shakllar orasida silliq o'tish
      const ix = i * 2;
      const k = 1 - Math.exp(-dt * (follow + seed[i * 4 + 3] * follow * 1.6));
      pos[ix] += (tx - pos[ix]) * k;
      pos[ix + 1] += (ty - pos[ix + 1]) * k;
    }

    if (this.gl) {
      const gl = this.gl;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform3f(this.uColor, this.color[0], this.color[1], this.color[2]);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.POINTS, 0, count);
    } else {
      const ctx = this.ctx2d;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = `rgba(${this.color.map((c) => Math.round(c * 255)).join(',')},0.75)`;
      const sz = 1.6 * this.dpr;
      for (let i = 0; i < count; i++) ctx.fillRect(pos[i * 2], pos[i * 2 + 1], sz, sz);
    }
    requestAnimationFrame((tt) => this.frame(tt));
  }
}
