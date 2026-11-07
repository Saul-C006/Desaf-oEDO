# TECHFIX — Documento académico: modelo matemático y métodos numéricos

> **Parámetros hipotéticos.** Los valores C0 = 10, M = 100 y k = 0.3 son supuestos didácticos,
> no datos medidos de un negocio real. Los resultados son una **estimación matemática**, no una
> predicción comprobada.
>
> Todos los números de este documento salen del código (`npm run tabla`) y están comprobados por
> las pruebas automáticas (`npm test`). Ninguno se escribió a mano.

---

## 0. Planteamiento del desafío

**Nombre del desafío:** TECHFIX: estimación del crecimiento de clientes de un emprendimiento de soporte técnico mediante ecuaciones diferenciales y métodos numéricos.

**Planteamiento del problema.** TechFix es un emprendimiento de reparación y mantenimiento de celulares y computadoras.
Comienza con pocos clientes y consigue nuevos gracias a la publicidad, las recomendaciones y la calidad del servicio.
El emprendedor no sabe cómo podría evolucionar su cartera de clientes en los primeros meses, información que necesita
para planificar horarios, compra de repuestos y publicidad.

**Contexto y beneficiarios.** Emprendedores tecnológicos, técnicos independientes, pequeños negocios de reparación
y personas que desean iniciar un emprendimiento tecnológico. Una estimación del crecimiento ayuda a planificar
y a reducir el riesgo de cierre en los primeros meses.

**Pregunta de investigación.** ¿Cómo puede estimarse el crecimiento de clientes de un emprendimiento de soporte técnico
durante sus primeros meses de funcionamiento y qué tan precisos son los métodos de Heun y Runge-Kutta de cuarto orden?

**Objetivo general.** Modelar el crecimiento de la cartera de clientes de TechFix con una EDO de primer orden y comparar
la precisión de los métodos de Heun y RK4 frente a la solución analítica, mediante una aplicación web.

**Objetivos específicos.**
1. Formular y justificar la EDO de crecimiento limitado dC/dt = k(M − C) con su condición inicial.
2. Obtener la solución analítica y verificarla por sustitución.
3. Implementar los métodos de Heun (RK2) y RK4 con los mismos parámetros, condición inicial e intervalo.
4. Calcular errores absolutos y relativos porcentuales y comparar los tamaños de paso h = 1 y h = 0.5.
5. Desarrollar y publicar una aplicación web con MySQL que muestre tablas, gráficas, interpretación e informes PDF.

**Meta cuantificable.** Estimar los clientes al mes 12 y el mes en que se alcanza el 50 % y el 90 % del mercado;
determinar qué método tiene menor error y cuántas veces disminuye el error al reducir h a la mitad.

---

## 1. Variables y parámetros

| Símbolo | Significado | Unidad | Valor (hipotético) |
|---|---|---|---|
| t | Tiempo desde la apertura (variable independiente) | meses | 0 a 12 |
| C(t) | Clientes acumulados estimados (variable dependiente) | clientes | — |
| C0 | Clientes al inicio, C(t0) | clientes | 10 |
| M | Mercado potencial: máximo de clientes que podría alcanzar | clientes | 100 |
| k | Tasa de crecimiento: rapidez con que se capta el mercado restante | 1/mes | 0.3 |
| h | Tamaño de paso de los métodos numéricos | meses | 1 y 0.5 |
| dC/dt | Velocidad de captación de clientes | clientes/mes | — |

**¿Por qué C puede ser decimal?** El modelo describe una evolución continua y promedio.
32.95 clientes significa "alrededor de 33 clientes", no 32 personas y "media persona".

---

## 2. Formulación de la EDO: ¿de dónde sale dC/dt = k(M − C)?

Razonamiento paso a paso:

1. **¿Cuántas personas aún no son clientes?** Si el mercado total es M y ya hay C clientes,
   quedan **M − C** clientes potenciales por captar.
