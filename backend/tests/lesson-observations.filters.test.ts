import assert from 'node:assert/strict';
import test from 'node:test';
import { observationFilters } from '../src/modules/lesson-observations/lesson-observations.filters';

const own = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';

test('mentor boshqa ustoz ID sini yuborsa ham faqat o‘z baholarini oladi', () => {
  const result = observationFilters({ teacherId: other, page: '2' }, own);
  assert.equal(result.where.teacherId, own);
  assert.equal(result.page, 2);
});

test('admin ustoz va sana bo‘yicha filtrlay oladi', () => {
  const result = observationFilters({ teacherId: other, from: '2026-10-01', to: '2026-10-15' });
  assert.equal(result.where.teacherId, other);
  assert.deepEqual(result.where.createdAt, {
    gte: new Date('2026-09-30T19:00:00.000Z'),
    lte: new Date('2026-10-15T18:59:59.999Z'),
  });
});

test('noto‘g‘ri filtrlar rad etiladi', () => {
  assert.throws(() => observationFilters({ teacherId: 'bad' }));
  assert.throws(() => observationFilters({ page: '-1' }));
  assert.throws(() => observationFilters({ from: ['2026-10-15'] }));
});
