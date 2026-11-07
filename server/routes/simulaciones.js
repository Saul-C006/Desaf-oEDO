/**
 * Rutas /api/simulaciones y /api/comparaciones
 */
'use strict';
const express = require('express');
const asincrono = require('./asincrono');
const servicio = require('../services/simulaciones');
const informes = require('../services/informes');
const { leerId } = require('../services/errores');

const router = express.Router();

// Calcular SIN guardar (vista previa)
router.post('/simulaciones/previsualizar', (req, res) => {
  res.json(servicio.previsualizar(req.body || {}));
});

// Calcular y GUARDAR una simulación
router.post('/simulaciones', asincrono(async (req, res) => {
  res.status(201).json(await servicio.crearSimulacion(req.body || {}));
}));

// Historial
router.get('/simulaciones', asincrono(async (req, res) => {
  res.json(await servicio.listarSimulaciones());
}));

// Detalle: parámetros, resultados, comparación, interpretación e informes
router.get('/simulaciones/:id', asincrono(async (req, res) => {
  res.json(await servicio.obtenerSimulacion(leerId(req.params.id)));
}));

// Eliminar (el frontend pide confirmación antes)
router.delete('/simulaciones/:id', asincrono(async (req, res) => {
  await servicio.eliminarSimulacion(leerId(req.params.id));
  res.status(204).end();
}));

// Generar un informe para la simulación
router.post('/simulaciones/:id/informes', asincrono(async (req, res) => {
  res.status(201).json(await informes.crearInforme(leerId(req.params.id), req.body || {}));
}));

// Ejecutar y GUARDAR los experimentos h = 1 y h = 0.5
router.post('/comparaciones', asincrono(async (req, res) => {
  res.status(201).json(await servicio.crearComparacion(req.body || {}));
}));

router.get('/comparaciones/:id', asincrono(async (req, res) => {
  res.json(await servicio.obtenerComparacion(leerId(req.params.id)));
}));

router.delete('/comparaciones/:id', asincrono(async (req, res) => {
  await servicio.eliminarComparacion(leerId(req.params.id));
  res.status(204).end();
}));

module.exports = router;
