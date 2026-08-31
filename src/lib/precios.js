// ═══════════════════════════════════════════════════════════════════
// precios.js — calculo de tarifas de zona.
// espejo 1:1 de v1: _buscarPrecioCfg(), _loadExtras(), _minZona(),
// _precioZona(), _desgloseTotalZona() y _topeAdultosZona().
//
// TODO el dinero que ve el cliente sale de aqui: la tarjeta de detalle y el
// checkout usan el MISMO desglose, asi que lo que se muestra es exactamente
// lo que se cobra.
// ═══════════════════════════════════════════════════════════════════

import { redondear_dinero } from './dinero'
import { es_jue_sab } from './fechas'

// mismo algoritmo de 3 niveles que precioDeZona() del admin:
// exacto → rango numerico → prefijo de palabras.
export function buscar_precio_cfg(nombre, cfg) {
  if (!nombre) return null
  const n = nombre.toUpperCase().trim()
  const keys = Object.keys(cfg)
  if (cfg[n]) return cfg[n]

  const m = n.match(/^(.*?)(\d+)\s*$/)
  if (m) {
    const prefijo = m[1].trim()
    const numero = parseInt(m[2])
    const k = keys.find((key) => {
      if (!key.startsWith(prefijo)) return false
      const rango = key.slice(prefijo.length).match(/(\d+)\s*-\s*(\d+)/)
      if (rango) return numero >= parseInt(rango[1]) && numero <= parseInt(rango[2])
      const uno = key.slice(prefijo.length).match(/(\d+)/)
      return uno ? parseInt(uno[1]) === numero : false
    })
    if (k) return cfg[k]
  }

  const palabras = n.split(/\s+/)
  for (let take = Math.min(2, palabras.length); take >= 1; take--) {
    const base = palabras.slice(0, take).join(' ')
    const k = keys.find(
      (key) => key.includes(base) || base.includes(key.split(/\s+/).slice(0, take).join(' '))
    )
    if (k) return cfg[k]
  }
  return null
}

// espejo de _loadExtras(). la v1 mutaba la zona; aqui se devuelve una copia
// enriquecida para no tocar el estado de react.
//
// solo RELLENA huecos: la fuente de verdad de tarifas es supabase (r=mapa).
// el cache local del admin ya no pisa los valores frescos de la base — solo
// cubre zonas a las que la base no da tarifa.
export function con_extras(z) {
  if (!z) return z
  const out = { ...z }
  try {
    const cfg = JSON.parse(localStorage.getItem('nrj_precios_config') || '{}')
    // primero por id unico del pin (soporta zonas con nombre duplicado); el
    // match por nombre queda como respaldo para configuraciones viejas.
    const entry = (z._id && cfg['ID:' + z._id]) || buscar_precio_cfg(z.nombre, cfg)
    if (entry) {
      if (z.precioExtra == null && entry.extra != null) out._precioExtra = entry.extra
      if (z.precioNino == null && entry.nino != null) out._precioNino = entry.nino
      if (z.precioExtra2 == null && entry.extra2 != null) out._precioExtra2 = entry.extra2
      if (z.precioNino2 == null && entry.nino2 != null) out._precioNino2 = entry.nino2
      if (!(z.precioPP > 0) && entry.precio != null) out._precioPP = entry.precio
      if (z.precio2 == null && entry.precio2 != null) out._precioPP2 = entry.precio2
    }
  } catch (e) {}
  return out
}

// PERSONAS INCLUIDAS en el precio base, segun el bloque de dia del juego.
// Administrar Precios guarda dos minimos por zona (min_personas y
// min_personas2), pero todo el calculo leia siempre el primero: el minimo de
// JUE-SAB se capturaba y no surtia efecto. sin minimo JUE-SAB configurado se
// hereda el de DOM-MIE, igual que precio2/extra2/nino2.
export function min_zona(z, fechajuego) {
  if (!z) return 1
  const min_js = Number(z.min2)
  if (es_jue_sab(fechajuego) && z.min2 != null && min_js > 0) return min_js
  return Number(z.min) || 1
}

// tarifa base segun el dia del juego. prioridad: supabase (precio/precio2 de
// mapa_secciones) → respaldo local → tarifa DOM-MIE.
// si una zona no tiene tarifa JUE-SAB se cobra la misma que DOM-MIE: el
// fallback anterior sumaba $7 (o $10) sueltos a la base y producia totales
// rotos como $8,007 en lugar de $8,000.
export function precio_zona(z, fechajuego) {
  const dom_mie = z.precioPP > 0 ? z.precioPP : z._precioPP > 0 ? z._precioPP : 0
  if (!es_jue_sab(fechajuego)) return dom_mie
  if (z.precio2 != null && z.precio2 > 0) return z.precio2
  if (z._precioPP2 != null && z._precioPP2 > 0) return z._precioPP2
  return dom_mie
}

// Desglose UNICO del total (la tarjeta de detalle Y el checkout usan esto).
// El precio base incluye `min` personas: los adultos consumen primero esos
// lugares y, si quedan libres, absorben ninos. Solo el excedente se cobra.
export function desglose_total_zona(z, fechajuego, adultos, ninos) {
  const pp = precio_zona(z, fechajuego)
  // Los extras salen del MISMO bloque de tarifa que el precio base: un juego
  // JUE-SAB cobra extra2/nino2, no los de DOM-MIE. Sin tarifa 2 configurada
  // se cae a la DOM-MIE — nunca se inventan montos.
  const jue_sab = es_jue_sab(fechajuego)
  const extra_dom = z.precioExtra != null ? z.precioExtra : z._precioExtra != null ? z._precioExtra : null
  const nino_dom = z.precioNino != null ? z.precioNino : z._precioNino != null ? z._precioNino : null
  const extra_js = z.precioExtra2 != null ? z.precioExtra2 : z._precioExtra2 != null ? z._precioExtra2 : null
  const nino_js = z.precioNino2 != null ? z.precioNino2 : z._precioNino2 != null ? z._precioNino2 : null

  const extra = jue_sab && extra_js != null && extra_js > 0 ? extra_js : extra_dom != null ? extra_dom : pp
  const nino = jue_sab && nino_js != null && nino_js > 0 ? nino_js : nino_dom != null ? nino_dom : 0

  const min = min_zona(z, fechajuego)
  const ext_adultos_cant = Math.max(0, adultos - min)
  const ninos_incluidos = Math.max(0, min - adultos)
  const ninos_extra_cant = Math.max(0, ninos - ninos_incluidos)

  // Al CENTAVO: tiene que dar exactamente lo mismo que precioZonaServidor()
  // en api/checkout.js, o el servidor rechaza el checkout con 400.
  const total = redondear_dinero(pp + ext_adultos_cant * extra + ninos_extra_cant * nino)

  return { pp, extra, nino, min, adultos, ext_adultos_cant, ninos_incluidos, ninos_extra_cant, total }
}

// Tope del stepper de ADULTOS. Regla de negocio: los adultos SIEMPRE pueden
// exceder la base incluida (el excedente se cobra como extra). Si la zona
// trae Cap. max. mal capturada (vacia o <= minimo, como cap=15 con base=15),
// el stepper NO se bloquea en la base — antes eso descartaba en silencio a
// los adultos extra: el cliente pedia 20 y solo se guardaban 15.
export function tope_adultos_zona(z, fechajuego) {
  const min = min_zona(z, fechajuego)
  const cap = Number(z.cap) || 0
  return cap > min ? cap : min + 20
}
