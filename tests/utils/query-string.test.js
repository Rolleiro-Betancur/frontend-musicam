import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuery, parseHash, parseQuery } from '../../src/shared/utils/query-string.js';

test('buildQuery omite vacíos y codifica', () => {
  assert.equal(
    buildQuery({ q: 'rock y pop', page: 2, estado: '', x: null }),
    '?q=rock+y+pop&page=2',
  );
  assert.equal(buildQuery({}), '');
});

test('parseQuery con y sin "?"', () => {
  assert.deepEqual(parseQuery('?a=1&b=2'), { a: '1', b: '2' });
  assert.deepEqual(parseQuery('a=1'), { a: '1' });
});

test('parseHash separa ruta y query, incluido el redirect codificado', () => {
  const { path, query } = parseHash('#/login?redirect=%23%2Fmis-eventos');
  assert.equal(path, '/login');
  assert.equal(query.get('redirect'), '#/mis-eventos');
  assert.equal(parseHash('').path, '/');
});
