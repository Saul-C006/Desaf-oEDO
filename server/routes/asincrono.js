/**
 * Express 4 no captura errores de funciones async por sí solo.
 * Este envoltorio los pasa al manejador de errores central (app.js).
 */
'use strict';
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
