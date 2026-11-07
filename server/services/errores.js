/**
 * Error con código HTTP, para responder mensajes claros al frontend
 * (400 = datos inválidos, 404 = no existe, etc.).
 */
'use strict';

class ErrorHttp extends Error {
  constructor(estado, mensaje, detalles) {
    super(mensaje);
    this.estado = estado;
    this.detalles = detalles;
  }
}

/** Convierte el parámetro :id de la URL en un entero positivo, o lanza 400. */
function leerId(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw new ErrorHttp(400, 'Identificador no válido.');
  return id;
}

module.exports = { ErrorHttp, leerId };
