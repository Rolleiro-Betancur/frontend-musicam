import { test } from 'node:test';
import assert from 'node:assert/strict';
import { html, raw, escapeHtml } from '../../src/shared/utils/html.js';

test('escapa los valores interpolados', () => {
  const malo = '<img src=x onerror="alert(1)">';
  assert.equal(
    String(html`<p>${malo}</p>`),
    '<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>',
  );
});

test('escapa comillas simples y ampersands en atributos', () => {
  assert.equal(escapeHtml(`a&b'c"d`), 'a&amp;b&#39;c&quot;d');
});

test('raw() inserta HTML confiable sin escapar', () => {
  assert.equal(String(html`<b>${raw('<i>ok</i>')}</b>`), '<b><i>ok</i></b>');
});

test('las plantillas anidadas y los arreglos no se escapan dos veces', () => {
  const item = (t) => html`<li>${t}</li>`;
  const salida = String(html`<ul>${['a', '<b>'].map(item)}</ul>`);
  assert.equal(salida, '<ul><li>a</li><li>&lt;b&gt;</li></ul>');
});

test('null, undefined y false se omiten; 0 se conserva', () => {
  assert.equal(String(html`[${null}${undefined}${false}${0}]`), '[0]');
});