2. **Supuesto clave:** cada mes, TechFix capta una fracción aproximadamente fija de esas personas
   que faltan (por publicidad, recomendaciones y calidad del servicio). Esa fracción es **k**.
3. Entonces, la velocidad de crecimiento es proporcional a lo que falta:

$$\frac{dC}{dt} = k\,(M - C), \qquad C(t_0) = C_0$$

Con los valores del proyecto: **dC/dt = 0.3 (100 − C)**, con **C(0) = 10**.

### Comprobación de unidades
- Lado izquierdo: dC/dt → clientes / mes.
- Lado derecho: k · (M − C) → (1/mes) · (clientes) = clientes / mes. ✔
- En la solución aparece e^(−kt): k·t → (1/mes)·(mes) = sin unidades. ✔ (un exponente siempre debe ser adimensional).

### ¿Por qué representa un crecimiento **limitado**?
- Si C < M, entonces M − C > 0 → **dC/dt > 0**: los clientes aumentan.
- A medida que C se acerca a M, la diferencia M − C se hace pequeña → **el crecimiento se frena**.
- Si C = M, dC/dt = 0 → ya no hay a quién captar (**equilibrio**).
- La segunda derivada es d²C/dt² = −k·dC/dt < 0: la curva es **cóncava**, crece cada vez más despacio.

Ejemplo con los valores del proyecto:
- Al inicio: dC/dt = 0.3·(100 − 10) = **27 clientes/mes**.
- Con 90 clientes: dC/dt = 0.3·(100 − 90) = **3 clientes/mes**.

### Significado práctico de k = 0.3 / mes
- Cada mes se capta aproximadamente el 30 % de los clientes potenciales que faltan
  (es una aproximación; en tiempo continuo la fracción exacta en un mes es 1 − e^(−0.3) ≈ 25.9 %).
- La distancia a M se reduce a la mitad cada ln(2)/k ≈ **2.31 meses**.
- Se alcanza el 90 % del mercado (90 clientes) en t = ln(9)/0.3 ≈ **7.32 meses**.

---

## 3. Supuestos del modelo

1. El mercado potencial M es constante durante los 12 meses.
2. La tasa k es constante (no hay campañas nuevas ni temporadas altas/bajas).
3. C(t) es **acumulado**: no se modela la pérdida de clientes.
4. No se modela competencia, precios ni capacidad de atención del taller.
5. C es una variable continua (promedio esperado).
6. Los parámetros son hipotéticos.

---

## 4. Solución analítica paso a paso

Ecuación: dC/dt = k(M − C), con C(t0) = C0. Usamos **separación de variables**.

**Paso 1. Separar** (todo lo de C a la izquierda y todo lo de t a la derecha). Válido mientras C ≠ M:

$$\frac{dC}{M - C} = k\,dt$$

**Paso 2. Integrar ambos lados.** Como ∫ dC/(M − C) = −ln|M − C|:

$$-\ln|M - C| = k\,t + K \quad (K = \text{constante de integración})$$

**Paso 3. Despejar.** Como C0 < M, se cumple C < M, así que |M − C| = M − C:

$$\ln(M - C) = -k\,t - K \;\Rightarrow\; M - C = e^{-K}\,e^{-k t} = A\,e^{-k t}$$

**Paso 4. Usar la condición inicial** C(0) = C0 (con t0 = 0):

$$M - C_0 = A\,e^{0} = A \;\Rightarrow\; A = M - C_0$$

**Paso 5. Solución general del proyecto:**

$$\boxed{C(t) = M - (M - C_0)\,e^{-k t}}$$

Con C0 = 10, M = 100, k = 0.3:

$$\boxed{C(t) = 100 - 90\,e^{-0.3 t}}$$

> Si el tiempo inicial no es 0, la misma deducción da C(t) = M − (M − C0)·e^(−k(t − t0)).
> Así está programado en `solucionAnalitica()`, para que funcione con cualquier t0 que ingrese el usuario.

