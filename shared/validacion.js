/**
 * TECHFIX - Validación de entradas (compartida)
 * ------------------------------------------------------------
 * El MISMO archivo se usa en:
 *   - el backend  (require('../shared/validacion'))
 *   - el navegador (<script src="/shared/validacion.js">  -> window.TechfixValidacion)
 * Así las reglas son idénticas en los dos lados. El backend SIEMPRE vuelve
 * a validar, porque los datos del navegador se pueden manipular.
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.TechfixValidacion = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_PASOS = 1000;
  var MAX_VALOR = 1e9; // evita valores absurdos (p. ej. 1e300)

  /** Definición de los campos numéricos con su nombre y unidad. */
  var CAMPOS = {
    C0: { etiqueta: 'Cantidad inicial de clientes (C0)', unidad: 'clientes' },
    M: { etiqueta: 'Mercado potencial (M)', unidad: 'clientes' },
    k: { etiqueta: 'Tasa de crecimiento (k)', unidad: '1/mes' },
    t0: { etiqueta: 'Tiempo inicial (t0)', unidad: 'meses' },
    tf: { etiqueta: 'Tiempo final (tf)', unidad: 'meses' },
    h: { etiqueta: 'Tamaño de paso (h)', unidad: 'meses' },
  };

  /** Valores predeterminados del proyecto (hipotéticos). */
  var PREDETERMINADOS = { C0: 10, M: 100, k: 0.3, t0: 0, tf: 12, h: 1 };

  /**
   * Convierte un valor a número de forma estricta.
   * Acepta números y textos numéricos ("0.3", "0,3"). Rechaza vacío, "abc", "12abc", Infinity.
   * Devuelve null si no es válido.
   */
  function aNumero(valor) {
    if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
    if (typeof valor !== 'string') return null;
    var texto = valor.trim().replace(',', '.');
    if (texto === '') return null;
    if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(texto)) return null;
    var n = Number(texto);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Valida los parámetros de una simulación.
   * @param {object} datos  objeto con C0, M, k, t0, tf, h (números o textos)
   * @param {{omitirH?: boolean}} opciones  omitirH: para comparaciones (h lo fija el sistema)
   * @returns {{valido: boolean, errores: Object<string,string>, valores: object}}
   */
  function validarParametros(datos, opciones) {
    datos = datos || {};
    opciones = opciones || {};
    var errores = {};
    var v = {};
    var nombres = Object.keys(CAMPOS).filter(function (c) {
      return !(opciones.omitirH && c === 'h');
    });

    nombres.forEach(function (campo) {
      var bruto = datos[campo];
      if (bruto === undefined || bruto === null || String(bruto).trim() === '') {
        errores[campo] = 'Este campo es obligatorio.';
        return;
      }
      var n = aNumero(bruto);
      if (n === null) {
        errores[campo] = 'Debe ser un número válido.';
        return;
      }
      if (Math.abs(n) > MAX_VALOR) {
        errores[campo] = 'El valor es demasiado grande.';
        return;
      }
      v[campo] = n;
    });

    if (!('C0' in errores) && v.C0 < 0) errores.C0 = 'C0 debe ser mayor o igual a cero.';
    if (!('M' in errores) && !('C0' in errores) && !(v.M > v.C0)) errores.M = 'M debe ser mayor que C0.';
    if (!('k' in errores) && !(v.k > 0)) errores.k = 'k debe ser mayor que cero.';
    if (!opciones.omitirH && !('h' in errores) && !(v.h > 0)) errores.h = 'h debe ser mayor que cero.';
    if (!('t0' in errores) && !('tf' in errores) && !(v.tf > v.t0)) {
      errores.tf = 'El tiempo final debe ser mayor que el tiempo inicial.';
    }

    // Límite de pasos (igual que en el módulo numérico).
    if (!opciones.omitirH && Object.keys(errores).length === 0) {
      var pasos = Math.ceil((v.tf - v.t0) / v.h - 1e-9);
      if (pasos > MAX_PASOS) {
        errores.h = 'Con este h se generan ' + pasos + ' pasos; el máximo es ' + MAX_PASOS + '. Use un h mayor.';
      }
    }

    return { valido: Object.keys(errores).length === 0, errores: errores, valores: v };
  }

  /** Valida un texto opcional u obligatorio con longitud máxima. */
  function validarTexto(valor, maximo, obligatorio) {
    var texto = valor === undefined || valor === null ? '' : String(valor).trim();
    if (obligatorio && texto === '') return { valido: false, error: 'Este campo es obligatorio.', valor: '' };
    if (texto.length > maximo) return { valido: false, error: 'Máximo ' + maximo + ' caracteres.', valor: texto };
    return { valido: true, error: null, valor: texto };
  }

  return {
    MAX_PASOS: MAX_PASOS,
    CAMPOS: CAMPOS,
    PREDETERMINADOS: PREDETERMINADOS,
    aNumero: aNumero,
    validarParametros: validarParametros,
    validarTexto: validarTexto,
  };
});
