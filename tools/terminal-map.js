// Toshkent xalqaro aeroporti — terminal xaritasi (tools/terminal.jpg, 3670x2523 px) uchun
// to'siqlar va nuqtalar. Koordinatalar shu rasm piksellarida.
//
// Devorlar rasmga qarab qo'lda chizilgan — taxminiy. Aniqlashtirish: admin panel → Xarita.
// `node tools/import-map.mjs` bu faylni bazaga yozadi (kiosk joyi saqlanib qoladi).

const wall = (points, width = 20) => ({ type: 'wall', points, width });
const poly = (points) => ({ type: 'poly', points });
const rect = (x0, y0, x1, y1) => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);

export const FLOOR = {
  name: 'Xalqaro terminal — uchish zali',
  image: 'terminal.jpg',
  width: 3670,
  height: 2523,
  obstacles: [
    // --- binoning tashqi devori (yopiq kontur) ---
    wall([
      [590, 616], [806, 612], [838, 812], [840, 888], [1085, 888], [1085, 812], // C yo'laklari va zalning shimoli-g'arbi
      [2800, 812], [2800, 605], [2716, 605], [2716, 315], [2974, 315], [2974, 605], [2898, 605], // shimoliy devor, A yo'laklari
      [2902, 1945], [2705, 1945], [2705, 2045], [2592, 2045], [2592, 2158], // sharqiy qanot (CIP/VIP)
      [1530, 2158], [1530, 1625], [1495, 1625], [1495, 1502], [702, 1502], // kirish tomoni, g'arbiy yo'lak
      [630, 945], [610, 845], [590, 616],
    ], 22),

    // --- C yo'laklari ---
    poly([[768, 850], [838, 850], [840, 890], [895, 890], [895, 905], [850, 950], [820, 1012], [795, 1012]]), // C1 yonidagi zinali blok
    wall([[712, 850], [735, 1040], [745, 1100], [757, 1300]], 16), // C2 yo'lagi bilan zal orasidagi devor

    // --- uchish zali (yuqori) bilan pasport nazorati zonasi orasidagi qator ---
    wall([[848, 1310], [848, 1395], [1600, 1395]]),
    wall([[1600, 1368], [1745, 1368]], 60), // lift bloki; 1745–1835 — o'tish joyi (xavfsizlik nazorati)
    wall([[1835, 1368], [1975, 1368]], 60),
    wall([[1975, 1392], [2160, 1392]]), // 2160–2250 — ikkinchi o'tish joyi
    // Sharqiy nazorat punkti (CIP/VIP tomonidan A yo'lagiga) marshrutlar uchun yopiq:
    // oddiy yo'lovchi pasport nazoratini chetlab o'tmasligi kerak.
    wall([[2250, 1392], [2900, 1392]]),
    wall([[2787, 1055], [2787, 1392]], 30), // zalning sharqiy uchi va A yo'lagi orasida

    // --- pasport nazorati qatori: kabinalar orasidagi uchta o'tish joyi ---
    wall([[1495, 1505], [1700, 1505]]),
    wall([[1775, 1505], [1865, 1505]]),
    wall([[1940, 1505], [2130, 1505]]),
    wall([[2205, 1505], [2420, 1505], [2420, 1392]]),

    // --- ro'yxatdan o'tish peshtaxtalari va lift shaxtalari ---
    rect(1755, 1595, 1800, 1685),
    rect(1945, 1595, 1990, 1687),
    rect(2155, 1588, 2200, 1680),
    rect(2335, 1590, 2378, 1683),
    rect(1650, 1605, 1695, 1655),
    rect(2020, 1602, 2080, 1700),
  ],
};

// Kiosk joyi taxminiy (ro'yxatdan o'tish zali, kirish nazoratidan keyin). Haqiqiy joyini admin panelda belgilang.
export const KIOSK = { x: 2063, y: 1930, name: 'Kiosk 1' };

const gate = (code, x, y) => ({
  category: 'gate', x, y,
  uz: `${code} chiqish yoʻlagi`, ru: `Выход ${code}`, en: `Gate ${code}`,
});