*Método alternativo (para mencionarlo si el docente pregunta):* la ecuación es lineal,
C' + kC = kM. Con el factor integrante e^(kt): (C·e^(kt))' = kM·e^(kt) → C·e^(kt) = M·e^(kt) + A
→ C = M + A·e^(−kt). Se llega al mismo resultado.

---

## 5. Verificación de la solución

### 5.1 Por sustitución en la EDO
Derivamos C(t) = M − (M − C0)e^(−kt):

$$C'(t) = -(M - C_0)\cdot(-k)\,e^{-kt} = k\,(M - C_0)\,e^{-kt}$$

Calculamos el lado derecho de la EDO:

$$k\,(M - C) = k\,\big(M - M + (M - C_0)e^{-kt}\big) = k\,(M - C_0)\,e^{-kt}$$

Ambos lados son iguales → **la solución satisface la EDO.** ✔

Con números: C'(t) = 27e^(−0.3t) y 0.3(100 − C) = 0.3·90e^(−0.3t) = 27e^(−0.3t). ✔

### 5.2 Condición inicial
C(0) = 100 − 90·e⁰ = 100 − 90 = **10 = C0**. ✔

### 5.3 Comportamiento a largo plazo
Cuando t → ∞, e^(−0.3t) → 0, así que C(t) → 100 = M. Nunca supera M. ✔

### 5.4 Verificación automática (en `tests/metodos.test.js`)
- C(0) = 10 exactamente.
- Se aproxima la derivada de la solución con diferencias centrales y se compara con k(M − C): coinciden con error < 10⁻⁶.
- C(t) es creciente y menor que 100 en todo el intervalo.

---

## 6. Método de Heun (Runge-Kutta de 2.º orden)

### Idea en lenguaje sencillo
1. Mido la pendiente al **inicio** del paso (k1).
2. Con esa pendiente "predigo" dónde estaría al **final** del paso (como Euler).
3. Mido la pendiente en ese punto predicho (k2).
4. Avanzo usando el **promedio** de las dos pendientes (corrección).

Es como estimar la velocidad media de un viaje promediando la velocidad al salir y al llegar.

### Fórmulas (implementadas en `pasoHeun()`)

```
k1    = f(tn, Cn)
k2    = f(tn + h, Cn + h·k1)
Cn+1  = Cn + (h/2)·(k1 + k2)
```

donde f(t, C) = k(M − C) = 0.3(100 − C).

### Primer paso a mano (h = 1, t0 = 0, C0 = 10)
- k1 = 0.3·(100 − 10) = **27**
- Predicción: C0 + h·k1 = 10 + 27 = 37
- k2 = 0.3·(100 − 37) = **18.9**
- C1 = 10 + (1/2)·(27 + 18.9) = 10 + 22.95 = **32.95**
- Exacto: C(1) = 100 − 90e^(−0.3) = **33.326360** → error absoluto 0.376360

### Orden del método
Error local por paso ∼ h³; error global acumulado ∼ **h²**. Si h se divide entre 2, el error debería bajar unas **4 veces**.

---

## 7. Método clásico de Runge-Kutta de 4.º orden (RK4)

### Idea en lenguaje sencillo
En lugar de 2 pendientes, mide **4 pendientes** dentro del paso: una al inicio, dos en la mitad
(la segunda mejorada con la primera) y una al final. Luego hace un **promedio ponderado** 1-2-2-1,
dando más peso a las del centro (parecido a la regla de Simpson).

### Fórmulas (implementadas en `pasoRK4()`)

```
k1    = f(tn,       Cn)
k2    = f(tn + h/2, Cn + h·k1/2)
k3    = f(tn + h/2, Cn + h·k2/2)
k4    = f(tn + h,   Cn + h·k3)
Cn+1  = Cn + (h/6)·(k1 + 2k2 + 2k3 + k4)
```

