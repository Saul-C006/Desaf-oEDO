/**
 * Pruebas de integración de la API (Express + MySQL real).
 * Requieren una base de datos configurada en .env con schema.sql instalado.
 * Si no hay conexión a MySQL, las pruebas se OMITEN (no fallan).
 *
 * Ejecutar:  npm run test:api
 * Las simulaciones creadas aquí se eliminan al final.
 */
'use strict';
require('dotenv').config({ quiet: true });
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server/app');
const { pool, comprobarConexion } = require('../server/config/db');
const metodos = require('../server/numerico/metodos');

const BASE_PARAMS = { C0: 10, M: 100, k: 0.3, t0: 0, tf: 12 };
let servidor;
let URL_BASE;
let hayBD = false;
const creadas = { simulaciones: [], comparaciones: [] };

before(async () => {
  try {
    hayBD = await comprobarConexion();
  } catch {
    hayBD = false;
  }
  servidor = app.listen(0);
  URL_BASE = `http://127.0.0.1:${servidor.address().port}/api`;
});

after(async () => {
  if (hayBD) {
    for (const id of creadas.comparaciones) await pool.execute('DELETE FROM comparaciones WHERE id_comparacion = ?', [id]);
    for (const id of creadas.simulaciones) await pool.execute('DELETE FROM simulaciones WHERE id_simulacion = ?', [id]);
  }
  servidor.close();
  await pool.end();
});

