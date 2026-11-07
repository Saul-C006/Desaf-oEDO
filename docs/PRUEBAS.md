# TECHFIX — Informe de pruebas (Etapa 6)

Fecha de ejecución: 7 de noviembre de 2026.
Todas las cifras de este documento salen de ejecutar las pruebas; ninguna se escribió a mano.

## 1. Resumen

| Tipo de prueba | Cantidad | Resultado | Comando |
|---|---|---|---|
| Métodos numéricos (analítica, Heun, RK4, errores) | 20 | ✅ 20/20 | `npm test` |
| Casos borde y propiedades matemáticas | 10 | ✅ 10/10 | `npm test` |
| Validación, interpretación y utilidades del PDF | 9 | ✅ 9/9 | `npm test` |
| API + base de datos (guardar, historial, PDF, seguridad) | 21 | ✅ 21/21 | `npm test` / `npm run test:api` |
| **Total automáticas** | **60** | ✅ **60/60** | |
| Verificación independiente en Python (fracciones exactas) | 15 comparaciones | ✅ todas | `npm run verificar` |
| Navegador real (Chromium), 3 tamaños de pantalla | 14 pasos | ✅ 14/14 | `npm run test:e2e` |
| Restricciones de la base de datos (inserciones inválidas) | 9 | ✅ 9 rechazadas | `pruebas_restricciones.sql` |

**Bases de datos probadas:** MySQL 8.0.46 y MariaDB 10.11 (la que trae XAMPP es compatible). Resultado idéntico en ambas.

---

## 2. Resultados matemáticos

### 2.1 Solución analítica
| Verificación | Resultado |
|---|---|
| C(0) = 10 (condición inicial) | ✅ exacto |
| C(t) = 100 − 90e^(−0.3t) en t = 0, 1, 2.5, 6, 12 | ✅ diferencia < 10⁻¹² |
| Sustitución en la EDO: derivada numérica de C(t) vs k(M − C) | ✅ diferencia < 10⁻⁶ |
| Creciente y siempre menor que M (t de 0 a 60) | ✅ |
| Con t₀ ≠ 0: C(t₀) = C₀ | ✅ |

### 2.2 Heun y RK4
| Verificación | Resultado |
|---|---|
| Primer paso de Heun a mano (h = 1): k1 = 27, k2 = 18.9, C1 = 32.95 | ✅ |
| Primer paso de RK4 a mano: 27; 22.95; 23.5575; 19.93275; C1 = 33.324625 | ✅ |
| Todas las iteraciones vs fórmula cerrada (h = 1, 0.5, 0.25) | ✅ diferencia < 10⁻⁹ |
| RK4 tiene menor error que Heun en **todas** las iteraciones (h = 1 y 0.5) | ✅ |
| 200 combinaciones aleatorias de parámetros (k·h ≤ 1): ambos métodos no decrecen, no superan M y RK4 es más preciso | ✅ |

### 2.3 Verificación independiente (otro lenguaje, sin redondeo)

`tests/verificacion_independiente.py` vuelve a programar los tres métodos en **Python**. Usa:
- **fracciones exactas** para Heun y RK4, es decir, ningún error de redondeo;
- **40 cifras** para la solución analítica.

Después compara con la aplicación:

| h | Exacto C(12) | Heun C(12) | RK4 C(12) | Mayor diferencia con la app |
|---|---|---|---|---|
| 1 | 97.540864979744 | 97.369018572055 | 97.540096900902 | 1.4 × 10⁻¹⁴ |
| 0.5 | 97.540864979744 | 97.503427701139 | 97.540822649069 | 1.7 × 10⁻¹⁴ |
| 0.25 | 97.540864979744 | 97.532068878124 | 97.540862494801 | 3.7 × 10⁻¹⁴ |

Diferencias del orden de 10⁻¹⁴ son el redondeo normal de la computadora: un número de 64 bits guarda unas 16 cifras.
**Conclusión: la implementación de la aplicación es matemáticamente correcta.**

