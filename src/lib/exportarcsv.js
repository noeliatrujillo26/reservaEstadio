// ═══════════════════════════════════════════════════════════════════
// exportarcsv.js — utilidad UNICA de exportacion E IMPORTACION de CSV de
// todo el panel. Sin equivalente en la v1 (sus exports a Excel salian de un
// boton por modulo, cada uno con su propio armado). Cualquier pantalla que
// necesite "Exportar a Excel" o "Importar CSV" pasa por aqui: un solo
// criterio de formato, no uno ligeramente distinto por cada componente.
//
// FORMATO de exportacion, pensado para Excel en español (Windows) — el mismo
// publico que exportarReporteExcel() de la v1 servia:
//   · BOM UTF-8 (el caracter U+FEFF) al inicio: sin el, Excel abre el
//     archivo como ANSI y los acentos y la ñ salen rotos.
//   · separador ; en vez de , — la configuracion regional en español de
//     Excel usa la COMA como separador decimal, asi que un monto con
//     centavos ("1500,50") partiria la fila en dos columnas si el separador
//     de campos tambien fuera la coma.
//   · TODA celda entre comillas dobles, no solo las que traen caracteres
//     especiales — para que cada valor caiga en su propia columna sin
//     ambiguedad y sin que Excel reinterprete nada (telefonos o folios con
//     ceros a la izquierda, por ejemplo).
// ═══════════════════════════════════════════════════════════════════

const bom_utf8 = '﻿'
const separador_csv = ';'

// Escapa una celda: las comillas internas se DUPLICAN (regla del formato
// CSV) y el resultado SIEMPRE queda entre comillas dobles.
export function celda_csv(v) {
  const s = String(v == null ? '' : v)
  return '"' + s.replace(/"/g, '""') + '"'
}

export function fila_csv(valores) {
  return (valores || []).map(celda_csv).join(separador_csv)
}

// encabezados: nombres de columna. filas: arreglo de arreglos, mismo orden
// que encabezados.
export function csv_texto(encabezados, filas) {
  return bom_utf8 + [encabezados, ...(filas || [])].map(fila_csv).join('\r\n')
}

// Igual que csv_texto, pero a partir de FILAS-OBJETO: `columnas` es
// [{ clave, titulo }, …] — la llave que se lee de cada fila y el titulo que
// se imprime en el encabezado. Evita que cada modulo repita el mismo
// "mapear objeto a arreglo en el orden de las columnas".
export function csv_de_filas(columnas, filas) {
  const encabezados = columnas.map((c) => c.titulo)
  const valores = (filas || []).map((f) => columnas.map((c) => f[c.clave]))
  return csv_texto(encabezados, valores)
}

// Variante "CSV" simple, para quien vaya a abrirlo con otra herramienta que
// no sea Excel en español: coma como separador y sin BOM (RFC4180 liso). Las
// celdas se siguen citando siempre, por la misma razon que csv_texto.
export function csv_de_filas_simple(columnas, filas) {
  const fila = (valores) => (valores || []).map(celda_csv).join(',')
  const encabezados = columnas.map((c) => c.titulo)
  const valores = (filas || []).map((f) => columnas.map((c) => f[c.clave]))
  return [encabezados, ...valores].map(fila).join('\r\n')
}

// ── importar ────────────────────────────────────────────────────
// Lee un CSV de vuelta a filas-arreglo. Tolera el formato que produce
// csv_texto (BOM, celdas entre comillas dobles con "" como escape, ;) Y un
// csv "simple" guardado a mano (sin comillas, separado por , o ;) — quien
// sube el archivo probablemente lo edito en Excel, que puede resguardarlo en
// cualquiera de los dos.
export function parsear_csv(texto) {
  let s = String(texto == null ? '' : texto)
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1) // BOM
  if (!s.trim()) return []

  const primeralinea = s.split(/\r?\n/, 1)[0] || ''
  const sep = primeralinea.includes(';') ? ';' : ','

  const filas = []
  let fila = []
  let celda = ''
  let entrecomillas = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (entrecomillas) {
      if (c === '"') {
        if (s[i + 1] === '"') { celda += '"'; i++ } else entrecomillas = false
      } else {
        celda += c
      }
    } else if (c === '"') {
      entrecomillas = true
    } else if (c === sep) {
      fila.push(celda); celda = ''
    } else if (c === '\r') {
      // se ignora: el \n que sigue cierra la fila
    } else if (c === '\n') {
      fila.push(celda); filas.push(fila); fila = []; celda = ''
    } else {
      celda += c
    }
  }
  if (celda !== '' || fila.length) { fila.push(celda); filas.push(fila) }

  // filas totalmente vacias (renglones en blanco al final del archivo) no cuentan.
  return filas.filter((f) => f.some((c) => String(c || '').trim() !== ''))
}

// Dispara la descarga de un archivo de texto — el UNICO lugar del panel que
// toca el DOM para esto (Blob + <a download>). Vive junto a los builders de
// arriba, no separado, para que cada modulo importe UNA sola cosa; mismo
// criterio que abrir_recibo_cobro() en lib/recibo.js, que abre una ventana
// junto al armado del HTML del recibo.
export function descargar_csv(nombre, contenido) {
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
