# TECHFIX — Guion literal del video (≈ 1 minuto)

Orden pedido por el docente: problema → EDO y condición inicial → solución analítica, Heun y RK4 →
mostrar la aplicación → resultados y conclusiones. Unas 155 palabras ≈ 60 segundos.

## Antes de grabar (2 minutos)

1. Abra **https://desaf-oedo-production.up.railway.app** y presione **Ctrl + F5**.
   Espere a que abajo a la izquierda diga **"Servidor y base de datos conectados"**.
2. **Configuración** → **Restaurar valores del proyecto** → **Ejecutar y guardar simulación** (h = 1).
3. **Comparación de h** → **Ejecutar comparación h = 1 y h = 0.5**.
4. Vuelva a **Inicio** (arriba del todo).
5. Cierre otras pestañas y silencie notificaciones. Zoom del navegador al 90 % (Ctrl + −) para que entre más contenido.
6. Grabar en Windows: **Win + Alt + R** (Xbox Game Bar) graba la ventana activa; con **Win + G** active el micrófono.

## Guion

| # | Tiempo | Pantalla y acción | Texto literal (en voz alta) |
|---|---|---|---|
| 1 | 0:00–0:08 | **Inicio** (parte de arriba, se ve TECHFIX) | "Soy *[nombre y apellido]*. Mi proyecto, TECHFIX, estima cuántos clientes tendrá un pequeño taller de reparación de celulares y computadoras en su primer año, para ayudarle a planificar." |
| 2 | 0:08–0:20 | Clic en **Modelo matemático** → se ve el punto **2. Formulación** | "Uso la ecuación diferencial de crecimiento limitado: de C sobre de t igual a k por, M menos C. Los clientes crecen según los que faltan por captar. La condición inicial es C de cero igual a 10 clientes, con un mercado de 100 y k igual a 0.3 por mes, valores hipotéticos." |
| 3 | 0:20–0:28 | Bajar al punto **4. Solución analítica** (señalar la fórmula final) | "Separando variables obtengo la solución analítica exacta: C de t igual a 100 menos 90 por e elevado a menos 0.3 t. La verifiqué por sustitución y la uso como referencia." |
| 4 | 0:28–0:36 | Bajar a **6. Heun** y **7. RK4** | "Para aproximarla, Heun promedia dos pendientes en cada paso, y Runge-Kutta 4 combina cuatro pendientes, por eso es más preciso." |
| 5 | 0:36–0:46 | Clic en **Configuración** → **Ejecutar y guardar simulación** → aparece **Simulación** (tarjetas y tabla) → clic en **Gráficas** | "En la aplicación ingreso los parámetros y el paso h. Calcula los tres métodos, los guarda en MySQL y muestra la tabla con los errores y las gráficas." |
| 6 | 0:46–0:56 | Clic en **Comparación de h** (se ven ÷ 4.59 y ÷ 18.14) | "A los 12 meses, el valor exacto es 97.54 clientes; RK4 da 97.54 y Heun 97.37. Al reducir h de 1 a 0.5, el error de Heun baja 4.6 veces y el de RK4, 18 veces." |
| 7 | 0:56–1:03 | Clic en **Interpretación** (se ve "Respuesta a la pregunta del desafío") | "En conclusión, la cartera crece rápido y se estabiliza cerca de 100 clientes, y RK4 es el método más preciso. Gracias." |

## Consejos

- Ensaye 2 veces leyendo en voz alta con un cronómetro.
- Si se pasa de 1 minuto, quite la segunda oración del bloque 2 ("Los clientes crecen según los que faltan por captar").
- Mueva el mouse despacio y señale con el cursor lo que está diciendo (la fórmula, el valor 97.54, el ÷ 4.59).
- Que se vea el enlace público en la barra del navegador.
