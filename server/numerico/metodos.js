/**
 * TECHFIX - Módulo numérico
 * ------------------------------------------------------------
 * Modelo de crecimiento limitado de clientes:
 *
 *     dC/dt = k (M - C),      C(t0) = C0
 *
 *   C(t): clientes acumulados estimados (clientes)
 *   t   : tiempo (meses)
 *   k   : tasa de crecimiento (1/mes)
 *   M   : mercado potencial (clientes)
 *   C0  : clientes iniciales (clientes)
 *
 * Este archivo NO depende de Express ni de MySQL: son funciones
 * "puras" (misma entrada => misma salida). Así se pueden probar
 * por separado y reutilizar en la API, la pantalla y el PDF.
 */

'use strict';

/** Máximo de pasos permitidos para no saturar la base de datos. */
const MAX_PASOS = 1000;

/** Tolerancia para decidir si (tf - t0) / h es un número entero. */
const TOLERANCIA_ENTERO = 1e-9;

/**
 * Lado derecho de la EDO: f(t, C) = k (M - C).
 * Devuelve la velocidad de crecimiento en clientes/mes.
 * (No depende de t, pero se recibe t para respetar la forma general f(t, C)).
 */
function derivada(t, C, p) {
  return p.k * (p.M - C);
}

/**
 * Solución analítica (exacta):
 *     C(t) = M - (M - C0) e^(-k (t - t0))
 * Con t0 = 0 queda la forma del enunciado: C(t) = M - (M - C0) e^(-k t).
 */
function solucionAnalitica(t, p) {
  return p.M - (p.M - p.C0) * Math.exp(-p.k * (t - p.t0));
}

/**
 * Un paso del método de Heun (RK2):
 *   k1 = f(tn, Cn)
 *   k2 = f(tn + h, Cn + h k1)          <- pendiente en el punto "predicho"
 *   Cn+1 = Cn + (h/2)(k1 + k2)          <- promedio de las dos pendientes
 */
function pasoHeun(f, t, C, h) {
  const k1 = f(t, C);
  const k2 = f(t + h, C + h * k1);
  return { siguiente: C + (h / 2) * (k1 + k2), k1, k2 };
}

/**
 * Un paso del método clásico de Runge-Kutta de 4.º orden (RK4):
 *   k1 = f(tn, Cn)
 *   k2 = f(tn + h/2, Cn + h k1 / 2)
 *   k3 = f(tn + h/2, Cn + h k2 / 2)
 *   k4 = f(tn + h,   Cn + h k3)
 *   Cn+1 = Cn + (h/6)(k1 + 2 k2 + 2 k3 + k4)
 */
function pasoRK4(f, t, C, h) {
  const k1 = f(t, C);
  const k2 = f(t + h / 2, C + (h * k1) / 2);
  const k3 = f(t + h / 2, C + (h * k2) / 2);
  const k4 = f(t + h, C + h * k3);
  return { siguiente: C + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4), k1, k2, k3, k4 };
}

/**
 * Errores frente al valor exacto.
 *   Ea = |exacto - aproximado|
 *   Er = Ea / |exacto| * 100   (null si exacto = 0: no está definido)
 */
function calcularErrores(exacto, aproximado) {
  const absoluto = Math.abs(exacto - aproximado);
  const relativo = exacto === 0 ? null : (absoluto / Math.abs(exacto)) * 100;
  return { absoluto, relativo };
}

/**
 * Genera los tiempos t0, t1, ..., tn.
 * - Se calcula t_i = t0 + i*h (no se suma h repetidamente, para no
 *   acumular errores de redondeo).
 * - Si h no divide exactamente el intervalo, el último paso se acorta
 *   para terminar justo en tf.
 */
function generarTiempos(t0, tf, h) {
  const cociente = (tf - t0) / h;
  let n = Math.round(cociente);
  let pasoFinalAjustado = false;
  if (Math.abs(cociente - n) > TOLERANCIA_ENTERO * Math.max(1, cociente)) {
    n = Math.ceil(cociente);
    pasoFinalAjustado = true;
  }
  if (n > MAX_PASOS) {
    throw new RangeError(
      `El tamaño de paso genera ${n} pasos; el máximo permitido es ${MAX_PASOS}. Use un h mayor.`
    );
  }
  const tiempos = [];
  for (let i = 0; i < n; i++) tiempos.push(t0 + i * h);
  tiempos.push(tf); // el último punto es exactamente tf
  return { tiempos, pasoFinalAjustado };
}

/** Comprueba que los parámetros sean números válidos (defensa básica). */
function comprobarParametros(p) {
  for (const nombre of ['C0', 'M', 'k', 't0', 'tf', 'h']) {
    if (typeof p[nombre] !== 'number' || !Number.isFinite(p[nombre])) {
      throw new TypeError(`El parámetro ${nombre} debe ser un número válido.`);
    }
  }
  if (p.C0 < 0) throw new RangeError('C0 debe ser mayor o igual a cero.');
  if (!(p.M > p.C0)) throw new RangeError('M debe ser mayor que C0.');
  if (!(p.k > 0)) throw new RangeError('k debe ser mayor que cero.');
  if (!(p.h > 0)) throw new RangeError('h debe ser mayor que cero.');
  if (!(p.tf > p.t0)) throw new RangeError('El tiempo final debe ser mayor que el inicial.');
}

