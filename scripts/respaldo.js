/**
 * TECHFIX - Respaldo y restauración de la base de datos (sin mysqldump)
 * ------------------------------------------------------------
 * Respaldo:     npm run respaldo
 *   -> crea database/respaldos/respaldo_AAAA-MM-DD_HH-MM.sql con todos los datos.
 * Restaurar:    npm run restaurar -- database/respaldos/respaldo_....sql
 *   -> vuelve a crear las tablas (schema.sql) y carga los datos del respaldo.
 *
 * Usa la conexión configurada en .env (local o en la nube: DB_* o MYSQL_URL).
 * Para respaldar la base de Railway desde su laptop, ponga en .env la URL PÚBLICA
 * del servicio MySQL (MYSQL_PUBLIC_URL) como MYSQL_URL.
 */
'use strict';
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { configuracionConexion } = require('../server/config/db');

const TABLAS = ['comparaciones', 'simulaciones', 'resultados', 'informes']; // padres primero
const CARPETA = path.join(__dirname, '..', 'database', 'respaldos');

async function respaldar(conexion) {
  const lineas = [
    '-- TECHFIX - respaldo generado el ' + new Date().toISOString(),
    'SET FOREIGN_KEY_CHECKS = 0;',
  ];
  for (const tabla of TABLAS) {
    const [filas] = await conexion.query(`SELECT * FROM ${tabla}`);
    lineas.push(`-- ${tabla}: ${filas.length} filas`);
    for (const f of filas) {
      const columnas = Object.keys(f).map((c) => '`' + c + '`').join(', ');
      lineas.push(`INSERT INTO ${tabla} (${columnas}) VALUES (${Object.values(f).map((v) => conexion.escape(v)).join(', ')});`);
    }
  }
  lineas.push('SET FOREIGN_KEY_CHECKS = 1;');
  fs.mkdirSync(CARPETA, { recursive: true });
  const fecha = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  const archivo = path.join(CARPETA, `respaldo_${fecha}.sql`);
  fs.writeFileSync(archivo, lineas.join('\n') + '\n', 'utf8');
  console.log('Respaldo creado:', path.relative(process.cwd(), archivo));
}

async function restaurar(conexion, archivo) {
  if (!archivo || !fs.existsSync(archivo)) throw new Error('Indique un archivo de respaldo existente.');
  const esquema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  await conexion.query(esquema); // ¡borra y vuelve a crear las tablas!
  await conexion.query(fs.readFileSync(archivo, 'utf8'));
  const [[c]] = await conexion.query('SELECT COUNT(*) AS n FROM simulaciones');
  console.log(`Restauración completa: ${c.n} simulaciones.`);
}

(async () => {
  const modo = process.argv[2];
  const conexion = await mysql.createConnection({ ...configuracionConexion(), multipleStatements: true, timezone: 'Z', dateStrings: true });
  try {
    if (modo === 'restaurar') await restaurar(conexion, process.argv[3]);
    else await respaldar(conexion);
  } finally {
    await conexion.end();
  }
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
