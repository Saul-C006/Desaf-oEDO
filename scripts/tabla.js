/**
 * Imprime en consola las tablas de la simulación (formato Markdown).
 * Uso:  npm run tabla            -> h = 1 y h = 0.5 con los parámetros del proyecto
 *       node scripts/tabla.js 0.25
 * Los números de la documentación se copian de esta salida, no se escriben a mano.
 */
'use strict';
const { simular, compararTamaniosPaso, PARAMETROS_PROYECTO } = require('../server/numerico/metodos');

const fmt = (x, d = 6) => (x === null ? 'No definido' : x.toFixed(d));
const sci = (x) => (x === null ? 'No definido' : x.toExponential(3));

function imprimirTabla(h) {
  const { filas, avisos } = simular({ ...PARAMETROS_PROYECTO, h });
  console.log(`\n### h = ${h} mes(es)\n`);
  console.log('| n | t (meses) | Analítica | Heun | Ea Heun | Er Heun (%) | RK4 | Ea RK4 | Er RK4 (%) |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const r of filas) {
    console.log(
      `| ${r.iteracion} | ${fmt(r.tiempo, 2)} | ${fmt(r.analitico)} | ${fmt(r.heun)} | ${fmt(r.errorAbsHeun)} | ${fmt(r.errorRelHeun, 4)} | ${fmt(r.rk4)} | ${sci(r.errorAbsRK4)} | ${sci(r.errorRelRK4)} |`
    );
  }
  avisos.forEach((a) => console.log(`\n> Aviso: ${a}`));
}

const argumentos = process.argv.slice(2).map(Number);
const pasos = argumentos.length ? argumentos : [1, 0.5];
pasos.forEach(imprimirTabla);

const comp = compararTamaniosPaso(PARAMETROS_PROYECTO, pasos);
console.log('\n### Resumen por tamaño de paso\n');
console.log('| h | C exacto(tf) | Heun(tf) | Ea Heun(tf) | Ea máx Heun | RK4(tf) | Ea RK4(tf) | Ea máx RK4 |');
console.log('|---|---|---|---|---|---|---|---|');
for (const e of comp.experimentos) {
  const s = e.resumen;
  console.log(
    `| ${e.h} | ${fmt(s.analiticoFinal)} | ${fmt(s.heunFinal)} | ${fmt(s.errorAbsFinalHeun)} | ${fmt(s.errorAbsMaxHeun)} | ${fmt(s.rk4Final)} | ${sci(s.errorAbsFinalRK4)} | ${sci(s.errorAbsMaxRK4)} |`
  );
}
for (const r of comp.reducciones) {
  console.log(
    `\nDe h = ${r.deH} a h = ${r.aH}: error final de Heun ÷ ${r.factorHeun.toFixed(2)}, error final de RK4 ÷ ${r.factorRK4.toFixed(2)}`
  );
}
