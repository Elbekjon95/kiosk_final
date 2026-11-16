import test from 'node:test';
import assert from 'node:assert/strict';
import { airportGeo, geoForFlights, HOME_CODE } from '../server/geo.js';

test('airportGeo: asosiy aeroportlar koordinatasi va davlati', () => {
  const tas = airportGeo(HOME_CODE);
  assert.equal(tas.country, 'UZ');
  assert.ok(Math.abs(tas.lat - 41.26) < 0.1 && Math.abs(tas.lng - 69.28) < 0.1);
  assert.equal(airportGeo('ist').country, 'TR');
  assert.equal(airportGeo('FRU').country, 'KG'); // qo'shimcha jadvaldan
  assert.equal(airportGeo('ZZZ'), null);
  assert.equal(airportGeo(''), null);
});

test('geoForFlights: faqat ma\'lum kodlar, takrorlanmasdan', () => {
  const geo = geoForFlights([{ code: 'IST' }, { code: 'IST' }, { code: 'SKD' }, { code: '???' }]);
  assert.deepEqual(Object.keys(geo).sort(), ['IST', 'SKD']);
  assert.equal(geo.SKD.country, 'UZ');
});
