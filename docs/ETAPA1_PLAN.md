# TECHFIX — Etapa 1: Análisis y planificación

> Documento de planificación. Todavía no contiene código de la aplicación.
> Se completará y ajustará después de la aprobación del estudiante.

---

## 1. Análisis de requisitos

El desafío del docente (PDF "Desafío individual: modelar un problema real con ecuaciones diferenciales") evalúa:

| Criterio de la rúbrica | Puntos | Cómo lo cubre TECHFIX |
|---|---|---|
| Originalidad, relevancia y claridad del problema | 15 | Sección Inicio + documentación (problema, beneficiarios, pregunta) |
| EDO, variables, parámetros y condición inicial | 20 | `docs/MODELO.md` + panel del modelo en la app, con unidades |
| Solución analítica correcta y verificada | 15 | Desarrollo paso a paso + verificación por sustitución + prueba automática |
| Implementación correcta de Heun y RK4 | 20 | Módulo `numerico.js` independiente, con pruebas de orden de convergencia |
| Comparación, gráficos, errores y análisis | 15 | Tabla, 2 gráficas Chart.js, comparación h=1 vs h=0.5, interpretación dinámica |
| App web, repositorio y video | 15 | App publicada, README, DEPLOY.md, guion de 1 minuto |

Requisitos adicionales del estudiante: MySQL persistente, historial, informes PDF registrados en BD, despliegue público.

### Advertencia de fecha
El PDF indica **fecha límite: viernes 6 de noviembre de 2026**. Hoy es 7 de noviembre de 2026.
Si existe una prórroga, conviene saber la nueva fecha para ajustar el ritmo de las etapas.

---

## 2. Arquitectura propuesta

Una sola aplicación Node.js/Express que sirve **tanto el frontend como la API**:

```
 Navegador (docente / celular / PC)
   │  HTML + CSS + JS + Chart.js
   │  fetch('/api/...')  ← JSON
   ▼
 Servidor Node.js + Express  (un solo servicio, una sola URL pública)
   ├── /            → archivos estáticos del frontend (carpeta public/)
   ├── /api/...     → rutas REST
   ├── numerico.js  → analítica, Heun, RK4, errores (funciones puras)
   ├── pdf.js       → genera el informe PDF con PDFKit
   └── db.js        → pool de conexiones mysql2 (credenciales desde .env)
   │  SQL (TLS si el proveedor lo exige)
   ▼
 MySQL en la nube (simulaciones, resultados, informes)
```

**¿Por qué un solo servicio?**
- Un único enlace para el docente.
- No hay problemas de CORS (frontend y API en el mismo dominio).
- Las credenciales de MySQL solo viven en el servidor; el navegador nunca las ve.
- Menos piezas que desplegar = menos cosas que pueden fallar en la defensa.

**¿Dónde se calcula?** En el servidor (`numerico.js`). El frontend solo muestra lo que devuelve la API.
Así lo que se guarda en MySQL, lo que se ve en pantalla y lo que sale en el PDF provienen del **mismo cálculo**
(regla 7: no generar informes con datos que no correspondan a la simulación).

### Flujo de una simulación
1. El usuario llena el formulario → el frontend valida (mensajes inmediatos).
2. `POST /api/simulaciones` con los parámetros.
3. El backend **vuelve a validar** (nunca confiar solo en el navegador).
4. `numerico.js` calcula analítica, Heun, RK4 y errores para cada paso.
5. Se guarda en una **transacción**: 1 fila en `simulaciones` + N filas en `resultados`.
   Si algo falla, no queda una simulación a medias.
6. Se devuelve el JSON → tabla, gráficas, tarjetas e interpretación.

---

