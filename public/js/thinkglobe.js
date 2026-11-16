// "O'ylayapman" holatida zarrachalar shari o'rniga aylanuvchi nuqtali yer shari (cobe, https://github.com/shuding/cobe).
// cobe 2 da ichki animatsiya sikli yo'q — kadrlarni o'zimiz chizamiz, shuning uchun shar faqat ko'rinib turganda ishlaydi.
// Kutubxona yoki WebGL bo'lmasa — hech narsa o'zgarmaydi, zarrachalar shari qoladi.

const HOME = [41.2579, 69.2812]; // Toshkent
const FADE_MS = 600; // CSS dagi o'tish vaqtidan biroz uzunroq — so'nish paytida ham aylanib tursin
const SPIN = 0.55; // radian/soniya

/** cobe dagi burchaklar: shu nuqta ekran markaziga qaraydi. */
const facing = ([lat, lng]) => [Math.PI - ((lng * Math.PI) / 180 - Math.PI / 2), (lat * Math.PI) / 180];

export class ThinkingGlobe {
  /** box — position:fixed quti. cobe canvas ni o'z div iga o'rab qo'yadi, shuning uchun canvas ni o'zimiz yaratamiz. */
  constructor(box) {
    this.box = box;
    this.globe = null;
    this.ready = false;
    this.active = false;
    this.size = 0;
    this.raf = 0;
    this.hideTimer = 0;
    this.arcs = [];
    [this.phi, this.theta] = facing(HOME);
    this.theta = 0.32; // biroz yuqoridan — Toshkent markazdan pastroqda, shimoliy yarimshar ko'rinadi
  }

  /** Kutubxonani oldindan yuklab, sharni yaratib qo'yadi (birinchi "o'ylash" kutilmasin). */
  async preload() {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        const { default: createGlobe } = await import('/vendor/cobe.js');
        this.createGlobe = createGlobe;
        this.arcs = await destinationArcs();
        this.build();
      } catch (err) {
        console.warn('cobe:', err);
      }
    })();
    return this.loading;
  }

  build() {
    if (!this.createGlobe || !this.size) return;
    this.globe?.destroy();
    // Har safar toza canvas: oldingi canvas va cobe ning o'rovchi div i quti bilan birga o'chadi
    const canvas = document.createElement('canvas');
    this.box.replaceChildren(canvas);
    this.box.style.width = this.box.style.height = `${this.size}px`;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.globe = this.createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: this.size,
      height: this.size,
      phi: this.phi,
      theta: this.theta,
      dark: 1,
      diffuse: 1.4,
      scale: 1,
      mapSamples: 16000,
      mapBrightness: 7,
      mapBaseBrightness: 0.02,
      baseColor: [0.32, 0.42, 0.68],
      markerColor: [0.22, 0.84, 1],
      glowColor: [0.12, 0.22, 0.48],
      markers: [{ location: HOME, size: 0.07 }],
      arcs: this.arcs,
      arcColor: [0.22, 0.84, 1],
      arcWidth: 0.6,
      arcHeight: 0.25,
      markerElevation: 0.01,
    });
    // WebGL bo'lmasa cobe xato bermay bo'sh obyekt qaytaradi — shuning uchun WebGL ni alohida tekshiramiz
    this.ready = Boolean(this.globe) && hasWebGL();
  }

  /** Zarrachalar shakli markazi (y) va radiusi, CSS piksellarida — shar shu joyga joylashadi. */
  setFocus(cy, r) {
    if (!(r > 20)) return; // sahifa hali joylashmagan (sahna balandligi deyarli nol)
    const size = Math.round(r * 1.7);
    this.box.style.top = `${Math.round(cy - size / 2)}px`;
    if (Math.abs(size - this.size) > 2) {
      this.size = size;
      if (this.createGlobe) this.build();
    }
  }

  /** true — "o'ylayapman": shar paydo bo'lib aylanadi; false — so'nadi va chizish to'xtaydi. */
  setActive(on) {
    if (on === this.active) return;
    this.active = on;
    clearTimeout(this.hideTimer);
    if (on) {
      if (!this.ready) return; // tayyor bo'lmasa zarrachalar shari ko'rinib turadi
      document.body.classList.add('globe-think');
      this.start();
    } else {
      document.body.classList.remove('globe-think');
      this.hideTimer = setTimeout(() => this.stop(), FADE_MS);
    }
  }

  start() {
    if (this.raf) return;
    let last = performance.now();
    const frame = (now) => {
      this.phi += Math.min(0.05, (now - last) / 1000) * SPIN;
      last = now;
      this.globe.update({ phi: this.phi });
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}

let webgl = null;
function hasWebGL() {
  if (webgl === null) {
    try {
      const c = document.createElement('canvas');
      webgl = Boolean(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      webgl = false;
    }
  }
  return webgl;
}

/** Toshkentdan tablodagi eng yaqin reyslar yo'nalishlariga yoylar (ko'pi bilan 10 ta). */
async function destinationArcs() {
  try {
    const res = await fetch('/api/flights?type=DEPARTURE');
    if (!res.ok) return [];
    const { flights = [], geo = {} } = await res.json();
    const now = Date.now();
    const codes = [];
    for (const f of flights) {
      if (f.ts < now || !geo[f.code] || codes.includes(f.code)) continue;
      codes.push(f.code);
      if (codes.length >= 10) break;
    }
    return codes.map((c) => ({ from: HOME, to: [geo[c].lat, geo[c].lng] }));
  } catch {
    return [];
  }
}
