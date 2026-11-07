/**
 * Extrae el texto de un PDF generado por PDFKit (solo para pruebas).
 * PDFKit comprime cada página (FlateDecode) y escribe el texto como cadenas
 * hexadecimales <...> con la codificación WinAnsi de las fuentes estándar.
 */
'use strict';
const zlib = require('node:zlib');

function textoDePdf(buffer) {
  const binario = buffer.toString('latin1');
  const partes = [];
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(binario))) {
    const inicio = m.index + m[0].length;
    const fin = binario.indexOf('endstream', inicio);
    if (fin < 0) break;
    try {
      const contenido = zlib.inflateSync(Buffer.from(binario.slice(inicio, fin), 'latin1')).toString('latin1');
      // Cada instrucción de texto: [<hex> ajuste <hex> ...] TJ
      const lineas = contenido.match(/\[([^\]]*)\]\s*TJ/g) || [];
      for (const l of lineas) {
        const hex = l.match(/<([0-9a-fA-F]*)>/g) || [];
        partes.push(hex.map((h) => Buffer.from(h.slice(1, -1), 'hex').toString('latin1')).join(''));
      }
    } catch (e) {
      /* stream no comprimido o de imagen: se ignora */
    }
  }
  return partes.join('\n');
}

module.exports = { textoDePdf };
