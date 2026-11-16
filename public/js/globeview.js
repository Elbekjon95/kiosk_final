// 3D globus: Toshkentdan (yoki Toshkentga) parvoz yo'nalishini ko'rsatadi.
// globe.gl kutubxonasi og'ir, shuning uchun faqat birinchi marta kerak bo'lganda yuklanadi.
const ASSETS = '/globe';
const RAD = Math.PI / 180;
const EARTH_KM = 6371;

const HOME_RGB = '52, 211, 153';
const DEST_RGB = '255, 77, 109';

let libPromise = null;
function loadLib() {
  if (window.Globe) return Promise.resolve();
  libPromise ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/vendor/globe.gl.min.js';
    script.onload = () => (window.Globe ? resolve() : reject(new Error('globe.gl topilmadi')));
    script.onerror = () => {
      libPromise = null;
      script.remove();
      reject(new Error('globe.gl yuklanmadi'));
    };
    document.head.append(script);
  });
  return libPromise;
}

let countriesPromise = null;
function loadCountries() {
  countriesPromise ||= fetch(`${ASSETS}/countries.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`countries ${res.status}`);
      return res.json();
    })
    .then((json) => json.features)
    .catch((err) => {
      countriesPromise = null;
      throw err;
    });
  return countriesPromise;
}

const toVec = ({ lat, lng }) => {
  const phi = lat * RAD;
  const lam = lng * RAD;
  return [Math.cos(phi) * Math.cos(lam), Math.cos(phi) * Math.sin(lam), Math.sin(phi)];
};

/** Ikki nuqta orasidagi eng qisqa yo'l: burchak (radian), masofa (km) va o'rta nuqta. */
export function greatCircle(a, b) {
  const va = toVec(a);
  const vb = toVec(b);
  const dot = Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const angle = Math.acos(dot);
  const m = [va[0] + vb[0], va[1] + vb[1], va[2] + vb[2]];
  const len = Math.hypot(...m);
  const mid = len < 1e-6 ? { lat: a.lat, lng: a.lng } : { lat: Math.asin(m[2] / len) / RAD, lng: Math.atan2(m[1], m[0]) / RAD };
  return { angle, km: angle * EARTH_KM, mid };
}

function pin(point, kind) {
  const el = document.createElement('div');
  el.className = `globe-pin ${kind}${point.below ? ' below' : ''}`;
  const label = document.createElement('span');
  if (point.label) {
    const name = document.createElement('b');
    name.textContent = point.label;
    label.append(name);
  }
  const code = document.createElement('small');
  code.textContent = point.code;
  label.append(code);
  el.append(document.createElement('i'), label);
  return el;
}

export class GlobeView {
  constructor() {
    this.host = document.createElement('div');
    this.host.className = 'globe-host';
    this.world = null;
    this.ready = null;
    this.offset = [0, 0];
    this.scale = 1;
    this.altitude = 0;
    new ResizeObserver(() => this.resize()).observe(this.host);
  }

  /** Kutubxona va chegaralarni oldindan yuklab qo'yadi (globus hali chizilmaydi). */
  preload() {
    loadLib().catch(() => {});
    loadCountries().catch(() => {});
    // Rasmlar brauzer keshiga tushib tursin — globus ochilganda darhol chiziladi
    this.warm = ['earth.jpg', 'earth-bump.png', 'sky.png'].map((name) => Object.assign(new Image(), { src: `${ASSETS}/${name}` }));
  }

  ensure() {
    this.ready ||= (async () => {
      const [, countries] = await Promise.all([loadLib(), loadCountries()]);
      const world = new window.Globe(this.host, {
        animateIn: false,
        // Rasm kechiksa yoki yuklanmasa ham globus (chegaralar va yo'nalish bilan) ko'rinaveradi
        waitForGlobeReady: false,
        rendererConfig: { antialias: true, alpha: true, powerPreference: 'high-performance' },
      });
      world
        .backgroundColor('rgba(0,0,0,0)')
        .backgroundImageUrl(`${ASSETS}/sky.png`)
        .globeImageUrl(`${ASSETS}/earth.jpg`)
        .bumpImageUrl(`${ASSETS}/earth-bump.png`)
        .showAtmosphere(true)
        .atmosphereColor('#4cc9ff')
        .atmosphereAltitude(0.17)
        .polygonsData(countries)
        .polygonCapColor(() => 'rgba(0,0,0,0)')
        .polygonSideColor(() => 'rgba(0,0,0,0)')
        .polygonStrokeColor(() => 'rgba(110, 231, 255, 0.8)')
        .polygonAltitude(0.008)
        .polygonsTransitionDuration(0)
        .arcColor((d) => d.color)
        .arcStroke((d) => d.stroke)
        .arcAltitudeAutoScale(0.34)
        .arcDashLength((d) => d.dash)
        .arcDashGap((d) => d.gap)
        .arcDashAnimateTime((d) => d.time)
        .arcsTransitionDuration(0)
        .ringColor((d) => (t) => `rgba(${d.rgb}, ${Math.max(0, 1 - t)})`)
        .ringMaxRadius((d) => d.ring)
        .ringPropagationSpeed((d) => d.ring * 0.75)
        .ringRepeatPeriod(900)
        .ringAltitude(0.012)
        .htmlAltitude(0.015)
        .htmlElement((d) => pin(d, d.kind))
        .htmlTransitionDuration(0);
      world.htmlElementVisibilityModifier?.((el, visible) => { el.style.opacity = visible ? '1' : '0'; });

      const controls = world.controls();
      controls.enablePan = false;
      controls.autoRotate = false;
      controls.rotateSpeed = 0.55;
      controls.zoomSpeed = 0.6;
      controls.minDistance = 130;
      controls.maxDistance = 470;

      this.world = world;
      this.resize();
    })().catch((err) => {
      this.ready = null;
      throw err;
    });
    return this.ready;
  }

  /**
   * Globus ustidagi reyslar ro'yxati yo'nalishni to'sib qo'ymasligi uchun:
   * x, y — globus markazini siljitish (px); scale — bo'sh joyning tuval balandligiga nisbati (0..1),
   * shunga qarab kamera uzoqlashtiriladi.
   */
  setFrame(x, y, scale) {
    const next = Math.max(0.35, Math.min(1, scale || 1));
    const changed = Math.abs(next - this.scale) > 0.02;
    this.offset = [Math.round(x), Math.round(y)];
    this.scale = next;
    if (!this.world) return;
    this.world.globeOffset(this.offset);
    if (changed && this.altitude) this.world.pointOfView({ altitude: this.viewAltitude() });
  }

  viewAltitude() {
    return Math.min(3.6, this.altitude / this.scale);
  }

  resize() {
    if (!this.world) return;
    const r = this.host.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    this.world.width(Math.round(r.width)).height(Math.round(r.height)).globeOffset(this.offset);
  }

  pause() {
    this.world?.pauseAnimation();
  }

  /**
   * @param {{ home: Point, dests: Point[], arrival?: boolean }} route
   *   Point = { code, lat, lng, country, label? }. arrival — yo'nalish Toshkentga qarab.
   */
  async show({ home, dests, arrival = false }) {
    await this.ensure();
    const world = this.world;
    const abroad = new Set(dests.map((d) => d.country).filter((c) => c && c !== home.country));
    const isHome = (f) => f.properties.iso === home.country;
    const isDest = (f) => abroad.has(f.properties.iso);

    world
      .polygonCapColor((f) => (isHome(f) ? `rgba(${HOME_RGB}, 0.42)` : isDest(f) ? `rgba(${DEST_RGB}, 0.5)` : 'rgba(0,0,0,0)'))
      .polygonAltitude((f) => (isHome(f) || isDest(f) ? 0.012 : 0.008));

    const arcs = [];
    for (const d of dests) {
      const [from, to] = arrival ? [d, home] : [home, d];
      const ends = { startLat: from.lat, startLng: from.lng, endLat: to.lat, endLng: to.lng };
      // Doimiy chiziq va uning ustidan yo'nalish bo'ylab yuguradigan yorug'lik
      arcs.push({ ...ends, color: ['rgba(200, 248, 255, 0.9)', 'rgba(200, 248, 255, 0.9)'], stroke: 0.42, dash: 1, gap: 0, time: 0 });
      arcs.push({ ...ends, color: ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 1)'], stroke: 0.85, dash: 0.3, gap: 0.7, time: 2200 });
    }
    const nearest = greatCircle(home, dests[0]);
    const ring = Math.max(0.5, Math.min(3.2, nearest.angle / RAD / 9));
    // Yaqin shaharlarda (ichki reyslar) yozuvlar ustma-ust tushmasligi uchun janubdagisining yozuvi pastga qo'yiladi
    const close = nearest.angle < 0.16;
    const homeBelow = close && dests[0].lat > home.lat;

    world
      .arcsData(arcs)
      .ringsData([
        { lat: home.lat, lng: home.lng, rgb: HOME_RGB, ring },
        ...dests.map((d) => ({ lat: d.lat, lng: d.lng, rgb: DEST_RGB, ring })),
      ])
      .htmlElementsData([
        { ...home, kind: 'home', below: homeBelow },
        ...dests.map((d) => ({ ...d, kind: 'dest', below: close && !homeBelow })),
      ]);

    this.resize();
    world.resumeAnimation();
    // Avval Toshkent ustidan ko'rsatib, keyin yo'nalishning o'rtasiga suriladi
    this.altitude = Math.max(0.42, Math.min(2.3, 0.35 + nearest.angle * 2.2));
    const altitude = this.viewAltitude();
    world.pointOfView({ lat: home.lat, lng: home.lng, altitude: Math.min(3.6, altitude + 0.9) }, 0);
    world.pointOfView({ lat: nearest.mid.lat, lng: nearest.mid.lng, altitude }, 1700);
    return nearest;
  }
}
