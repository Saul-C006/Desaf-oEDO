-- =====================================================================
-- TECHFIX - Pruebas de restricciones (CADA sentencia DEBE FALLAR)
-- Ejecutar con --force para que MySQL continúe después de cada error:
--     mysql -u root -p --force techfix < database/pruebas_restricciones.sql
-- Si alguna sentencia NO muestra error, la restricción no está funcionando.
-- =====================================================================

-- C0 negativo -> viola chk_c0
INSERT INTO simulaciones (nombre_desafio, condicion_inicial, mercado_potencial, tasa_crecimiento, tiempo_inicial, tiempo_final, tamanio_paso)
VALUES ('C0 negativo', -1, 100, 0.3, 0, 12, 1);

-- M no mayor que C0 -> viola chk_m_c0
INSERT INTO simulaciones (nombre_desafio, condicion_inicial, mercado_potencial, tasa_crecimiento, tiempo_inicial, tiempo_final, tamanio_paso)
VALUES ('M <= C0', 50, 50, 0.3, 0, 12, 1);

-- k = 0 -> viola chk_k
INSERT INTO simulaciones (nombre_desafio, condicion_inicial, mercado_potencial, tasa_crecimiento, tiempo_inicial, tiempo_final, tamanio_paso)
VALUES ('k cero', 10, 100, 0, 0, 12, 1);

-- h = 0 -> viola chk_h
INSERT INTO simulaciones (nombre_desafio, condicion_inicial, mercado_potencial, tasa_crecimiento, tiempo_inicial, tiempo_final, tamanio_paso)
VALUES ('h cero', 10, 100, 0.3, 0, 12, 0);

-- tf <= t0 -> viola chk_tiempos
INSERT INTO simulaciones (nombre_desafio, condicion_inicial, mercado_potencial, tasa_crecimiento, tiempo_inicial, tiempo_final, tamanio_paso)
VALUES ('tiempos', 10, 100, 0.3, 12, 0, 1);

-- Resultado de una simulación que no existe -> viola fk_resultados_simulacion
INSERT INTO resultados (id_simulacion, iteracion, tiempo, valor_analitico, valor_heun, error_absoluto_heun, valor_rk4, error_absoluto_rk4)
VALUES (999999, 0, 0, 10, 10, 0, 10, 0);

-- Informe de una simulación que no existe -> viola fk_informes_simulacion
INSERT INTO informes (id_simulacion, titulo, resumen, conclusion, ubicacion_pdf)
VALUES (999999, 'x', 'x', 'x', 'x');

-- Iteración duplicada en la misma simulación -> viola uq_resultados_sim_iter
INSERT INTO resultados (id_simulacion, iteracion, tiempo, valor_analitico, valor_heun, error_absoluto_heun, valor_rk4, error_absoluto_rk4)
SELECT id_simulacion, 0, 0, 10, 10, 0, 10, 0 FROM simulaciones ORDER BY id_simulacion LIMIT 1;

-- Valor obligatorio vacío (NULL) -> viola NOT NULL
INSERT INTO simulaciones (nombre_desafio, condicion_inicial, mercado_potencial, tasa_crecimiento, tiempo_inicial, tiempo_final, tamanio_paso)
VALUES ('nulo', NULL, 100, 0.3, 0, 12, 1);

-- Comprobación: ninguna de las filas anteriores debe haberse guardado.
SELECT COUNT(*) AS filas_invalidas_guardadas
FROM simulaciones
WHERE nombre_desafio IN ('C0 negativo', 'M <= C0', 'k cero', 'h cero', 'tiempos', 'nulo');
