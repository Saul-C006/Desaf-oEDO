/**
 * Rutas /api/informes
 */
'use strict';
const express = require('express');
const asincrono = require('./asincrono');
const servicio = require('../services/informes');
const { leerId } = require('../services/errores');

const router = express.Router();

router.get('/informes', asincrono(async (req, res) => {
  res.json(await servicio.listarInformes());
}));

router.get('/informes/:id', asincrono(async (req, res) => {
  res.json(await servicio.obtenerInforme(leerId(req.params.id)));
}));

// Descarga del PDF (regenerado desde MySQL). Con ?ver=1 se abre en el navegador.
router.get('/informes/:id/pdf', asincrono(async (req, res) => {
  const { nombreArchivo, buffer } = await servicio.pdfDeInforme(leerId(req.params.id));
  const modo = req.query.ver === '1' ? 'inline' : 'attachment';
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `${modo}; filename="${nombreArchivo}"`,
    'Content-Length': buffer.length,
    'Cache-Control': 'no-store',
  });
  res.send(buffer);
}));

router.delete('/informes/:id', asincrono(async (req, res) => {
  await servicio.eliminarInforme(leerId(req.params.id));
  res.status(204).end();
}));

module.exports = router;
