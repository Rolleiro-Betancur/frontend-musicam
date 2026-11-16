import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bogotaLocalToIso,
  formatDate,
  formatDateTime,
  formatTime,
} from '../../src/shared/utils/format-date.js';

const normal = (s) => s.replace(/\s/g, ' ');

test('muestra la hora en America/Bogota (UTC-5), no en UTC', () => {
  // 01:00 UTC del 5 de dic = 8:00 p. m. del 4 de dic en Bogotá.
  const iso = '2026-12-05T01:00:00+00:00';
  assert.equal(normal(formatDateTime(iso)), '4 de dic de 2026, 08:00 p. m.');
  assert.equal(normal(formatTime(iso)), '08:00 p. m.');
  assert.equal(normal(formatDate(iso)), '04 de dic de 2026');
});

test('fechas inválidas o vacías devuelven un guion', () => {
  assert.equal(formatDate(null), '—');
  assert.equal(formatDateTime('no-es-fecha'), '—');
});

test('bogotaLocalToIso convierte hora local de Bogotá a UTC', () => {
  assert.equal(bogotaLocalToIso('2026-12-04T20:00'), '2026-12-05T01:00:00.000Z');
  assert.equal(bogotaLocalToIso('basura'), null);
});
