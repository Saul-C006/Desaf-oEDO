/**
 * TECHFIX - Servicio de simulaciones
 * ------------------------------------------------------------
 * Une las tres piezas: validación -> cálculo numérico -> MySQL.
 * Todas las consultas usan parámetros (?) para evitar inyección SQL.
 */
'use strict';
const { pool, enTransaccion } = require('../config/db');
const metodos = require('../numerico/metodos');
const { validarParametros, validarTexto } = require('../../shared/validacion');
const { interpretar } = require('./interpretacion');
const { ErrorHttp } = require('./errores');

const NOMBRE_PREDETERMINADO = 'TECHFIX: crecimiento de clientes';
const PASOS_COMPARACION = [1, 0.5]; // Experimento 1 y Experimento 2

// ---------------------------------------------------------------------
// Validación de la petición
// ---------------------------------------------------------------------

/** Valida parámetros y textos. Lanza ErrorHttp 400 con el detalle por campo. */
function validarPeticion(cuerpo, opciones = {}) {
  const v = validarParametros(cuerpo, opciones);
  const nombre = validarTexto(cuerpo.nombre_desafio, 150, false);
  const descripcion = validarTexto(cuerpo.descripcion, 500, false);
  const observaciones = validarTexto(cuerpo.observaciones, 2000, false);
  const errores = { ...v.errores };
  if (!nombre.valido) errores.nombre_desafio = nombre.error;
  if (!descripcion.valido) errores.descripcion = descripcion.error;
  if (!observaciones.valido) errores.observaciones = observaciones.error;
  if (Object.keys(errores).length) throw new ErrorHttp(400, 'Hay datos inválidos en el formulario.', errores);
  return {
    parametros: v.valores,
    nombre: nombre.valor || NOMBRE_PREDETERMINADO,
    descripcion: descripcion.valor || null,
    observaciones: observaciones.valor || null,
  };
}

// ---------------------------------------------------------------------
// Cálculo sin guardar
// ---------------------------------------------------------------------

/** Comparación h = 1 vs h = 0.5 calculada en memoria (mismos C0, M, k, t0, tf). */
function comparacionCalculada(p) {
  try {
    const { experimentos, reducciones } = metodos.compararTamaniosPaso(p, PASOS_COMPARACION);
    return {
      origen: 'calculada',
      experimentos: experimentos.map((e) => ({ h: e.h, resumen: e.resumen, avisos: e.avisos })),
      reducciones,
    };
  } catch {
    return null; // p. ej. el intervalo es tan largo que h = 0.5 supera el máximo de pasos
  }
}

/** Calcula una simulación sin guardarla (vista previa). */
function previsualizar(cuerpo) {
  const datos = validarPeticion(cuerpo);
  const sim = metodos.simular(datos.parametros);
  const comparacion = comparacionCalculada(datos.parametros);
  return { ...formatearSimulacion(null, datos, sim), comparacionPasos: comparacion, interpretacion: interpretar(sim, comparacion) };
}

// ---------------------------------------------------------------------
// Guardado
// ---------------------------------------------------------------------

