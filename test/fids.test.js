import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSchedule, searchFlights } from '../server/fids.js';
import { parseReply } from '../server/ai.js';
import { destinationCities } from '../server/weather.js';

const row = (time, airline, num, city, code, cls, status, desk) => `
  <tr>
    <td class="flight-time"> ${time} </td>
    <td><div class="airline-logo"><img src="x/${airline}.png" alt="${airline}"/></div></td>
    <td class="flight-number"> ${num} </td>
    <td class="flight-destination"><span class="city">${city}</span> <span class="code">(${code})</span></td>
    <td class="flight-status"><span class="status-badge ${cls}"> ${status} </span></td>
    <td class="flight-gate"> ${desk} </td>
  </tr>`;

const HTML = `<table class="flights-table"><thead><tr><th>ВРЕМЯ</th></tr></thead><tbody>
  <tr class="date-row"><td colspan="6"><div class="date-header"> 10 NOVEMBER 2099 </div></td></tr>
  ${row('09:55', 'TK', 'TK 369', 'ISTANBUL', 'IST', 'status-departed', 'Departed 10:03', '15 - 18')}
  ${row('14:10', 'HY', 'HY 601', 'MOSCOW', 'DME', 'status-delayed', 'Delayed until 15:00', '—')}
  <tr class="date-row"><td colspan="6"><div class="date-header"> 11 NOVEMBER 2099 </div></td></tr>
  ${row('06:30', 'HY', 'HY 271', 'ISTANBUL', 'IST', 'status-boarding', 'On schedule', '')}
</tbody></table>`;

test('FIDS jadvali toʻgʻri oʻqiladi', () => {
  const flights = parseSchedule(HTML, 'TAS2', 'DEPARTURE');
  assert.equal(flights.length, 3);
  assert.deepEqual(
    { ...flights[0], ts: undefined },
    {
      airport: 'TAS2', type: 'DEPARTURE', date: '2099-11-10', time: '09:55', ts: undefined, airline: 'TK',
      flight: 'TK 369', city: 'ISTANBUL', code: 'IST', status: 'Departed 10:03', statusKind: 'departed', desk: '15 - 18',
    },
  );
  assert.equal(flights[0].ts, Date.parse('2099-11-10T04:55:00Z'), 'vaqt Toshkent (UTC+5) boʻyicha');
  assert.equal(flights[1].statusKind, 'delayed');
  assert.equal(flights[1].desk, '');
  assert.equal(flights[2].date, '2099-11-11');
  assert.equal(flights[2].statusKind, 'scheduled');
});

test('reys qidirish: shahar, kod, reys raqami, sana', () => {
  const src = parseSchedule(HTML, 'TAS2', 'DEPARTURE');
  assert.equal(searchFlights({ direction: 'departure', query: 'istanbul' }, src).flights.length, 2);
  assert.equal(searchFlights({ direction: 'departure', query: 'DME' }, src).flights[0].flight, 'HY 601');
  assert.equal(searchFlights({ direction: 'any', query: 'hy601' }, src).flights[0].city, 'MOSCOW');
  assert.equal(searchFlights({ direction: 'departure', query: 'IST', date: '2099-11-11' }, src).flights.length, 1);
  assert.equal(searchFlights({ direction: 'arrival', query: 'IST' }, src).flights.length, 0);
  const miss = searchFlights({ direction: 'departure', query: 'Stambul' }, src);
  assert.equal(miss.flights.length, 0);
  assert.deepEqual(miss.available_cities, ['ISTANBUL (IST)', 'MOSCOW (DME)']);
});