### Primer paso a mano (h = 1, t0 = 0, C0 = 10)
- k1 = 0.3·(100 − 10) = **27**
- k2 = 0.3·(100 − (10 + 27/2)) = 0.3·(100 − 23.5) = **22.95**
- k3 = 0.3·(100 − (10 + 22.95/2)) = 0.3·(100 − 21.475) = **23.5575**
- k4 = 0.3·(100 − (10 + 23.5575)) = 0.3·66.4425 = **19.93275**
- C1 = 10 + (1/6)·(27 + 2·22.95 + 2·23.5575 + 19.93275) = 10 + 139.94775/6 = **33.324625**
- Exacto: 33.326360 → error absoluto 0.001735 (**217 veces menor** que el de Heun en este paso)

### Orden del método
Error local ∼ h⁵; error global ∼ **h⁴**. Si h se divide entre 2, el error debería bajar unas **16 veces**.

### Diferencia clave entre Heun y RK4

| | Heun (RK2) | RK4 |
|---|---|---|
| Pendientes evaluadas por paso | 2 | 4 |
| Promedio | simple (1/2, 1/2) | ponderado (1, 2, 2, 1)/6 |
| Orden global | 2 | 4 |
| Al dividir h entre 2, el error baja | ~4 veces | ~16 veces |
| Costo por paso | menor | el doble de evaluaciones |

---

## 8. Resultados

### Experimento 1: h = 1 mes (12 pasos)

| n | t (meses) | Analítica | Heun | Ea Heun | Er Heun (%) | RK4 | Ea RK4 | Er RK4 (%) |
|---|---|---|---|---|---|---|---|---|
| 0 | 0.00 | 10.000000 | 10.000000 | 0.000000 | 0.0000 | 10.000000 | 0.000e+0 | 0.000e+0 |
| 1 | 1.00 | 33.326360 | 32.950000 | 0.376360 | 1.1293 | 33.324625 | 1.735e-3 | 5.207e-3 |
| 2 | 2.00 | 50.606953 | 50.047750 | 0.559203 | 1.1050 | 50.604382 | 2.571e-3 | 5.080e-3 |
| 3 | 3.00 | 63.408731 | 62.785574 | 0.623157 | 0.9828 | 63.405874 | 2.857e-3 | 4.505e-3 |
| 4 | 4.00 | 72.892521 | 72.275252 | 0.617268 | 0.8468 | 72.889699 | 2.822e-3 | 3.871e-3 |
| 5 | 5.00 | 79.918286 | 79.345063 | 0.573223 | 0.7173 | 79.915672 | 2.613e-3 | 3.270e-3 |
| 6 | 6.00 | 85.123100 | 84.612072 | 0.511028 | 0.6003 | 85.120777 | 2.323e-3 | 2.729e-3 |
| 7 | 7.00 | 88.978921 | 88.535994 | 0.442928 | 0.4978 | 88.976914 | 2.008e-3 | 2.257e-3 |
| 8 | 8.00 | 91.835384 | 91.459315 | 0.376069 | 0.4095 | 91.833684 | 1.700e-3 | 1.851e-3 |
| 9 | 9.00 | 93.951504 | 93.637190 | 0.314314 | 0.3345 | 93.950087 | 1.417e-3 | 1.508e-3 |
| 10 | 10.00 | 95.519164 | 95.259706 | 0.259457 | 0.2716 | 95.517998 | 1.166e-3 | 1.221e-3 |
| 11 | 11.00 | 96.680515 | 96.468481 | 0.212034 | 0.2193 | 96.679565 | 9.504e-4 | 9.830e-4 |
| 12 | 12.00 | 97.540865 | 97.369019 | 0.171846 | 0.1762 | 97.540097 | 7.681e-4 | 7.874e-4 |

### Experimento 2: h = 0.5 meses (24 pasos) — filas en meses enteros

