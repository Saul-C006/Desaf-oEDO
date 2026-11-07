/**
 * Pruebas de validación de entradas e interpretación automática (sin base de datos).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validarParametros, aNumero } = require('../shared/validacion');
const { interpretar, tiempoParaFraccion } = require('../server/services/interpretacion');
const { seleccionarFilas, limpiar } = require('../server/services/informePdf');
const metodos = require('../server/numerico/metodos');

const P = { C0: 10, M: 100, k: 0.3, t0: 0, tf: 12, h: 1 };

test('aNumero: acepta números y textos numéricos; rechaza vacíos y texto', () => {
  assert.equal(aNumero(0.3), 0.3);
  assert.equal(aNumero('0.3'), 0.3);
  assert.equal(aNumero('0,3'), 0.3);
  assert.equal(aNumero(' 12 '), 12);
  assert.equal(aNumero('1e2'), 100);
  for (const malo of ['', '   ', 'abc', '12abc', '1.2.3', 'Infinity', 'NaN', null, undefined, {}, [], true, Infinity, NaN]) {
    assert.equal(aNumero(malo), null, `debería rechazar ${String(malo)}`);
  }
});

test('validarParametros: valores del proyecto son válidos', () => {
  const v = validarParametros(P);
  assert.equal(v.valido, true);
  assert.deepEqual(v.valores, P);
});

test('validarParametros: cada regla del enunciado', () => {
  const casos = [
    [{ C0: -1 }, 'C0'],
    [{ M: 10 }, 'M'],
    [{ M: 5 }, 'M'],
    [{ k: 0 }, 'k'],
    [{ k: -0.3 }, 'k'],
    [{ h: 0 }, 'h'],
    [{ h: -1 }, 'h'],
    [{ tf: 0 }, 'tf'],
    [{ t0: 12 }, 'tf'],
    [{ C0: '' }, 'C0'],
    [{ k: 'abc' }, 'k'],
    [{ h: 0.001 }, 'h'], // más de 1000 pasos
    [{ M: 1e12 }, 'M'],
  ];
  for (const [cambio, campo] of casos) {
    const v = validarParametros({ ...P, ...cambio });
    assert.equal(v.valido, false, JSON.stringify(cambio));
    assert.ok(v.errores[campo], `${JSON.stringify(cambio)} -> error en ${campo}`);
  }
  assert.equal(validarParametros({ ...P, C0: 0 }).valido, true); // C0 = 0 es válido
});

test('validarParametros: falta de campos', () => {
  const v = validarParametros({});
  assert.deepEqual(Object.keys(v.errores).sort(), ['C0', 'M', 'h', 'k', 't0', 'tf']);
  assert.equal(validarParametros({ ...P, h: undefined }, { omitirH: true }).valido, true);
});

test('tiempoParaFraccion: 50 % y 90 % del mercado con los parámetros del proyecto', () => {
  assert.ok(Math.abs(tiempoParaFraccion(P, 0.5) - Math.log(1.8) / 0.3) < 1e-12); // 1.959 meses
  assert.ok(Math.abs(tiempoParaFraccion(P, 0.9) - Math.log(9) / 0.3) < 1e-12);   // 7.324 meses
  assert.equal(tiempoParaFraccion({ ...P, C0: 60 }, 0.5), null);
});

test('interpretar: usa los valores reales de la simulación', () => {
  const sim = metodos.simular(P);
  const comp = metodos.compararTamaniosPaso(P);
  const it = interpretar(sim, { ...comp, origen: 'calculada' });
  assert.match(it.crecimiento, /comienza con 10 clientes/);
  assert.match(it.crecimiento, /97\.54 clientes/);
  assert.match(it.hitos[0], /mes 1\.96/);
  assert.match(it.hitos[1], /mes 7\.32/);
  assert.match(it.metodo, /RK4 presentó el menor error/);
  assert.match(it.paso, /4\.59 veces menor/);
  assert.match(it.paso, /18\.14 veces menor/);
  assert.match(it.conclusion, /reproducen bien/);

  // Con otros parámetros, el texto cambia
  const p2 = { C0: 25, M: 400, k: 0.1, t0: 0, tf: 24, h: 0.5 };
  const it2 = interpretar(metodos.simular(p2), null);
  assert.match(it2.crecimiento, /comienza con 25 clientes/);
  assert.match(it2.crecimiento, /mercado potencial de 400 clientes/);
});

test('interpretar: con k·h grande la conclusión advierte la pérdida de precisión', () => {
  const p = { C0: 5, M: 60, k: 0.5, t0: 0, tf: 12, h: 5 };
  const it = interpretar(metodos.simular(p), null);
  assert.match(it.conclusion, /pierden precisión/);
  assert.doesNotMatch(it.conclusion, /reproducen bien/);
  assert.ok(it.avisos.some((a) => /inestable/.test(a)));
});

test('PDF: con muchas filas se seleccionan filas espaciadas incluyendo la primera y la última', () => {
  const { filas } = metodos.simular({ ...P, h: 0.012 }); // 1001 filas
  const sel = seleccionarFilas(filas);
  assert.equal(sel.recortada, true);
  assert.ok(sel.filas.length <= 62);
  assert.equal(sel.filas[0].iteracion, 0);
  assert.equal(sel.filas.at(-1).iteracion, 1000);
  assert.equal(seleccionarFilas(metodos.simular(P).filas).recortada, false);
});

test('PDF: reemplaza símbolos que no existen en la fuente estándar', () => {
  assert.equal(limpiar('a ≈ b → c − d'), 'a aprox. b -> c - d');
});
