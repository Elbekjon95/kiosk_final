// Interfeys matnlari (kiosk). AI javoblari istalgan tilda bo'ladi — bu faqat tugma va yozuvlar uchun.
export const LANGS = [
  { code: 'uz', label: 'Oʻzbek' },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
];

const T = {
  map: { uz: 'Xarita', ru: 'Карта', en: 'Map' },
  operator: { uz: 'Operator', ru: 'Оператор', en: 'Operator' },
  flights: { uz: 'Reyslar', ru: 'Рейсы', en: 'Flights' },
  feedback: { uz: 'Murojaat', ru: 'Обращение', en: 'Feedback' },
  askPlaceholder: { uz: 'Savolingizni yozing…', ru: 'Напишите ваш вопрос…', en: 'Type your question…' },
  tapMic: {
    uz: 'Savol berish uchun mikrofonni bosing',
    ru: 'Нажмите на микрофон, чтобы задать вопрос',
    en: 'Tap the microphone to ask a question',
  },
  listening: { uz: 'Tinglayapman…', ru: 'Слушаю…', en: 'Listening…' },
  thinking: { uz: 'Oʻylayapman…', ru: 'Думаю…', en: 'Thinking…' },
  speaking: { uz: 'Javob beryapman', ru: 'Отвечаю', en: 'Answering' },
  you: { uz: 'Siz', ru: 'Вы', en: 'You' },
  notHeard: {
    uz: 'Eshitmadim. Mikrofonni bosib, qaytadan ayting.',
    ru: 'Я не расслышал. Нажмите на микрофон и повторите.',
    en: "I didn't catch that. Tap the microphone and try again.",
  },
  errorGeneric: {
    uz: 'Kechirasiz, hozir javob bera olmadim. Birozdan soʻng qayta urinib koʻring.',
    ru: 'Извините, сейчас не удалось ответить. Попробуйте ещё раз чуть позже.',
    en: "Sorry, I couldn't answer right now. Please try again in a moment.",
  },
  aiOff: {
    uz: 'AI xizmati hali sozlanmagan. Xarita va reyslar boʻlimidan foydalanishingiz mumkin.',
    ru: 'Сервис ИИ ещё не настроен. Вы можете пользоваться картой и табло рейсов.',
    en: 'The AI service is not configured yet. You can still use the map and flights.',
  },
  micDenied: {
    uz: 'Mikrofonga ruxsat berilmagan. Savolingizni yozib yuborishingiz mumkin.',
    ru: 'Нет доступа к микрофону. Вы можете написать свой вопрос.',
    en: 'Microphone access is not allowed. You can type your question instead.',
  },
  offline: { uz: 'Server bilan aloqa yoʻq. Qayta ulanmoqda…', ru: 'Нет связи с сервером. Переподключение…', en: 'No connection to the server. Reconnecting…' },
  close: { uz: 'Yopish', ru: 'Закрыть', en: 'Close' },
  send: { uz: 'Yuborish', ru: 'Отправить', en: 'Send' },

  departures: { uz: 'Uchish', ru: 'Вылет', en: 'Departures' },
  arrivals: { uz: 'Qoʻnish', ru: 'Прилёт', en: 'Arrivals' },
  allTerminals: { uz: 'Barcha terminallar', ru: 'Все терминалы', en: 'All terminals' },
  searchFlight: { uz: 'Shahar yoki reys raqami…', ru: 'Город или номер рейса…', en: 'City or flight number…' },
  colTime: { uz: 'Vaqt', ru: 'Время', en: 'Time' },
  colFlight: { uz: 'Reys', ru: 'Рейс', en: 'Flight' },
  colTo: { uz: 'Yoʻnalish', ru: 'Направление', en: 'Destination' },
  colFrom: { uz: 'Qayerdan', ru: 'Откуда', en: 'From' },
  colStatus: { uz: 'Holati', ru: 'Статус', en: 'Status' },
  colDesks: { uz: 'Peshtaxta', ru: 'Стойки', en: 'Desks' },
  colBelt: { uz: 'Bagaj', ru: 'Багаж', en: 'Belt' },
  noFlights: { uz: 'Reys topilmadi', ru: 'Рейсы не найдены', en: 'No flights found' },
  flightsStale: { uz: 'Maʼlumot yangilanmayapti', ru: 'Данные не обновляются', en: 'Data is not updating' },
  updatedAt: { uz: 'Yangilandi', ru: 'Обновлено', en: 'Updated' },
  tapFlight: {
    uz: 'Reysni bosing: roʻyxatdan oʻtish ochiq boʻlsa — xaritada peshtaxtalarga yoʻl, aks holda — globusda yoʻnalish',
    ru: 'Нажмите на рейс: если регистрация открыта — путь к стойкам на карте, иначе — маршрут на глобусе',
    en: 'Tap a flight: if check-in is open — the way to the desks on the map, otherwise — the route on the globe',
  },
  route: { uz: 'Yoʻnalish', ru: 'Маршрут', en: 'Route' },
  homeCity: { uz: 'Toshkent', ru: 'Ташкент', en: 'Tashkent' },
  upcomingFlights: { uz: 'Yaqin reyslar', ru: 'Ближайшие рейсы', en: 'Upcoming flights' },
  allFlights: { uz: 'Barcha reyslar', ru: 'Все рейсы', en: 'All flights' },
  timeWindow: { uz: 'Yaqin soatlar: {from}–{to}', ru: 'Ближайшие часы: {from}–{to}', en: 'Next hours: {from}–{to}' },
  today: { uz: 'Bugun', ru: 'Сегодня', en: 'Today' },

  weatherTitle: { uz: 'Manzil shaharlar ob-havosi', ru: 'Погода в городах назначения', en: 'Weather at destinations' },
  humidity: { uz: 'Namlik', ru: 'Влажность', en: 'Humidity' },
  loadMore: { uz: 'Koʻproq yuklash ({n} ta qoldi)', ru: 'Показать ещё (осталось {n})', en: 'Load more ({n} left)' },
  noWeather: { uz: 'Maʼlumot yoʻq', ru: 'Нет данных', en: 'No data' },
  weatherOff: { uz: 'Ob-havo xizmati hali sozlanmagan', ru: 'Сервис погоды ещё не настроен', en: 'The weather service is not configured yet' },
  noDestinations: { uz: 'Hozircha uchib ketadigan reyslar yoʻq', ru: 'Пока нет предстоящих вылетов', en: 'No upcoming departures right now' },
  weatherHint: { uz: 'Shaharni bossangiz, yoʻnalish globusda koʻrinadi', ru: 'Нажмите на город, чтобы увидеть маршрут на глобусе', en: 'Tap a city to see the route on the globe' },
  tomorrow: { uz: 'Ertaga', ru: 'Завтра', en: 'Tomorrow' },

  mapTitle: { uz: 'Aerovokzal xaritasi', ru: 'Карта аэровокзала', en: 'Terminal map' },
  services: { uz: 'Xizmatlar', ru: 'Услуги', en: 'Services' },
  gates: { uz: 'Darvozalar', ru: 'Выходы', en: 'Gates' },
  zoomIn: { uz: 'Kattalashtirish', ru: 'Увеличить', en: 'Zoom in' },
  zoomOut: { uz: 'Kichraytirish', ru: 'Уменьшить', en: 'Zoom out' },
  zoomFit: { uz: 'Toʻliq koʻrsatish', ru: 'Показать целиком', en: 'Fit to screen' },
  askVoice: { uz: 'Savol berish', ru: 'Задать вопрос', en: 'Ask a question' },
  youAreHere: { uz: 'Siz shu yerdasiz', ru: 'Вы здесь', en: 'You are here' },
  searchPlace: { uz: 'Joy qidirish…', ru: 'Поиск места…', en: 'Search places…' },
  allPlaces: { uz: 'Hammasi', ru: 'Все', en: 'All' },
  pickPlace: { uz: 'Roʻyxatdan yoki xaritadan joyni tanlang', ru: 'Выберите место в списке или на карте', en: 'Pick a place from the list or the map' },
  noMap: { uz: 'Xarita hali yuklanmagan', ru: 'Карта ещё не загружена', en: 'The map has not been uploaded yet' },
  noRoute: { uz: 'Bu joyga yoʻl topilmadi', ru: 'Маршрут к этому месту не найден', en: 'No route to this place was found' },
  noKiosk: { uz: 'Kiosk joyi belgilanmagan', ru: 'Положение киоска не задано', en: 'Kiosk position is not set' },
  walk: { uz: '≈ {m} m · {min} daqiqa piyoda', ru: '≈ {m} м · {min} мин пешком', en: '≈ {m} m · {min} min walk' },
  goVia: { uz: '{via} orqali «{floor}» ga oʻting', ru: 'Перейдите на «{floor}» через: {via}', en: 'Take {via} to “{floor}”' },
  step: { uz: '{n}-qadam', ru: 'Шаг {n}', en: 'Step {n}' },

  fbTitle: { uz: 'Shikoyat yoki taklif qoldiring', ru: 'Оставьте жалобу или предложение', en: 'Leave a complaint or suggestion' },
  fbComplaint: { uz: 'Shikoyat', ru: 'Жалоба', en: 'Complaint' },
  fbSuggestion: { uz: 'Taklif', ru: 'Предложение', en: 'Suggestion' },
  fbThanks: { uz: 'Minnatdorchilik', ru: 'Благодарность', en: 'Thanks' },
  fbPlaceholder: { uz: 'Fikringizni yozing yoki mikrofonni bosib ayting…', ru: 'Напишите или надиктуйте ваше сообщение…', en: 'Type or dictate your message…' },
  fbContact: { uz: 'Telefon yoki e-mail (ixtiyoriy)', ru: 'Телефон или e-mail (необязательно)', en: 'Phone or e-mail (optional)' },
  fbDone: { uz: 'Rahmat! Murojaatingiz qabul qilindi.', ru: 'Спасибо! Ваше обращение принято.', en: 'Thank you! Your feedback has been received.' },
  fbShort: { uz: 'Iltimos, murojaat matnini kiriting.', ru: 'Пожалуйста, введите текст обращения.', en: 'Please enter your message.' },
  fbDictate: { uz: 'Ovoz bilan kiritish', ru: 'Надиктовать', en: 'Dictate' },
  opTitle: { uz: 'Operator bilan bogʻlanish', ru: 'Связь с оператором', en: 'Contact an operator' },
};