async function api(metodo, ruta, cuerpo, crudo) {
  const res = await fetch(URL_BASE + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: crudo !== undefined ? crudo : cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  const tipo = res.headers.get('content-type') || '';
  const datos = tipo.includes('json') ? await res.json() : tipo.includes('pdf') ? Buffer.from(await res.arrayBuffer()) : null;
  return { estado: res.status, datos, tipo };
}

async function crearSim(params) {
  const r = await api('POST', '/simulaciones', params);
  if (r.estado === 201) creadas.simulaciones.push(r.datos.id);
  return r;
}

const conBD = (nombre, fn) =>
  test(nombre, async (t) => {
    if (!hayBD) return t.skip('Sin conexión a MySQL');
    await fn(t);
  });

// ----------------------------------------------------------------------

conBD('GET /api/salud responde ok con la base conectada', async () => {
  const r = await api('GET', '/salud');
  assert.equal(r.estado, 200);
  assert.equal(r.datos.baseDeDatos, 'conectada');
});

conBD('POST /api/simulaciones guarda exactamente los valores calculados', async () => {
  const r = await crearSim({ ...BASE_PARAMS, h: 1, nombre_desafio: 'Prueba API h=1' });
  assert.equal(r.estado, 201);
  const esperado = metodos.simular({ ...BASE_PARAMS, h: 1 });
  assert.equal(r.datos.filas.length, 13);
  assert.deepEqual(r.datos.filas, esperado.filas); // DOUBLE conserva el valor exacto
  assert.equal(r.datos.resumen.metodoMasPreciso, 'RK4');
  assert.equal(r.datos.comparacionPasos.origen, 'calculada');
  assert.match(r.datos.interpretacion.crecimiento, /97\.54 clientes/);
});

conBD('GET /api/simulaciones/:id devuelve la simulación desde MySQL', async () => {
  const { datos: creada } = await crearSim({ ...BASE_PARAMS, h: 0.5 });
  const r = await api('GET', `/simulaciones/${creada.id}`);
  assert.equal(r.estado, 200);
  assert.equal(r.datos.filas.length, 25);
  assert.deepEqual(r.datos.parametros, { ...BASE_PARAMS, h: 0.5 });
  assert.deepEqual(r.datos.filas, metodos.simular({ ...BASE_PARAMS, h: 0.5 }).filas);
  assert.ok(r.datos.fechaCreacion);
});

conBD('GET /api/simulaciones (historial) incluye resultado final y errores máximos', async () => {
  const { datos: creada } = await crearSim({ ...BASE_PARAMS, h: 1 });
  const r = await api('GET', '/simulaciones');
  const fila = r.datos.find((s) => s.id === creada.id);
  assert.ok(fila);
  assert.equal(fila.pasos, 12);
  assert.equal(fila.rk4Final, creada.resumen.rk4Final);
  assert.equal(fila.errorAbsMaxHeun, creada.resumen.errorAbsMaxHeun);
  assert.equal(fila.metodoMasPreciso, 'RK4');
});

conBD('Validación: rechaza datos inválidos con un mensaje por campo', async () => {
  const r = await api('POST', '/simulaciones', { C0: -1, M: '', k: 'abc', t0: 5, tf: 2, h: 0 });
  assert.equal(r.estado, 400);
  assert.deepEqual(Object.keys(r.datos.detalles).sort(), ['C0', 'M', 'h', 'k', 'tf']);
  const r2 = await api('POST', '/simulaciones', { C0: 50, M: 40, k: 0.3, t0: 0, tf: 12, h: 1 });
  assert.equal(r2.estado, 400);
  assert.ok(r2.datos.detalles.M);
});

conBD('Validación: rechaza más de 1000 pasos y JSON mal formado', async () => {
  const r = await api('POST', '/simulaciones', { ...BASE_PARAMS, h: 0.001 });
  assert.equal(r.estado, 400);
  assert.match(r.datos.detalles.h, /máximo es 1000/);
  const r2 = await api('POST', '/simulaciones', undefined, '{"C0": 10,');
  assert.equal(r2.estado, 400);
});

conBD('Acepta números escritos como texto, incluso con coma decimal', async () => {
  const r = await crearSim({ C0: '10', M: '100', k: '0,3', t0: '0', tf: '12', h: '1' });
  assert.equal(r.estado, 201);
  assert.equal(r.datos.parametros.k, 0.3);
});

conBD('C0 = 0: el error relativo inicial se guarda como NULL (no definido)', async () => {
  const r = await crearSim({ ...BASE_PARAMS, C0: 0, h: 1 });
  const leida = await api('GET', `/simulaciones/${r.datos.id}`);
  assert.equal(leida.datos.filas[0].errorRelHeun, null);
  assert.equal(leida.datos.filas[0].errorRelRK4, null);
  assert.notEqual(leida.datos.filas[1].errorRelHeun, null);
});

conBD('h que no divide el intervalo: termina en tf y muestra aviso', async () => {
  const r = await crearSim({ ...BASE_PARAMS, h: 0.7 });
  assert.equal(r.datos.filas.at(-1).tiempo, 12);
  assert.ok(r.datos.avisos.some((a) => a.includes('acortó')));
});

conBD('POST /simulaciones/previsualizar calcula sin guardar', async () => {
  const [[antes]] = await pool.query('SELECT COUNT(*) AS n FROM simulaciones');
  const r = await api('POST', '/simulaciones/previsualizar', { ...BASE_PARAMS, h: 1 });
  const [[despues]] = await pool.query('SELECT COUNT(*) AS n FROM simulaciones');
  assert.equal(r.estado, 200);
  assert.equal(r.datos.id, null);
  assert.equal(antes.n, despues.n);
});

conBD('POST /api/comparaciones guarda los experimentos h = 1 y h = 0.5 con los mismos parámetros', async () => {
  const r = await api('POST', '/comparaciones', { ...BASE_PARAMS, nombre_desafio: 'Comparación API' });
  assert.equal(r.estado, 201);
  creadas.comparaciones.push(r.datos.id);
  const [e1, e2] = r.datos.experimentos;
  assert.equal(e1.h, 1);
  assert.equal(e2.h, 0.5);
  assert.deepEqual({ ...e1.parametros, h: 0 }, { ...e2.parametros, h: 0 });
  assert.equal(e1.filas.length, 13);
  assert.equal(e2.filas.length, 25);
  assert.ok(Math.abs(r.datos.reducciones[0].factorHeun - 4.59) < 0.01);
  assert.ok(Math.abs(r.datos.reducciones[0].factorRK4 - 18.14) < 0.01);

  // El detalle de un experimento usa la comparación GUARDADA
  const det = await api('GET', `/simulaciones/${e1.idSimulacion}`);
  assert.equal(det.datos.comparacionPasos.origen, 'guardada');
  assert.equal(det.datos.idComparacion, r.datos.id);
});

conBD('Informes: se registran en MySQL y el PDF se descarga', async () => {
  const { datos: sim } = await crearSim({ ...BASE_PARAMS, h: 1 });
  const r = await api('POST', `/simulaciones/${sim.id}/informes`, {});
  assert.equal(r.estado, 201);
  assert.equal(r.datos.idSimulacion, sim.id);
  assert.equal(r.datos.ubicacionPdf, `/api/informes/${r.datos.id}/pdf`);
  assert.match(r.datos.resumen, /RK4/);

  const pdf = await api('GET', `/informes/${r.datos.id}/pdf`);
  assert.equal(pdf.estado, 200);
  assert.match(pdf.tipo, /application\/pdf/);
  assert.equal(pdf.datos.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.datos.length > 10000);

  const lista = await api('GET', '/informes');
  assert.ok(lista.datos.some((i) => i.id === r.datos.id));
  const det = await api('GET', `/simulaciones/${sim.id}`);
  assert.equal(det.datos.informes.length, 1);
});

conBD('DELETE /api/simulaciones/:id elimina en cascada resultados e informes', async () => {
  const { datos: sim } = await crearSim({ ...BASE_PARAMS, h: 1 });
  const { datos: inf } = await api('POST', `/simulaciones/${sim.id}/informes`, {});
  const r = await api('DELETE', `/simulaciones/${sim.id}`);
  assert.equal(r.estado, 204);
  assert.equal((await api('GET', `/simulaciones/${sim.id}`)).estado, 404);
  assert.equal((await api('GET', `/informes/${inf.id}`)).estado, 404);
  const [[c]] = await pool.execute('SELECT COUNT(*) AS n FROM resultados WHERE id_simulacion = ?', [sim.id]);
  assert.equal(c.n, 0);
});

conBD('Al eliminar todos los experimentos de una comparación, la comparación también se elimina', async () => {
  const { datos: comp } = await api('POST', '/comparaciones', BASE_PARAMS);
  creadas.comparaciones.push(comp.id);
  for (const e of comp.experimentos) await api('DELETE', `/simulaciones/${e.idSimulacion}`);
  assert.equal((await api('GET', `/comparaciones/${comp.id}`)).estado, 404);
});

conBD('Identificadores inválidos (400) e inexistentes (404)', async () => {
  assert.equal((await api('GET', '/simulaciones/abc')).estado, 400);
  assert.equal((await api('GET', '/simulaciones/-3')).estado, 400);
  assert.equal((await api('GET', '/simulaciones/99999999')).estado, 404);
  assert.equal((await api('DELETE', '/informes/99999999')).estado, 404);
  assert.equal((await api('GET', '/no-existe')).estado, 404);
});