test('umumiy savol: faqat [hozir − 1 soat, hozir + 4 soat] oynasi; yoʻnalish soʻralsa oyna yoʻq', () => {
  const now = Date.parse('2099-11-10T14:14:00+05:00');
  const mk = (time, city, code, date = '2099-11-10') => ({
    airport: 'TAS2', type: 'DEPARTURE', date, time, ts: Date.parse(`${date}T${time}:00+05:00`),
    airline: 'HY', flight: `HY ${time.replace(':', '')}`, city, code, status: 'On schedule', statusKind: 'scheduled', desk: '',
  });
  const src = [
    mk('13:00', 'MOSCOW', 'DME'), // 1 soatdan ko'proq oldin — kirmaydi
    mk('13:14', 'DUBAI', 'DXB'), // chegara — kiradi
    mk('15:30', 'ISTANBUL', 'IST'),
    mk('18:14', 'BAKU', 'GYD'), // chegara — kiradi
    mk('18:30', 'ISTANBUL', 'IST'), // 4 soatdan keyin — kirmaydi
    mk('09:00', 'ISTANBUL', 'IST', '2099-11-11'),
  ];
  const general = searchFlights({ direction: 'departure', query: '' }, src, now);
  assert.deepEqual(general.flights.map((f) => f.time), ['13:14', '15:30', '18:14']);
  assert.deepEqual(general.time_window, { from: '13:14', to: '18:14' });

  const city = searchFlights({ direction: 'departure', query: 'ISTANBUL' }, src, now);
  assert.deepEqual(city.flights.map((f) => f.time), ['15:30'], 'yoʻnalish boʻyicha ham faqat yaqin soatlar');
  assert.equal(city.outside_window, undefined);

  const later = searchFlights({ direction: 'departure', query: 'SEOUL' },
    [...src, mk('23:50', 'SEOUL', 'ICN'), mk('10:00', 'SEOUL', 'ICN', '2099-11-11')], now);
  assert.deepEqual(later.flights.map((f) => f.time), ['23:50', '10:00'], 'oynada boʻlmasa — keyingi eng yaqinlari');
  assert.equal(later.outside_window, true);

  const day = searchFlights({ direction: 'departure', query: '', date: '2099-11-11' }, src, now);
  assert.deepEqual(day.flights.map((f) => f.city), ['ISTANBUL'], 'sana berilsa — butun kun');
});

test('manzil shaharlar: uchib ketganlar chiqmaydi, shahar takrorlanmaydi, eng yaqini birinchi', () => {
  const now = Date.parse('2099-11-10T14:00:00+05:00');
  const mk = (time, city, code, statusKind = 'scheduled') => ({
    type: 'DEPARTURE', date: '2099-11-10', time, ts: Date.parse(`2099-11-10T${time}:00+05:00`), flight: `X ${time}`, city, code, statusKind,
  });
  const cities = destinationCities({
    now,
    flights: [
      mk('12:00', 'MOSCOW', 'SVO', 'departed'),
      mk('13:30', 'DUBAI', 'DXB', 'delayed'), // kechikkan — hali uchmagan
      mk('15:00', 'ISTANBUL', 'IST'),
      mk('16:00', 'ISTANBUL', 'SAW'),
      mk('17:00', 'MOSCOW', 'SVO', 'cancelled'),
    ],
  });
  assert.deepEqual(cities.map((c) => c.city), ['DUBAI', 'ISTANBUL']);
  assert.equal(cities[1].next.time, '15:00');
  assert.equal(typeof cities[0].lat, 'number', 'koordinatalar aeroport kodidan olinadi');
});

test('model javobi yumshoq tahlil qilinadi', () => {
  const ok = parseReply('```json\n{"heard":"salom","lang":"uz","answer":"Salom!","action":{"type":"none"}}\n```');
  assert.equal(ok.answer, 'Salom!');
  const wrapped = parseReply('Mana javob: {"heard":"a","lang":"ru","answer":"Привет","action":{"type":"none"}} ');
  assert.equal(wrapped.lang, 'ru');
  const plain = parseReply('Oddiy matn');
  assert.equal(plain.answer, 'Oddiy matn');
  assert.equal(plain.action.type, 'none');
});
