/**
 * TECHFIX - Formato de números y fechas para la interfaz.
 * Se usa punto decimal, igual que en las fórmulas y el informe PDF.
 */
(function () {
  'use strict';

  /** Valor con decimales fijos (clientes, tiempos). */
  function valor(x, decimales) {
    if (x === null || x === undefined || Number.isNaN(x)) return '—';
    return Number(x).toFixed(decimales === undefined ? 6 : decimales);
  }

  /** Error absoluto: notación científica si es muy pequeño (ej. 7.681e-4). */
  function error(x) {
    if (x === null || x === undefined) return 'No definido';
    if (x === 0) return '0';
    return Math.abs(x) < 1e-3 ? Number(x).toExponential(3) : Number(x).toFixed(6);
  }

  /** Error relativo porcentual: null -> "No definido" (exacto = 0). */
  function relativo(x) {
    if (x === null || x === undefined) return 'No definido';
    if (x === 0) return '0';
    return Math.abs(x) < 1e-3 ? Number(x).toExponential(3) : Number(x).toFixed(4);
  }

  /** Número sin ceros sobrantes: 10 -> "10", 0.30 -> "0.3". */
  function cifra(x, maxDecimales) {
    return String(Number(Number(x).toFixed(maxDecimales === undefined ? 6 : maxDecimales)));
  }

  /** Fecha y hora local del navegador (las fechas llegan en UTC desde el servidor). */
  function fecha(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('es', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  /** "1 mes" / "0.5 meses". */
  function meses(x) {
    return cifra(x, 4) + (Number(x) === 1 ? ' mes' : ' meses');
  }

  /** Escapa texto para insertarlo como HTML (evita inyección de código). */
  function html(texto) {
    return String(texto === null || texto === undefined ? '' : texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  window.Formato = { valor, error, relativo, cifra, fecha, meses, html };
})();