/** Inserta una simulación y todas sus filas usando la conexión de una transacción. */
async function insertarSimulacion(conexion, datos, sim, idComparacion = null) {
  const p = datos.parametros;
  const [res] = await conexion.execute(
    `INSERT INTO simulaciones
       (id_comparacion, nombre_desafio, descripcion, condicion_inicial, mercado_potencial,
        tasa_crecimiento, tiempo_inicial, tiempo_final, tamanio_paso, observaciones)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [idComparacion, datos.nombre, datos.descripcion, p.C0, p.M, p.k, p.t0, p.tf, p.h, datos.observaciones]
  );
  const idSimulacion = res.insertId;

  // Inserción masiva: una sola sentencia con todas las iteraciones.
  const filas = sim.filas.map((r) => [
    idSimulacion, r.iteracion, r.tiempo, r.analitico,
    r.heun, r.errorAbsHeun, r.errorRelHeun,
    r.rk4, r.errorAbsRK4, r.errorRelRK4,
  ]);
  await conexion.query(
    `INSERT INTO resultados
       (id_simulacion, iteracion, tiempo, valor_analitico,
        valor_heun, error_absoluto_heun, error_relativo_heun,
        valor_rk4, error_absoluto_rk4, error_relativo_rk4)
     VALUES ?`,
    [filas]
  );
  return idSimulacion;
}

/** Calcula y guarda una simulación individual. Devuelve la simulación completa. */
async function crearSimulacion(cuerpo) {
  const datos = validarPeticion(cuerpo);
  const sim = metodos.simular(datos.parametros);
  const id = await enTransaccion((conexion) => insertarSimulacion(conexion, datos, sim));
  return obtenerSimulacion(id);
}

/**
 * Ejecuta y guarda los experimentos de comparación (h = 1 y h = 0.5)
 * con exactamente los mismos C0, M, k, t0 y tf.
 */
async function crearComparacion(cuerpo) {
  const datos = validarPeticion(cuerpo, { omitirH: true });
  const experimentos = PASOS_COMPARACION.map((h, i) => {
    const parametros = { ...datos.parametros, h };
    const v = validarParametros(parametros); // comprueba el límite de pasos con este h
    if (!v.valido) {
      throw new ErrorHttp(400, `No se puede ejecutar el experimento con h = ${h}.`, v.errores);
    }
    return {
      datos: {
        ...datos,
        parametros,
        nombre: `${datos.nombre} - Experimento ${i + 1} (h = ${h})`,
      },
      sim: metodos.simular(parametros),
    };
  });

  const idComparacion = await enTransaccion(async (conexion) => {
    const [res] = await conexion.execute('INSERT INTO comparaciones (descripcion) VALUES (?)', [
      `${datos.nombre}: comparación de h = ${PASOS_COMPARACION.join(' y h = ')}`,
    ]);
    for (const e of experimentos) await insertarSimulacion(conexion, e.datos, e.sim, res.insertId);
    return res.insertId;
  });
  return obtenerComparacion(idComparacion);
}

// ---------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------

/** Convierte una fila de la tabla resultados al formato del módulo numérico. */
function filaDesdeBD(r) {
  return {
    iteracion: r.iteracion,
    tiempo: r.tiempo,
    analitico: r.valor_analitico,
    heun: r.valor_heun,
    errorAbsHeun: r.error_absoluto_heun,
    errorRelHeun: r.error_relativo_heun,
    rk4: r.valor_rk4,
    errorAbsRK4: r.error_absoluto_rk4,
    errorRelRK4: r.error_relativo_rk4,
  };
}

function parametrosDesdeBD(s) {
  return {
    C0: s.condicion_inicial,
    M: s.mercado_potencial,
    k: s.tasa_crecimiento,
    t0: s.tiempo_inicial,
    tf: s.tiempo_final,
    h: s.tamanio_paso,
  };
}

/** Formato único de una simulación para la API (guardada o no). */
function formatearSimulacion(fila, datos, sim) {
  return {
    id: fila ? fila.id_simulacion : null,
    idComparacion: fila ? fila.id_comparacion : null,
    nombre: datos.nombre,
    descripcion: datos.descripcion,
    observaciones: datos.observaciones,
    fechaCreacion: fila ? fila.fecha_creacion : null,
    parametros: sim.parametros,
    filas: sim.filas,
    curvaAnalitica: metodos.curvaAnalitica(sim.parametros),
    resumen: sim.resumen,
    avisos: sim.avisos,
  };
}

/** Lee una simulación y sus resultados desde MySQL (sin interpretar). */
async function leerSimulacionBase(id) {
  const [simulaciones] = await pool.execute('SELECT * FROM simulaciones WHERE id_simulacion = ?', [id]);
  if (!simulaciones.length) throw new ErrorHttp(404, 'La simulación no existe.');
  const s = simulaciones[0];
  const [resultados] = await pool.execute(
    'SELECT * FROM resultados WHERE id_simulacion = ? ORDER BY iteracion',
    [id]
  );
  const parametros = parametrosDesdeBD(s);
  const filas = resultados.map(filaDesdeBD);
  const sim = { parametros, filas, resumen: metodos.resumir(filas), avisos: metodos.calcularAvisos(parametros) };
  return formatearSimulacion(
    s,
    { nombre: s.nombre_desafio, descripcion: s.descripcion, observaciones: s.observaciones },
    sim
  );
}

/** Experimentos guardados de una comparación, con su reducción de error. */
async function leerExperimentos(idComparacion, incluirFilas) {
  const [ids] = await pool.execute(
    'SELECT id_simulacion FROM simulaciones WHERE id_comparacion = ? ORDER BY tamanio_paso DESC, id_simulacion',
    [idComparacion]
  );
  const experimentos = [];
  for (const { id_simulacion } of ids) {
    const s = await leerSimulacionBase(id_simulacion);
    experimentos.push({
      idSimulacion: s.id,
      nombre: s.nombre,
      h: s.parametros.h,
      resumen: s.resumen,
      avisos: s.avisos,
      ...(incluirFilas ? { filas: s.filas, parametros: s.parametros } : {}),
    });
  }
  return { experimentos, reducciones: metodos.calcularReducciones(experimentos) };
}

/** Comparación de pasos para una simulación: la guardada si existe; si no, calculada. */
async function comparacionParaSimulacion(sim) {
  if (sim.idComparacion) {
    const guardada = await leerExperimentos(sim.idComparacion, false);
    if (guardada.experimentos.length >= 2) return { origen: 'guardada', idComparacion: sim.idComparacion, ...guardada };
  }
  return comparacionCalculada(sim.parametros);
}

/** Simulación completa: parámetros, resultados, comparación, interpretación e informes. */
async function obtenerSimulacion(id) {
  const sim = await leerSimulacionBase(id);
  const comparacion = await comparacionParaSimulacion(sim);
  const [informes] = await pool.execute(
    `SELECT id_informe, titulo, fecha_generacion, ubicacion_pdf
       FROM informes WHERE id_simulacion = ? ORDER BY fecha_generacion DESC, id_informe DESC`,
    [id]
  );
  return {
    ...sim,
    comparacionPasos: comparacion,
    interpretacion: interpretar(sim, comparacion),
    informes: informes.map((i) => ({
      id: i.id_informe,
      titulo: i.titulo,
      fechaGeneracion: i.fecha_generacion,
      ubicacionPdf: i.ubicacion_pdf,
    })),
  };
}

/** Historial: lista de simulaciones con resultado final y errores máximos. */
async function listarSimulaciones() {
  const [filas] = await pool.query(
    `SELECT s.id_simulacion, s.id_comparacion, s.nombre_desafio, s.descripcion, s.fecha_creacion,
            s.condicion_inicial, s.mercado_potencial, s.tasa_crecimiento,
            s.tiempo_inicial, s.tiempo_final, s.tamanio_paso,
            a.ultima AS pasos, a.max_heun, a.max_rk4,
            r.valor_analitico, r.valor_heun, r.valor_rk4,
            (SELECT COUNT(*) FROM informes i WHERE i.id_simulacion = s.id_simulacion) AS num_informes
       FROM simulaciones s
       JOIN (SELECT id_simulacion, MAX(iteracion) AS ultima,
                    MAX(error_absoluto_heun) AS max_heun, MAX(error_absoluto_rk4) AS max_rk4
               FROM resultados GROUP BY id_simulacion) a ON a.id_simulacion = s.id_simulacion
       JOIN resultados r ON r.id_simulacion = s.id_simulacion AND r.iteracion = a.ultima
      ORDER BY s.fecha_creacion DESC, s.id_simulacion DESC
      LIMIT 500`
  );
  return filas.map((f) => ({
    id: f.id_simulacion,
    idComparacion: f.id_comparacion,
    nombre: f.nombre_desafio,
    descripcion: f.descripcion,
    fechaCreacion: f.fecha_creacion,
    parametros: parametrosDesdeBD(f),
    pasos: f.pasos,
    analiticoFinal: f.valor_analitico,
    heunFinal: f.valor_heun,
    rk4Final: f.valor_rk4,
    errorAbsMaxHeun: f.max_heun,
    errorAbsMaxRK4: f.max_rk4,
    metodoMasPreciso: f.max_rk4 < f.max_heun ? 'RK4' : f.max_rk4 > f.max_heun ? 'Heun' : 'Empate',
    numInformes: f.num_informes,
  }));
}

/** Comparación guardada con todas sus filas (pantalla de comparación). */
async function obtenerComparacion(idComparacion) {
  const [c] = await pool.execute('SELECT * FROM comparaciones WHERE id_comparacion = ?', [idComparacion]);
  if (!c.length) throw new ErrorHttp(404, 'La comparación no existe.');
  const { experimentos, reducciones } = await leerExperimentos(idComparacion, true);
  return {
    curvaAnalitica: experimentos.length ? metodos.curvaAnalitica(experimentos[0].parametros) : [],
    id: c[0].id_comparacion,
    descripcion: c[0].descripcion,
    fechaCreacion: c[0].fecha_creacion,
    experimentos,
    reducciones,
  };
}

// ---------------------------------------------------------------------
// Eliminación
// ---------------------------------------------------------------------

/**
 * Elimina una simulación (sus resultados e informes se borran en cascada).
 * Si era parte de una comparación y esta queda vacía, también se elimina la comparación.
 */
async function eliminarSimulacion(id) {
  await enTransaccion(async (conexion) => {
    const [s] = await conexion.execute('SELECT id_comparacion FROM simulaciones WHERE id_simulacion = ? FOR UPDATE', [id]);
    if (!s.length) throw new ErrorHttp(404, 'La simulación no existe.');
    await conexion.execute('DELETE FROM simulaciones WHERE id_simulacion = ?', [id]);
    if (s[0].id_comparacion) {
      await conexion.execute(
        `DELETE FROM comparaciones WHERE id_comparacion = ?
           AND NOT EXISTS (SELECT 1 FROM simulaciones WHERE id_comparacion = ?)`,
        [s[0].id_comparacion, s[0].id_comparacion]
      );
    }
  });
}

/** Elimina una comparación completa (sus experimentos, resultados e informes, en cascada). */
async function eliminarComparacion(id) {
  const [res] = await pool.execute('DELETE FROM comparaciones WHERE id_comparacion = ?', [id]);
  if (res.affectedRows === 0) throw new ErrorHttp(404, 'La comparación no existe.');
}

module.exports = {
  PASOS_COMPARACION,
  validarPeticion,
  previsualizar,
  crearSimulacion,
  crearComparacion,
  obtenerSimulacion,
  listarSimulaciones,
  obtenerComparacion,
  eliminarSimulacion,
  eliminarComparacion,
};