## 3. Endpoints REST

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/salud` | Comprueba servidor + conexión a MySQL |
| POST | `/api/simulaciones/previsualizar` | Calcula sin guardar (opcional, para "probar" valores) |
| POST | `/api/simulaciones` | Calcula y guarda |
| GET | `/api/simulaciones` | Historial (lista con parámetros, fecha, resultado final) |
| GET | `/api/simulaciones/:id` | Parámetros + todas las filas de resultados |
| DELETE | `/api/simulaciones/:id` | Elimina (con confirmación en el frontend; borra en cascada) |
| GET | `/api/simulaciones/:id/comparacion-pasos` | Compara h=1 y h=0.5 con los mismos C0, M, k, t0, tf |
| POST | `/api/simulaciones/:id/informes` | Genera un informe y lo registra en `informes` |
| GET | `/api/informes` | Lista de informes |
| GET | `/api/informes/:id/pdf` | Descarga el PDF (regenerado desde la BD) |
| DELETE | `/api/informes/:id` | Elimina el registro de un informe |

---

## 4. Estructura de carpetas

```
Desaf-oEDO/
├── server/
│   ├── app.js               # configura Express, rutas y archivos estáticos
│   ├── server.js            # arranca el servidor (puerto desde .env)
│   ├── config/db.js         # pool mysql2 + SSL opcional
│   ├── numerico/
│   │   └── metodos.js       # analítica, Heun, RK4, errores (sin dependencias)
│   ├── services/
│   │   ├── validacion.js    # reglas de entrada (compartidas con el frontend)
│   │   ├── simulaciones.js  # lógica + consultas SQL
│   │   ├── interpretacion.js# textos generados con los valores reales
│   │   └── informePdf.js    # PDFKit
│   └── routes/
│       ├── simulaciones.js
│       └── informes.js
├── public/                  # frontend
│   ├── index.html           # SPA con secciones: Inicio, Configurar, Simulación,
│   │                        #   Gráficas, Comparación h, Interpretación, Historial, Informes
│   ├── css/styles.css
│   └── js/ (api.js, app.js, graficas.js, tablas.js, validacion.js)
├── database/
│   ├── schema.sql           # instala la BD desde cero
│   └── consultas_prueba.sql # consultas para comprobar relaciones
├── tests/
│   └── metodos.test.js      # pruebas con node:test (sin librerías extra)
├── docs/
│   ├── ETAPA1_PLAN.md
│   ├── MODELO.md            # documento académico (20 puntos pedidos)
│   ├── DEFENSA.md           # preguntas y respuestas
│   └── GUION_VIDEO.md
├── .env.example
├── .gitignore               # incluye .env y node_modules
├── package.json
├── README.md
└── DEPLOY.md
```

---

## 5. Diseño de la base de datos

### Diagrama de relaciones
```
simulaciones (1) ──< resultados (N)
simulaciones (1) ──< informes   (N)
```

### Tablas

**simulaciones**
| Campo | Tipo | Nota |
|---|---|---|
| id_simulacion | INT UNSIGNED AUTO_INCREMENT PK | |
| nombre_desafio | VARCHAR(150) NOT NULL | etiqueta, p. ej. "Experimento 1" |
| descripcion | VARCHAR(500) NULL | |
| fecha_creacion | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | |
| condicion_inicial | DOUBLE NOT NULL | C0 (clientes) |
| mercado_potencial | DOUBLE NOT NULL | M (clientes) |
| tasa_crecimiento | DOUBLE NOT NULL | k (1/mes) |
| tiempo_inicial | DOUBLE NOT NULL | meses |
| tiempo_final | DOUBLE NOT NULL | meses |
| tamanio_paso | DOUBLE NOT NULL | h (meses) |
| observaciones | TEXT NULL | |

Restricciones `CHECK`: `condicion_inicial >= 0`, `mercado_potencial > condicion_inicial`,
`tasa_crecimiento > 0`, `tamanio_paso > 0`, `tiempo_final > tiempo_inicial`
(MySQL 8.0.16+ las aplica; además se validan en el backend).

**resultados**
| Campo | Tipo | Nota |
|---|---|---|
| id_resultado | INT UNSIGNED AUTO_INCREMENT PK | |
| id_simulacion | INT UNSIGNED NOT NULL FK → simulaciones ON DELETE CASCADE | |
| iteracion | INT UNSIGNED NOT NULL | 0, 1, 2, ... |
| tiempo | DOUBLE NOT NULL | meses |
| valor_analitico | DOUBLE NOT NULL | |
| valor_heun / valor_rk4 | DOUBLE NOT NULL | |
| error_absoluto_heun / _rk4 | DOUBLE NOT NULL | |
| error_relativo_heun / _rk4 | DOUBLE **NULL** | NULL = "no definido" (exacto = 0) |
| UNIQUE (id_simulacion, iteracion) | | evita filas duplicadas |

**informes**
| Campo | Tipo | Nota |
|---|---|---|
| id_informe | INT UNSIGNED AUTO_INCREMENT PK | |
| id_simulacion | INT UNSIGNED NOT NULL FK → simulaciones ON DELETE CASCADE | |
| titulo | VARCHAR(200) NOT NULL | |
| fecha_generacion | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | |
| resumen | TEXT NOT NULL | generado con los valores reales |
| conclusion | TEXT NOT NULL | |
| ubicacion_pdf | VARCHAR(255) NOT NULL | ruta de descarga, p. ej. `/api/informes/7/pdf` |

**No se agregan más tablas**: no hacen falta usuarios ni catálogos.

### Decisiones importantes
- **DOUBLE en vez de DECIMAL**: los errores de RK4 son del orden de 10⁻⁵ a 10⁻⁸. Un DECIMAL con
  pocas cifras decimales los redondearía a 0 y la comparación Heun vs RK4 se perdería.
- **ON DELETE CASCADE**: al eliminar una simulación, se eliminan sus resultados e informes; no quedan huérfanos.
- **El PDF no se guarda como archivo en disco**: los hostings gratuitos suelen tener disco *efímero*
  (se borra al reiniciar). Se guarda en `informes` todo lo necesario (id de simulación + resumen + conclusión)
  y el PDF se **regenera** a partir de los datos de MySQL cada vez que se descarga. Siempre coincide con la simulación.
- **Comparación h=1 vs h=0.5**: se calcula con los mismos C0, M, k, t0, tf de la simulación (funciones puras,
  resultado determinista). Opcionalmente, la pantalla "Comparación" permite *guardar* ambos experimentos
  como simulaciones independientes en el historial.

---

## 6. Problemas matemáticos y técnicos identificados

1. **h que no divide exactamente el intervalo** (p. ej. h = 0.7 en [0, 12]): el último paso se acorta para
   terminar exactamente en tf; se avisa al usuario.
2. **Acumulación de error de punto flotante en el tiempo**: se calcula `t_n = t0 + n·h` en lugar de sumar `t += h`
   (con h = 0.1, sumar 120 veces no da exactamente 12).
3. **t0 ≠ 0**: la solución analítica debe usar `(t − t0)`: `C(t) = M − (M − C0)·e^(−k(t − t0))`.
4. **Error relativo con exacto = 0**: solo ocurre si C0 = 0 en t = t0. Se guarda NULL y se muestra "No definido".
5. **h muy pequeño** (p. ej. 0.0001 → 120 000 filas): saturaría la BD gratuita. Límite propuesto: **máximo 1 000 pasos**.
6. **Estabilidad con h grande**: si `k·h` es grande, Heun/RK4 oscilan o divergen (factor de amplificación).
   Se mostrará una advertencia cuando `k·h > 1` (no se bloquea: es un resultado didáctico).
7. **Entradas no numéricas / vacías**: validación en frontend y backend.
8. **Gráfica dentro del PDF**: dibujarla con las primitivas de PDFKit (líneas y ejes vectoriales) evita
   dependencias nativas como `canvas`, que suelen fallar en hostings gratuitos.
9. **Hosting gratuito que "duerme"**: la primera petición puede tardar. Se documentará en DEPLOY.md
   (sin usar pings artificiales) junto con una copia local de respaldo para la defensa.

### Cálculo de prueba preliminar (verificado en esta etapa)
Con C0 = 10, M = 100, k = 0.3, t ∈ [0, 12]:

| h | C exacto (12) | Heun (12) | Error Heun | RK4 (12) | Error RK4 |
|---|---|---|---|---|---|
| 1 | 97.540865 | 97.369019 | 0.171846 | 97.540097 | 0.000768 |
| 0.5 | 97.540865 | 97.503428 | 0.037437 | 97.540823 | 0.0000423 |

Al dividir h entre 2, el error de Heun baja ≈ 4.6 veces (≈ 2², orden 2) y el de RK4 ≈ 18 veces (≈ 2⁴, orden 4).
Esto coincide con la teoría y se usará como prueba automática.

---

## 7. Tecnologías

| Capa | Elección | Motivo |
|---|---|---|
| Frontend | HTML + CSS + JS puro + Chart.js (CDN) | Sin compilación, fácil de explicar |
| Backend | Node.js 20+ + Express | Pedido por el estudiante |
| BD | MySQL 8 + mysql2 (promesas, consultas parametrizadas) | Evita inyección SQL |
| Config | dotenv | Credenciales fuera del código |
| PDF | PDFKit | JavaScript puro, sin navegador headless |
| Pruebas | `node:test` (incluido en Node) | Sin dependencias extra |

## 8. Despliegue (preliminar — se verificará en la Etapa 7)

Candidatos a revisar con la documentación oficial actualizada: Aiven (MySQL gratuito),
TiDB Cloud Serverless (compatible con MySQL), Railway, Clever Cloud y opciones de pago bajo costo;
para la app: Render y similares. Para cada uno se verificará: suspensión por inactividad,
límites de almacenamiento/conexiones, tarjeta bancaria, borrado de datos y límites de uso.
**No se recomendará ninguno sin esa verificación.**