| n | t (meses) | Analítica | Heun | Ea Heun | Er Heun (%) | RK4 | Ea RK4 | Er RK4 (%) |
|---|---|---|---|---|---|---|---|---|
| 0 | 0.00 | 10.000000 | 10.000000 | 0.000000 | 0.0000 | 10.000000 | 0.000e+0 | 0.000e+0 |
| 2 | 1.00 | 33.326360 | 33.242359 | 0.084001 | 0.2521 | 33.326264 | 9.564e-5 | 2.870e-4 |
| 4 | 2.00 | 50.606953 | 50.482416 | 0.124537 | 0.2461 | 50.606811 | 1.417e-4 | 2.800e-4 |
| 6 | 3.00 | 63.408731 | 63.270255 | 0.138476 | 0.2184 | 63.408573 | 1.575e-4 | 2.483e-4 |
| 8 | 4.00 | 72.892521 | 72.755654 | 0.136867 | 0.1878 | 72.892365 | 1.555e-4 | 2.134e-4 |
| 10 | 5.00 | 79.918286 | 79.791464 | 0.126822 | 0.1587 | 79.918142 | 1.440e-4 | 1.802e-4 |
| 12 | 6.00 | 85.123100 | 85.010287 | 0.112813 | 0.1325 | 85.122972 | 1.280e-4 | 1.504e-4 |
| 14 | 7.00 | 88.978921 | 88.881357 | 0.097565 | 0.1096 | 88.978811 | 1.107e-4 | 1.244e-4 |
| 16 | 8.00 | 91.835384 | 91.752729 | 0.082655 | 0.0900 | 91.835291 | 9.369e-5 | 1.020e-4 |
| 18 | 9.00 | 93.951504 | 93.882574 | 0.068930 | 0.0734 | 93.951426 | 7.809e-5 | 8.311e-5 |
| 20 | 10.00 | 95.519164 | 95.462390 | 0.056774 | 0.0594 | 95.519100 | 6.428e-5 | 6.729e-5 |
| 22 | 11.00 | 96.680515 | 96.634220 | 0.046295 | 0.0479 | 96.680463 | 5.238e-5 | 5.418e-5 |
| 24 | 12.00 | 97.540865 | 97.503428 | 0.037437 | 0.0384 | 97.540823 | 4.233e-5 | 4.340e-5 |

La tabla completa (24 filas) se obtiene con `npm run tabla`.

### Resumen y comparación de tamaños de paso

| h | C exacto(12) | Heun(12) | Ea Heun(12) | Ea máx Heun | RK4(12) | Ea RK4(12) | Ea máx RK4 |
|---|---|---|---|---|---|---|---|
| 1 | 97.540865 | 97.369019 | 0.171846 | 0.623157 | 97.540097 | 7.681e-4 | 2.857e-3 |
| 0.5 | 97.540865 | 97.503428 | 0.037437 | 0.139096 | 97.540823 | 4.233e-5 | 1.581e-4 |

**Reducción del error final al pasar de h = 1 a h = 0.5:** Heun ÷ 4.59 y RK4 ÷ 18.14.

Con pasos aún menores, los factores se acercan a los valores teóricos
(de h = 0.25 a h = 0.125: Heun ÷ 4.12 y RK4 ÷ 16.51). Esto confirma que Heun es de orden 2 y RK4 de orden 4.

---

## 9. Análisis de errores

1. **RK4 es más preciso que Heun en todas las iteraciones** de ambos experimentos (comprobado en las pruebas).
   Con h = 1, el error máximo de RK4 (0.002857 clientes) es unas 218 veces menor que el de Heun (0.623157 clientes).
2. **Reducir h mejora los dos métodos**, pero RK4 mejora mucho más rápido (orden 4 frente a orden 2).
3. **El error de Heun es pequeño en términos prácticos**: como máximo 1.13 % con h = 1 y 0.25 % con h = 0.5.
   Para estimar clientes, ambos métodos son útiles; RK4 es prácticamente igual a la solución exacta.
4. **¿Por qué el error sube al principio y luego baja?** Al principio la curva cambia rápido (27 clientes/mes) y
   los métodos se equivocan más; cuando la curva se aplana cerca de M, cualquier método la sigue con facilidad.
