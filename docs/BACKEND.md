# TECHFIX — Backend (Etapa 4)

## 1. ¿Qué hace el backend?

Es el "cerebro" del sistema. Recibe los datos del formulario, los valida, ejecuta los métodos
numéricos, guarda todo en MySQL y genera los informes PDF. El navegador **nunca** se conecta
directamente a MySQL: solo habla con el backend mediante peticiones HTTP que devuelven JSON.

```
Navegador ──(JSON)──► Express ──► validación ──► metodos.js ──► MySQL
                         ▲                                         │
                         └─────────── respuesta JSON / PDF ◄───────┘
```

## 2. Archivos y responsabilidad de cada uno

| Archivo | Responsabilidad |
|---|---|
| `server/server.js` | Arranca el servidor en el puerto `PORT` y lee `.env` |
| `server/app.js` | Configura Express: rutas, archivos estáticos, seguridad y manejo de errores |
| `server/config/db.js` | Pool de conexiones mysql2, SSL y transacciones |
| `shared/validacion.js` | Reglas de validación (las mismas en navegador y servidor) |
| `server/numerico/metodos.js` | Analítica, Heun, RK4 y errores (Etapa 2) |
| `server/services/simulaciones.js` | Guardar, consultar y eliminar simulaciones y comparaciones |
| `server/services/interpretacion.js` | Textos de interpretación con los valores reales |
| `server/services/informes.js` | Registrar informes en MySQL y obtener su PDF |
| `server/services/informePdf.js` | Dibujar el PDF (18 secciones, tablas y gráfica) |
| `server/routes/*.js` | Definición de las rutas de la API |

Esta separación permite explicar cada parte por separado: las **rutas** reciben la petición,
los **servicios** hacen el trabajo y el **módulo numérico** solo calcula.

## 3. Endpoints de la API

| Método | Ruta | Qué hace | Respuesta |
|---|---|---|---|
| GET | `/api/salud` | Comprueba servidor y MySQL | 200 / 503 |
| POST | `/api/simulaciones/previsualizar` | Calcula **sin guardar** | 200 |
| POST | `/api/simulaciones` | Calcula y **guarda** una simulación | 201 |
| GET | `/api/simulaciones` | Historial | 200 |
| GET | `/api/simulaciones/:id` | Parámetros, tabla, comparación, interpretación e informes | 200 / 404 |
| DELETE | `/api/simulaciones/:id` | Elimina (resultados e informes en cascada) | 204 / 404 |
| POST | `/api/simulaciones/:id/informes` | Genera y **registra** un informe | 201 |
| POST | `/api/comparaciones` | Ejecuta y guarda h = 1 y h = 0.5 con los mismos parámetros | 201 |
| GET | `/api/comparaciones/:id` | Experimentos de la comparación con todas sus filas | 200 / 404 |
| DELETE | `/api/comparaciones/:id` | Elimina la comparación y sus experimentos | 204 / 404 |
| GET | `/api/informes` | Lista de informes | 200 |
| GET | `/api/informes/:id` | Datos del informe | 200 / 404 |
| GET | `/api/informes/:id/pdf` | Descarga el PDF (`?ver=1` lo abre en el navegador) | 200 / 404 |
| DELETE | `/api/informes/:id` | Elimina el registro del informe | 204 / 404 |

### Ejemplo: crear una simulación

Petición:
```http
POST /api/simulaciones
Content-Type: application/json

{ "C0": 10, "M": 100, "k": 0.3, "t0": 0, "tf": 12, "h": 1, "nombre_desafio": "Experimento propio" }
```

Respuesta (resumida):
```json
{
  "id": 1,
  "parametros": { "C0": 10, "M": 100, "k": 0.3, "t0": 0, "tf": 12, "h": 1 },
  "filas": [ { "iteracion": 0, "tiempo": 0, "analitico": 10, "heun": 10, "rk4": 10, ... }, ... ],
  "resumen": { "analiticoFinal": 97.5408649797, "heunFinal": 97.3690185720, "rk4Final": 97.5400969009,
               "errorAbsMaxHeun": 0.6231568733, "errorAbsMaxRK4": 0.0028568671, "metodoMasPreciso": "RK4" },
  "avisos": [],
  "comparacionPasos": { "origen": "calculada", "reducciones": [ { "factorHeun": 4.59, "factorRK4": 18.14 } ] },
  "interpretacion": { "crecimiento": "El emprendimiento comienza con 10 clientes...", "conclusion": "..." },
  "informes": []
}
```