export const PLACES = [
  gate('A1', 2940, 560),
  gate('A2', 2760, 560),
  gate('B3', 1710, 870),
  gate('C1', 925, 962),
  gate('C2', 668, 900),
  gate('C3', 640, 740),

  { category: 'checkin', x: 1872, y: 1640, uz: 'Roʻyxatdan oʻtish — 1-zona', ru: 'Регистрация — зона 1', en: 'Check-in area 1' },
  { category: 'checkin', x: 2267, y: 1640, uz: 'Roʻyxatdan oʻtish — 2-zona', ru: 'Регистрация — зона 2', en: 'Check-in area 2' },

  { category: 'security', x: 2063, y: 2060, uz: 'Terminalga kirish nazorati', ru: 'Входной контроль в терминал', en: 'Terminal security control', desc: 'Terminalga kirishdagi tekshiruv' },
  { category: 'security', x: 1820, y: 1562, uz: 'Pasport nazorati', ru: 'Паспортный контроль', en: 'Passport control', desc: 'Roʻyxatdan oʻtish zalidan keyin' },
  { category: 'security', x: 1790, y: 1300, uz: 'Aviatsiya xavfsizligi nazorati — markaziy 1', ru: 'Контроль авиабезопасности — центр 1', en: 'Aviation security control — central 1', desc: 'Pasport nazoratidan keyin' },
  { category: 'security', x: 2205, y: 1310, uz: 'Aviatsiya xavfsizligi nazorati — markaziy 2', ru: 'Контроль авиабезопасности — центр 2', en: 'Aviation security control — central 2', desc: 'Pasport nazoratidan keyin' },
  { category: 'security', x: 850, y: 1455, uz: 'Aviatsiya xavfsizligi nazorati — gʻarbiy', ru: 'Контроль авиабезопасности — западный', en: 'Aviation security control — west', desc: 'C chiqish yoʻlaklari tomonida' },
  { category: 'security', x: 2850, y: 1262, uz: 'Aviatsiya xavfsizligi nazorati — sharqiy', ru: 'Контроль авиабезопасности — восточный', en: 'Aviation security control — east', desc: 'A chiqish yoʻlaklari tomonida' },

  { category: 'shop', x: 1558, y: 1018, uz: 'Duty Free 1', ru: 'Duty Free 1', en: 'Duty Free 1', desc: 'Art Bazaar yonida' },
  { category: 'shop', x: 1800, y: 1110, uz: 'Duty Free 2', ru: 'Duty Free 2', en: 'Duty Free 2', desc: 'Uchish zalining markazida' },
  { category: 'shop', x: 2223, y: 1105, uz: 'Duty Free 3', ru: 'Duty Free 3', en: 'Duty Free 3', desc: 'Uchish zalining markazida' },
  { category: 'shop', x: 2385, y: 958, uz: 'Duty Free 4', ru: 'Duty Free 4', en: 'Duty Free 4', desc: 'A chiqish yoʻlaklari tomonida' },
  { category: 'shop', x: 1285, y: 1095, uz: 'Art Bazaar', ru: 'Art Bazaar', en: 'Art Bazaar' },

  { category: 'cafe', x: 1080, y: 1328, uz: 'Food City', ru: 'Food City', en: 'Food City', desc: 'C chiqish yoʻlaklari tomonida' },
  { category: 'cafe', x: 1150, y: 1205, uz: 'Kafe va restoranlar — gʻarbiy qism', ru: 'Кафе и рестораны — западная часть', en: 'Cafés and restaurants — west side', desc: 'C chiqish yoʻlaklari tomonida' },
  { category: 'cafe', x: 2445, y: 1205, uz: 'Kafe va restoranlar — sharqiy qism', ru: 'Кафе и рестораны — восточная часть', en: 'Cafés and restaurants — east side', desc: 'A chiqish yoʻlaklari tomonida' },

  { category: 'lounge', x: 1335, y: 1320, uz: 'Anjir biznes-zali', ru: 'Бизнес-зал Anjir', en: 'Anjir Business Lounge' },
  { category: 'lounge', x: 2530, y: 1280, uz: 'Anor biznes-zali', ru: 'Бизнес-зал Anor', en: 'Anor Business Lounge' },
  { category: 'lounge', x: 2590, y: 1595, uz: 'CIP zali', ru: 'CIP-зал', en: 'CIP Lounge' },
  { category: 'lounge', x: 2715, y: 1900, uz: 'VIP zali', ru: 'VIP-зал', en: 'VIP Lounge' },

  { category: 'exit', x: 2063, y: 2122, uz: 'Kirish va chiqish', ru: 'Вход и выход', en: 'Entrance and exit', desc: 'Terminalning asosiy eshiklari' },
];
