// ═══════════════════════════════════════════════════════════════════
// imagenes.js — fotos de la zona para la galeria del detalle.
// espejo 1:1 de v1: _imagenDeZona() y _imagenesDeZona().
// ═══════════════════════════════════════════════════════════════════

// el servidor MANDA (mapa_secciones via ?r=mapa); el localStorage solo es
// respaldo del primer pintado y de llaves legadas con rangos. `mapa` permite
// resolver la SEGUNDA foto con el mismo algoritmo.
export function imagen_de_zona(nombre, mapa) {
  try {
    const imgs =
      mapa ||
      Object.assign(
        {},
        JSON.parse(localStorage.getItem('nrj_imagenes_precio') || '{}'),
        window._imgsZonasServidor || {}
      )
    const n = (nombre || '').toUpperCase().trim()
    if (imgs[n]) return imgs[n]
    const m = n.match(/^(.*?)(\d+)$/)
    if (!m) return null
    const prefijo = m[1].trim()
    const num = parseInt(m[2])
    for (const key of Object.keys(imgs)) {
      const k = key.toUpperCase().trim()
      if (!k.startsWith(prefijo)) continue
      const rango = k.slice(prefijo.length).match(/(\d+)\s*-\s*(\d+)/)
      if (rango && num >= parseInt(rango[1]) && num <= parseInt(rango[2])) return imgs[key]
      const uno = k.slice(prefijo.length).match(/(\d+)/)
      if (uno && parseInt(uno[1]) === num) return imgs[key]
    }
  } catch (e) {}
  return null
}

// fotos disponibles, en orden y sin repetir: primero las que trae la propia
// zona (respuesta del mapa) y, como respaldo, las resueltas por nombre.
export function imagenes_de_zona(z) {
  if (!z) return []
  const lista = []
  const agregar = (u) => {
    const v = String(u || '').trim()
    if (v && lista.indexOf(v) < 0) lista.push(v)
  }
  agregar(z.img)
  agregar(z.img2)
  if (!lista.length) agregar(imagen_de_zona(z.nombre))
  if (lista.length < 2) agregar(imagen_de_zona(z.nombre, window._imgs2ZonasServidor || {}))
  return lista
}
