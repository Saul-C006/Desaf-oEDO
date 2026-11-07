# TECHFIX — Publicación (Etapa 7)

Guía para publicar la aplicación y la base de datos MySQL con un enlace público.

---

## 1. Comparación de proveedores (revisado el 7 de noviembre de 2026)

| Proveedor | ¿MySQL gratis? | ¿Se duerme / suspende? | Tarjeta | Datos | Veredicto |
|---|---|---|---|---|---|
| **Aiven** | **No para cuentas nuevas**: el plan gratuito de MySQL fue retirado; los servicios gratuitos existentes se apagan y sus datos se borran el 21/12/2026 | Los servicios gratuitos se apagan si no tienen actividad | No (en el plan gratuito) | — | ❌ No se puede crear uno nuevo. Plan "Developer" de pago: 5 USD/mes, no se apaga |
| **Railway** | Prueba: crédito único de **5 USD** por hasta **30 días**; luego el plan gratuito da 1 USD/mes | Los servicios no se duermen salvo que se active "Serverless" | No para la prueba (se pide verificar la cuenta, p. ej. con GitHub) | Cuando se acaba el crédito los servicios se detienen | ✅ **Elegido**: app + MySQL en un solo lugar, listo en minutos |
| **Render** (solo la app) | No ofrece MySQL | El servicio gratuito se duerme tras **15 min** sin visitas y tarda **~1 min** en despertar; 750 h/mes | No | — | Alternativa para la app, pero necesita MySQL en otro lugar |

**Advertencias honestas:**
- **No existe hoy una opción de MySQL gratuita que garantice estar siempre activa.** Railway sirve para la defensa (el crédito de prueba alcanza de sobra), pero **no es permanente**: cuando se acaba el crédito o pasan los 30 días, los servicios se detienen.
- Para una publicación duradera: plan Hobby de Railway (5 USD/mes) o Aiven Developer (5 USD/mes).
- La página oficial de la prueba de Railway (docs.railway.com) no se pudo abrir desde el entorno de desarrollo. Las condiciones anteriores salen de la página de precios de Railway y de su documentación indexada. **Revise su panel de Railway**, que muestra el crédito restante.
- No se usan "pings" artificiales para evitar que un servicio se duerma.

