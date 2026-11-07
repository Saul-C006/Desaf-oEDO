/**
 * TECHFIX - Interpretación automática de resultados
 * ------------------------------------------------------------
 * Construye los textos de interpretación y conclusiones con los VALORES
 * REALES de cada simulación (nada de textos fijos que ignoren los parámetros).
 * Se usa en la pantalla de Interpretación y en los informes PDF.
 */
'use strict';

/** Formato con decimales fijos (punto decimal, igual que en las tablas). */
const num = (x, d = 2) => Number(x).toFixed(d);

/** Número sin ceros sobrantes: 10.00 -> "10", 0.30 -> "0.3", 97.5409 -> "97.54". */
const cifra = (x, d = 2) => String(Number(Number(x).toFixed(d)));

/** "1 mes" / "0.5 meses" / "12 meses". */
const meses = (x) => `${cifra(x, 4)} ${Number(x) === 1 ? 'mes' : 'meses'}`;

/** Formato para errores: notación científica si son muy pequeños. */
function numError(x) {
  if (x === null || x === undefined) return 'no definido';
  if (x === 0) return '0';
  return Math.abs(x) < 0.001 ? Number(x).toExponential(2) : Number(x).toFixed(6);
}

/**
 * Tiempo en que la solución exacta alcanza la fracción f del mercado M.
 * De M - (M - C0) e^(-k(t - t0)) = f·M  =>  t = t0 + ln((M - C0) / (M(1 - f))) / k
 * Devuelve null si C0 ya supera ese nivel.
 */
function tiempoParaFraccion(p, f) {
  if (p.C0 >= f * p.M) return null;
  return p.t0 + Math.log((p.M - p.C0) / (p.M * (1 - f))) / p.k;
}

/**
 * @param {object} sim   { parametros, resumen, avisos }
 * @param {object|null} comparacion  { experimentos: [{h, resumen}], reducciones: [...], origen }
 */
