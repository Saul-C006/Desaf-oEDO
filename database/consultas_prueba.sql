-- =====================================================================
-- TECHFIX - Consultas de comprobación
-- Ejecutar DESPUÉS de schema.sql y datos_prueba.sql:
--     mysql -u root -p techfix < database/consultas_prueba.sql
-- Son las mismas consultas que usará el backend en la Etapa 4.
-- =====================================================================

-- 1) ¿Se crearon las 4 tablas?
SELECT TABLE_NAME AS tabla, ENGINE AS motor, TABLE_COLLATION AS cotejamiento
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME;

-- 2) ¿Existen las claves foráneas y su regla de borrado?
SELECT kcu.TABLE_NAME AS tabla_hija, kcu.COLUMN_NAME AS columna,
       kcu.REFERENCED_TABLE_NAME AS tabla_padre, rc.DELETE_RULE AS al_eliminar
FROM information_schema.KEY_COLUMN_USAGE kcu
JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
  ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
 AND rc.CONSTRAINT_NAME   = kcu.CONSTRAINT_NAME
WHERE kcu.TABLE_SCHEMA = DATABASE() AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY kcu.TABLE_NAME;

-- 3) HISTORIAL: lista de simulaciones con su resultado final y nº de informes.
--    El resultado final se toma de la última iteración (no se duplica en simulaciones).
SELECT s.id_simulacion, s.nombre_desafio, s.fecha_creacion, s.id_comparacion,
       s.condicion_inicial AS C0, s.mercado_potencial AS M, s.tasa_crecimiento AS k,
       s.tiempo_inicial AS t0, s.tiempo_final AS tf, s.tamanio_paso AS h,
       COUNT(r.id_resultado) - 1                           AS pasos,
       ROUND(MAX(CASE WHEN r.iteracion = u.ultima THEN r.valor_analitico END), 6) AS analitico_final,
       ROUND(MAX(CASE WHEN r.iteracion = u.ultima THEN r.valor_heun END), 6)      AS heun_final,
       ROUND(MAX(CASE WHEN r.iteracion = u.ultima THEN r.valor_rk4 END), 6)       AS rk4_final,
       (SELECT COUNT(*) FROM informes i WHERE i.id_simulacion = s.id_simulacion)  AS informes
FROM simulaciones s
JOIN resultados r ON r.id_simulacion = s.id_simulacion
JOIN (SELECT id_simulacion, MAX(iteracion) AS ultima FROM resultados GROUP BY id_simulacion) u
  ON u.id_simulacion = s.id_simulacion
GROUP BY s.id_simulacion
ORDER BY s.fecha_creacion DESC, s.id_simulacion DESC;

-- 4) DETALLE: tabla comparativa del Experimento 1 (h = 1).
SELECT r.iteracion AS n, r.tiempo AS t_meses,
       ROUND(r.valor_analitico, 6) AS analitica,
       ROUND(r.valor_heun, 6)      AS heun, ROUND(r.error_absoluto_heun, 6) AS ea_heun,
       ROUND(r.error_relativo_heun, 4) AS er_heun_pct,
       ROUND(r.valor_rk4, 6)       AS rk4,  r.error_absoluto_rk4 AS ea_rk4,
       r.error_relativo_rk4 AS er_rk4_pct
FROM resultados r
JOIN simulaciones s ON s.id_simulacion = r.id_simulacion
WHERE s.nombre_desafio LIKE 'Experimento 1%'
ORDER BY r.iteracion;

-- 5) COMPARACIÓN DE TAMAÑOS DE PASO: errores máximos y finales de cada experimento.
SELECT c.id_comparacion, s.nombre_desafio, s.tamanio_paso AS h,
       ROUND(MAX(r.error_absoluto_heun), 6) AS ea_max_heun,
       MAX(r.error_absoluto_rk4)            AS ea_max_rk4,
       CASE WHEN MAX(r.error_absoluto_rk4) < MAX(r.error_absoluto_heun)
            THEN 'RK4' ELSE 'Heun' END      AS metodo_mas_preciso
FROM comparaciones c
JOIN simulaciones s ON s.id_comparacion = c.id_comparacion
JOIN resultados r   ON r.id_simulacion  = s.id_simulacion
GROUP BY c.id_comparacion, s.id_simulacion
ORDER BY c.id_comparacion, s.tamanio_paso DESC;

-- 6) y 7) se ejecutan dentro de una TRANSACCIÓN que al final se deshace (ROLLBACK),
--    para no dejar informes ni borrados de prueba en la base de datos.
START TRANSACTION;

-- 6) Registrar un informe de prueba y consultarlo junto a su simulación.
INSERT INTO informes (id_simulacion, titulo, resumen, conclusion, ubicacion_pdf)
SELECT id_simulacion, 'Informe de prueba', 'Resumen de prueba.', 'Conclusión de prueba.', 'pendiente'
FROM simulaciones WHERE nombre_desafio LIKE 'Experimento 1%';
UPDATE informes SET ubicacion_pdf = CONCAT('/api/informes/', id_informe, '/pdf') WHERE ubicacion_pdf = 'pendiente';

SELECT i.id_informe, i.titulo, i.fecha_generacion, i.ubicacion_pdf, s.nombre_desafio
FROM informes i JOIN simulaciones s ON s.id_simulacion = i.id_simulacion;

-- 7) ELIMINACIÓN EN CASCADA: al borrar el Experimento 1 deben desaparecer
--    sus resultados y su informe.
SELECT 'ANTES' AS momento,
       (SELECT COUNT(*) FROM simulaciones) AS simulaciones,
       (SELECT COUNT(*) FROM resultados)   AS resultados,
       (SELECT COUNT(*) FROM informes)     AS informes;
DELETE FROM simulaciones WHERE nombre_desafio LIKE 'Experimento 1%';
SELECT 'DESPUES' AS momento,
       (SELECT COUNT(*) FROM simulaciones) AS simulaciones,
       (SELECT COUNT(*) FROM resultados)   AS resultados,
       (SELECT COUNT(*) FROM informes)     AS informes;
ROLLBACK;   -- se deshace todo: el informe de prueba y el borrado

-- 8) Conteo final: igual al de "ANTES" pero con 0 informes (el de prueba se deshizo).
SELECT (SELECT COUNT(*) FROM comparaciones) AS comparaciones,
       (SELECT COUNT(*) FROM simulaciones)  AS simulaciones,
       (SELECT COUNT(*) FROM resultados)    AS resultados,
       (SELECT COUNT(*) FROM informes)      AS informes;
