-- =====================================================================
-- TECHFIX - Script de instalación de la base de datos (MySQL 8.0+)
-- ---------------------------------------------------------------------
-- Crea las tablas dentro de la base de datos que esté SELECCIONADA.
--   * Local:  primero ejecute database/crear_bd_local.sql (crea "techfix").
--   * Nube:   el proveedor ya entrega una base (p. ej. "defaultdb"); se
--             importa este archivo directamente sobre ella.
--
-- ¡CUIDADO! Borra las tablas si ya existen (instalación desde cero).
-- =====================================================================

SET NAMES utf8mb4;

-- Se eliminan en orden inverso a las dependencias (primero las "hijas").
DROP TABLE IF EXISTS informes;
DROP TABLE IF EXISTS resultados;
DROP TABLE IF EXISTS simulaciones;
DROP TABLE IF EXISTS comparaciones;

-- ---------------------------------------------------------------------
-- comparaciones
-- Agrupa los experimentos que se ejecutan juntos para comparar tamaños
-- de paso (p. ej. Experimento 1: h = 1 y Experimento 2: h = 0.5).
-- Justificación: sin esta tabla no se podría saber qué simulaciones del
-- historial forman parte de la misma comparación. Es la única tabla
-- adicional a las tres pedidas.
-- ---------------------------------------------------------------------
CREATE TABLE comparaciones (
  id_comparacion  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  descripcion     VARCHAR(255)  NOT NULL,
  fecha_creacion  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_comparacion)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- simulaciones
-- Una fila por cada ejecución: guarda los PARÁMETROS de entrada.
-- Los resultados NO se repiten aquí: viven en la tabla "resultados".
-- ---------------------------------------------------------------------
CREATE TABLE simulaciones (
  id_simulacion      INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_comparacion     INT UNSIGNED  NULL,           -- NULL = simulación individual
  nombre_desafio     VARCHAR(150)  NOT NULL,
  descripcion        VARCHAR(500)  NULL,
  fecha_creacion     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  condicion_inicial  DOUBLE        NOT NULL,       -- C0 (clientes)
  mercado_potencial  DOUBLE        NOT NULL,       -- M  (clientes)
  tasa_crecimiento   DOUBLE        NOT NULL,       -- k  (1/mes)
  tiempo_inicial     DOUBLE        NOT NULL,       -- t0 (meses)
  tiempo_final       DOUBLE        NOT NULL,       -- tf (meses)
  tamanio_paso       DOUBLE        NOT NULL,       -- h  (meses)
  observaciones      TEXT          NULL,
  PRIMARY KEY (id_simulacion),
  KEY idx_simulaciones_fecha (fecha_creacion),
  CONSTRAINT fk_simulaciones_comparacion
    FOREIGN KEY (id_comparacion) REFERENCES comparaciones (id_comparacion)
    ON DELETE CASCADE ON UPDATE CASCADE,
  -- Mismas reglas que valida el backend (MySQL 8.0.16+ las hace cumplir).
  CONSTRAINT chk_c0      CHECK (condicion_inicial >= 0),
  CONSTRAINT chk_m_c0    CHECK (mercado_potencial > condicion_inicial),
  CONSTRAINT chk_k       CHECK (tasa_crecimiento > 0),
  CONSTRAINT chk_h       CHECK (tamanio_paso > 0),
  CONSTRAINT chk_tiempos CHECK (tiempo_final > tiempo_inicial)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- resultados
-- Una fila por cada iteración de una simulación (relación 1 a N).
-- DOUBLE: conserva errores muy pequeños de RK4 (1e-5 ... 1e-8) que un
-- DECIMAL con pocos decimales redondearía a cero.
-- error_relativo_* admite NULL = "no definido" (cuando el valor exacto es 0).
-- ---------------------------------------------------------------------
CREATE TABLE resultados (
  id_resultado         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_simulacion        INT UNSIGNED  NOT NULL,
  iteracion            INT UNSIGNED  NOT NULL,     -- 0, 1, 2, ...
  tiempo               DOUBLE        NOT NULL,     -- meses
  valor_analitico      DOUBLE        NOT NULL,     -- clientes
  valor_heun           DOUBLE        NOT NULL,
  error_absoluto_heun  DOUBLE        NOT NULL,
  error_relativo_heun  DOUBLE        NULL,         -- %
  valor_rk4            DOUBLE        NOT NULL,
  error_absoluto_rk4   DOUBLE        NOT NULL,
  error_relativo_rk4   DOUBLE        NULL,         -- %
  PRIMARY KEY (id_resultado),
  -- Evita que una misma iteración se guarde dos veces.
  -- También sirve como índice para buscar los resultados de una simulación.
  UNIQUE KEY uq_resultados_sim_iter (id_simulacion, iteracion),
  CONSTRAINT fk_resultados_simulacion
    FOREIGN KEY (id_simulacion) REFERENCES simulaciones (id_simulacion)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_errores_no_negativos
    CHECK (error_absoluto_heun >= 0 AND error_absoluto_rk4 >= 0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- informes
-- Registro de cada informe PDF generado para una simulación (1 a N).
-- El PDF se REGENERA a partir de la simulación y sus resultados, por lo
-- que aquí se guarda la ruta de descarga y los textos del informe.
-- ---------------------------------------------------------------------
CREATE TABLE informes (
  id_informe        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_simulacion     INT UNSIGNED  NOT NULL,
  titulo            VARCHAR(200)  NOT NULL,
  fecha_generacion  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resumen           TEXT          NOT NULL,
  conclusion        TEXT          NOT NULL,
  ubicacion_pdf     VARCHAR(255)  NOT NULL,        -- p. ej. /api/informes/7/pdf
  PRIMARY KEY (id_informe),
  KEY idx_informes_simulacion (id_simulacion),
  CONSTRAINT fk_informes_simulacion
    FOREIGN KEY (id_simulacion) REFERENCES simulaciones (id_simulacion)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
