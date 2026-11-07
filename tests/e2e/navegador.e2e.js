/**
 * TECHFIX - Prueba de extremo a extremo en un navegador real (Chromium + Playwright)
 * ------------------------------------------------------------------------------
 * Arranca el servidor, recorre la aplicación como lo haría un usuario,
 * prueba 3 tamaños de pantalla y REINICIA el servidor para comprobar que
 * los datos persisten en MySQL.
 *
 * Requisitos: MySQL con schema.sql (y .env configurado) y Playwright:
 *     npm install --no-save playwright
 *     npx playwright install chromium
 * Ejecutar:   npm run test:e2e
 */
'use strict';
const path = require('node:path');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.log('Playwright no está instalado. Ejecute:\n  npm install --no-save playwright\n  npx playwright install chromium');
  process.exit(0);
}

const PUERTO = 3100;
const URL = `http://localhost:${PUERTO}`;
const raiz = path.join(__dirname, '..', '..');
const resultados = [];

function iniciarServidor() {
  return new Promise((resolver, rechazar) => {
    const proc = spawn(process.execPath, ['server/server.js'], { cwd: raiz, env: { ...process.env, PORT: String(PUERTO) } });
    const tiempo = setTimeout(() => rechazar(new Error('El servidor no inició')), 15000);
    proc.stdout.on('data', (d) => {
      if (String(d).includes('Conectado a MySQL')) { clearTimeout(tiempo); resolver(proc); }
    });
    proc.stderr.on('data', (d) => process.stderr.write(d));
  });
}
const detener = (proc) => new Promise((r) => { proc.on('exit', r); proc.kill('SIGTERM'); });

async function paso(nombre, fn) {
  try {
    await fn();
    resultados.push(['OK', nombre]);
  } catch (e) {
    resultados.push(['FALLA', nombre + ' -> ' + e.message]);
  }
}

