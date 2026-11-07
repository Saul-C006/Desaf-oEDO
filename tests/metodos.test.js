/**
 * Pruebas de los cálculos numéricos de TECHFIX.
 * Ejecutar con:  npm test
 * Usa el módulo de pruebas incluido en Node.js (node:test), sin librerías extra.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const m = require('../server/numerico/metodos');

const P = m.PARAMETROS_PROYECTO; // C0=10, M=100, k=0.3, t0=0, tf=12, h=1
const cerca = (real, esperado, tol, msg) =>
  assert.ok(Math.abs(real - esperado) <= tol, `${msg ?? ''} esperado ${esperado}, obtenido ${real}`);

// ---------- Solución analítica ----------

test('analítica: cumple la condición inicial C(0) = C0', () => {
  assert.equal(m.solucionAnalitica(0, P), 10);
});

test('analítica: coincide con C(t) = 100 - 90 e^(-0.3 t)', () => {
  for (const t of [0, 1, 2.5, 6, 12]) {
    cerca(m.solucionAnalitica(t, P), 100 - 90 * Math.exp(-0.3 * t), 1e-12, `t=${t}`);
  }
  cerca(m.solucionAnalitica(12, P), 97.540865, 1e-6, 'C(12)');
});

test('analítica: satisface la EDO dC/dt = k(M - C) (verificación por sustitución numérica)', () => {
  const d = 1e-6;
  for (const t of [0.5, 3, 7, 11]) {
    const derivadaNumerica = (m.solucionAnalitica(t + d, P) - m.solucionAnalitica(t - d, P)) / (2 * d);
    cerca(derivadaNumerica, m.derivada(t, m.solucionAnalitica(t, P), P), 1e-6, `t=${t}`);
  }
});

test('analítica: con t0 distinto de cero se cumple C(t0) = C0', () => {
  const p = { ...P, t0: 3, tf: 15 };
  assert.equal(m.solucionAnalitica(3, p), 10);
});

test('analítica: es creciente y nunca supera M', () => {
  let anterior = -Infinity;
  for (let t = 0; t <= 60; t += 0.5) {
    const c = m.solucionAnalitica(t, P);
    assert.ok(c > anterior && c < 100);
    anterior = c;
  }
});

// ---------- Primer paso calculado a mano (h = 1) ----------

test('Heun: primer paso coincide con el cálculo a mano (32.95)', () => {
  const f = (t, C) => m.derivada(t, C, P);
  const r = m.pasoHeun(f, 0, 10, 1);
  cerca(r.k1, 27, 1e-12, 'k1');
  cerca(r.k2, 18.9, 1e-12, 'k2');
  cerca(r.siguiente, 32.95, 1e-12, 'C1');
});

test('RK4: primer paso coincide con el cálculo a mano (33.324625)', () => {
  const f = (t, C) => m.derivada(t, C, P);
  const r = m.pasoRK4(f, 0, 10, 1);
  cerca(r.k1, 27, 1e-12, 'k1');
  cerca(r.k2, 22.95, 1e-12, 'k2');
  cerca(r.k3, 23.5575, 1e-12, 'k3');
  cerca(r.k4, 19.93275, 1e-12, 'k4');
  cerca(r.siguiente, 33.324625, 1e-12, 'C1');
});

// ---------- Fórmula cerrada de cada método (modelo lineal) ----------
// Para dC/dt = k(M - C), cada paso multiplica la distancia (M - C) por un factor fijo:
//   Heun: g = 1 - kh + (kh)^2/2
//   RK4 : g = 1 - kh + (kh)^2/2 - (kh)^3/6 + (kh)^4/24
// (son los primeros términos de la serie de Taylor de e^(-kh)).

test('Heun y RK4 coinciden con su fórmula cerrada para el modelo lineal', () => {
  for (const h of [1, 0.5, 0.25]) {
    const x = P.k * h;
    const gHeun = 1 - x + x ** 2 / 2;
    const gRK4 = gHeun - x ** 3 / 6 + x ** 4 / 24;
    const { filas } = m.simular({ ...P, h });
    filas.forEach((r, n) => {
      cerca(r.heun, 100 - 90 * gHeun ** n, 1e-9, `Heun h=${h} n=${n}`);
      cerca(r.rk4, 100 - 90 * gRK4 ** n, 1e-9, `RK4 h=${h} n=${n}`);
    });
  }
});

// ---------- Resultados de los experimentos ----------

test('Experimento 1 (h = 1): valores finales', () => {
  const s = m.simular({ ...P, h: 1 }).resumen;
  assert.equal(s.pasos, 12);
  cerca(s.heunFinal, 97.369019, 1e-6);
  cerca(s.rk4Final, 97.540097, 1e-6);
  cerca(s.errorAbsFinalHeun, 0.171846, 1e-6);
});

test('Experimento 2 (h = 0.5): valores finales', () => {
  const s = m.simular({ ...P, h: 0.5 }).resumen;
  assert.equal(s.pasos, 24);
  cerca(s.heunFinal, 97.503428, 1e-6);
  cerca(s.rk4Final, 97.540823, 1e-6);
});

test('RK4 tiene menor error que Heun en todas las iteraciones (h = 1 y h = 0.5)', () => {
  for (const h of [1, 0.5]) {
    const { filas, resumen } = m.simular({ ...P, h });
    filas.slice(1).forEach((r) => assert.ok(r.errorAbsRK4 < r.errorAbsHeun, `h=${h} t=${r.tiempo}`));
    assert.equal(resumen.metodoMasPreciso, 'RK4');
  }
});

test('Orden de convergencia: al dividir h entre 2, el error de Heun baja ~4 veces y el de RK4 ~16', () => {
  const { reducciones } = m.compararTamaniosPaso(P, [0.25, 0.125]);
  const r = reducciones[0];
  assert.ok(r.factorHeun > 3.8 && r.factorHeun < 4.4, `Heun ${r.factorHeun}`);
  assert.ok(r.factorRK4 > 15 && r.factorRK4 < 17.5, `RK4 ${r.factorRK4}`);
});

test('Comparación h = 1 vs h = 0.5: un paso menor reduce el error de ambos métodos', () => {
  const { experimentos } = m.compararTamaniosPaso(P);
  const [e1, e2] = experimentos;
  assert.ok(e2.resumen.errorAbsFinalHeun < e1.resumen.errorAbsFinalHeun);
  assert.ok(e2.resumen.errorAbsFinalRK4 < e1.resumen.errorAbsFinalRK4);
});

// ---------- Errores ----------

test('Errores: absoluto y relativo porcentual', () => {
  const e = m.calcularErrores(50, 49);
  assert.equal(e.absoluto, 1);
  assert.equal(e.relativo, 2);
});

test('Errores: el relativo no está definido (null) cuando el valor exacto es 0', () => {
  assert.equal(m.calcularErrores(0, 0).relativo, null);
  const { filas } = m.simular({ ...P, C0: 0 });
  assert.equal(filas[0].errorRelHeun, null);
  assert.equal(filas[0].errorRelRK4, null);
  assert.ok(filas[1].errorRelHeun !== null);
});

// ---------- Tiempos y casos borde ----------

test('Tiempos: se calculan como t0 + n·h (sin acumular redondeo) y terminan en tf', () => {
  const { tiempos, pasoFinalAjustado } = m.generarTiempos(0, 12, 0.1);
  assert.equal(tiempos.length, 121);
  assert.equal(tiempos.at(-1), 12);
  assert.equal(pasoFinalAjustado, false);
});

test('Tiempos: si h no divide el intervalo, el último paso se acorta y hay aviso', () => {
  const sim = m.simular({ ...P, h: 0.7 });
  assert.equal(sim.filas.at(-1).tiempo, 12);
  cerca(sim.filas.at(-2).tiempo, 11.9, 1e-12);
  assert.ok(sim.avisos.some((a) => a.includes('acortó')));
});

test('Aviso de estabilidad cuando k·h > 1', () => {
  assert.ok(m.simular({ ...P, h: 4 }).avisos.some((a) => a.includes('k·h')));
  assert.equal(m.simular({ ...P, h: 1 }).avisos.length, 0);
});

test('Límite de pasos: rechaza más de 1000 pasos', () => {
  assert.throws(() => m.simular({ ...P, h: 0.001 }), RangeError);
  assert.doesNotThrow(() => m.simular({ ...P, h: 0.012 })); // exactamente 1000 pasos
});

test('Validación de parámetros', () => {
  assert.throws(() => m.simular({ ...P, C0: -1 }), /C0/);
  assert.throws(() => m.simular({ ...P, M: 10 }), /M debe ser mayor/);
  assert.throws(() => m.simular({ ...P, k: 0 }), /k debe/);
  assert.throws(() => m.simular({ ...P, h: 0 }), /h debe/);
  assert.throws(() => m.simular({ ...P, tf: 0 }), /tiempo final/);
  assert.throws(() => m.simular({ ...P, k: NaN }), TypeError);
  assert.throws(() => m.simular({ ...P, M: '100' }), TypeError);
});
