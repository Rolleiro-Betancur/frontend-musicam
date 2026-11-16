import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  esRedirectSeguro,
  esUrlExternaSegura,
  validarEmail,
  validarImagen,
  validarPassword,
  validarRequerido,
} from '../../src/shared/utils/validators.js';

test('validarPassword refleja RN-03 (≥ 8, letra y dígito)', () => {
  assert.ok(validarPassword('Ab1'));
  assert.ok(validarPassword('12345678'));
  assert.ok(validarPassword('abcdefgh'));
  assert.ok(validarPassword('a1'.repeat(65)));
  assert.equal(validarPassword('Clave1234'), null);
  assert.equal(validarPassword('abcdefg1'), null);
});

test('validarEmail', () => {
  assert.ok(validarEmail(''));
  assert.ok(validarEmail('sin-arroba'));
  assert.ok(validarEmail('a@b'));
  assert.equal(validarEmail('ana@example.com'), null);
});

test('validarRequerido respeta el máximo', () => {
  assert.ok(validarRequerido('   ', 'El nombre'));
  assert.ok(validarRequerido('x'.repeat(101), 'El nombre', 100));
  assert.equal(validarRequerido('Ana', 'El nombre', 100), null);
});

test('validarImagen: tipo y tamaño (≤ 2 MB)', () => {
  assert.equal(validarImagen({ type: 'image/webp', size: 1000 }), null);
  assert.ok(validarImagen({ type: 'image/gif', size: 1000 }));
  assert.ok(validarImagen({ type: 'image/png', size: 2 * 1024 * 1024 + 1 }));
  assert.equal(validarImagen({ type: 'image/png', size: 2 * 1024 * 1024 }), null);
});

test('esRedirectSeguro solo acepta rutas internas #/', () => {
  assert.equal(esRedirectSeguro('#/mis-eventos'), true);
  assert.equal(esRedirectSeguro('#/'), true);
  assert.equal(esRedirectSeguro('https://malo.com'), false);
  assert.equal(esRedirectSeguro('//malo.com'), false);
  assert.equal(esRedirectSeguro('#//malo.com'), false);
  assert.equal(esRedirectSeguro('javascript:alert(1)'), false);
  assert.equal(esRedirectSeguro(null), false);
});

test('esUrlExternaSegura: https o http://localhost', () => {
  assert.equal(esUrlExternaSegura('https://cdn.com/a.jpg'), true);
  assert.equal(esUrlExternaSegura('http://localhost:5000/a.jpg'), true);
  assert.equal(esUrlExternaSegura('http://malo.com/a.jpg'), false);
  assert.equal(esUrlExternaSegura('http://localhost.malo.com/a'), false);
});
