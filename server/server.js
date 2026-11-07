/**
 * TECHFIX - Punto de entrada del servidor
 * Uso:  npm start   (o  npm run dev  para reiniciar al guardar cambios)
 */
'use strict';
require('dotenv').config({ quiet: true }); // lee el archivo .env (solo en local)

const app = require('./app');
const { comprobarConexion, pool, configuracionConexion } = require('./config/db');
const { instalarSiFalta } = require('./config/instalarBD');

const PUERTO = Number(process.env.PORT || 3000); // los hostings definen PORT automáticamente

const servidor = app.listen(PUERTO, async () => {
  console.log(`TECHFIX escuchando en http://localhost:${PUERTO}`);
  try {
    await comprobarConexion();
    const c = configuracionConexion();
    console.log(`Conectado a MySQL (${c.host}/${c.database}).`);
    console.log(`Tablas de la base de datos: ${await instalarSiFalta()}.`);
  } catch (error) {
    // No se detiene el servidor: /api/salud informará el problema.
    console.error('ADVERTENCIA: no se pudo conectar a MySQL:', error.code || error.message);
  }
});

// Cierre ordenado (los hostings envían SIGTERM al reiniciar)
function cerrar() {
  servidor.close(() => pool.end().finally(() => process.exit(0)));
}
process.on('SIGTERM', cerrar);
process.on('SIGINT', cerrar);
