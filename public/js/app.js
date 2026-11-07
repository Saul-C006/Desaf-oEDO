/**
 * TECHFIX - Lógica de la interfaz
 * ------------------------------------------------------------
 * - Navegación entre secciones (con el "#" de la URL).
 * - Formulario con validación (mismas reglas que el servidor).
 * - Muestra resultados, gráficas, comparación, interpretación,
 *   historial e informes. Todos los datos vienen del backend (MySQL):
 *   aquí NO se calcula ningún método numérico.
 */
(function () {
  'use strict';
  const F = window.Formato;
  const V = window.TechfixValidacion;
  const $ = (sel, raiz) => (raiz || document).querySelector(sel);
  const $$ = (sel, raiz) => Array.from((raiz || document).querySelectorAll(sel));

  const SECCIONES = ['inicio', 'modelo', 'configuracion', 'simulacion', 'graficas', 'comparacion', 'interpretacion', 'historial', 'informes'];
  const CAMPOS = ['C0', 'M', 'k', 't0', 'tf', 'h'];

  const estado = {
    sim: null,              // simulación actual (respuesta de la API)
    comp: null,             // comparación actual
    escalaErrores: 'logarithmic',
    graficasPendientes: true,
    compPendiente: true,
  };

  // Recordar qué simulación estaba abierta (solo el número; los datos están en MySQL).
  const memoria = {
    leer(clave) { try { return localStorage.getItem('techfix.' + clave); } catch (e) { return null; } },
    guardar(clave, valor) { try { valor === null ? localStorage.removeItem('techfix.' + clave) : localStorage.setItem('techfix.' + clave, valor); } catch (e) { /* sin almacenamiento */ } },
  };

  // ------------------------------------------------------------------ Íconos
  const ICONOS = {
    inicio: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    modelo: '<path d="M5 5h14M5 19h14M8 5l6 7-6 7"/>',
    configuracion: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    simulacion: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16M15 4v16"/>',
    graficas: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M6 16c3-6 6-8 13-10"/>',
    comparacion: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
    interpretacion: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
    historial: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    informes: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
  };
  $$('[data-ico]').forEach((el) => {
    el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONOS[el.dataset.ico] + '</svg>';
  });

  // ------------------------------------------------------------------ Utilidades de interfaz
  function toast(mensaje, tipo) {
    const el = document.createElement('div');
    el.className = 'toast ' + (tipo || '');
    el.textContent = mensaje;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), tipo === 'error' ? 6000 : 4000);
    // Como máximo 3 avisos visibles a la vez
    const todos = $$('.toast');
    if (todos.length > 3) todos[0].remove();
  }

  let contadorCarga = 0;
  function cargando(activo, texto) {
    contadorCarga += activo ? 1 : -1;
    $('#cargandoTexto').textContent = texto || 'Procesando…';
    $('#cargando').hidden = contadorCarga <= 0;
  }

  /** Ejecuta una acción con pantalla de carga y muestra los errores de la API. */
  async function conCarga(texto, accion) {
    cargando(true, texto);
    try {
      return await accion();
    } catch (e) {
      toast(e.message || 'Ocurrió un error.', 'error');
      throw e;
    } finally {
      cargando(false);
    }
  }

  /** Confirmación antes de eliminar (diálogo propio, accesible). */
  function confirmar(titulo, texto) {
    const dialogo = $('#dialogo');
    $('#dialogoTitulo').textContent = titulo;
    $('#dialogoTexto').textContent = texto;
    return new Promise((resolver) => {
      dialogo.addEventListener('close', function alCerrar() {
        dialogo.removeEventListener('close', alCerrar);
        resolver(dialogo.returnValue === 'aceptar');
      });
      dialogo.returnValue = '';
      dialogo.showModal();
    });
  }

  // ------------------------------------------------------------------ Navegación
  function mostrarSeccion(id) {
    if (!SECCIONES.includes(id)) id = 'inicio';
    SECCIONES.forEach((s) => { $('#' + s).hidden = s !== id; });
    $$('.menu a').forEach((a) => a.classList.toggle('activo', a.dataset.seccion === id));
    cerrarMenu();
    window.scrollTo({ top: 0 });

    if (id === 'graficas') dibujarGraficas();
    if (id === 'comparacion') dibujarComparacion();
    if (id === 'historial') cargarHistorial();
    if (id === 'informes') cargarInformes();
  }
  window.addEventListener('hashchange', () => mostrarSeccion(location.hash.slice(1)));

  function ir(id) {
    if (location.hash === '#' + id) mostrarSeccion(id);
    else location.hash = id;
  }

  // Menú en celulares
  function cerrarMenu() {
    $('#sidebar').classList.remove('abierta');
    $('#velo').hidden = true;
    $('#btnMenu').setAttribute('aria-expanded', 'false');
  }
  $('#btnMenu').addEventListener('click', () => {
    const abierto = $('#sidebar').classList.toggle('abierta');
    $('#velo').hidden = !abierto;
    $('#btnMenu').setAttribute('aria-expanded', String(abierto));
  });
  $('#velo').addEventListener('click', cerrarMenu);

  // ------------------------------------------------------------------ Estado del servidor
  async function comprobarServidor(intento) {
    const caja = $('#estadoServidor');
    try {
      await Api.salud();
      caja.className = 'estado-servidor ok';
      $('.texto', caja).textContent = 'Servidor y base de datos conectados';
    } catch (e) {
      caja.className = 'estado-servidor error';
      $('.texto', caja).textContent = intento < 3 ? 'Esperando al servidor…' : 'Sin conexión con la base de datos';
      // Un hosting gratuito puede tardar en "despertar": se reintenta unas pocas veces.
      if (intento < 3) setTimeout(() => comprobarServidor(intento + 1), 5000);
    }
  }

  // ------------------------------------------------------------------ Formulario
  const form = $('#formSimulacion');

  function llenarFormulario(valores) {
    CAMPOS.forEach((c) => { form.elements[c].value = valores[c]; });
    limpiarErrores();
    vistaPasos();
  }

  function leerFormulario() {
    const datos = {};
    CAMPOS.concat(['nombre_desafio', 'descripcion', 'observaciones']).forEach((c) => { datos[c] = form.elements[c].value; });
    return datos;
  }

  function limpiarErrores() {
    $$('.campo', form).forEach((c) => c.classList.remove('invalido'));
    $$('[data-error]', form).forEach((e) => { e.textContent = ''; });
  }

  function mostrarErrores(errores) {
    limpiarErrores();
    Object.keys(errores || {}).forEach((campo) => {
      const el = $('[data-error="' + campo + '"]', form);
      if (!el) return;
      el.textContent = errores[campo];
      el.closest('.campo').classList.add('invalido');
    });
    const primero = Object.keys(errores || {})[0];
    if (primero && form.elements[primero]) form.elements[primero].focus();
  }

  /** Muestra cuántos pasos se calcularán y si k·h es grande (ayuda al usuario). */
  function vistaPasos() {
    const v = V.validarParametros(leerFormulario());
    const caja = $('#vistaPasos');
    if (!v.valido) { caja.textContent = ''; return; }
    const p = v.valores;
    const pasos = Math.ceil((p.tf - p.t0) / p.h - 1e-9);
    const kh = p.k * p.h;
    caja.innerHTML = 'Se calcularán <b>' + pasos + ' pasos</b> (' + (pasos + 1) + ' filas) entre t = ' + F.cifra(p.t0) +
      ' y t = ' + F.cifra(p.tf) + ' meses · k·h = <b>' + F.cifra(kh, 4) + '</b>' +
      (kh > 2 ? ' · <span class="error">Heun será inestable con este h</span>' : kh > 1 ? ' · se perderá precisión' : '');
  }

  form.addEventListener('input', (e) => {
    const campo = e.target.name;
    if (CAMPOS.includes(campo)) {
      // Validación en vivo del campo editado
      const v = V.validarParametros(leerFormulario());
      const el = $('[data-error="' + campo + '"]', form);
      if (el) {
        el.textContent = v.errores[campo] || '';
        el.closest('.campo').classList.toggle('invalido', Boolean(v.errores[campo]));
      }
      vistaPasos();
    }
  });

  $$('[data-h]').forEach((b) => b.addEventListener('click', () => {
    form.elements.h.value = b.dataset.h;
    form.elements.h.dispatchEvent(new Event('input', { bubbles: true }));
  }));

  $('#btnRestaurar').addEventListener('click', () => {
    llenarFormulario(V.PREDETERMINADOS);
    toast('Se restauraron los valores del proyecto: C0 = 10, M = 100, k = 0.3, t0 = 0, tf = 12, h = 1.');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = leerFormulario();
    const v = V.validarParametros(datos);
    if (!v.valido) {
      mostrarErrores(v.errores);
      toast('Revise los campos marcados en rojo.', 'error');
      return;
    }
    const boton = $('#btnEjecutar');
    boton.disabled = true;
    try {
      const sim = await conCarga('Calculando Analítica, Heun y RK4…', () => Api.crearSimulacion(datos));
      establecerSimulacion(sim);
      toast('Simulación N.º ' + sim.id + ' calculada y guardada en MySQL.', 'exito');
      ir('simulacion');
    } catch (err) {
      if (err.detalles) mostrarErrores(err.detalles);
    } finally {
      boton.disabled = false;
    }
  });

  async function ejecutarComparacion() {
    const datos = leerFormulario();
    const v = V.validarParametros(datos, { omitirH: true });
    if (!v.valido) {
      ir('configuracion');
      mostrarErrores(v.errores);
      toast('Revise los parámetros del formulario antes de comparar.', 'error');
      return;
    }
    try {
      const comp = await conCarga('Ejecutando los experimentos h = 1 y h = 0.5…', () => Api.crearComparacion(datos));
      await establecerComparacion(comp);
      toast('Comparación guardada: experimentos N.º ' + comp.experimentos.map((x) => x.idSimulacion).join(' y ') + '.', 'exito');
      ir('comparacion');
    } catch (err) {
      if (err.detalles) { ir('configuracion'); mostrarErrores(err.detalles); }
    }
  }
  $('#btnComparar').addEventListener('click', ejecutarComparacion);

  // ------------------------------------------------------------------ Simulación actual
  function establecerSimulacion(sim) {
    estado.sim = sim;
    estado.graficasPendientes = true;
    memoria.guardar('simulacion', sim ? String(sim.id) : null);
    renderSimulacion();
  }

  function chipsParametros(p, conH) {
    const chips = [
      ['C₀', F.cifra(p.C0) + ' clientes'],
      ['M', F.cifra(p.M) + ' clientes'],
      ['k', F.cifra(p.k) + ' /mes'],
      ['t₀', F.cifra(p.t0) + ' meses'],
      ['t<sub>f</sub>', F.cifra(p.tf) + ' meses'],
    ];
    if (conH) chips.push(['h', F.meses(p.h)]);
    return chips.map((c) => '<span>' + c[0] + ' = <b>' + F.html(c[1]) + '</b></span>').join('');
  }

  function tarjetasResumen(sim) {
    const r = sim.resumen;
    const ganador = r.metodoMasPreciso;
    const veces = r.errorAbsMaxRK4 > 0 ? r.errorAbsMaxHeun / r.errorAbsMaxRK4 : null;
    return (
      '<div class="stat"><div class="titulo">Valor exacto en t = ' + F.cifra(r.tiempoFinal) + '</div>' +
        '<div class="valor">' + F.valor(r.analiticoFinal, 4) + '</div><p class="detalle">clientes (solución analítica)</p></div>' +
      '<div class="stat heun"><div class="titulo">Heun (RK2)</div>' +
        '<div class="valor">' + F.valor(r.heunFinal, 4) + '</div><p class="detalle">Ea final: ' + F.error(r.errorAbsFinalHeun) + ' · máx.: ' + F.error(r.errorAbsMaxHeun) + '</p></div>' +
      '<div class="stat rk4"><div class="titulo">Runge-Kutta 4</div>' +
        '<div class="valor">' + F.valor(r.rk4Final, 4) + '</div><p class="detalle">Ea final: ' + F.error(r.errorAbsFinalRK4) + ' · máx.: ' + F.error(r.errorAbsMaxRK4) + '</p></div>' +
      '<div class="stat ganador"><div class="titulo">Menor error</div>' +
        '<div class="valor">' + F.html(ganador) + '</div><p class="detalle">' +
        (ganador === 'RK4' && veces ? 'Error máximo ≈ ' + F.cifra(veces, 0) + ' veces menor que Heun' : 'Comparando el error absoluto máximo') +
        '</p></div>'
    );
  }

  function filaTabla(r) {
    const rel = (x) => (x === null ? '<span class="no-definido">No definido</span>' : F.relativo(x));
    return '<tr><td>' + r.iteracion + '</td><td>' + F.valor(r.tiempo, 4) + '</td><td>' + F.valor(r.analitico) + '</td>' +
      '<td>' + F.valor(r.heun) + '</td><td>' + F.error(r.errorAbsHeun) + '</td><td>' + rel(r.errorRelHeun) + '</td>' +
      '<td>' + F.valor(r.rk4) + '</td><td>' + F.error(r.errorAbsRK4) + '</td><td>' + rel(r.errorRelRK4) + '</td></tr>';
  }

  function renderSimulacion() {
    const sim = estado.sim;
    $$('[data-sin-sim]').forEach((el) => { el.hidden = Boolean(sim); });
    $$('[data-con-sim]').forEach((el) => { el.hidden = !sim; });
    if (!sim) {
      $$('[data-sim="titulo"]').forEach((el) => { el.textContent = ''; });
      return;
    }
    const titulo = 'Simulación N.º ' + sim.id + ' · ' + sim.nombre + ' · ' + F.fecha(sim.fechaCreacion);
    $$('[data-sim="titulo"]').forEach((el) => { el.textContent = titulo; });
    $$('[data-sim="parametros"]').forEach((el) => { el.innerHTML = chipsParametros(sim.parametros, true); });
    $$('[data-sim="avisos"]').forEach((el) => {
      el.innerHTML = sim.avisos.map((a) => '<div class="aviso">⚠ ' + F.html(a) + '</div>').join('');
    });
    $$('[data-sim="tarjetas"]').forEach((el) => { el.innerHTML = tarjetasResumen(sim); });
    $('#tablaResultados tbody').innerHTML = sim.filas.map(filaTabla).join('');

    // Interpretación (textos generados por el servidor con los valores reales)
    const it = sim.interpretacion;
    $('[data-int="crecimiento"]').textContent = it.crecimiento;
    $('[data-int="hitos"]').innerHTML = it.hitos.map((h) => '<li>' + F.html(h) + '</li>').join('');
    $('[data-int="metodo"]').textContent = it.metodo;
    $('[data-int="paso"]').textContent = it.paso;
    $('[data-int="conclusion"]').textContent = it.conclusion;
    $('[data-int="limitaciones"]').innerHTML = it.limitaciones.map((l) => '<li>' + F.html(l) + '</li>').join('');

    if (!$('#graficas').hidden) dibujarGraficas();
  }

  function dibujarGraficas() {
    if (!estado.sim || !estado.graficasPendientes) return;
    estado.graficasPendientes = false;
    Graficas.soluciones($('#graficaSoluciones'), estado.sim);
    Graficas.errores($('#graficaErrores'), estado.sim, estado.escalaErrores);
  }

  $$('[data-escala]').forEach((b) => b.addEventListener('click', () => {
    estado.escalaErrores = b.dataset.escala;
    $$('[data-escala]').forEach((x) => x.classList.toggle('activo', x === b));
    if (estado.sim) Graficas.errores($('#graficaErrores'), estado.sim, estado.escalaErrores);
  }));

  async function abrirSimulacion(id, destino) {
    try {
      const sim = await conCarga('Cargando la simulación desde MySQL…', () => Api.obtenerSimulacion(id));
      establecerSimulacion(sim);
      llenarFormulario(sim.parametros);
      ir(destino || 'simulacion');
    } catch (e) { /* el error ya se mostró */ }
  }

  // ------------------------------------------------------------------ Comparación
  async function establecerComparacion(comp) {
    estado.comp = comp;
    estado.compPendiente = true;
    memoria.guardar('comparacion', comp ? String(comp.id) : null);
    if (comp) {
      // La conclusión sobre el paso la redacta el servidor (interpretación del experimento 1).
      try {
        const sim1 = await Api.obtenerSimulacion(comp.experimentos[0].idSimulacion);
        comp.conclusionPaso = sim1.interpretacion.paso;
      } catch (e) {
        comp.conclusionPaso = '';
      }
    }
    renderComparacion();
  }

  function renderComparacion() {
    const comp = estado.comp;
    const valida = comp && comp.experimentos.length >= 2;
    $('[data-sin-comp]').hidden = Boolean(valida);
    $('[data-con-comp]').hidden = !valida;
    if (!valida) return;
    const [e1, e2] = comp.experimentos;
    const red = comp.reducciones[0];

    $('[data-comp="parametros"]').innerHTML = '<span>Comparación N.º <b>' + comp.id + '</b></span>' + chipsParametros(e1.parametros, false);
    $('[data-comp="factores"]').innerHTML =
      '<div class="stat heun"><div class="titulo">Heun: reducción del error final</div><div class="valor">÷ ' + F.cifra(red.factorHeun, 2) +
      '</div><p class="detalle">De ' + F.error(e1.resumen.errorAbsFinalHeun) + ' (h = 1) a ' + F.error(e2.resumen.errorAbsFinalHeun) +
      ' (h = 0.5). Teoría (orden 2): ≈ 4</p></div>' +
      '<div class="stat rk4"><div class="titulo">RK4: reducción del error final</div><div class="valor">÷ ' + F.cifra(red.factorRK4, 2) +
      '</div><p class="detalle">De ' + F.error(e1.resumen.errorAbsFinalRK4) + ' (h = 1) a ' + F.error(e2.resumen.errorAbsFinalRK4) +
      ' (h = 0.5). Teoría (orden 4): ≈ 16</p></div>';

    $('#tablaResumenComp tbody').innerHTML = comp.experimentos.map((e, i) =>
      '<tr><td class="texto">Experimento ' + (i + 1) + ' <span class="sub">Simulación N.º ' + e.idSimulacion + '</span></td><td>' + F.cifra(e.h) + '</td><td>' + e.resumen.pasos + '</td>' +
      '<td>' + F.valor(e.resumen.heunFinal) + '</td><td>' + F.error(e.resumen.errorAbsFinalHeun) + '</td><td>' + F.error(e.resumen.errorAbsMaxHeun) + '</td>' +
      '<td>' + F.valor(e.resumen.rk4Final) + '</td><td>' + F.error(e.resumen.errorAbsFinalRK4) + '</td><td>' + F.error(e.resumen.errorAbsMaxRK4) + '</td></tr>'
    ).join('');

    // Tiempos comunes: los de h = 1 también existen en h = 0.5.
    const clave = (t) => Number(t).toFixed(9);
    const porTiempo = new Map(e2.filas.map((r) => [clave(r.tiempo), r]));
    $('#tablaComp tbody').innerHTML = e1.filas.filter((r) => porTiempo.has(clave(r.tiempo))).map((a) => {
      const b = porTiempo.get(clave(a.tiempo));
      return '<tr><td>' + F.valor(a.tiempo, 2) + '</td><td>' + F.valor(a.analitico) + '</td>' +
        '<td>' + F.valor(a.heun) + '</td><td>' + F.valor(b.heun) + '</td><td>' + F.error(a.errorAbsHeun) + '</td><td>' + F.error(b.errorAbsHeun) + '</td>' +
        '<td>' + F.valor(a.rk4) + '</td><td>' + F.valor(b.rk4) + '</td><td>' + F.error(a.errorAbsRK4) + '</td><td>' + F.error(b.errorAbsRK4) + '</td></tr>';
    }).join('');

    $('[data-comp="conclusion"]').textContent = comp.conclusionPaso ||
      'Al reducir h de 1 a 0.5, el error final de Heun se dividió entre ' + F.cifra(red.factorHeun, 2) + ' y el de RK4 entre ' + F.cifra(red.factorRK4, 2) + '.';

    if (!$('#comparacion').hidden) dibujarComparacion();
  }

  function dibujarComparacion() {
    if (!estado.comp || estado.comp.experimentos.length < 2 || !estado.compPendiente) return;
    estado.compPendiente = false;
    Graficas.comparacion($('#graficaComp'), estado.comp);
  }

  async function abrirComparacion(id) {
    try {
      const comp = await conCarga('Cargando la comparación…', () => Api.obtenerComparacion(id));
      await establecerComparacion(comp);
      ir('comparacion');
    } catch (e) { /* ya se mostró */ }
  }

  // ------------------------------------------------------------------ Historial
  async function cargarHistorial() {
    let lista;
    try {
      lista = await conCarga('Cargando el historial…', () => Api.listarSimulaciones());
    } catch (e) { return; }
    $('#historialVacio').hidden = lista.length > 0;
    $('#tablaHistorial tbody').innerHTML = lista.map((s) => {
      const p = s.parametros;
      return '<tr>' +
        '<td>' + s.id + '</td>' +
        '<td class="texto"><b>' + F.html(s.nombre) + '</b>' + (s.descripcion ? '<span class="sub">' + F.html(s.descripcion) + '</span>' : '') +
          (s.idComparacion ? '<button class="etiqueta-comp" data-abrir-comp="' + s.idComparacion + '" title="Abrir la comparación">Comparación N.º ' + s.idComparacion + '</button>' : '') + '</td>' +
        '<td class="izq">' + F.fecha(s.fechaCreacion) + '</td>' +
        '<td class="izq">C₀=' + F.cifra(p.C0) + ' · M=' + F.cifra(p.M) + ' · k=' + F.cifra(p.k) + '<span class="sub">t: ' + F.cifra(p.t0) + '→' + F.cifra(p.tf) + ' · h=' + F.cifra(p.h) + ' (' + s.pasos + ' pasos)</span></td>' +
        '<td class="izq">Exacto ' + F.valor(s.analiticoFinal, 4) + '<span class="sub">Heun ' + F.valor(s.heunFinal, 4) + ' · RK4 ' + F.valor(s.rk4Final, 4) + '</span></td>' +
        '<td class="izq"><span class="etiqueta-metodo' + (s.metodoMasPreciso === 'Heun' ? ' heun' : '') + '">' + F.html(s.metodoMasPreciso) + '</span></td>' +
        '<td>' + (s.numInformes > 0 ? '<a href="#informes">' + s.numInformes + '</a>' : '0') + '</td>' +
        '<td><div class="acciones-chicas">' +
          '<button class="btn btn-secundario btn-tabla" data-abrir="' + s.id + '">Abrir</button>' +
          '<button class="btn btn-secundario btn-tabla" data-informe="' + s.id + '">Informe</button>' +
          '<button class="btn btn-texto btn-tabla" data-eliminar-sim="' + s.id + '" data-nombre="' + F.html(s.nombre) + '">Eliminar</button>' +
        '</div></td></tr>';
    }).join('');
  }

  $('#tablaHistorial').addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.abrir) abrirSimulacion(Number(b.dataset.abrir));
    if (b.dataset.abrirComp) abrirComparacion(Number(b.dataset.abrirComp));
    if (b.dataset.informe) generarInforme(Number(b.dataset.informe));
    if (b.dataset.eliminarSim) {
      const id = Number(b.dataset.eliminarSim);
      const ok = await confirmar('Eliminar simulación N.º ' + id,
        '¿Seguro que desea eliminar «' + b.dataset.nombre + '»? También se eliminarán sus resultados y sus informes. Esta acción no se puede deshacer.');
      if (!ok) return;
      try {
        await conCarga('Eliminando…', () => Api.eliminarSimulacion(id));
        toast('Simulación N.º ' + id + ' eliminada.', 'exito');
        if (estado.sim && estado.sim.id === id) establecerSimulacion(null);
        if (estado.comp && estado.comp.experimentos.some((x) => x.idSimulacion === id)) await establecerComparacion(null);
        cargarHistorial();
      } catch (err) { /* ya se mostró */ }
    }
  });

  // ------------------------------------------------------------------ Informes
  async function generarInforme(idSimulacion) {
    if (!idSimulacion) return;
    try {
      const inf = await conCarga('Registrando el informe…', () => Api.crearInforme(idSimulacion));
      toast('Informe N.º ' + inf.id + ' generado. Puede verlo o descargarlo en la lista.', 'exito');
      if (estado.sim && estado.sim.id === idSimulacion) {
        estado.sim.informes.unshift({ id: inf.id, titulo: inf.titulo, fechaGeneracion: inf.fechaGeneracion, ubicacionPdf: inf.ubicacionPdf });
      }
      ir('informes');
      cargarInformes(inf.id);
    } catch (e) { /* ya se mostró */ }
  }

  async function cargarInformes(resaltar) {
    let lista;
    try {
      lista = await Api.listarInformes();
    } catch (e) {
      toast(e.message, 'error');
      return;
    }
    $('#informesVacio').hidden = lista.length > 0;
    $('#tablaInformes tbody').innerHTML = lista.map((i) =>
      '<tr' + (i.id === resaltar ? ' style="background:#e6f6fa"' : '') + '>' +
      '<td>' + i.id + '</td>' +
      '<td class="texto"><b>' + F.html(i.titulo) + '</b><span class="sub">' + F.html(i.resumen) + '</span></td>' +
      '<td class="texto">N.º ' + i.idSimulacion + ' · ' + F.html(i.nombreSimulacion) + '<span class="sub">h = ' + F.cifra(i.tamanioPaso) + '</span></td>' +
      '<td class="izq">' + F.fecha(i.fechaGeneracion) + '</td>' +
      '<td><div class="acciones-chicas">' +
        '<a class="btn btn-secundario btn-tabla" href="' + Api.urlPdf(i.id, true) + '" target="_blank" rel="noopener">Ver</a>' +
        '<a class="btn btn-primario btn-tabla" href="' + Api.urlPdf(i.id, false) + '" download>Descargar PDF</a>' +
        '<button class="btn btn-secundario btn-tabla" data-abrir="' + i.idSimulacion + '">Simulación</button>' +
        '<button class="btn btn-texto btn-tabla" data-eliminar-inf="' + i.id + '">Eliminar</button>' +
      '</div></td></tr>'
    ).join('');
  }

  $('#tablaInformes').addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.abrir) abrirSimulacion(Number(b.dataset.abrir));
    if (b.dataset.eliminarInf) {
      const id = Number(b.dataset.eliminarInf);
      const ok = await confirmar('Eliminar informe N.º ' + id, '¿Seguro que desea eliminar el registro de este informe? La simulación y sus resultados se conservan.');
      if (!ok) return;
      try {
        await conCarga('Eliminando…', () => Api.eliminarInforme(id));
        toast('Informe N.º ' + id + ' eliminado.', 'exito');
        cargarInformes();
      } catch (err) { /* ya se mostró */ }
    }
  });

  // ------------------------------------------------------------------ Botones con data-accion
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-accion]');
    if (!b) return;
    const accion = b.dataset.accion;
    if (accion === 'generar-informe' && estado.sim) generarInforme(estado.sim.id);
    if (accion === 'comparar') ejecutarComparacion();
    if (accion === 'recargar-historial') cargarHistorial();
    if (accion === 'recargar-informes') cargarInformes();
  });

  // ------------------------------------------------------------------ Inicio de la aplicación
  async function iniciar() {
    llenarFormulario(V.PREDETERMINADOS);
    renderSimulacion();
    renderComparacion();
    mostrarSeccion(location.hash.slice(1) || 'inicio');
    comprobarServidor(1);

    // Recuperar la última simulación y comparación abiertas (los datos vienen de MySQL).
    const idSim = memoria.leer('simulacion');
    if (idSim) {
      try {
        const sim = await Api.obtenerSimulacion(idSim);
        establecerSimulacion(sim);
        llenarFormulario(sim.parametros);
      } catch (e) {
        memoria.guardar('simulacion', null);
      }
    }
    const idComp = memoria.leer('comparacion');
    if (idComp) {
      try {
        await establecerComparacion(await Api.obtenerComparacion(idComp));
      } catch (e) {
        memoria.guardar('comparacion', null);
      }
    }
    // Si la sección visible depende de estos datos, se redibuja.
    const actual = location.hash.slice(1);
    if (actual === 'graficas') dibujarGraficas();
    if (actual === 'comparacion') dibujarComparacion();
  }

  iniciar();
})();
