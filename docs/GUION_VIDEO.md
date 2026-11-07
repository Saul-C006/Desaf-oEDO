# TECHFIX — Guion del video (≈ 1 minuto)

Unas 150 palabras: a ritmo normal, 55 a 65 segundos. Grabe la pantalla con la aplicación publicada abierta.

| Tiempo | Pantalla | Qué decir |
|---|---|---|
| 0:00–0:10 | **Inicio** | "Soy *[nombre]*. Mi desafío es TECHFIX: estimar cómo crecen los clientes de un emprendimiento de reparación de celulares y computadoras en su primer año, para ayudar a pequeños emprendedores a planificar." |
| 0:10–0:22 | **Modelo matemático** (EDO y solución) | "Uso la EDO de crecimiento limitado dC/dt = k(M − C), con C(0) = 10 clientes, mercado M = 100 y k = 0.3 por mes, valores hipotéticos. Su solución exacta es C(t) = 100 − 90e^(−0.3t), y la verifiqué por sustitución." |
| 0:22–0:34 | **Modelo** (Heun y RK4) → **Configuración** → Ejecutar | "Heun promedia dos pendientes por paso; RK4 combina cuatro con pesos 1-2-2-1. La aplicación calcula los tres métodos con los mismos parámetros y los guarda en MySQL." |
| 0:34–0:46 | **Simulación** y **Gráficas** | "Con h = 1, a los 12 meses el valor exacto es 97.54 clientes; Heun da 97.37 y RK4 97.540. El error máximo de RK4 es unas 218 veces menor que el de Heun." |
| 0:46–0:55 | **Comparación de h** | "Al reducir h de 1 a 0.5, el error de Heun baja 4.6 veces y el de RK4 18 veces, como predicen sus órdenes 2 y 4." |
| 0:55–1:05 | **Interpretación** / Informe PDF | "Conclusión: la cartera crece rápido y se estabiliza cerca de 100 clientes; el 90 % se alcanza hacia el mes 7.3. RK4 es el método más preciso. Gracias." |

**Consejos:**
- Antes de grabar, ejecute una simulación (h = 1) y una comparación para que todo tenga datos.
- Si la página tarda en abrir, espere a que el indicador diga "Servidor y base de datos conectados".
- Muestre el enlace público en la barra del navegador.
