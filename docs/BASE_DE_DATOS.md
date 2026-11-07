# TECHFIX — Base de datos MySQL (Etapa 3)

## 1. Archivos

| Archivo | Para qué sirve | ¿Dónde se ejecuta? |
|---|---|---|
| `database/crear_bd_local.sql` | Crea la base `techfix` y el usuario `techfix_app` con permisos mínimos | Solo en su computadora |
| `database/schema.sql` | **Instala las tablas desde cero** (borra las anteriores si existen) | Local y en la nube |
| `database/datos_prueba.sql` | Datos de prueba **generados por el código** (`npm run datos-prueba`) | Opcional |
| `database/consultas_prueba.sql` | Comprueba tablas, relaciones, historial, cascada | Opcional |
| `database/pruebas_restricciones.sql` | 9 inserciones inválidas que **deben fallar** | Opcional |

---

## 2. Diagrama de relaciones

```
┌───────────────────┐ 1      N ┌────────────────────┐ 1      N ┌──────────────────┐
│  comparaciones    │──────────│   simulaciones     │──────────│   resultados     │
│───────────────────│ (opcional)│────────────────────│          │──────────────────│
│ PK id_comparacion │          │ PK id_simulacion   │          │ PK id_resultado  │
│ descripcion       │          │ FK id_comparacion  │          │ FK id_simulacion │
│ fecha_creacion    │          │ nombre_desafio     │          │ iteracion        │
└───────────────────┘          │ descripcion        │          │ tiempo           │
                               │ fecha_creacion     │          │ valor_analitico  │
                               │ condicion_inicial  │          │ valor_heun       │
                               │ mercado_potencial  │          │ error_abs/rel_heun│
                               │ tasa_crecimiento   │          │ valor_rk4        │
                               │ tiempo_inicial     │          │ error_abs/rel_rk4│
                               │ tiempo_final       │          └──────────────────┘
                               │ tamanio_paso       │ 1      N ┌──────────────────┐
                               │ observaciones      │──────────│   informes       │
                               └────────────────────┘          │──────────────────│
                                                               │ PK id_informe    │
                                                               │ FK id_simulacion │
                                                               │ titulo, fecha    │
                                                               │ resumen          │
                                                               │ conclusion       │
                                                               │ ubicacion_pdf    │
                                                               └──────────────────┘
```

### ¿Qué guarda cada tabla? (explicación para la defensa)

- **simulaciones**: los **datos de entrada** de cada ejecución (C0, M, k, t0, tf, h), su nombre y su fecha.
  Una fila = una simulación.
- **resultados**: la **tabla comparativa**. Una fila por cada iteración, con el valor exacto, Heun, RK4 y sus errores.
  La simulación con h = 1 tiene 13 filas (de n = 0 a n = 12); con h = 0.5 tiene 25.
- **informes**: el **registro** de cada informe PDF generado: a qué simulación pertenece, cuándo se generó,
  su resumen, su conclusión y desde dónde se descarga.
- **comparaciones** (tabla adicional): agrupa los experimentos que se ejecutaron juntos para comparar
  tamaños de paso (h = 1 y h = 0.5). Una simulación individual tiene `id_comparacion = NULL`.

### Cambio respecto del plan de la Etapa 1
Se agregó la tabla **comparaciones** porque usted aprobó *guardar* los experimentos h = 1 y h = 0.5.
Sin ella, el historial mostraría dos simulaciones sueltas sin saber que forman una sola comparación.
Es una tabla muy pequeña (3 columnas) y es la única adicional.

---

## 3. Decisiones de diseño (¿por qué así?)

| Decisión | Motivo en lenguaje sencillo |
|---|---|
| **Normalización**: los parámetros están solo en `simulaciones`; los valores por paso, solo en `resultados` | No se repite C0, M, k... en cada una de las filas de resultados. Si se repitieran, podrían quedar inconsistentes |
| El **resultado final no se guarda** en `simulaciones` | Ya está en la última fila de `resultados`; guardarlo dos veces sería duplicar información |
| **DOUBLE** para números | Guarda el valor exacto que calcula JavaScript (también es DOUBLE). Los errores de RK4 (≈ 10⁻⁵) no se redondean a 0 |
| `error_relativo_*` admite **NULL** | NULL significa "no definido" cuando el valor exacto es 0 (no se divide entre cero) |
| **UNIQUE (id_simulacion, iteracion)** | Impide guardar dos veces la misma iteración |
| **ON DELETE CASCADE** | Al eliminar una simulación se borran sus resultados e informes. Al eliminar una comparación se borran sus experimentos. No quedan datos huérfanos |
| **CHECK** (C0 ≥ 0, M > C0, k > 0, h > 0, tf > t0) | Segunda barrera: aunque el backend falle, MySQL no acepta datos inválidos. Funciona desde MySQL 8.0.16 |
| **InnoDB + utf8mb4** | InnoDB permite claves foráneas y transacciones. utf8mb4 guarda tildes y ñ sin problemas |
| **Transacción** al guardar | La simulación y sus resultados se guardan juntos o no se guarda nada (no quedan simulaciones a medias) |
| Usuario con **permisos mínimos** (`SELECT, INSERT, UPDATE, DELETE`) | Si alguien obtuviera la contraseña de la app, no podría borrar tablas ni ver otras bases |
| Los **PDF no se guardan** como archivo | Se regeneran desde `simulaciones` + `resultados`. Así siempre coinciden con los datos y no se pierden aunque el servidor gratuito borre sus archivos |

