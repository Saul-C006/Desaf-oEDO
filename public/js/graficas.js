/**
 * TECHFIX - Gráficas con Chart.js
 *  1) Solución analítica vs Heun vs RK4 (misma gráfica)
 *  2) Errores absolutos de Heun y RK4
 *  3) Comparación de errores con h = 1 y h = 0.5
 */
(function () {
  'use strict';
  const F = window.Formato;

  const COLOR = {
    analitica: '#1f2933',
    heun: '#e07b00',
    rk4: '#0091b3',
    mercado: '#9aa5b1',
    heunClaro: '#f4b860',
    rk4Claro: '#66c6dc',
  };

  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.color = '#5f6b7a';

  /**
   * Modo de interacción propio: al pasar el mouse busca el TIEMPO (nodo) más
   * cercano y muestra a la vez Heun y RK4 en ese tiempo. Así la información
   * emergente compara los métodos en el mismo instante.
   */
  Chart.Interaction.modes.nodoTechfix = function (chart, e) {
    const pos = Chart.helpers.getRelativePosition(e, chart);
    const nodos = nodosPorGrafica[chart.canvas.id] || [];
    let mejor = null;
    nodos.forEach((di) => {
      const meta = chart.getDatasetMeta(di);
      if (meta.hidden) return;
      meta.data.forEach((el, i) => {
        const d = Math.abs(el.x - pos.x);
        if (!mejor || d < mejor.d) mejor = { d, i };
      });
    });
    if (!mejor) return [];
    return nodos
      .filter((di) => !chart.getDatasetMeta(di).hidden)
      .map((di) => ({ element: chart.getDatasetMeta(di).data[mejor.i], datasetIndex: di, index: mejor.i }));
  };

  /** En escala logarítmica solo se rotulan las potencias de 10 (1e-1, 1e-2, ...). */
  function etiquetaLog(v) {
    const e = Math.log10(v);
    return Math.abs(e - Math.round(e)) < 1e-9 ? Number(v).toExponential(0) : '';
  }

  /** Leyenda en el orden de los datos: analítica, Heun, RK4. */
  const leyenda = { position: 'bottom', labels: { usePointStyle: true, padding: 16, sort: (a, b) => a.datasetIndex - b.datasetIndex } };

  const graficas = {};
  /** Índices de los datasets que tienen valores en los nodos t0, t0+h, ... (por gráfica). */
  const nodosPorGrafica = {};
  function destruir(id) {
    if (graficas[id]) {
      graficas[id].destroy();
      delete graficas[id];
    }
  }

  function ejeX(sim) {
    return {
      type: 'linear',
      min: sim.parametros.t0,
      max: sim.parametros.tf,
      title: { display: true, text: 'Tiempo (meses)', font: { weight: '600' } },
      grid: { color: '#e9eef4' },
    };
  }

  /** 1) Las tres soluciones en una misma gráfica. */
  function soluciones(canvas, sim) {
    destruir(canvas.id);
    const p = sim.parametros;
    const filas = sim.filas;
    const conMarcas = filas.length <= 60;
    nodosPorGrafica[canvas.id] = [1, 2];
    graficas[canvas.id] = new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Solución analítica (exacta)',
            data: sim.curvaAnalitica.map((q) => ({ x: q.t, y: q.C })),
            borderColor: COLOR.analitica, backgroundColor: COLOR.analitica,
            borderWidth: 2.5, pointRadius: 0, order: 3,
          },
          {
            label: 'Heun (RK2), h = ' + F.cifra(p.h),
            data: filas.map((r) => ({ x: r.tiempo, y: r.heun })),
            borderColor: COLOR.heun, backgroundColor: COLOR.heun,
            borderWidth: 2, borderDash: [7, 4], pointRadius: conMarcas ? 4 : 0, pointHoverRadius: 6, order: 1,
          },
          {
            label: 'RK4, h = ' + F.cifra(p.h),
            data: filas.map((r) => ({ x: r.tiempo, y: r.rk4 })),
            borderColor: COLOR.rk4, backgroundColor: COLOR.rk4,
            borderWidth: 2, borderDash: [2, 3], pointStyle: 'rectRot', pointRadius: conMarcas ? 4.5 : 0, pointHoverRadius: 7, order: 2,
          },
          {
            label: 'Mercado potencial M = ' + F.cifra(p.M),
            data: [{ x: p.t0, y: p.M }, { x: p.tf, y: p.M }],
            borderColor: COLOR.mercado, borderWidth: 1.5, borderDash: [4, 4], pointRadius: 0, order: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nodoTechfix', intersect: false },
        plugins: {
          title: { display: true, text: 'Crecimiento estimado de clientes: Analítica vs Heun vs RK4', font: { size: 15, weight: '600' }, color: '#1f2933' },
          legend: leyenda,
          tooltip: {
            callbacks: {
              title: (items) => 't = ' + F.cifra(filas[items[0].dataIndex].tiempo, 6) + ' meses  (n = ' + filas[items[0].dataIndex].iteracion + ')',
              beforeBody: (items) => 'Analítica: ' + F.valor(filas[items[0].dataIndex].analitico) + ' clientes',
              label: (item) => {
                const r = filas[item.dataIndex];
                return item.datasetIndex === 1
                  ? 'Heun: ' + F.valor(r.heun) + '  (Ea = ' + F.error(r.errorAbsHeun) + ')'
                  : 'RK4:  ' + F.valor(r.rk4) + '  (Ea = ' + F.error(r.errorAbsRK4) + ')';
              },
            },
          },
        },
        scales: {
          x: ejeX(sim),
          y: { title: { display: true, text: 'Cantidad estimada de clientes', font: { weight: '600' } }, grid: { color: '#e9eef4' } },
        },
      },
    });
  }

  /** En escala logarítmica, el 0 no existe: se deja un hueco (null). */
  const paraLog = (v, log) => (log && v <= 0 ? null : v);

  /** 2) Errores absolutos de Heun y RK4. */
  function errores(canvas, sim, escala) {
    destruir(canvas.id);
    const filas = sim.filas;
    const log = escala === 'logarithmic';
    const conMarcas = filas.length <= 60;
    nodosPorGrafica[canvas.id] = [0, 1];
    graficas[canvas.id] = new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Error absoluto de Heun',
            data: filas.map((r) => ({ x: r.tiempo, y: paraLog(r.errorAbsHeun, log) })),
            borderColor: COLOR.heun, backgroundColor: COLOR.heun, borderWidth: 2, pointRadius: conMarcas ? 3.5 : 0, spanGaps: false,
          },
          {
            label: 'Error absoluto de RK4',
            data: filas.map((r) => ({ x: r.tiempo, y: paraLog(r.errorAbsRK4, log) })),
            borderColor: COLOR.rk4, backgroundColor: COLOR.rk4, borderWidth: 2, pointStyle: 'rectRot', pointRadius: conMarcas ? 4 : 0, spanGaps: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nodoTechfix', intersect: false },
        plugins: {
          title: { display: true, text: 'Comparación de errores absolutos: Heun vs RK4', font: { size: 15, weight: '600' }, color: '#1f2933' },
          legend: leyenda,
          tooltip: {
            callbacks: {
              title: (items) => 't = ' + F.cifra(filas[items[0].dataIndex].tiempo, 6) + ' meses',
              label: (item) => {
                const r = filas[item.dataIndex];
                return item.datasetIndex === 0
                  ? 'Heun: Ea = ' + F.error(r.errorAbsHeun) + ' · Er = ' + F.relativo(r.errorRelHeun) + ' %'
                  : 'RK4:  Ea = ' + F.error(r.errorAbsRK4) + ' · Er = ' + F.relativo(r.errorRelRK4) + ' %';
              },
            },
          },
        },
        scales: {
          x: ejeX(sim),
          y: {
            type: escala,
            title: { display: true, text: 'Error absoluto (clientes)' + (log ? ' · escala logarítmica' : ''), font: { weight: '600' } },
            grid: { color: '#e9eef4' },
            ticks: { callback: (v) => (log ? etiquetaLog(v) : v) },
          },
        },
      },
    });
  }

  /** 3) Errores de ambos métodos con h = 1 y h = 0.5. */
  function comparacion(canvas, comp) {
    destruir(canvas.id);
    const [e1, e2] = comp.experimentos;
    const serie = (e, metodo, color, guion, estilo) => ({
      label: (metodo === 'heun' ? 'Heun' : 'RK4') + ', h = ' + F.cifra(e.h),
      data: e.filas.map((r) => ({ x: r.tiempo, y: paraLog(metodo === 'heun' ? r.errorAbsHeun : r.errorAbsRK4, true) })),
      borderColor: color, backgroundColor: color, borderWidth: 2, borderDash: guion, pointRadius: 3, pointStyle: estilo,
    });
    graficas[canvas.id] = new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [
          serie(e1, 'heun', COLOR.heun, [], 'circle'),
          serie(e2, 'heun', COLOR.heunClaro, [6, 4], 'circle'),
          serie(e1, 'rk4', COLOR.rk4, [], 'rectRot'),
          serie(e2, 'rk4', COLOR.rk4Claro, [6, 4], 'rectRot'),
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          title: { display: true, text: 'Error absoluto con h = 1 y h = 0.5 (escala logarítmica)', font: { size: 15, weight: '600' }, color: '#1f2933' },
          legend: leyenda,
          tooltip: {
            callbacks: {
              title: (items) => 't = ' + F.cifra(items[0].parsed.x, 6) + ' meses',
              label: (item) => item.dataset.label + ': Ea = ' + F.error(item.parsed.y),
            },
          },
        },
        scales: {
          x: { type: 'linear', title: { display: true, text: 'Tiempo (meses)', font: { weight: '600' } }, grid: { color: '#e9eef4' } },
          y: {
            type: 'logarithmic',
            title: { display: true, text: 'Error absoluto (clientes)', font: { weight: '600' } },
            grid: { color: '#e9eef4' },
            ticks: { callback: etiquetaLog },
          },
        },
      },
    });
  }

  window.Graficas = { soluciones, errores, comparacion, destruir };
})();
