// ═══════════════════════════════════════════════════════════════════
// leyenda.js — categorias de la leyenda del mapa.
// espejo 1:1 de v1: _categoriaLeyenda() y el arreglo `orden` de
// _renderLeyendaMapa() (panel-inicio.html lineas 3020-3073).
// ═══════════════════════════════════════════════════════════════════

export function categoria_leyenda(nombre) {
  const n = (nombre || '').toLowerCase()
  // "terr" y no "terraza" exacto: tolera capturas como "Terreza Derecha".
  const es_terraza = n.includes('terraza') || n.includes('terreza')
  if (es_terraza && n.includes('izq')) return 'Terraza Izq.'
  if (es_terraza && n.includes('der')) return 'Terraza Der.'
  if (n.includes('platea') && n.includes('izq')) return 'Platea Izq.'
  if (n.includes('platea') && n.includes('der')) return 'Platea Der.'
  if (n.includes('platea')) return 'Platea'
  if (n.includes('palco')) return 'Palco All-Inc.'
  const es_jardin = n.includes('jardín') || n.includes('jardin')
  if (es_jardin && n.includes('central')) return 'Jardín Central'
  if (es_jardin && n.includes('izq')) return 'Jardín Izq.'
  if (es_jardin && n.includes('der')) return 'Jardín Der.'
  if (es_jardin) return 'Jardín'
  if (n.includes('bleacher')) return 'Bleachers'
  // sin categoria conocida: primeras 2 palabras del nombre.
  const palabras = (nombre || '').trim().split(/\s+/).slice(0, 2).join(' ')
  return palabras || null
}

export const orden_leyenda = [
  'Terraza Der.', 'Terraza Izq.', 'Platea', 'Platea Der.', 'Platea Izq.',
  'Palco All-Inc.', 'Jardín Der.', 'Jardín Izq.', 'Jardín Central', 'Jardín', 'Bleachers',
]

// misma sanitizacion del color que hacia la v1 antes de meterlo al style.
export function color_seguro(s) {
  return String(s).replace(/[^#(),.%a-zA-Z0-9 ]/g, '')
}