let current = 'uz';
export const getLang = () => current;
export const setLang = (code) => {
  current = LANGS.some((l) => l.code === code) ? code : 'uz';
  document.documentElement.lang = current;
};

export function t(key, vars) {
  let s = T[key]?.[current] ?? T[key]?.uz ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}

/** { uz, ru, en } ko'rinishidagi obyektdan joriy tildagi matn. */
export const pick = (obj) => (obj && (obj[current] || obj.uz || obj.en || obj.ru)) || '';

export const placeName = (p) => (p && (p[`name_${current}`] || p.name_uz)) || '';

// Brauzerda davlat nomlarining o'zbekchasi yo'q (ruscha chiqadi) — Toshkentdan uchiladigan davlatlar uchun o'zimiz yozamiz.
const COUNTRIES_UZ = {
  UZ: 'Oʻzbekiston', TR: 'Turkiya', RU: 'Rossiya', AE: 'Birlashgan Arab Amirliklari', KZ: 'Qozogʻiston', KG: 'Qirgʻiziston',
  TJ: 'Tojikiston', TM: 'Turkmaniston', AZ: 'Ozarbayjon', GE: 'Gruziya', AM: 'Armaniston', BY: 'Belarus', UA: 'Ukraina',
  CN: 'Xitoy', HK: 'Gonkong', KR: 'Janubiy Koreya', JP: 'Yaponiya', MN: 'Mongoliya', IN: 'Hindiston', PK: 'Pokiston',
  AF: 'Afgʻoniston', BD: 'Bangladesh', NP: 'Nepal', LK: 'Shri-Lanka', MV: 'Maldiv orollari', IR: 'Eron', IQ: 'Iroq',
  SA: 'Saudiya Arabistoni', QA: 'Qatar', KW: 'Quvayt', BH: 'Bahrayn', OM: 'Ummon', JO: 'Iordaniya', IL: 'Isroil',
  EG: 'Misr', TH: 'Tailand', MY: 'Malayziya', SG: 'Singapur', VN: 'Vyetnam', ID: 'Indoneziya', US: 'AQSH', CA: 'Kanada',
  GB: 'Buyuk Britaniya', DE: 'Germaniya', FR: 'Fransiya', IT: 'Italiya', ES: 'Ispaniya', PT: 'Portugaliya',
  NL: 'Niderlandiya', BE: 'Belgiya', CH: 'Shveysariya', AT: 'Avstriya', PL: 'Polsha', CZ: 'Chexiya', HU: 'Vengriya',
  GR: 'Gretsiya', CY: 'Kipr', BG: 'Bolgariya', RS: 'Serbiya', ME: 'Chernogoriya', LV: 'Latviya', LT: 'Litva',
  EE: 'Estoniya', FI: 'Finlandiya', SE: 'Shvetsiya', NO: 'Norvegiya', DK: 'Daniya',
};

