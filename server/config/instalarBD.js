/**
 * TECHFIX - Instalación automática de las tablas
 * ------------------------------------------------------------
 * Al arrancar, si la tabla "simulaciones" NO existe, se ejecuta
 * database/schema.sql una sola vez. Si las tablas ya existen no se
 * toca nada (los datos guardados nunca se borran).
 *
 * Sirve para publicar en la nube sin tener que importar el SQL a mano.
 * Se puede desactivar con DB_AUTO_INSTALAR=false.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { pool, configuracionConexion } = require('./db');

async function instalarSiFalta() {
  if (String(process.env.DB_AUTO_INSTALAR || 'true').toLowerCase() === 'false') return 'desactivado';

  const [filas] = await pool.query(
    "SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'simulaciones'"
  );
  if (filas[0].n > 0) return 'ya instalada';

  // Conexión aparte que permite ejecutar varias sentencias SQL seguidas (solo para este script).
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'schema.sql'), 'utf8');
  const conexion = await mysql.createConnection({ ...configuracionConexion(), multipleStatements: true });
  try {
    await conexion.query(sql);
  } finally {
    await conexion.end();
  }
  return 'instalada ahora';
}

module.exports = { instalarSiFalta };