### Ejemplo: datos inválidos
```json
// POST { "C0": -1, "M": "", "k": "abc", "t0": 5, "tf": 2, "h": 0 }   -> 400
{
  "error": "Hay datos inválidos en el formulario.",
  "detalles": {
    "C0": "C0 debe ser mayor o igual a cero.",
    "M": "Este campo es obligatorio.",
    "k": "Debe ser un número válido.",
    "h": "h debe ser mayor que cero.",
    "tf": "El tiempo final debe ser mayor que el tiempo inicial."
  }
}
```

## 4. Flujo al guardar una simulación (paso a paso)

1. La ruta `POST /api/simulaciones` recibe el JSON.
2. `validarPeticion()` revisa cada campo. Si hay errores, responde **400** con un mensaje por campo.
3. `metodos.simular()` calcula la analítica, Heun y RK4 con **los mismos parámetros**.
4. `enTransaccion()` abre una transacción:
   - `INSERT` en `simulaciones` (parámetros);
   - **un solo** `INSERT` con todas las filas en `resultados`;
   - `COMMIT`. Si algo falla, `ROLLBACK`: no queda nada a medias.
5. Se vuelve a leer la simulación **desde MySQL** y se devuelve. Así lo que ve el usuario es exactamente lo guardado.

## 5. Informes PDF

1. `POST /api/simulaciones/:id/informes` genera el **resumen** y la **conclusión** con los valores reales y los
   guarda en la tabla `informes`, junto con `ubicacion_pdf = /api/informes/{id}/pdf`.
2. `GET /api/informes/{id}/pdf` lee el informe, la simulación y sus resultados desde MySQL y **dibuja el PDF en ese momento**.
3. El archivo no se guarda en disco: los hostings gratuitos suelen borrar sus archivos al reiniciarse.
   Como todos los datos están en MySQL, el PDF siempre se puede regenerar y siempre coincide con la simulación.

El PDF contiene las 18 secciones pedidas: nombre del proyecto, desafío, problema, objetivo, modelo, EDO,
condición inicial, parámetros, solución analítica, Heun y RK4 (con el primer paso desarrollado), tabla comparativa,
gráfica, tabla de errores, comparación de tamaños de paso, interpretación, conclusiones y limitaciones.
Si la simulación tiene más de 61 filas, las tablas muestran filas espaciadas (siempre la primera y la última) y lo indican.

## 6. Seguridad

| Medida | Dónde |
|---|---|
| Credenciales solo en variables de entorno (`.env` está en `.gitignore`) | `config/db.js`, `.env.example` |
| Consultas con parámetros `?` (evitan inyección SQL) | todos los servicios |
| Validación en el servidor, aunque el navegador ya valide | `shared/validacion.js` |
| Errores internos sin detalles para el usuario (se registran en la consola del servidor) | `app.js` |
| SSL/TLS con verificación de certificado cuando el proveedor lo exige | `DB_SSL`, `DB_SSL_CA` |
| Límite de tamaño del cuerpo (20 KB) y máximo de 1000 pasos | `app.js`, validación |
| Usuario MySQL con permisos mínimos (local) | `database/crear_bd_local.sql` |
| Pool con pocas conexiones (los planes gratuitos las limitan) | `DB_CONNECTION_LIMIT` |

## 7. Cómo ejecutarlo en su computadora

```bash
npm install                  # instala express, mysql2, dotenv y pdfkit
cp .env.example .env         # en Windows: copy .env.example .env
# edite .env con su usuario y contraseña de MySQL (Etapa 3)
npm start                    # o: npm run dev (se reinicia al guardar cambios)
```

Abra http://localhost:3000/api/salud. Debe responder `{"estado":"ok","baseDeDatos":"conectada",...}`.

## 8. Pruebas

```bash
npm test          # 44 pruebas: numéricas, validación, interpretación y API
npm run test:api  # solo la API (necesita MySQL con schema.sql instalado)
```

Si MySQL no está disponible, las 15 pruebas de la API se **omiten** (no fallan).
Las simulaciones que crean las pruebas se eliminan al terminar.

Resultado en este entorno (MySQL 8.0.46): **44 pruebas, 44 aprobadas.**

Pruebas manuales adicionales del PDF:

| Caso | Páginas | Tiempo de generación |
|---|---|---|
| h = 1 (13 filas) | 4 | < 100 ms |
| h = 0.012 (1001 filas, tabla recortada) | 7 | 85 ms |
| C0 = 0, t0 = 2, h = 0.7 (último paso acortado) | 6 | 50 ms |
| h = 5, k·h = 2.5 (Heun inestable) | 4 | 32 ms |

En el último caso, Heun da valores negativos. La interpretación lo detecta: avisa que el método se vuelve
inestable y la conclusión recomienda reducir h, en lugar de afirmar que el resultado es bueno.
