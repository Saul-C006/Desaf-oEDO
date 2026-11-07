/**
 * Casos borde y propiedades matemáticas del módulo numérico (sin base de datos).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const m = require('../server/numerico/metodos');

const P = m.PARAMETROS_PROYECTO;

/** Generador pseudoaleatorio con semilla fija: las pruebas dan siempre el mismo resultado. */
function aleatorio(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

test('Los tres procedimientos usan exactamente los mismos tiempos y la misma condición inicial', () => {
  const { filas, parametros } = m.simular({ ...P, h: 0.5 });
  assert.equal(filas[0].analitico, parametros.C0);
  assert.equal(filas[0].heun, parametros.C0);
  assert.equal(filas[0].rk4, parametros.C0);
  filas.forEach((r, n) => assert.equal(r.tiempo, n * 0.5));
});

test('h mayor que el intervalo: un solo paso, acortado hasta tf', () => {
  const sim = m.simular({ ...P, h: 20 });
  assert.equal(sim.filas.length, 2);
  assert.equal(sim.filas[1].tiempo, 12);
  assert.ok(sim.avisos.some((a) => a.includes('acortó')));
});

test('Tiempo inicial negativo y distinto de cero', () => {
  const p = { C0: 10, M: 100, k: 0.3, t0: -3, tf: 9, h: 1 };
  const sim = m.simular(p);
  assert.equal(sim.filas[0].tiempo, -3);
  assert.equal(sim.filas.at(-1).tiempo, 9);
  // Desplazar el tiempo no cambia la solución: debe dar lo mismo que t0 = 0, tf = 12
  const base = m.simular(P);
  sim.filas.forEach((r, i) => {
    assert.ok(Math.abs(r.analitico - base.filas[i].analitico) < 1e-12);
    assert.ok(Math.abs(r.rk4 - base.filas[i].rk4) < 1e-12);
  });
});

test('k muy pequeño: el crecimiento es casi nulo y los errores son diminutos', () => {
  const sim = m.simular({ ...P, k: 1e-6 });
  assert.ok(sim.resumen.analiticoFinal - 10 < 0.002);
  assert.ok(sim.resumen.errorAbsMaxHeun < 1e-9);
});

test('Valores grandes (M = 1 000 000) mantienen el error relativo pequeño', () => {
  const sim = m.simular({ C0: 500, M: 1e6, k: 0.3, t0: 0, tf: 12, h: 0.5 });
  const maxRel = Math.max(...sim.filas.map((r) => r.errorRelRK4 ?? 0));
  assert.ok(maxRel < 1e-3, `Er máx RK4 = ${maxRel}`);
});

test('C0 = 0 en t0: Ea = 0 y Er "no definido" solo en la primera fila', () => {
  const { filas } = m.simular({ ...P, C0: 0 });
  assert.equal(filas[0].errorAbsHeun, 0);
  assert.equal(filas[0].errorRelHeun, null);
  assert.ok(filas.slice(1).every((r) => r.errorRelHeun !== null && r.errorRelRK4 !== null));
});

/*
 * Nota sobre precisión: en aritmética exacta, Heun y RK4 crecen estrictamente y nunca llegan a M.
 * Pero un número de la computadora (double) guarda unas 16 cifras significativas: cuando la
 * distancia M - C es menor que ~1e-13·M (p. ej. después de 40 meses con k = 0.93), el valor
 * se redondea exactamente a M. Por eso se comprueba "no decrece" (>=) y "no supera M" (<=).
 */
test('Propiedad: con k·h ≤ 1, Heun y RK4 nunca decrecen, nunca superan M y RK4 es más preciso (200 casos)', () => {
  const azar = aleatorio(2026);
  for (let caso = 0; caso < 200; caso++) {
    const M = 50 + azar() * 5000;
    const C0 = azar() * M * 0.9;
    const k = 0.01 + azar() * 1.5;
    const tf = 1 + azar() * 60;
    const h = Math.min(tf / 2, (0.05 + azar() * 0.95) / k); // garantiza k·h ≤ 1 y al menos 2 pasos
    const p = { C0, M, k, t0: 0, tf, h };
    if (Math.ceil(tf / h) > 1000) continue;
    const { filas, resumen } = m.simular(p);
    for (let i = 1; i < filas.length; i++) {
      assert.ok(filas[i].heun >= filas[i - 1].heun, `Heun decreció (caso ${caso})`);
      assert.ok(filas[i].rk4 >= filas[i - 1].rk4, `RK4 decreció (caso ${caso})`);
      assert.ok(filas[i].heun <= M && filas[i].rk4 <= M, `superó M (caso ${caso})`);
      // Mientras la distancia a M sea apreciable, el crecimiento es estricto.
      if (M - filas[i - 1].rk4 > 1e-9 * M) assert.ok(filas[i].rk4 > filas[i - 1].rk4, `RK4 no creció (caso ${caso})`);
    }
    assert.ok(resumen.errorAbsMaxRK4 <= resumen.errorAbsMaxHeun, `RK4 menos preciso (caso ${caso})`);
  }
});

test('Propiedad: el error global de Heun es O(h²) y el de RK4 es O(h⁴) para varios k', () => {
  for (const k of [0.1, 0.3, 0.8]) {
    const base = { C0: 10, M: 100, k, t0: 0, tf: 12 };
    const { reducciones } = m.compararTamaniosPaso(base, [0.2, 0.1]);
    const r = reducciones[0];
    assert.ok(Math.abs(r.factorHeun - 4) < 0.6, `k=${k}: Heun ÷ ${r.factorHeun}`);
    assert.ok(Math.abs(r.factorRK4 - 16) < 2.5, `k=${k}: RK4 ÷ ${r.factorRK4}`);
  }
});

test('Con k·h > 2, Heun se vuelve inestable y se avisa', () => {
  const sim = m.simular({ C0: 5, M: 60, k: 0.5, t0: 0, tf: 12, h: 5 });
  assert.ok(sim.avisos.some((a) => a.includes('inestable')));
  assert.ok(sim.filas.some((r) => r.heun < 0)); // el método da valores sin sentido físico
});

test('La curva analítica tiene 201 puntos, empieza en C0 y termina en C(tf)', () => {
  const c = m.curvaAnalitica(P);
  assert.equal(c.length, 201);
  assert.equal(c[0].C, 10);
  assert.equal(c.at(-1).t, 12);
  assert.ok(Math.abs(c.at(-1).C - 97.54086497974367) < 1e-12);
});
