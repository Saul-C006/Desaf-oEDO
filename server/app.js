/**
 * TECHFIX - Configuración de la aplicación Express
 * ------------------------------------------------------------
 * Un solo servidor entrega:
 *   /          -> el frontend (carpeta public/)
 *   /shared    -> código compartido con el navegador (validación)
 *   /api/...   -> la API REST en formato JSON
 * Se separa de server.js para poder probar la app sin abrir un puerto fijo.
 */
'use strict';
const path = require('node:path');
const express = require('express');
const { comprobarConexion } = require('./config/db');
const { ErrorHttp } = require('./services/errores');

const app = express();
app.disable('x-powered-by'); // no revelar la tecnología del servidor

// Cabeceras básicas de seguridad
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'same-origin',
  });
  next();
});

app.use(express.json({ limit: '20kb' })); // las peticiones solo llevan parámetros: no necesitan más

// ---------------- API ----------------
app.get('/api/salud', async (req, res) => {
  try {
    await comprobarConexion();
    res.json({ estado: 'ok', baseDeDatos: 'conectada', hora: new Date().toISOString() });
  } catch (error) {
    console.error('[salud] Sin conexión a MySQL:', error.code || error.message);
    res.status(503).json({ estado: 'error', baseDeDatos: 'sin conexión' });
  }
});

app.use('/api', require('./routes/simulaciones'));
app.use('/api', require('./routes/informes'));

// Ruta de API inexistente
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

// ---------------- Frontend ----------------
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));
// Chart.js se entrega desde node_modules (no depende de un CDN externo durante la defensa)
app.get('/vendor/chart.umd.min.js', (req, res) => {
  res.sendFile(path.join(path.dirname(require.resolve('chart.js')), 'chart.umd.min.js'));
});
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------------- Manejador central de errores ----------------
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  if (error instanceof ErrorHttp) {
    return res.status(error.estado).json({ error: error.message, detalles: error.detalles });
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la petición no es un JSON válido.' });
  }
  if (error instanceof RangeError || error instanceof TypeError) {
    // Errores de validación del módulo numérico
    return res.status(400).json({ error: error.message });
  }
  // Errores inesperados (p. ej. MySQL caído): se registran en el servidor,
  // pero al usuario no se le muestran detalles internos.
  console.error('[error]', error);
  const sinBD = ['ECONNREFUSED', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR', 'ENOTFOUND'].includes(error.code);
  res.status(sinBD ? 503 : 500).json({
    error: sinBD
      ? 'No se pudo conectar con la base de datos. Intente nuevamente en unos segundos.'
      : 'Ocurrió un error interno en el servidor.',
  });
});

module.exports = app;