/**
 * Ejecuta la simulación completa con los TRES procedimientos usando
 * exactamente los mismos parámetros, condición inicial e intervalo.
 *
 * @param {{C0:number, M:number, k:number, t0:number, tf:number, h:number}} p
 * @returns {{parametros, filas, resumen, avisos}}
 */
function simular(p) {
  comprobarParametros(p);
  const f = (t, C) => derivada(t, C, p);
  const { tiempos, pasoFinalAjustado } = generarTiempos(p.t0, p.tf, p.h);

  const filas = [];
  let heun = p.C0; // condición inicial para Heun
  let rk4 = p.C0;  // condición inicial para RK4 (la misma)

  for (let i = 0; i < tiempos.length; i++) {
    const t = tiempos[i];
    if (i > 0) {
      const tAnterior = tiempos[i - 1];
      const hReal = t - tAnterior; // igual a h, salvo en un último paso acortado
      heun = pasoHeun(f, tAnterior, heun, hReal).siguiente;
      rk4 = pasoRK4(f, tAnterior, rk4, hReal).siguiente;
    }
    const exacto = solucionAnalitica(t, p);
    const eHeun = calcularErrores(exacto, heun);
    const eRK4 = calcularErrores(exacto, rk4);
    filas.push({
      iteracion: i,
      tiempo: t,
      analitico: exacto,
      heun,
      errorAbsHeun: eHeun.absoluto,
      errorRelHeun: eHeun.relativo,
      rk4,
      errorAbsRK4: eRK4.absoluto,
      errorRelRK4: eRK4.relativo,
    });
  }

  const avisos = [];
  if (pasoFinalAjustado) {
    avisos.push(
      `h = ${p.h} no divide exactamente el intervalo; el último paso se acortó para terminar en t = ${p.tf} meses.`
    );
  }
  if (p.k * p.h > 1) {
    avisos.push(
      `k·h = ${(p.k * p.h).toFixed(3)} es mayor que 1: con pasos tan grandes los métodos numéricos pierden precisión y pueden oscilar.`
    );
  }

  return { parametros: { ...p }, filas, resumen: resumir(filas), avisos };
}

/** Resumen útil para tarjetas, interpretación e informes. */
function resumir(filas) {
  const final = filas[filas.length - 1];
  const maxAbs = (campo) => Math.max(...filas.map((r) => r[campo]));
  const promedio = (campo) => filas.reduce((s, r) => s + r[campo], 0) / filas.length;
  const resumen = {
    pasos: filas.length - 1,
    tiempoFinal: final.tiempo,
    analiticoFinal: final.analitico,
    heunFinal: final.heun,
    rk4Final: final.rk4,
    errorAbsFinalHeun: final.errorAbsHeun,
    errorAbsFinalRK4: final.errorAbsRK4,
    errorAbsMaxHeun: maxAbs('errorAbsHeun'),
    errorAbsMaxRK4: maxAbs('errorAbsRK4'),
    errorAbsPromHeun: promedio('errorAbsHeun'),
    errorAbsPromRK4: promedio('errorAbsRK4'),
  };
  resumen.metodoMasPreciso =
    resumen.errorAbsMaxRK4 < resumen.errorAbsMaxHeun
      ? 'RK4'
      : resumen.errorAbsMaxRK4 > resumen.errorAbsMaxHeun
        ? 'Heun'
        : 'Empate';
  return resumen;
}

/**
 * Compara varios tamaños de paso con los MISMOS C0, M, k, t0 y tf.
 * Por defecto: experimento 1 (h = 1) y experimento 2 (h = 0.5).
 * Devuelve también cuántas veces se redujo el error final al pasar
 * de un h al siguiente (la teoría predice ~2^2 = 4 en Heun y ~2^4 = 16 en RK4
 * cuando h se divide entre 2).
 */
function compararTamaniosPaso(base, pasos = [1, 0.5]) {
  const experimentos = pasos.map((h) => {
    const sim = simular({ ...base, h });
    return { h, resumen: sim.resumen, filas: sim.filas, avisos: sim.avisos };
  });
  const reducciones = [];
  for (let i = 1; i < experimentos.length; i++) {
    const a = experimentos[i - 1].resumen;
    const b = experimentos[i].resumen;
    reducciones.push({
      deH: experimentos[i - 1].h,
      aH: experimentos[i].h,
      factorHeun: b.errorAbsFinalHeun === 0 ? null : a.errorAbsFinalHeun / b.errorAbsFinalHeun,
      factorRK4: b.errorAbsFinalRK4 === 0 ? null : a.errorAbsFinalRK4 / b.errorAbsFinalRK4,
    });
  }
  return { experimentos, reducciones };
}

/** Parámetros hipotéticos del proyecto (no son datos reales). */
const PARAMETROS_PROYECTO = Object.freeze({ C0: 10, M: 100, k: 0.3, t0: 0, tf: 12, h: 1 });

module.exports = {
  MAX_PASOS,
  PARAMETROS_PROYECTO,
  derivada,
  solucionAnalitica,
  pasoHeun,
  pasoRK4,
  calcularErrores,
  generarTiempos,
  comprobarParametros,
  simular,
  resumir,
  compararTamaniosPaso,
};