5. **Ambos métodos se quedan por debajo del valor exacto.** Explicación: en este modelo cada paso multiplica
   la distancia a M (M − C) por un factor. El factor exacto con h = 1 es e^(−0.3) = 0.740818;
   el de Heun es 1 − 0.3 + 0.3²/2 = 0.745 y el de RK4 es 0.7408375. Como ambos son un poco mayores que el exacto,
   reducen la distancia a M un poco menos de lo debido, y la estimación queda ligeramente baja.
   Estos factores son los primeros términos de la serie de Taylor de e^(−kh): Heun conserva 3 términos y RK4 conserva 5.
   Las pruebas verifican que los resultados del programa coinciden exactamente con estas fórmulas.

### Verificaciones de que la implementación es correcta
- El primer paso de Heun (32.95) y de RK4 (33.324625) coincide con el cálculo a mano.
- Todas las iteraciones coinciden con las fórmulas cerradas de cada método (error < 10⁻⁹).
- Las tasas de reducción del error coinciden con el orden teórico (≈4 y ≈16).

---

## 10. Decisiones de implementación

| Situación | Decisión |
|---|---|
| Tiempos | t_n = t0 + n·h (no se suma h repetidamente, para no acumular redondeo) |
| h no divide el intervalo | El último paso se acorta para terminar en tf y se muestra un aviso |
| Error relativo con exacto = 0 | Se devuelve `null` → "No definido" (solo pasa si C0 = 0 en t = t0) |
| Pasos excesivos | Máximo 1000 pasos |
| k·h > 1 | Aviso de pérdida de precisión. Con k·h > 2, Heun ya no converge (su factor 1 − kh + (kh)²/2 supera 1) |
| Parámetros | Iguales para los tres procedimientos: se pasan en un único objeto a `simular()` |

---

## 11. Limitaciones del modelo
- No considera la pérdida de clientes, la competencia, la temporada ni el presupuesto de publicidad.
- k y M son constantes e hipotéticos; en la realidad tendrían que estimarse con datos del negocio.
- El resultado es un promedio continuo, no un conteo exacto de personas.
- Sirve para comprender la tendencia (crecimiento rápido al inicio y luego saturación), no para garantizar cifras.

---

## 12. Conclusiones

1. El modelo dC/dt = k(M − C) describe un crecimiento rápido al inicio que se frena al acercarse al mercado potencial:
   con los parámetros hipotéticos, la cartera pasa de 10 a 97.54 clientes en 12 meses; el 50 % del mercado se alcanza
   en el mes 1.96 y el 90 % en el mes 7.32.
2. La solución analítica C(t) = 100 − 90e^(−0.3t) cumple la EDO y la condición inicial, y sirvió como referencia exacta.
3. Ambos métodos reproducen bien la solución, pero **RK4 es mucho más preciso**: con h = 1 su error máximo
   (0.002857 clientes) es unas 218 veces menor que el de Heun (0.623157 clientes).
4. Reducir h de 1 a 0.5 disminuye el error final de Heun 4.59 veces y el de RK4 18.14 veces, de acuerdo con
   sus órdenes teóricos 2 y 4 (≈ 4 y ≈ 16 veces).
5. **Respuesta a la pregunta:** el crecimiento de clientes puede estimarse con una EDO de crecimiento limitado y
   resolverse numéricamente; RK4 da resultados prácticamente iguales a la solución exacta, y Heun, aunque menos
   preciso, mantiene un error relativo menor al 1.13 % con h = 1 y menor al 0.26 % con h = 0.5.

## 13. Bibliografía

- Chapra, S. C., y Canale, R. P. (2015). *Métodos numéricos para ingenieros* (7.ª ed.). McGraw-Hill.
  Capítulo de métodos de Runge-Kutta (Heun y RK4 clásico).
- Burden, R. L., Faires, J. D., y Burden, A. M. (2017). *Análisis numérico* (10.ª ed.). Cengage Learning.
  Métodos de Runge-Kutta y orden de convergencia.
- Zill, D. G. (2015). *Ecuaciones diferenciales con aplicaciones de modelado* (10.ª ed.). Cengage Learning.
  Ecuaciones separables y modelos de crecimiento limitado.