(async () => {
  let servidor = await iniciarServidor();
  const navegador = await chromium.launch();
  const errores = [];
  const pagina = await navegador.newPage({ viewport: { width: 1366, height: 860 } });
  pagina.on('pageerror', (e) => errores.push(e.message));
  pagina.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  const filas = (sel) => pagina.$$eval(sel + ' tbody tr', (r) => r.length);
  let idSimulacion;

  await paso('Carga inicial e indicador de conexión', async () => {
    await pagina.goto(URL);
    await pagina.waitForFunction(() => document.querySelector('#estadoServidor').classList.contains('ok'), null, { timeout: 10000 });
  });

  await paso('Validaciones: vacío, texto, negativo, M <= C0, tf <= t0, h = 0, más de 1000 pasos', async () => {
    await pagina.goto(URL + '/#configuracion');
    const casos = [
      [{ C0: '' }, 'C0', 'obligatorio'],
      [{ k: 'abc' }, 'k', 'número válido'],
      [{ C0: '-1' }, 'C0', 'mayor o igual'],
      [{ M: '5' }, 'M', 'mayor que C0'],
      [{ tf: '0' }, 'tf', 'mayor que el tiempo inicial'],
      [{ h: '0' }, 'h', 'mayor que cero'],
      [{ h: '0.001' }, 'h', 'máximo es 1000'],
    ];
    for (const [cambio, campo, texto] of casos) {
      await pagina.click('#btnRestaurar');
      for (const [c, v] of Object.entries(cambio)) await pagina.fill('#' + c, v);
      await pagina.click('#btnEjecutar');
      const msg = await pagina.textContent(`[data-error="${campo}"]`);
      assert.ok(msg.includes(texto), `${JSON.stringify(cambio)}: «${msg}»`);
    }
    assert.equal(await pagina.isHidden('#simulacion'), true); // no se envió nada
  });

  await paso('Ejecutar simulación del proyecto (h = 1) y ver tabla de 13 filas con valores correctos', async () => {
    await pagina.click('#btnRestaurar');
    await pagina.fill('#nombre_desafio', '<img src=x onerror="window.__xss=1"> Prueba e2e');
    await pagina.click('#btnEjecutar');
    await pagina.waitForSelector('#simulacion:not([hidden])');
    assert.equal(await filas('#tablaResultados'), 13);
    const ultima = await pagina.$eval('#tablaResultados tbody tr:last-child', (r) => r.innerText);
    for (const v of ['97.540865', '97.369019', '97.540097']) assert.ok(ultima.includes(v), ultima);
    idSimulacion = Number((await pagina.textContent('#simulacion [data-sim="titulo"]')).match(/N\.º (\d+)/)[1]);
  });

  await paso('Seguridad: el nombre con HTML se muestra como texto (sin ejecutar código)', async () => {
    await pagina.goto(URL + '/#historial');
    await pagina.waitForSelector('#tablaHistorial tbody tr');
    assert.equal(await pagina.evaluate(() => window.__xss), undefined);
    assert.ok((await pagina.textContent('#tablaHistorial')).includes('<img src=x'));
  });

  await paso('Gráficas: 2 lienzos dibujados con 4 y 2 series', async () => {
    await pagina.goto(URL + '/#graficas');
    await pagina.waitForTimeout(800);
    const series = await pagina.evaluate(() => ['graficaSoluciones', 'graficaErrores'].map((id) => Chart.getChart(id).data.datasets.length));
    assert.deepEqual(series, [4, 2]);
  });

  await paso('Comparación h = 1 y h = 0.5: factores 4.59 y 18.14', async () => {
    await pagina.goto(URL + '/#comparacion');
    await pagina.click('#comparacion [data-accion="comparar"]');
    await pagina.waitForSelector('#comparacion [data-con-comp]:not([hidden])');
    const texto = await pagina.textContent('[data-comp="factores"]');
    assert.ok(texto.includes('4.59') && texto.includes('18.14'), texto);
    assert.equal(await filas('#tablaComp'), 13);
  });

  await paso('Interpretación con valores reales (97.54 clientes, mes 1.96 y 7.32)', async () => {
    await pagina.goto(URL + '/#simulacion');
    await pagina.goto(URL + '/#interpretacion');
    const t = await pagina.textContent('#interpretacion');
    for (const v of ['97.54 clientes', 'mes 1.96', 'mes 7.32', 'RK4 presentó el menor error']) assert.ok(t.includes(v), v);
  });

  await paso('Informe: se genera, aparece en la lista y el PDF se descarga', async () => {
    await pagina.goto(URL + '/#informes');
    await pagina.click('#informes [data-accion="generar-informe"]');
    await pagina.waitForSelector('#tablaInformes tbody tr');
    const enlace = await pagina.$eval('#tablaInformes a[download]', (a) => a.href);
    const r = await pagina.request.get(enlace);
    assert.equal(r.status(), 200);
    assert.equal(r.headers()['content-type'], 'application/pdf');
  });

  await paso('Persistencia: reiniciar el servidor y recuperar la simulación desde MySQL', async () => {
    await detener(servidor);
    servidor = await iniciarServidor();
    const r = await pagina.request.get(`${URL}/api/simulaciones/${idSimulacion}`);
    assert.equal(r.status(), 200);
    assert.equal((await r.json()).filas.length, 13);
    await pagina.reload();
    await pagina.goto(URL + '/#simulacion');
    await pagina.waitForSelector('#tablaResultados tbody tr');
    assert.equal(await filas('#tablaResultados'), 13);
  });

  await paso('Eliminar: cancelar conserva; aceptar elimina (con confirmación)', async () => {
    await pagina.goto(URL + '/#historial');
    await pagina.waitForSelector(`[data-eliminar-sim="${idSimulacion}"]`);
    const antes = await filas('#tablaHistorial');
    await pagina.click(`[data-eliminar-sim="${idSimulacion}"]`);
    await pagina.click('#dialogo button[value="cancelar"]');
    assert.equal(await filas('#tablaHistorial'), antes);
    await pagina.click(`[data-eliminar-sim="${idSimulacion}"]`);
    await pagina.click('#dialogo button[value="aceptar"]');
    await pagina.waitForFunction((n) => document.querySelectorAll('#tablaHistorial tbody tr').length === n - 1, antes);
  });

  for (const [nombre, ancho, alto] of [['Computadora', 1366, 860], ['Tablet', 768, 1024], ['Celular', 390, 844]]) {
    await paso(`${nombre} (${ancho}px): sin desplazamiento horizontal en las 8 secciones`, async () => {
      const p = await navegador.newPage({ viewport: { width: ancho, height: alto }, isMobile: ancho < 800, hasTouch: ancho < 800 });
      for (const s of ['inicio', 'configuracion', 'simulacion', 'graficas', 'comparacion', 'interpretacion', 'historial', 'informes']) {
        await p.goto(`${URL}/#${s}`);
        await p.waitForTimeout(250);
        const desborda = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        assert.equal(desborda, false, `desborda en #${s}`);
      }
      if (ancho < 900) {
        await p.click('#btnMenu');
        assert.ok(await p.isVisible('.menu a[data-seccion="historial"]'));
      }
      await p.close();
    });
  }

  await paso('Consola del navegador sin errores', async () => {
    assert.deepEqual(errores, []);
  });

  await navegador.close();
  await detener(servidor);

  console.log('\nPrueba en navegador (Chromium)\n');
  resultados.forEach(([estado, nombre]) => console.log(`  ${estado === 'OK' ? '✔' : '✘'} ${nombre}`));
  const fallas = resultados.filter((r) => r[0] !== 'OK').length;
  console.log(`\n${resultados.length - fallas} de ${resultados.length} pasos correctos.`);
  process.exit(fallas ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
