/**
 * TECHFIX - Cliente de la API.
 * Todas las peticiones al backend pasan por aquí. El navegador nunca
 * se conecta a MySQL: solo envía y recibe JSON del servidor Express.
 */
(function () {
  'use strict';

  /** Error con el detalle por campo que devuelve el servidor (400). */
  class ErrorApi extends Error {
    constructor(mensaje, estado, detalles) {
      super(mensaje);
      this.estado = estado;
      this.detalles = detalles || null;
    }
  }

  async function peticion(metodo, ruta, cuerpo) {
    let res;
    try {
      res = await fetch('/api' + ruta, {
        method: metodo,
        headers: cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {},
        body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      });
    } catch (e) {
      throw new ErrorApi('No se pudo contactar al servidor. Revise su conexión e intente nuevamente.', 0);
    }
    if (res.status === 204) return null;
    let datos = null;
    try {
      datos = await res.json();
    } catch (e) {
      datos = null;
    }
    if (!res.ok) {
      throw new ErrorApi((datos && datos.error) || 'Error del servidor (' + res.status + ').', res.status, datos && datos.detalles);
    }
    return datos;
  }

  window.Api = {
    ErrorApi,
    salud: () => peticion('GET', '/salud'),
    crearSimulacion: (datos) => peticion('POST', '/simulaciones', datos),
    listarSimulaciones: () => peticion('GET', '/simulaciones'),
    obtenerSimulacion: (id) => peticion('GET', '/simulaciones/' + id),
    eliminarSimulacion: (id) => peticion('DELETE', '/simulaciones/' + id),
    crearComparacion: (datos) => peticion('POST', '/comparaciones', datos),
    obtenerComparacion: (id) => peticion('GET', '/comparaciones/' + id),
    crearInforme: (idSimulacion) => peticion('POST', '/simulaciones/' + idSimulacion + '/informes', {}),
    listarInformes: () => peticion('GET', '/informes'),
    eliminarInforme: (id) => peticion('DELETE', '/informes/' + id),
    urlPdf: (id, ver) => '/api/informes/' + id + '/pdf' + (ver ? '?ver=1' : ''),
  };
})();
