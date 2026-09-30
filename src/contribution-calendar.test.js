import assert from 'node:assert/strict';
import test from 'node:test';
import { calendarLayout } from './contribution-calendar.js';

test('positions weekdays across year and leap-day boundaries without overlapping month labels', () => {
  const days = Array.from({ length: 50 }, (_, index) => ({
    date: new Date(Date.UTC(2024, 1, 28) + index * 86_400_000).toISOString().slice(0, 10),
    count: 0, level: 0,
  }));
  const layout = calendarLayout(days);
  assert.equal(layout.cells[0].row, 3);
  assert.equal(layout.cells[1].date, '2024-02-29');
  assert.equal(layout.cells[1].row, 4);
  assert.equal(layout.cells[4].row, 0);
  assert.equal(layout.cells[4].column, 1);
  assert.deepEqual(layout.months, [{ column: 0, label: '3月' }, { column: 5, label: '4月' }]);
  assert.equal(layout.columns, 8);
  const newYear = calendarLayout([{ date: '2025-12-31' }, { date: '2026-01-01' }]);
  assert.deepEqual(newYear.months, [{ column: 0, label: '1月' }]);
});