Fuentes: [Aiven: retiro del MySQL gratuito](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier) · [Aiven: precios](https://aiven.io/docs/platform/concepts/service-pricing) · [Aiven Developer](https://aiven.io/developer-tier-pg-mysql) · [Render FAQ](https://render.com/docs/faq) · [Railway: precios](https://railway.com/pricing) · [Railway: prueba gratuita](https://docs.railway.com/pricing/free-trial) · [Railway: MySQL](https://docs.railway.app/guides/mysql)

---

## 2. Publicar en Railway (≈ 15 minutos)

### Paso 1. Crear la cuenta
1. Entre a **https://railway.com** → **Login** → **Login with GitHub** (use la cuenta donde está el repositorio).
2. Acepte los términos. Si pide verificar la cuenta, siga las instrucciones (la cuenta de GitHub sirve).

### Paso 2. Crear el proyecto con la base de datos MySQL
1. **New Project** → **Database** → **Add MySQL**.
2. Espere ~1 minuto hasta que el servicio **MySQL** aparezca en verde (Active).
   Railway genera automáticamente el host, el puerto, el usuario, la contraseña y la base de datos.
   Puede verlos en **MySQL → Variables** (`MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`, `MYSQL_URL`).

### Paso 3. Agregar la aplicación desde GitHub
1. Dentro del mismo proyecto: **+ Create** (o **New**) → **GitHub Repo** → elija **Desaf-oEDO**.
   (Si no aparece, dé clic en **Configure GitHub App** y autorice el repositorio.)
2. Railway detecta Node.js y usa `npm install` y `npm start` automáticamente.
   La rama que se publica es la predeterminada del repositorio (`claude/techfix-cliente-growth-sim-j6ivfm`);
   puede confirmarlo en **Settings → Source → Branch**.

### Paso 4. Conectar la aplicación con MySQL (variables de entorno)
En el servicio de la **aplicación** → pestaña **Variables** → **New Variable**:

| Nombre | Valor (escríbalo tal cual) |
|---|---|
| `MYSQL_URL` | `${{MySQL.MYSQL_URL}}` |

- `${{MySQL.MYSQL_URL}}` es una **referencia**: Railway copia la dirección privada de su base de datos sin que usted vea ni escriba la contraseña.
  Si su servicio de base de datos tiene otro nombre (no "MySQL"), use ese nombre: `${{NombreDelServicio.MYSQL_URL}}`.
- **No** agregue `DB_HOST` (si existe, la app lo usa en lugar de `MYSQL_URL`).
- La conexión es por la **red privada** de Railway (no sale a internet), por eso no hace falta SSL (`DB_SSL` queda en `false`).
- Guarde: la aplicación se vuelve a desplegar sola.

### Paso 5. Importar las tablas: automático
No hay que importar nada a mano. Al arrancar, el servidor revisa si existe la tabla `simulaciones`;
si no existe, ejecuta `database/schema.sql` una sola vez. En **Deployments → View logs** debe ver:

```
TECHFIX escuchando en http://localhost:8080
Conectado a MySQL (mysql.railway.internal/railway).
Tablas de la base de datos: instalada ahora.
```

Comprobar las tablas: servicio **MySQL → Data** debe mostrar `comparaciones`, `informes`, `resultados` y `simulaciones`.

### Paso 6. Generar el enlace público
Servicio de la aplicación → **Settings → Networking → Generate Domain**.
Obtendrá un enlace como `https://desaf-oedo-production.up.railway.app`.

### Paso 7. Probar
1. Abra `https://SU-ENLACE/api/salud` → debe responder `{"estado":"ok","baseDeDatos":"conectada",...}`.
2. Abra `https://SU-ENLACE` → Configuración → **Ejecutar y guardar simulación** → verifique la tabla (C(12) exacto = 97.540865).
3. **Ejecutar comparación** → debe mostrar ÷ 4.59 y ÷ 18.14.
4. Genere un informe y descárguelo.
5. **Desde su celular con datos móviles** (no el wifi de la laptop), abra el mismo enlace y revise el Historial.

---

## 3. Respaldo y restauración

**Respaldo** (crea un archivo `.sql` con todos los datos):
1. En Railway → servicio **MySQL → Variables**, copie el valor de **`MYSQL_PUBLIC_URL`** (dirección pública).
2. En su laptop, en el archivo `.env`, agregue una línea `MYSQL_URL=<ese valor>` y **comente** la línea `DB_HOST` poniendo `#` adelante.
3. Ejecute:
   ```cmd
   npm run respaldo
   ```
   Se crea `database\respaldos\respaldo_AAAA-MM-DD_HH-MM.sql` (esta carpeta no se sube a GitHub).
4. Vuelva a dejar su `.env` como estaba (para usar XAMPP).

**Restaurar** (¡borra las tablas y carga el respaldo!) en la base configurada en `.env`:
```cmd
npm run restaurar -- database\respaldos\respaldo_AAAA-MM-DD_HH-MM.sql
```
Sirve también para copiar los datos de la nube a XAMPP o al revés.

---

## 4. Plan B para la defensa (si la nube falla)

1. **Copia local:** la aplicación funciona en su laptop con XAMPP (`npm start` → http://localhost:3000).
   Antes de la defensa: abra XAMPP (MySQL en verde), ejecute `npm start` y deje la pestaña abierta.
2. **Mismos datos que la nube:** haga un respaldo de Railway (sección 3) y restáurelo en XAMPP.
3. Tenga a mano `docs/capturas/` y un PDF de informe ya descargado.

---

## 5. Seguridad

- Las contraseñas **no** están en el código: Railway las guarda como variables y la app las recibe por `MYSQL_URL`.
- `.env` está en `.gitignore`; `.env.example` no tiene credenciales reales.
- El navegador nunca recibe credenciales de MySQL.
- La conexión app ↔ MySQL en Railway va por red privada. Si usa un proveedor externo que exija SSL, configure `DB_SSL=true` y su certificado en `DB_SSL_CA`.
- No comparta el valor de `MYSQL_PUBLIC_URL`: contiene la contraseña.

## 6. Problemas frecuentes

| Síntoma | Solución |
|---|---|
| `/api/salud` dice "sin conexión" | Revise que la variable sea `${{MySQL.MYSQL_URL}}` (nombre exacto del servicio) y que MySQL esté *Active* |
| Logs: `ENOTFOUND mysql.railway.internal` | La app y MySQL deben estar en el **mismo proyecto** de Railway |
| "Application failed to respond" | Espere a que termine el despliegue (Deployments) y revise los logs |
| La página carga sin estilos o sin gráficas | Recargue con Ctrl+F5 |
| Se acabó el crédito de prueba | Use el Plan B (sección 4) o active el plan Hobby |
