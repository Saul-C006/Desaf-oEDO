/**
 * TECHFIX - Generación del informe PDF (PDFKit)
 * ------------------------------------------------------------
 * El PDF se construye SIEMPRE a partir de los datos guardados en MySQL
 * (simulación + resultados + registro del informe). Por eso no hace falta
 * guardar el archivo: se puede regenerar idéntico cuando se necesite.
 *
 * La gráfica se dibuja con líneas vectoriales de PDFKit (sin librerías
 * nativas como "canvas", que suelen fallar en hostings gratuitos).
 */
'use strict';
const PDFDocument = require('pdfkit');
const metodos = require('../numerico/metodos');
const { num, cifra, numError } = require('./interpretacion');

// ------------------------- Estilo -------------------------
const COLOR = {
  primario: '#0B4F8A',
  acento: '#00A3C4',
  texto: '#1F2933',
  suave: '#5F6B7A',
  borde: '#D5DCE4',
  fondoTabla: '#EEF3F8',
  analitica: '#1F2933',
  heun: '#E07B00',
  rk4: '#0091B3',
};
const MARGEN = 50;
const MAX_FILAS_TABLA = 61;

/**
 * Las fuentes estándar de PDF (Helvetica) solo tienen caracteres latinos básicos.
 * Se reemplazan símbolos que no existen en esa codificación.
 */
function limpiar(texto) {
  return String(texto)
    .replace(/≈/g, 'aprox.')
    .replace(/→/g, '->')
    .replace(/[−–]/g, '-')
    .replace(/⁴/g, '^4')
    .replace(/[✔✓]/g, '')
    .replace(/[“”]/g, '"');
}

const fmtValor = (x) => Number(x).toFixed(6);
const fmtError = (x) => (x === null ? 'No definido' : x !== 0 && Math.abs(x) < 1e-3 ? x.toExponential(3) : x.toFixed(6));
const fmtRel = (x) => (x === null ? 'No definido' : x !== 0 && Math.abs(x) < 1e-3 ? x.toExponential(3) : x.toFixed(4));

// ------------------------- Utilidades de maquetación -------------------------

function espacioRestante(doc) {
  return doc.page.height - doc.page.margins.bottom - doc.y;
}

function asegurarEspacio(doc, alto) {
  if (espacioRestante(doc) < alto) doc.addPage();
}

function titulo(doc, numero, texto) {
  asegurarEspacio(doc, 60);
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(13).fillColor(COLOR.primario).text(limpiar(`${numero}. ${texto}`), MARGEN);
  const y = doc.y + 2;
  doc.moveTo(MARGEN, y).lineTo(doc.page.width - MARGEN, y).lineWidth(0.7).strokeColor(COLOR.acento).stroke();
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(10).fillColor(COLOR.texto);
}

