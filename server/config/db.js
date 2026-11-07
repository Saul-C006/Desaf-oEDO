/**
 * TECHFIX - Conexión a MySQL (pool de conexiones con mysql2)
 * ------------------------------------------------------------
 * Las credenciales se leen de variables de entorno (.env en local,
 * panel del hosting en producción). NUNCA se escriben en el código.
 *
 * Un "pool" mantiene algunas conexiones abiertas y las reutiliza: es más
 * rápido que abrir una conexión nueva en cada petición y respeta el
 * límite de conexiones de los proveedores gratuitos.
 */
'use strict';
const fs = require('node:fs');
const mysql = require('mysql2/promise');

/** Configuración SSL/TLS (conexión cifrada), necesaria en la mayoría de proveedores en la nube. */
function configuracionSSL() {
  if (String(process.env.DB_SSL || 'false').toLowerCase() !== 'true') return undefined;
  const ssl = {
    // Por seguridad se verifica el certificado del servidor, salvo que se desactive explícitamente.
    rejectUnauthorized: String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false',
  };
  // Certificado de la autoridad (CA) del proveedor: como texto (DB_SSL_CA) o como archivo (DB_SSL_CA_PATH).
  if (process.env.DB_SSL_CA) ssl.ca = process.env.DB_SSL_CA.replace(/\\n/g, '\n');
  else if (process.env.DB_SSL_CA_PATH) ssl.ca = fs.readFileSync(process.env.DB_SSL_CA_PATH, 'utf8');
  return ssl;
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: configuracionSSL(),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 5), // bajo: los planes gratuitos limitan conexiones
  queueLimit: 0,
  timezone: 'Z',       // las fechas se interpretan en UTC
  dateStrings: false,
  decimalNumbers: true,
  connectTimeout: 15000,
});

// Cada conexión nueva trabaja en UTC, para que CURRENT_TIMESTAMP sea igual en local y en la nube.
pool.pool.on('connection', (conexion) => {
  conexion.query("SET time_zone = '+00:00'");
});

/**
 * Ejecuta una función dentro de una TRANSACCIÓN:
 * si todo sale bien se confirma (COMMIT); si algo falla se deshace (ROLLBACK).
 */
async function enTransaccion(trabajo) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await trabajo(conexion);
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

/** Comprueba que la base de datos responde (para /api/salud). */
async function comprobarConexion() {
  const [filas] = await pool.query('SELECT 1 AS ok');
  return filas[0].ok === 1;
}

module.exports = { pool, enTransaccion, comprobarConexion };