function interpretar(sim, comparacion) {
  const p = sim.parametros;
  const r = sim.resumen;
  const duracion = p.tf - p.t0;
  const porcentajeMercado = (r.analiticoFinal / p.M) * 100;
  const ritmoInicial = p.k * (p.M - p.C0);
  const ritmoFinal = p.k * (p.M - r.analiticoFinal);
  const aumento = r.analiticoFinal - p.C0;

  // 1) Crecimiento de la cartera
  let crecimiento =
    `El emprendimiento comienza con ${cifra(p.C0)} clientes en el mes ${cifra(p.t0)}. ` +
    `Según la solución analítica, al cabo de ${meses(duracion)} (t = ${cifra(p.tf)}) la cartera estimada sería de ` +
    `${num(r.analiticoFinal)} clientes, es decir, un aumento de ${num(aumento)} clientes y el ${num(porcentajeMercado, 1)} % ` +
    `del mercado potencial de ${cifra(p.M)} clientes. `;
  crecimiento +=
    `Al inicio se captan unos ${num(ritmoInicial)} clientes por mes, pero al final el ritmo baja a ${num(ritmoFinal)} ` +
    `clientes por mes: el crecimiento disminuye conforme la cartera se acerca al mercado potencial.`;

  // 2) Hitos (solo si ocurren dentro del intervalo simulado)
  const hitos = [];
  for (const f of [0.5, 0.9]) {
    const t = tiempoParaFraccion(p, f);
    if (t === null) {
      hitos.push(`Desde el inicio ya se supera el ${f * 100} % del mercado potencial.`);
    } else if (t <= p.tf) {
      hitos.push(`El ${f * 100} % del mercado (${cifra(f * p.M)} clientes) se alcanzaría aproximadamente en el mes ${num(t, 2)}.`);
    } else {
      hitos.push(`El ${f * 100} % del mercado (${cifra(f * p.M)} clientes) no se alcanza dentro del periodo simulado (se estima en el mes ${num(t, 2)}).`);
    }
  }

  // 3) Método con menor error
  let metodo;
  if (r.metodoMasPreciso === 'RK4') {
    const veces = r.errorAbsMaxRK4 > 0 ? r.errorAbsMaxHeun / r.errorAbsMaxRK4 : null;
    metodo =
      `El método RK4 presentó el menor error: su error absoluto máximo fue ${numError(r.errorAbsMaxRK4)} clientes, ` +
      `frente a ${numError(r.errorAbsMaxHeun)} clientes del método de Heun` +
      (veces ? ` (aproximadamente ${num(veces, 0)} veces menor).` : '.') +
      ` Al final de la simulación, Heun estimó ${num(r.heunFinal, 4)} clientes y RK4 ${num(r.rk4Final, 4)}, ` +
      `frente al valor exacto de ${num(r.analiticoFinal, 4)}.`;
  } else if (r.metodoMasPreciso === 'Heun') {
    metodo =
      `En esta simulación Heun presentó un error máximo menor (${numError(r.errorAbsMaxHeun)}) que RK4 ` +
      `(${numError(r.errorAbsMaxRK4)}). Es un caso poco habitual; revise el tamaño de paso.`;
  } else {
    metodo = `Ambos métodos presentaron el mismo error máximo (${numError(r.errorAbsMaxHeun)} clientes).`;
  }

  // 4) Influencia del tamaño de paso
  let paso;
  if (comparacion && comparacion.experimentos.length >= 2) {
    const [a, b] = comparacion.experimentos;
    const red = comparacion.reducciones[0];
    paso =
      `Al reducir el tamaño de paso de h = ${a.h} a h = ${b.h} meses (mismos C0, M, k e intervalo), ` +
      `el error final de Heun pasó de ${numError(a.resumen.errorAbsFinalHeun)} a ${numError(b.resumen.errorAbsFinalHeun)} ` +
      (red.factorHeun ? `(${num(red.factorHeun, 2)} veces menor) ` : '') +
      `y el de RK4 de ${numError(a.resumen.errorAbsFinalRK4)} a ${numError(b.resumen.errorAbsFinalRK4)}` +
      (red.factorRK4 ? ` (${num(red.factorRK4, 2)} veces menor). ` : '. ') +
      `Un paso más pequeño mejora la precisión de ambos métodos, pero RK4 mejora mucho más rápido ` +
      `(la teoría predice unas 4 veces para Heun, de orden 2, y unas 16 veces para RK4, de orden 4).`;
  } else {
    paso =
      'No fue posible comparar los tamaños de paso h = 1 y h = 0.5 con estos parámetros ' +
      '(el intervalo genera demasiados pasos).';
  }
  paso += ` En esta simulación se usó h = ${meses(p.h)} (${r.pasos} pasos).`;

  // 5) Limitaciones
  const limitaciones = [
    `Los parámetros (C0 = ${cifra(p.C0, 6)} clientes, M = ${cifra(p.M, 6)} clientes, k = ${cifra(p.k, 6)} por mes) son hipotéticos: no provienen de datos reales de un negocio.`,
    'El modelo supone que el mercado potencial M y la tasa k se mantienen constantes durante todo el periodo.',
    'No considera la pérdida de clientes, la competencia, la temporada ni cambios en la publicidad.',
    'La cantidad de clientes es una estimación continua (puede tener decimales), no un conteo exacto de personas.',
    'Los resultados son una estimación matemática para entender la tendencia, no una predicción comprobada.',
  ];

  // 6) Conclusión (responde a la pregunta del desafío)
  // Se considera "buena precisión" si k·h <= 1 y el error relativo máximo de Heun es menor al 5 %.
  const errorRelMaxHeun = Math.max(0, ...sim.filas.map((f) => f.errorRelHeun ?? 0));
  const precisionAceptable = p.k * p.h <= 1 && errorRelMaxHeun < 5;
  const conclusion =
    `Con el modelo de crecimiento limitado dC/dt = k(M - C), la cartera de clientes de TechFix crece rápido al inicio y luego ` +
    `se estabiliza cerca del mercado potencial: pasa de ${cifra(p.C0)} a unos ${num(r.analiticoFinal)} clientes en ` +
    `${meses(duracion)}. ` +
    (precisionAceptable
      ? 'Los métodos de Heun y RK4 reproducen bien este comportamiento; '
      : `Con este tamaño de paso (k·h = ${cifra(p.k * p.h, 3)}) los métodos numéricos pierden precisión ` +
        `(el error relativo máximo de Heun fue ${num(errorRelMaxHeun, 2)} %), por lo que conviene reducir h; `) +
    (r.metodoMasPreciso === 'RK4'
      ? `RK4 fue el más preciso, con un error máximo de ${numError(r.errorAbsMaxRK4)} clientes frente a ${numError(r.errorAbsMaxHeun)} de Heun. `
      : `en esta simulación el método con menor error fue ${r.metodoMasPreciso}. `) +
    `Reducir el tamaño de paso disminuye el error de ambos métodos. ` +
    `Estos resultados se basan en parámetros hipotéticos y deben interpretarse como una estimación, no como una predicción comprobada.`;

  // 7) Resumen corto (se guarda en la tabla informes)
  const resumen =
    `Simulación con C0 = ${cifra(p.C0, 6)} clientes, M = ${cifra(p.M, 6)} clientes, k = ${cifra(p.k, 6)} por mes, ` +
    `de t = ${cifra(p.t0, 4)} a t = ${cifra(p.tf, 4)} meses y h = ${meses(p.h)} (${r.pasos} pasos). ` +
    `Valor exacto final: ${num(r.analiticoFinal, 4)}; Heun: ${num(r.heunFinal, 4)}; RK4: ${num(r.rk4Final, 4)} clientes. ` +
    `Método con menor error: ${r.metodoMasPreciso}.`;

  return { crecimiento, hitos, metodo, paso, limitaciones, conclusion, resumen, avisos: sim.avisos || [] };
}

module.exports = { interpretar, tiempoParaFraccion, num, cifra, meses, numError };