function parrafo(doc, texto, opciones = {}) {
  doc.font(opciones.negrita ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(opciones.tamano || 10)
    .fillColor(opciones.color || COLOR.texto)
    .text(limpiar(texto), MARGEN, doc.y, { align: opciones.align || 'justify', width: doc.page.width - 2 * MARGEN });
  doc.moveDown(opciones.despues ?? 0.4);
}

function formula(doc, texto) {
  doc.font('Courier-Bold').fontSize(10.5).fillColor(COLOR.primario)
    .text(limpiar(texto), MARGEN + 20, doc.y, { width: doc.page.width - 2 * MARGEN - 20 });
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor(COLOR.texto);
}

function vinetas(doc, lista) {
  for (const item of lista) {
    asegurarEspacio(doc, 20);
    doc.font('Helvetica').fontSize(10).fillColor(COLOR.texto)
      .text(limpiar(`•  ${item}`), MARGEN + 8, doc.y, { width: doc.page.width - 2 * MARGEN - 8, align: 'left' });
    doc.moveDown(0.2);
  }
  doc.moveDown(0.2);
}

/**
 * Dibuja una tabla simple con encabezado repetido en cada página.
 * @param {string[]} encabezados
 * @param {string[][]} filas
 * @param {number[]} anchos  proporciones de cada columna
 * @param {string[]} [alineaciones]  'left' | 'right' por columna (por defecto: 1.ª a la izquierda, resto a la derecha)
 */
function tabla(doc, encabezados, filas, anchos, alineaciones) {
  const anchoTotal = doc.page.width - 2 * MARGEN;
  const suma = anchos.reduce((a, b) => a + b, 0);
  const cols = anchos.map((a) => (a / suma) * anchoTotal);
  const altoFila = 15;
  const tamano = encabezados.length > 6 ? 7.5 : 8.5;

  const dibujarFila = (celdas, esEncabezado, sombreada) => {
    if (espacioRestante(doc) < altoFila + 2) {
      doc.addPage();
      if (!esEncabezado) dibujarFila(encabezados, true, false);
    }
    const y = doc.y;
    if (esEncabezado) doc.rect(MARGEN, y, anchoTotal, altoFila).fill(COLOR.primario);
    else if (sombreada) doc.rect(MARGEN, y, anchoTotal, altoFila).fill(COLOR.fondoTabla);
    let x = MARGEN;
    celdas.forEach((celda, i) => {
      doc.font(esEncabezado ? 'Helvetica-Bold' : 'Helvetica').fontSize(tamano)
        .fillColor(esEncabezado ? '#FFFFFF' : COLOR.texto)
        .text(limpiar(celda), x + 3, y + 4, { width: cols[i] - 6, align: alineaciones ? alineaciones[i] : i === 0 ? 'left' : 'right', lineBreak: false });
      x += cols[i];
    });
    doc.x = MARGEN;
    doc.y = y + altoFila;
  };

  dibujarFila(encabezados, true, false);
  filas.forEach((f, i) => dibujarFila(f, false, i % 2 === 1));
  doc.moveTo(MARGEN, doc.y).lineTo(MARGEN + anchoTotal, doc.y).lineWidth(0.5).strokeColor(COLOR.borde).stroke();
  doc.moveDown(0.6);
}

/**
 * Si hay demasiadas filas, se muestran filas espaciadas (siempre la primera y la última)
 * y se avisa en el informe. La tabla completa está en la aplicación.
 */
function seleccionarFilas(filas) {
  if (filas.length <= MAX_FILAS_TABLA) return { filas, recortada: false };
  const salto = Math.ceil((filas.length - 1) / (MAX_FILAS_TABLA - 1));
  const elegidas = filas.filter((_, i) => i % salto === 0);
  if (elegidas[elegidas.length - 1] !== filas[filas.length - 1]) elegidas.push(filas[filas.length - 1]);
  return { filas: elegidas, recortada: true, salto };
}

/** Escala "bonita" para los ejes (1, 2, 5 x 10^n). */
function pasoEje(rango, divisiones) {
  const bruto = rango / divisiones;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / potencia;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * potencia;
}

/** Gráfica de las tres soluciones en un mismo sistema de ejes. */
function grafica(doc, sim) {
  const alto = 250;
  asegurarEspacio(doc, alto + 85);
  const x0 = MARGEN + 45;
  const y0 = doc.y + 24;
  const ancho = doc.page.width - 2 * MARGEN - 60;
  const p = sim.parametros;

  // Curva analítica con muchos puntos (es continua); Heun y RK4 en sus nodos.
  const analitica = metodos.curvaAnalitica(p).map((q) => [q.t, q.C]);
  const heun = sim.filas.map((r) => [r.tiempo, r.heun]);
  const rk4 = sim.filas.map((r) => [r.tiempo, r.rk4]);
  const todos = [...analitica, ...heun, ...rk4].map((v) => v[1]);
  let yMin = Math.min(0, ...todos);
  let yMax = Math.max(p.M, ...todos);
  const pasoY = pasoEje(yMax - yMin, 5);
  yMin = Math.floor(yMin / pasoY) * pasoY;
  yMax = Math.ceil(yMax / pasoY) * pasoY;
  const pasoX = pasoEje(p.tf - p.t0, 8);

  const X = (t) => x0 + ((t - p.t0) / (p.tf - p.t0)) * ancho;
  const Y = (c) => y0 + alto - ((c - yMin) / (yMax - yMin)) * alto;

  // Título
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLOR.texto)
    .text('Crecimiento estimado de clientes: Analítica vs Heun vs RK4', MARGEN, y0 - 18, { width: doc.page.width - 2 * MARGEN, align: 'center' });

  // Cuadrícula y marcas
  doc.lineWidth(0.4).strokeColor(COLOR.borde);
  doc.font('Helvetica').fontSize(7.5).fillColor(COLOR.suave);
  for (let c = yMin; c <= yMax + 1e-9; c += pasoY) {
    doc.moveTo(x0, Y(c)).lineTo(x0 + ancho, Y(c)).stroke();
    doc.text(num(c, pasoY < 1 ? 1 : 0), x0 - 40, Y(c) - 3, { width: 35, align: 'right' });
  }
  for (let t = Math.ceil(p.t0 / pasoX) * pasoX; t <= p.tf + 1e-9; t += pasoX) {
    doc.moveTo(X(t), y0).lineTo(X(t), y0 + alto).stroke();
    doc.text(num(t, pasoX < 1 ? 1 : 0), X(t) - 15, y0 + alto + 4, { width: 30, align: 'center' });
  }
  doc.lineWidth(1).strokeColor(COLOR.suave).rect(x0, y0, ancho, alto).stroke();

  // Línea del mercado potencial M
  doc.save().dash(2, { space: 3 }).lineWidth(0.8).strokeColor('#9AA5B1')
    .moveTo(x0, Y(p.M)).lineTo(x0 + ancho, Y(p.M)).stroke().restore();
  doc.fontSize(7).fillColor(COLOR.suave).text(`M = ${num(p.M, 0)}`, x0 + ancho - 60, Y(p.M) - 10, { width: 58, align: 'right' });

  // Series
  const linea = (puntos, color, grosor, guiones) => {
    doc.save().lineWidth(grosor).strokeColor(color);
    if (guiones) doc.dash(guiones[0], { space: guiones[1] });
    puntos.forEach(([t, c], i) => (i === 0 ? doc.moveTo(X(t), Y(c)) : doc.lineTo(X(t), Y(c))));
    doc.stroke().restore();
  };
  const marcas = (puntos, color, forma) => {
    if (puntos.length > 80) return; // con muchos puntos, las marcas taparían la curva
    doc.save().fillColor(color);
    puntos.forEach(([t, c]) => {
      if (forma === 'cuadro') doc.rect(X(t) - 2, Y(c) - 2, 4, 4).fill();
      else doc.circle(X(t), Y(c), 2).fill();
    });
    doc.restore();
  };
  linea(analitica, COLOR.analitica, 1.6);
  linea(heun, COLOR.heun, 1.2, [4, 2]);
  marcas(heun, COLOR.heun, 'circulo');
  linea(rk4, COLOR.rk4, 1.2, [1.5, 2]);
  marcas(rk4, COLOR.rk4, 'cuadro');

  // Ejes
  doc.font('Helvetica').fontSize(8.5).fillColor(COLOR.texto)
    .text('Tiempo (meses)', x0, y0 + alto + 16, { width: ancho, align: 'center' });
  doc.save().rotate(-90, { origin: [MARGEN + 2, y0 + alto / 2] })
    .text('Clientes estimados', MARGEN + 2 - 60, y0 + alto / 2 - 4, { width: 120, align: 'center' }).restore();

  // Leyenda
  const yLeyenda = y0 + alto + 32;
  const elementos = [
    ['Solución analítica', COLOR.analitica, null],
    [`Heun (h = ${p.h})`, COLOR.heun, [4, 2]],
    [`RK4 (h = ${p.h})`, COLOR.rk4, [1.5, 2]],
  ];
  let xl = x0 + ancho / 2 - 190;
  for (const [nombre, color, guiones] of elementos) {
    // En la leyenda la línea es continua y gruesa para que el color se distinga bien.
    doc.save().lineWidth(2.5).strokeColor(color).moveTo(xl, yLeyenda + 4).lineTo(xl + 22, yLeyenda + 4).stroke();
    if (guiones && guiones[0] > 2) doc.fillColor(color).circle(xl + 11, yLeyenda + 4, 2.5).fill();
    else if (guiones) doc.fillColor(color).rect(xl + 8.5, yLeyenda + 1.5, 5, 5).fill();
    doc.restore();
    doc.fontSize(8.5).fillColor(COLOR.texto).text(limpiar(nombre), xl + 26, yLeyenda, { lineBreak: false });
    xl += 130;
  }
  doc.x = MARGEN;
  doc.y = yLeyenda + 22;
}

