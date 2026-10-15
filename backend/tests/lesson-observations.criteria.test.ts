import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OBSERVATION_ITEMS, OBSERVATION_MAX_SCORE, OBSERVATION_SECTIONS,
  createObservationSchema, observationDateRange, observationTotal,
} from '../src/modules/lesson-observations/lesson-observations.criteria';

const valid = () => ({
  teacherId: '11111111-1111-4111-8111-111111111111',
  groupName: 'Foundation', topic: 'Algoritmlar',
  studentsEnrolled: 12, studentsPresent: 10,
  strengths: 'Aniq misollar', improvements: 'Vaqtni boshqarish',
  ratings: Object.fromEntries(OBSERVATION_ITEMS.map(item => [item.id, 5])),
});

test('PDF formasi 5 bo‘lim, 19 mezon va 95 balldan iborat', () => {
  assert.deepEqual(OBSERVATION_SECTIONS.map(section => section.items.length), [5, 3, 5, 3, 3]);
  assert.equal(OBSERVATION_MAX_SCORE, 95);
  assert.equal(observationTotal(valid().ratings), 95);
});

test('barcha mezonlar to‘ldirilmasa yoki ball noto‘g‘ri bo‘lsa rad etiladi', () => {
  const missing = valid();
  delete missing.ratings[OBSERVATION_ITEMS[0].id];
  assert.equal(createObservationSchema.safeParse(missing).success, false);
  const invalid = valid();
  invalid.ratings[OBSERVATION_ITEMS[0].id] = 6;
  assert.equal(createObservationSchema.safeParse(invalid).success, false);
  const extra = valid();
  extra.ratings.other = 5;
  assert.equal(createObservationSchema.safeParse(extra).success, false);
});

test('kelganlar ro‘yxatdagidan ko‘p bo‘la olmaydi', () => {
  assert.equal(createObservationSchema.safeParse({ ...valid(), studentsPresent: 13 }).success, false);
  assert.equal(createObservationSchema.safeParse(valid()).success, true);
});

test('sana filtri Toshkent vaqti bilan kunni to‘liq oladi', () => {
  const range = observationDateRange('2026-10-15', '2026-10-15');
  assert.deepEqual(range && { from: range.gte?.toISOString(), to: range.lte?.toISOString() }, {
    from: '2026-10-14T19:00:00.000Z', to: '2026-10-15T18:59:59.999Z',
  });
  assert.equal(observationDateRange('2026-02-30'), null);
  assert.equal(observationDateRange('2026-10-16', '2026-10-15'), null);
});
