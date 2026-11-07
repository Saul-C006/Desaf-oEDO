/**
 * TECHFIX - Servicio de informes
 * ------------------------------------------------------------
 * Cada informe queda REGISTRADO en la tabla informes (asociado a su
 * simulación). El PDF no se guarda en disco: se regenera con los datos
 * de MySQL cada vez que se descarga, así siempre corresponde a la simulación.
 */
'use strict';
const { pool, enTransaccion } = require('../config/db');
const { validarTexto } = require('../../shared/validacion');
const { obtenerSimulacion } = require('./simulaciones');
const { generarPdf } = require('./informePdf');
const { ErrorHttp } = require('./errores');

const rutaPdf = (id) => `/api/informes/${id}/pdf`;

function formatear(i) {
  return {
    id: i.id_informe,
    idSimulacion: i.id_simulacion,
    titulo: i.titulo,
    fechaGeneracion: i.fecha_generacion,
    resumen: i.resumen,
    conclusion: i.conclusion,
    ubicacionPdf: i.ubicacion_pdf,
    ...(i.nombre_desafio !== undefined
      ? { nombreSimulacion: i.nombre_desafio, tamanioPaso: i.tamanio_paso }
      : {}),
  };
}

/** Genera (registra) un nuevo informe para una simulación. */
async function crearInforme(idSimulacion, cuerpo = {}) {
  const sim = await obtenerSimulacion(idSimulacion); // 404 si no existe
  const t = validarTexto(cuerpo.titulo, 200, false);
  if (!t.valido) throw new ErrorHttp(400, 'Título no válido.', { titulo: t.error });
  const titulo = t.valor || `Informe de simulación: ${sim.nombre}`.slice(0, 200);

  const id = await enTransaccion(async (conexion) => {
    const [res] = await conexion.execute(
      `INSERT INTO informes (id_simulacion, titulo, resumen, conclusion, ubicacion_pdf)
       VALUES (?, ?, ?, ?, ?)`,
      [idSimulacion, titulo, sim.interpretacion.resumen, sim.interpretacion.conclusion, 'pendiente']
    );
    // La ubicación depende del id generado, por eso se actualiza después de insertar.
    await conexion.execute('UPDATE informes SET ubicacion_pdf = ? WHERE id_informe = ?', [rutaPdf(res.insertId), res.insertId]);
    return res.insertId;
  });
  return obtenerInforme(id);
}

async function obtenerInforme(id) {
  const [filas] = await pool.execute('SELECT * FROM informes WHERE id_informe = ?', [id]);
  if (!filas.length) throw new ErrorHttp(404, 'El informe no existe.');
  return formatear(filas[0]);
}

async function listarInformes() {
  const [filas] = await pool.query(
    `SELECT i.*, s.nombre_desafio, s.tamanio_paso
       FROM informes i JOIN simulaciones s ON s.id_simulacion = i.id_simulacion
      ORDER BY i.fecha_generacion DESC, i.id_informe DESC
      LIMIT 500`
  );
  return filas.map(formatear);
}

/** Regenera el PDF del informe a partir de MySQL. Devuelve { nombreArchivo, buffer }. */
async function pdfDeInforme(id) {
  const informe = await obtenerInforme(id);
  const sim = await obtenerSimulacion(informe.idSimulacion);
  const buffer = await generarPdf(informe, sim);
  return { nombreArchivo: `TECHFIX_informe_${informe.id}_simulacion_${sim.id}.pdf`, buffer };
}

async function eliminarInforme(id) {
  const [res] = await pool.execute('DELETE FROM informes WHERE id_informe = ?', [id]);
  if (res.affectedRows === 0) throw new ErrorHttp(404, 'El informe no existe.');
}

module.exports = { crearInforme, obtenerInforme, listarInformes, pdfDeInforme, eliminarInforme };
