import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCop } from '../../src/shared/utils/format-money.js';

const normal = (s) => s.replace(/\s/g, ' ');

test('formatea COP sin decimales y con separador de miles', () => {
  assert.equal(normal(formatCop(20000)), '$ 20.000');
  assert.equal(normal(formatCop(1250000)), '$ 1.250.000');
  assert.equal(normal(formatCop(0)), '$ 0');
});

test('valores no numéricos devuelven un guion', () => {
  assert.equal(formatCop(undefined), '—');
  assert.equal(formatCop('abc'), '—');
});