## 3. Errores

| Verificación | Resultado |
|---|---|
| Ea = \|exacto − aprox.\| y Er = Ea/\|exacto\|·100 (ej. exacto 50, aprox. 49 → Ea = 1, Er = 2 %) | ✅ |
| Exacto = 0 (C₀ = 0 en t₀): Er = "No definido", sin división entre cero | ✅ en cálculo, MySQL (NULL), pantalla y PDF |
| Errores de RK4 muy pequeños (≈ 10⁻⁵) se guardan sin perder cifras (DOUBLE) | ✅ idénticos bit a bit al leerlos |
| Con M = 1 000 000 el error relativo de RK4 sigue siendo < 0.001 % | ✅ |

## 4. Tamaños de paso

| Verificación | Resultado |
|---|---|
| Experimento 1 (h = 1): 12 pasos; Heun(12) = 97.369019; RK4(12) = 97.540097 | ✅ |
| Experimento 2 (h = 0.5): 24 pasos; Heun(12) = 97.503428; RK4(12) = 97.540823 | ✅ |
| De h = 1 a h = 0.5: error final de Heun ÷ 4.59 y de RK4 ÷ 18.14 | ✅ |
| Orden de convergencia con k = 0.1, 0.3 y 0.8 (h = 0.2 → 0.1): Heun ≈ 4 y RK4 ≈ 16 | ✅ |
| h que no divide el intervalo (h = 0.7): último paso acortado y aviso | ✅ |
| h mayor que el intervalo (h = 20): un solo paso hasta t<sub>f</sub> | ✅ |
| t₀ negativo (−3 a 9): mismos valores que de 0 a 12 | ✅ |
| k·h > 2 (h = 5, k = 0.5): Heun da valores negativos → aviso de inestabilidad y conclusión que lo advierte | ✅ |
| Más de 1000 pasos: rechazado | ✅ |

## 5. Guardado en MySQL

| Verificación | Resultado |
|---|---|
| Lo que se guarda es **idéntico** a lo calculado (comparación bit a bit) | ✅ |
| Transacción: una falla simulada a mitad del guardado no deja la simulación a medias | ✅ conteos iguales antes y después |
| 1000 pasos se calculan y guardan en menos de 3 s | ✅ |
| Comparación h = 1 y h = 0.5 guarda 2 simulaciones con los mismos C₀, M, k, t₀, t<sub>f</sub> | ✅ |
| Eliminar una simulación borra en cascada sus resultados e informes | ✅ |
| Eliminar todos los experimentos de una comparación elimina la comparación | ✅ |
| Restricciones CHECK, claves foráneas, UNIQUE y NOT NULL rechazan 9 inserciones inválidas | ✅ |
| **Persistencia:** se reinicia el servidor y la simulación se recupera desde MySQL | ✅ |

## 6. Historial

| Verificación | Resultado |
|---|---|
| Lista con parámetros, fecha, resultado final, errores máximos y número de informes | ✅ |
| Abrir una simulación carga su tabla, gráficas e interpretación | ✅ |
| Eliminar pide confirmación: **Cancelar** conserva y **Eliminar** borra | ✅ |
| Las simulaciones de una comparación muestran la etiqueta "Comparación N.º" | ✅ |

## 7. Informes PDF

| Verificación | Resultado |
|---|---|
| El informe queda registrado en la tabla `informes` y asociado a su simulación | ✅ |
| El PDF se descarga (HTTP 200, `application/pdf`) | ✅ |
| Contiene las **18 secciones** pedidas (se lee el texto dentro del PDF) | ✅ |
| Contiene los valores reales: 97.540865, 97.369019, 97.540097, 32.950000, 33.324625 | ✅ |
| La conclusión del PDF es la misma guardada en MySQL | ✅ |
| El informe de un experimento usa la comparación **guardada** (÷ 4.59 y ÷ 18.14) | ✅ |
| Con C₀ = 0 muestra "No definido" | ✅ |
| 1000 pasos: tabla con filas espaciadas y aviso (7 páginas, < 100 ms) | ✅ |