// ------------------------- Informe -------------------------

/**
 * Genera el PDF en memoria y devuelve un Buffer.
 * @param {object} informe  registro de la tabla informes {id, titulo, fechaGeneracion, resumen, conclusion}
 * @param {object} sim      simulación completa (obtenerSimulacion)
 */
function generarPdf(informe, sim) {
  return new Promise((resolver, rechazar) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGEN, bottom: MARGEN + 10, left: MARGEN, right: MARGEN },
      bufferPages: true,
      info: { Title: limpiar(informe.titulo), Author: 'TECHFIX', Subject: 'Informe de simulación - Métodos Numéricos' },
    });
    const partes = [];
    doc.on('data', (d) => partes.push(d));
    doc.on('end', () => resolver(Buffer.concat(partes)));
    doc.on('error', rechazar);

    try {
      escribirContenido(doc, informe, sim);
      piePagina(doc, informe);
      doc.end();
    } catch (error) {
      rechazar(error);
    }
  });
}

function escribirContenido(doc, informe, sim) {
  const p = sim.parametros;
  const r = sim.resumen;
  const it = sim.interpretacion;
  const ancho = doc.page.width - 2 * MARGEN;
  const fecha = new Date(informe.fechaGeneracion).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

  // Encabezado
  doc.rect(0, 0, doc.page.width, 85).fill(COLOR.primario);
  doc.font('Helvetica-Bold').fontSize(24).fillColor('#FFFFFF').text('TECHFIX', MARGEN, 22);
  doc.font('Helvetica').fontSize(10).fillColor('#CFE8F3')
    .text('Simulación del crecimiento de clientes mediante métodos numéricos', MARGEN, 52);
  doc.y = 100;
  doc.font('Helvetica-Bold').fontSize(15).fillColor(COLOR.texto).text(limpiar(informe.titulo), MARGEN, doc.y, { width: ancho });
  doc.font('Helvetica').fontSize(9).fillColor(COLOR.suave)
    .text(limpiar(`Informe N.º ${informe.id}  ·  Simulación N.º ${sim.id}  ·  Generado: ${fecha}`), MARGEN, doc.y + 2);
  doc.moveDown(0.6);

  // Resumen (guardado en la tabla informes)
  const yResumen = doc.y;
  doc.font('Helvetica').fontSize(9.5);
  const altoResumen = doc.heightOfString(limpiar(informe.resumen), { width: ancho - 20 }) + 26;
  doc.rect(MARGEN, yResumen, ancho, altoResumen).fill(COLOR.fondoTabla);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLOR.primario).text('Resumen', MARGEN + 10, yResumen + 7);
  doc.font('Helvetica').fontSize(9.5).fillColor(COLOR.texto).text(limpiar(informe.resumen), MARGEN + 10, doc.y + 2, { width: ancho - 20 });
  doc.y = yResumen + altoResumen + 4;
  parrafo(doc, 'Nota: los parámetros son hipotéticos. Los resultados son una estimación matemática, no una predicción comprobada.', { tamano: 8.5, color: COLOR.suave });

  // 1. Nombre del proyecto
  titulo(doc, 1, 'Nombre del proyecto');
  parrafo(doc, 'TECHFIX: Sistema de simulación del crecimiento de clientes de un emprendimiento de soporte técnico mediante métodos numéricos.');

  // 2. Nombre del desafío
  titulo(doc, 2, 'Nombre del desafío');
  parrafo(doc, 'Estimación del crecimiento de clientes de un emprendimiento de soporte técnico durante sus primeros meses de funcionamiento: solución analítica, método de Heun y método de Runge-Kutta de 4.º orden.');
  parrafo(doc, `Simulación registrada: ${sim.nombre}${sim.descripcion ? ' - ' + sim.descripcion : ''}.`);

  // 3. Descripción del problema
  titulo(doc, 3, 'Descripción del problema');
  parrafo(doc, 'TechFix es un emprendimiento dedicado a la reparación y mantenimiento de celulares y computadoras. Comienza con pocos clientes y consigue nuevos gracias a la publicidad, las recomendaciones y la calidad de su servicio. El emprendedor no sabe cómo podría evolucionar su cartera de clientes en los primeros meses. Beneficiarios: emprendedores tecnológicos, técnicos independientes y pequeños negocios de reparación.');
  parrafo(doc, 'Pregunta: ¿Cómo puede estimarse el crecimiento de clientes de un emprendimiento de soporte técnico durante sus primeros meses de funcionamiento y qué tan precisos son los métodos de Heun y Runge-Kutta de cuarto orden?');

  // 4. Objetivo
  titulo(doc, 4, 'Objetivo');
  parrafo(doc, 'Simular el crecimiento de la cartera de clientes de TechFix con una ecuación diferencial ordinaria de primer orden y comparar la precisión de los métodos de Heun y RK4 frente a la solución analítica, usando dos tamaños de paso.');

  // 5. Modelo matemático
  titulo(doc, 5, 'Modelo matemático');
  parrafo(doc, 'Se usa un modelo de crecimiento limitado: la velocidad con que se captan clientes es proporcional a los clientes potenciales que todavía faltan (M - C). Al inicio faltan muchos y el crecimiento es rápido; cerca de M el crecimiento se frena.');
  tabla(doc, ['Símbolo', 'Significado', 'Unidad'], [
    ['t', 'Tiempo (variable independiente)', 'meses'],
    ['C(t)', 'Clientes acumulados estimados (variable dependiente)', 'clientes'],
    ['C0', 'Clientes iniciales', 'clientes'],
    ['M', 'Mercado potencial (máximo de clientes)', 'clientes'],
    ['k', 'Tasa de crecimiento', '1/mes'],
    ['h', 'Tamaño de paso', 'meses'],
  ], [1, 4, 1.3], ['left', 'left', 'left']);
  parrafo(doc, 'Supuestos: M y k constantes; C acumulado (sin pérdida de clientes); variable continua; sin competencia ni estacionalidad.');

  // 6. Ecuación diferencial
  titulo(doc, 6, 'Ecuación diferencial');
  formula(doc, 'dC/dt = k (M - C)');
  formula(doc, `dC/dt = ${cifra(p.k, 6)} (${cifra(p.M, 6)} - C)`);
  parrafo(doc, 'Unidades: (1/mes)·(clientes) = clientes/mes, igual que dC/dt. Si C < M la derivada es positiva (crece) y disminuye conforme C se acerca a M.');

  // 7. Condición inicial
  titulo(doc, 7, 'Condición inicial');
  formula(doc, `C(${cifra(p.t0, 6)}) = ${cifra(p.C0, 6)} clientes`);

  // 8. Parámetros utilizados
  titulo(doc, 8, 'Parámetros utilizados (hipotéticos)');
  tabla(doc, ['Parámetro', 'Valor', 'Unidad'], [
    ['Clientes iniciales (C0)', String(p.C0), 'clientes'],
    ['Mercado potencial (M)', String(p.M), 'clientes'],
    ['Tasa de crecimiento (k)', String(p.k), '1/mes'],
    ['Tiempo inicial (t0)', String(p.t0), 'meses'],
    ['Tiempo final (tf)', String(p.tf), 'meses'],
    ['Tamaño de paso (h)', String(p.h), 'meses'],
    ['Número de pasos', String(r.pasos), '-'],
  ], [3, 2, 1.5], ['left', 'right', 'left']);
  if (sim.avisos.length) vinetas(doc, sim.avisos.map((a) => `Aviso: ${a}`));

  // 9. Solución analítica
  titulo(doc, 9, 'Solución analítica');
  parrafo(doc, 'Separando variables: dC/(M - C) = k dt. Integrando: -ln(M - C) = k t + K, de donde M - C = A e^(-k t). Con la condición inicial, A = M - C0:');
  formula(doc, 'C(t) = M - (M - C0) e^(-k (t - t0))');
  formula(doc, p.t0 === 0
    ? `C(t) = ${cifra(p.M, 6)} - ${cifra(p.M - p.C0, 6)} e^(-${cifra(p.k, 6)} t)`
    : `C(t) = ${cifra(p.M, 6)} - ${cifra(p.M - p.C0, 6)} e^(-${cifra(p.k, 6)} (t - ${cifra(p.t0, 6)}))`);
  parrafo(doc, `Verificación: C'(t) = k (M - C0) e^(-k(t - t0)) y k (M - C) = k (M - C0) e^(-k(t - t0)); ambos lados coinciden. Además C(t0) = M - (M - C0) = C0 = ${cifra(p.C0, 6)}.`);

  // 10. Heun
  const f = (t, C) => metodos.derivada(t, C, p);
  const h1 = sim.filas.length > 1 ? sim.filas[1].tiempo - sim.filas[0].tiempo : p.h;
  const ph = metodos.pasoHeun(f, p.t0, p.C0, h1);
  titulo(doc, 10, 'Desarrollo resumido del método de Heun (RK2)');
  parrafo(doc, 'Calcula la pendiente al inicio del paso, predice el punto final con ella, calcula la pendiente en ese punto y avanza con el promedio de ambas pendientes. Es de orden 2: el error global es proporcional a h².');
  formula(doc, 'k1 = f(tn, Cn)');
  formula(doc, 'k2 = f(tn + h, Cn + h·k1)');
  formula(doc, 'Cn+1 = Cn + (h/2)(k1 + k2)');
  parrafo(doc, `Primer paso (t0 = ${cifra(p.t0, 6)}, C0 = ${cifra(p.C0, 6)}, h = ${cifra(h1, 6)}): k1 = ${num(ph.k1, 6)}; k2 = ${num(ph.k2, 6)}; C1 = ${num(ph.siguiente, 6)} clientes (exacto: ${num(sim.filas[1]?.analitico ?? p.C0, 6)}).`);

  // 11. RK4
  const pr = metodos.pasoRK4(f, p.t0, p.C0, h1);
  titulo(doc, 11, 'Desarrollo resumido del método de Runge-Kutta de 4.º orden (RK4)');
  parrafo(doc, 'Evalúa cuatro pendientes en cada paso (inicio, dos en el punto medio y final) y las combina con pesos 1-2-2-1. Es de orden 4: el error global es proporcional a h^4.');
  formula(doc, 'k1 = f(tn, Cn)');
  formula(doc, 'k2 = f(tn + h/2, Cn + h·k1/2)');
  formula(doc, 'k3 = f(tn + h/2, Cn + h·k2/2)');
  formula(doc, 'k4 = f(tn + h, Cn + h·k3)');
  formula(doc, 'Cn+1 = Cn + (h/6)(k1 + 2k2 + 2k3 + k4)');
  parrafo(doc, `Primer paso: k1 = ${num(pr.k1, 6)}; k2 = ${num(pr.k2, 6)}; k3 = ${num(pr.k3, 6)}; k4 = ${num(pr.k4, 6)}; C1 = ${num(pr.siguiente, 6)} clientes.`);

  // 12. Tabla comparativa
  const sel = seleccionarFilas(sim.filas);
  titulo(doc, 12, 'Tabla comparativa');
  if (sel.recortada) {
    parrafo(doc, `La simulación tiene ${sim.filas.length} filas; se muestra 1 de cada ${sel.salto} (más la última). La tabla completa está disponible en la aplicación.`, { tamano: 8.5, color: COLOR.suave });
  }
  tabla(doc, ['n', 't (meses)', 'Analítica', 'Heun', 'RK4'],
    sel.filas.map((x) => [String(x.iteracion), num(x.tiempo, 3), fmtValor(x.analitico), fmtValor(x.heun), fmtValor(x.rk4)]),
    [0.6, 1, 1.5, 1.5, 1.5]);

  // 13. Gráfica
  titulo(doc, 13, 'Gráfica de las tres soluciones');
  grafica(doc, sim);

  // 14. Errores
  titulo(doc, 14, 'Tabla de errores absolutos y relativos');
  parrafo(doc, 'Ea = |exacto - aproximado| (clientes);  Er = Ea / |exacto| × 100 (%). Si el valor exacto es 0, Er no está definido.', { tamano: 9 });
  tabla(doc, ['n', 't', 'Ea Heun', 'Er Heun (%)', 'Ea RK4', 'Er RK4 (%)'],
    sel.filas.map((x) => [String(x.iteracion), num(x.tiempo, 3), fmtError(x.errorAbsHeun), fmtRel(x.errorRelHeun), fmtError(x.errorAbsRK4), fmtRel(x.errorRelRK4)]),
    [0.6, 0.9, 1.4, 1.3, 1.4, 1.3]);
  parrafo(doc, `Error absoluto máximo: Heun ${numError(r.errorAbsMaxHeun)} y RK4 ${numError(r.errorAbsMaxRK4)} clientes. Error absoluto promedio: Heun ${numError(r.errorAbsPromHeun)} y RK4 ${numError(r.errorAbsPromRK4)} clientes.`);

  // 15. Comparación de tamaños de paso
  titulo(doc, 15, 'Comparación de tamaños de paso');
  const comp = sim.comparacionPasos;
  if (comp) {
    parrafo(doc, comp.origen === 'guardada'
      ? 'Experimentos guardados en la base de datos con los mismos C0, M, k, t0 y tf.'
      : 'Experimentos calculados con los mismos C0, M, k, t0 y tf de esta simulación.', { tamano: 9, color: COLOR.suave });
    tabla(doc, ['h (meses)', 'Pasos', 'Heun(tf)', 'Ea final Heun', 'Ea máx Heun', 'RK4(tf)', 'Ea final RK4', 'Ea máx RK4'],
      comp.experimentos.map((e) => [String(e.h), String(e.resumen.pasos), fmtValor(e.resumen.heunFinal), fmtError(e.resumen.errorAbsFinalHeun), fmtError(e.resumen.errorAbsMaxHeun), fmtValor(e.resumen.rk4Final), fmtError(e.resumen.errorAbsFinalRK4), fmtError(e.resumen.errorAbsMaxRK4)]),
      [0.8, 0.6, 1.2, 1.1, 1.1, 1.2, 1.1, 1.1]);
  }
  parrafo(doc, it.paso);

  // 16. Interpretación
  titulo(doc, 16, 'Interpretación de resultados');
  parrafo(doc, it.crecimiento);
  vinetas(doc, it.hitos);
  parrafo(doc, it.metodo);

  // 17. Conclusiones (guardadas en la tabla informes)
  titulo(doc, 17, 'Conclusiones');
  parrafo(doc, informe.conclusion);

  // 18. Limitaciones
  titulo(doc, 18, 'Limitaciones del modelo');
  vinetas(doc, it.limitaciones);
}

/** Pie de página con número de página en todas las hojas. */
function piePagina(doc, informe) {
  const rango = doc.bufferedPageRange();
  for (let i = rango.start; i < rango.start + rango.count; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - MARGEN + 5;
    doc.page.margins.bottom = 0; // permite escribir en el margen sin crear otra página
    doc.font('Helvetica').fontSize(8).fillColor(COLOR.suave)
      .text(limpiar(`TECHFIX · Informe N.º ${informe.id} · Métodos Numéricos`), MARGEN, y, { lineBreak: false })
      .text(`Página ${i + 1} de ${rango.count}`, doc.page.width - MARGEN - 100, y, { width: 100, align: 'right', lineBreak: false });
  }
}

module.exports = { generarPdf, seleccionarFilas, limpiar };