/** ISO kodi bo'yicha davlat nomi joriy tilda (o'zbekchasi bo'lmasa — inglizcha). */
export function countryName(code) {
  if (current === 'uz' && COUNTRIES_UZ[code]) return COUNTRIES_UZ[code];
  try {
    return new Intl.DisplayNames([current === 'uz' ? 'en' : current], { type: 'region' }).of(code) || '';
  } catch {
    return '';
  }
}

const STATUS = [
  [/^on schedule$/i, { uz: 'Jadval boʻyicha', ru: 'По расписанию' }],
  [/^departed\s*/i, { uz: 'Uchib ketdi ', ru: 'Вылетел ' }],
  [/^arrived\s*/i, { uz: 'Qoʻndi ', ru: 'Прибыл ' }],
  [/^landed\s*/i, { uz: 'Qoʻndi ', ru: 'Прибыл ' }],
  [/^delayed until\s*/i, { uz: 'Kechikmoqda, yangi vaqt ', ru: 'Задержан до ' }],
  [/^delayed\s*/i, { uz: 'Kechikmoqda ', ru: 'Задержан ' }], // "Delayed" va "Delayed 17:14"
  [/^expected in\s*/i, { uz: 'Kutilmoqda ', ru: 'Ожидается в ' }],
  [/^check-?in open$/i, { uz: 'Roʻyxatdan oʻtish ochiq', ru: 'Регистрация открыта' }],
  [/^check-?in closed$/i, { uz: 'Roʻyxatdan oʻtish yopildi', ru: 'Регистрация закрыта' }],
  [/^boarding$/i, { uz: 'Samolyotga chiqish', ru: 'Посадка' }],
  [/^flight cancelled$/i, { uz: 'Bekor qilindi', ru: 'Отменён' }],
  [/^cancelled$/i, { uz: 'Bekor qilindi', ru: 'Отменён' }],
];