## 8. Validaciones

En el navegador **y** en el servidor (mismo archivo `shared/validacion.js`):

| Entrada | Mensaje | Resultado |
|---|---|---|
| Campo vacío | "Este campo es obligatorio." | ✅ |
| `abc`, `12abc`, `1.2.3`, `Infinity` | "Debe ser un número válido." | ✅ |
| `0,3` (coma decimal) | Se acepta como 0.3 | ✅ |
| C₀ = −1 | "C0 debe ser mayor o igual a cero." | ✅ |
| M ≤ C₀ | "M debe ser mayor que C0." | ✅ |
| k ≤ 0 | "k debe ser mayor que cero." | ✅ |
| h ≤ 0 | "h debe ser mayor que cero." | ✅ |
| t<sub>f</sub> ≤ t₀ | "El tiempo final debe ser mayor que el tiempo inicial." | ✅ |
| h = 0.001 (12 000 pasos) | "...el máximo es 1000. Use un h mayor." | ✅ |
| JSON mal formado enviado a la API | Error 400 | ✅ |
| Identificador `abc` o `-3` | Error 400; inexistente → 404 | ✅ |

## 9. Seguridad

| Verificación | Resultado |
|---|---|
| Inyección SQL en el nombre (`x'); DROP TABLE simulaciones; --`) se guarda como texto; la tabla sigue existiendo | ✅ |
| Código HTML en el nombre (`<img src=x onerror=...>`) se muestra como texto y **no se ejecuta** | ✅ |
| `.env` no está en el repositorio (`.gitignore`) | ✅ |
| El navegador nunca recibe credenciales: solo usa `/api/...` | ✅ |

## 10. Funcionamiento en diferentes dispositivos

Prueba automática en Chromium (`npm run test:e2e`) que recorre las **8 secciones** en cada tamaño:

| Dispositivo | Ancho | Sin desplazamiento horizontal | Menú |
|---|---|---|---|
| Computadora | 1366 px | ✅ 8/8 secciones | Lateral fijo |
| Tablet | 768 px | ✅ 8/8 secciones | Botón ☰ |
| Celular | 390 px | ✅ 8/8 secciones | Botón ☰ |

Consola del navegador: **sin errores**.

> La prueba automática usa Chromium (el motor de Chrome y Edge). Se recomienda abrir también el enlace
> publicado desde un celular real y desde otro navegador (Firefox o Safari) antes de la defensa (Etapa 7).

## 11. Hallazgos durante las pruebas

| Hallazgo | Explicación | Acción |
|---|---|---|
| En 1 de los 200 casos aleatorios, RK4 dio **exactamente** M en el mes 40 | La distancia real a M era ≈ 10⁻¹³ clientes, menor que la precisión de un número de 64 bits (≈ 16 cifras). No es un error del método: es el **límite de precisión** de la computadora | Se documentó en la prueba; se exige "no supera M" (≤) |
| Con k·h = 2.5, Heun da clientes negativos | Heun solo es estable si k·h < 2 (su factor 1 − kh + (kh)²/2 supera 1) | Ya corregido en la Etapa 4: aviso + conclusión que lo advierte |
| En los párrafos justificados del PDF no hay espacios en el texto interno | PDFKit separa las palabras con ajustes de posición; visualmente se ven bien | Solo afecta a la prueba, que compara sin espacios |

## 12. Cómo repetir las pruebas

```bash
npm test                         # 60 pruebas (las 21 de API necesitan MySQL; si no hay, se omiten)
npm run verificar                # verificación independiente (necesita Python 3)
#   en Windows, si "python" no existe:  py tests/verificacion_independiente.py
npm install --no-save playwright # solo la primera vez, para la prueba en navegador
npx playwright install chromium
npm run test:e2e                 # 14 pasos en navegador (necesita MySQL)
```
