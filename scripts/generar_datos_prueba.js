/**
 * Genera database/datos_prueba.sql a partir de los cálculos REALES de
 * server/numerico/metodos.js (así ningún número del SQL se escribe a mano).
 *
 * Uso:  npm run datos-prueba
 *
 * Contenido generado:
 *   - 1 comparación con 2 experimentos (h = 1 y h = 0.5) + sus resultados
 *   - 1 simulación individual (h = 0.25) + sus resultados
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { simular, PARAMETROS_PROYECTO } = require('../server/numerico/metodos');

// String(x) da la representación más corta que conserva el valor exacto del double.
const num = (x) => (x === null ? 'NULL' : String(x));
const texto = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;

function sqlSimulacion(p, nombre, descripcion, conComparacion) {
  const { filas } = simular(p);
  const lineas = [];
  lineas.push(
    `INSERT INTO simulaciones (id_comparacion, nombre_desafio, descripcion, condicion_inicial, mercado_potencial, tasa_crecimiento, tiempo_inicial, tiempo_final, tamanio_paso, observaciones)`,
    `VALUES (${conComparacion ? '@id_comparacion' : 'NULL'}, ${texto(nombre)}, ${texto(descripcion)}, ${num(p.C0)}, ${num(p.M)}, ${num(p.k)}, ${num(p.t0)}, ${num(p.tf)}, ${num(p.h)}, 'Parámetros hipotéticos (datos de prueba).');`,
    'SET @id_sim = LAST_INSERT_ID();',
    'INSERT INTO resultados (id_simulacion, iteracion, tiempo, valor_analitico, valor_heun, error_absoluto_heun, error_relativo_heun, valor_rk4, error_absoluto_rk4, error_relativo_rk4) VALUES'
  );
  lineas.push(
    filas
      .map(
        (r) =>
          `  (@id_sim, ${r.iteracion}, ${num(r.tiempo)}, ${num(r.analitico)}, ${num(r.heun)}, ${num(r.errorAbsHeun)}, ${num(r.errorRelHeun)}, ${num(r.rk4)}, ${num(r.errorAbsRK4)}, ${num(r.errorRelRK4)})`
      )
      .join(',\n') + ';'
  );
  return lineas.join('\n');
}

const salida = [
  '-- =====================================================================',
  '-- TECHFIX - Datos de prueba (GENERADO por scripts/generar_datos_prueba.js)',
  '-- No editar a mano: los valores salen de server/numerico/metodos.js.',
  '-- Ejecutar DESPUÉS de schema.sql. Parámetros hipotéticos.',
  '-- =====================================================================',
  '',
  'START TRANSACTION;',
  '',
  "INSERT INTO comparaciones (descripcion) VALUES ('Comparación de tamaños de paso: h = 1 y h = 0.5');",
  'SET @id_comparacion = LAST_INSERT_ID();',
  '',
  sqlSimulacion({ ...PARAMETROS_PROYECTO, h: 1 }, 'Experimento 1 (h = 1 mes)', 'Crecimiento de clientes de TechFix con paso de 1 mes.', true),
  '',
  sqlSimulacion({ ...PARAMETROS_PROYECTO, h: 0.5 }, 'Experimento 2 (h = 0.5 meses)', 'Crecimiento de clientes de TechFix con paso de 0.5 meses.', true),
  '',
  sqlSimulacion({ ...PARAMETROS_PROYECTO, h: 0.25 }, 'Simulación individual (h = 0.25 meses)', 'Ejemplo de simulación sin comparación.', false),
  '',
  'COMMIT;',
  '',
].join('\n');

const destino = path.join(__dirname, '..', 'database', 'datos_prueba.sql');
fs.writeFileSync(destino, salida, 'utf8');
console.log(`Generado ${path.relative(process.cwd(), destino)}`);