// OpenWeather holat kodlari (https://openweathermap.org/weather-conditions) — o'zbekchasi API da yo'q, o'zimiz yozamiz.
const WEATHER = {
  thunder: { uz: 'Momaqaldiroq', ru: 'Гроза', en: 'Thunderstorm' },
  drizzle: { uz: 'Shivalab yomgʻir', ru: 'Морось', en: 'Drizzle' },
  rain: { uz: 'Yomgʻir', ru: 'Дождь', en: 'Rain' },
  heavyRain: { uz: 'Kuchli yomgʻir', ru: 'Сильный дождь', en: 'Heavy rain' },
  sleet: { uz: 'Qor aralash yomgʻir', ru: 'Мокрый снег', en: 'Sleet' },
  snow: { uz: 'Qor', ru: 'Снег', en: 'Snow' },
  fog: { uz: 'Tuman', ru: 'Туман', en: 'Fog' },
  haze: { uz: 'Gʻubor', ru: 'Дымка', en: 'Haze' },
  dust: { uz: 'Chang', ru: 'Пыль', en: 'Dust' },
  squall: { uz: 'Kuchli shamol', ru: 'Шквал', en: 'Squalls' },
  tornado: { uz: 'Tornado', ru: 'Торнадо', en: 'Tornado' },
  clear: { uz: 'Ochiq osmon', ru: 'Ясно', en: 'Clear sky' },
  few: { uz: 'Biroz bulutli', ru: 'Малооблачно', en: 'Few clouds' },
  scattered: { uz: 'Qisman bulutli', ru: 'Переменная облачность', en: 'Scattered clouds' },
  broken: { uz: 'Bulutli', ru: 'Облачно', en: 'Broken clouds' },
  overcast: { uz: 'Qalin bulutli', ru: 'Пасмурно', en: 'Overcast' },
};

function weatherGroup(id) {
  if (id >= 200 && id < 300) return 'thunder';
  if (id >= 300 && id < 400) return 'drizzle';
  if (id === 511 || (id >= 611 && id <= 616)) return 'sleet';
  if (id >= 500 && id < 600) return [500, 501, 520, 521].includes(id) ? 'rain' : 'heavyRain';
  if (id >= 600 && id < 700) return 'snow';
  if (id === 701 || id === 741) return 'fog';
  if (id === 711 || id === 721) return 'haze';
  if (id === 771) return 'squall';
  if (id === 781) return 'tornado';
  if (id >= 700 && id < 800) return 'dust';
  return { 800: 'clear', 801: 'few', 802: 'scattered', 803: 'broken', 804: 'overcast' }[id] || '';
}

/** OpenWeather holat kodi → joriy tildagi nom (noma'lum kod bo'lsa API ning inglizcha matni). */
export function weatherText(id, fallback = '') {
  const tr = WEATHER[weatherGroup(Number(id))];
  if (tr) return tr[current] || tr.en;
  return fallback ? fallback[0].toUpperCase() + fallback.slice(1) : '';
}

/** FIDS dagi inglizcha holatni joriy tilga o'giradi (noma'lum holat o'zgarishsiz qoladi). */
export function flightStatus(text) {
  if (current === 'en') return text;
  for (const [re, tr] of STATUS) {
    if (re.test(text)) return text.replace(re, tr[current]).trim();
  }
  return text;
}