---

## 4. Cómo ejecutarlo en su computadora (paso a paso)

### 4.1 Instalar MySQL
- **Windows / macOS**: descargue *MySQL Community Server 8* desde https://dev.mysql.com/downloads/mysql/.
  Durante la instalación anote la contraseña de `root`. Opcional: *MySQL Workbench* (interfaz gráfica).
- **Ubuntu / Debian**: `sudo apt install mysql-server`

Compruebe la instalación abriendo una terminal (en Windows: "MySQL 8.0 Command Line Client" o `cmd`):
```bash
mysql --version
```

### 4.2 Crear la base y el usuario de la aplicación
1. Abra `database/crear_bd_local.sql` y cambie `CAMBIE_ESTA_CLAVE` por una contraseña propia.
2. Desde la carpeta del proyecto ejecute (le pedirá la contraseña de root):
```bash
mysql -u root -p < database/crear_bd_local.sql
```

### 4.3 Instalar las tablas
```bash
mysql -u root -p techfix < database/schema.sql
```

### 4.4 (Opcional) Cargar los datos de prueba y comprobar
```bash
npm run datos-prueba                                         # regenera datos_prueba.sql desde el código
mysql -u root -p techfix < database/datos_prueba.sql
mysql -u root -p -t techfix < database/consultas_prueba.sql
mysql -u root -p --force techfix < database/pruebas_restricciones.sql
```

> **En MySQL Workbench:** File → Open SQL Script → elija el archivo → botón del rayo ⚡ (Execute).
> Antes de ejecutar `schema.sql`, seleccione la base `techfix` con doble clic en el panel izquierdo.

### 4.5 Si quiere empezar de cero
Vuelva a ejecutar `schema.sql`: borra y crea de nuevo las tablas (**se pierden los datos**).

---

## 5. Resultados de la comprobación (MySQL 8.0.46)

**Tablas creadas:** comparaciones, informes, resultados, simulaciones (todas InnoDB, utf8mb4_unicode_ci).

**Claves foráneas:**

| Tabla hija | Columna | Tabla padre | Al eliminar |
|---|---|---|---|
| informes | id_simulacion | simulaciones | CASCADE |
| resultados | id_simulacion | simulaciones | CASCADE |
| simulaciones | id_comparacion | comparaciones | CASCADE |

**Historial (consulta 3):**

| id | Nombre | h | Pasos | Analítica final | Heun final | RK4 final |
|---|---|---|---|---|---|---|
| 3 | Simulación individual (h = 0.25 meses) | 0.25 | 48 | 97.540865 | 97.532069 | 97.540862 |
| 2 | Experimento 2 (h = 0.5 meses) | 0.5 | 24 | 97.540865 | 97.503428 | 97.540823 |
| 1 | Experimento 1 (h = 1 mes) | 1 | 12 | 97.540865 | 97.369019 | 97.540097 |

Los valores coinciden con los de `docs/MODELO.md`. Los errores de RK4 se recuperan con todas sus cifras
(p. ej. 0.0007680788414319295), igual que en JavaScript.

**Comparación de tamaños de paso (consulta 5):**

| Experimento | h | Ea máx. Heun | Ea máx. RK4 | Más preciso |
|---|---|---|---|---|
| Experimento 1 | 1 | 0.623157 | 0.002857 | RK4 |
| Experimento 2 | 0.5 | 0.139096 | 0.000158 | RK4 |

**Eliminación en cascada (consulta 7, después deshecha con ROLLBACK):**

| Momento | simulaciones | resultados | informes |
|---|---|---|---|
| Antes | 3 | 87 | 1 |
| Después de borrar el Experimento 1 | 2 | 74 | 0 |

Se borraron 1 simulación, sus 13 resultados y su informe (87 − 13 = 74). ✔

**Restricciones:** las 9 inserciones inválidas fueron rechazadas (chk_c0, chk_m_c0, chk_k, chk_h,
chk_tiempos, 2 claves foráneas, iteración duplicada, valor NULL). Filas inválidas guardadas: **0**. ✔

**Permisos mínimos:** `techfix_app` puede leer y escribir datos, pero
`DROP TABLE informes` → *ERROR 1142: DROP command denied*. ✔

---

## 6. Nota para la nube (se detalla en DEPLOY.md, Etapa 7)
- En la nube **no** se ejecuta `crear_bd_local.sql`: el proveedor entrega la base, el usuario y la contraseña.
- Se importa `schema.sql` sobre la base entregada.
- Algunos proveedores exigen que todas las tablas tengan clave primaria: este diseño ya lo cumple.
- Si el proveedor no aplica los `CHECK`, la validación del backend sigue protegiendo los datos.
