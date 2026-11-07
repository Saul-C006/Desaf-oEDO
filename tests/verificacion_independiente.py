"""
TECHFIX - Verificación independiente de los cálculos (Python)
----------------------------------------------------------------
Este programa NO usa el código de la aplicación para calcular. Implementa
de nuevo, en otro lenguaje, la solución analítica, Heun y RK4:

  * Heun y RK4 con aritmética de FRACCIONES EXACTAS (fractions.Fraction):
    sin ningún error de redondeo.
  * La solución analítica con 40 cifras decimales (decimal.Decimal).

Luego pide a Node.js los resultados de la aplicación y compara.
Si la diferencia máxima es del orden de 1e-13 (redondeo normal de la
computadora), la implementación de la aplicación es correcta.

Uso (desde la carpeta del proyecto):   python tests/verificacion_independiente.py
Requiere: Python 3.8+ y Node.js. No requiere MySQL.
"""
import json
import subprocess
import sys
from decimal import Decimal, getcontext
from fractions import Fraction

getcontext().prec = 40

C0, M, K, T0, TF = Fraction(10), Fraction(100), Fraction(3, 10), Fraction(0), Fraction(12)


def f(t, c):
    """dC/dt = k (M - C)"""
    return K * (M - c)


def heun(c, t, h):
    k1 = f(t, c)
    k2 = f(t + h, c + h * k1)
    return c + h / 2 * (k1 + k2)


def rk4(c, t, h):
    k1 = f(t, c)
    k2 = f(t + h / 2, c + h * k1 / 2)
    k3 = f(t + h / 2, c + h * k2 / 2)
    k4 = f(t + h, c + h * k3)
    return c + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4)


def analitica(t):
    """C(t) = M - (M - C0) e^(-k (t - t0)) con 40 cifras."""
    exponente = -Decimal(K.numerator) / Decimal(K.denominator) * (Decimal(t.numerator) / Decimal(t.denominator))
    return Decimal(M.numerator) - Decimal((M - C0).numerator) * exponente.exp()


def valores_app(h_texto):
    """Resultados de la aplicación (JavaScript) para el mismo h."""
    codigo = (
        "const m=require('./server/numerico/metodos');"
        f"console.log(JSON.stringify(m.simular({{C0:10,M:100,k:0.3,t0:0,tf:12,h:{h_texto}}}).filas))"
    )
    salida = subprocess.run(["node", "-e", codigo], capture_output=True, text=True, check=True)
    return json.loads(salida.stdout)


def verificar(h):
    filas = valores_app(str(float(h)))
    pasos = int((TF - T0) / h)
    assert len(filas) == pasos + 1, "número de filas distinto"
    c_heun = c_rk4 = C0
    max_dif = {"analitica": 0.0, "heun": 0.0, "rk4": 0.0, "ea_heun": 0.0, "ea_rk4": 0.0}
    for n in range(pasos + 1):
        t = T0 + n * h
        if n > 0:
            c_heun = heun(c_heun, t - h, h)
            c_rk4 = rk4(c_rk4, t - h, h)
        exacto = analitica(t)
        app = filas[n]
        ea_heun = abs(exacto - Decimal(c_heun.numerator) / Decimal(c_heun.denominator))
        ea_rk4 = abs(exacto - Decimal(c_rk4.numerator) / Decimal(c_rk4.denominator))
        comparaciones = {
            "analitica": (float(exacto), app["analitico"]),
            "heun": (float(c_heun), app["heun"]),
            "rk4": (float(c_rk4), app["rk4"]),
            "ea_heun": (float(ea_heun), app["errorAbsHeun"]),
            "ea_rk4": (float(ea_rk4), app["errorAbsRK4"]),
        }
        for clave, (referencia, valor) in comparaciones.items():
            max_dif[clave] = max(max_dif[clave], abs(referencia - valor))
    return float(c_heun), float(c_rk4), float(analitica(TF)), max_dif


def main():
    print("Verificación independiente (Python, fracciones exactas) vs aplicación (JavaScript)\n")
    todo_bien = True
    for h in (Fraction(1), Fraction(1, 2), Fraction(1, 4)):
        heun_f, rk4_f, exacto_f, dif = verificar(h)
        print(f"h = {float(h)}:  exacto(12) = {exacto_f:.12f}   Heun(12) = {heun_f:.12f}   RK4(12) = {rk4_f:.12f}")
        for clave, valor in dif.items():
            # Valores ~100 con double: el redondeo normal es ~1e-14. Se acepta hasta 1e-10.
            ok = valor < 1e-10
            todo_bien &= ok
            print(f"    diferencia máxima en {clave:<10}: {valor:.2e}  {'OK' if ok else 'ERROR'}")
        print()
    print("RESULTADO:", "la aplicación coincide con la verificación independiente." if todo_bien else "HAY DIFERENCIAS.")
    sys.exit(0 if todo_bien else 1)


if __name__ == "__main__":
    main()
