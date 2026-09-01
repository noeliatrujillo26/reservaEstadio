// ═══════════════════════════════════════════════════════════════════
// preciosadmin.js — catalogo de tarifas por zona del panel.
// espejo 1:1 de v1: la construccion de preciosData en
// actualizarSelectoresZonas() (js/01-nucleo.js), detectarSeccion()
// (js/modules/utils.js), _cargarMinPrecio() y renderPrecios()
// (js/modules/precios-mapa.js).
//
// El catalogo son las SECCIONES REALES del mapa (mapa_secciones), la misma
// fuente que corregimos en Reservas.
// ═══════════════════════════════════════════════════════════════════

export function detectar_seccion(nombre) {
  const n = String(nombre || '').toUpperCase()
  if (n.includes('TERRAZA')) return 'Terraza'
  if (n.includes('PALCO') || n.includes('ALL-INC') || n.includes('ALL INC')) return 'Palco'
  if (n.includes('PLATEA')) return 'Platea'
  if (n.includes('JARDÍN') || n.includes('JARDIN') || n.includes('GARDEN')) return 'Jardín'
  return 'General'
}

// espejo del push a preciosData. Una fila cruda de mapa_secciones se traduce
// al modelo del catalogo, con el mismo criterio de respaldos de la v1.
export function map_precio(s) {
  const base = s.precio || 7000
  return {
    // vinculo 1-a-1 con el pin del mapa: sin esto, dos secciones con el mismo
    // nombre (ej. dos "Platea Izquierda") eran indistinguibles y colisionaban.
    pinid: s.id || 'sec-' + s.num,
    pinnum: s.num != null ? String(s.num) : '',
    zona: s.nombre || 'Sección ' + s.num,
    seccion: detectar_seccion(s.nombre || ''),
    cap: s.cap || 50,
    escompartida: s.es_compartida === true,
    capacidadmaxima: s.capacidad_maxima != null ? Number(s.capacidad_maxima) : null,
    min: s.min_personas != null ? s.min_personas : undefined,
    min2: s.min_personas2 != null ? s.min_personas2 : undefined,
    cap2: s.cap2 != null ? s.cap2 : undefined,
    precio: base,
    // sin tarifa JUE-SAB configurada se usa la MISMA de DOM-MIE: el viejo
    // respaldo `base + 500` inventaba precios y podia acabar guardado en la
    // base al editar la fila.
    precio2: s.precio2 || base,
    precioextra: s.precio_extra != null ? s.precio_extra : undefined,
    precioextra2: s.precio_extra2 != null ? s.precio_extra2 : undefined,
    precionino: s.precio_nino != null ? s.precio_nino : undefined,
    precionino2: s.precio_nino2 != null ? s.precio_nino2 : undefined,
    preciodiscada: s.precio_discada != null ? s.precio_discada : undefined,
    precioextradiscada: s.precio_extra_discada != null ? s.precio_extra_discada : undefined,
    precioninodiscada: s.precio_nino_discada != null ? s.precio_nino_discada : undefined,
    sku: s.sku || undefined,
    descripcion: s.descripcion || undefined,
    shortdescription: s.short_description || undefined,
  }
}

// espejo de _cargarMinPrecio(): el cache local del admin RELLENA campos del
// catalogo. Primero la clave por id unico del pin; el nombre queda como
// respaldo para configuraciones guardadas antes de ese cambio.
export function aplicar_overrides_locales(lista) {
  let cfg = {}
  try {
    cfg = JSON.parse(localStorage.getItem('nrj_precios_config') || '{}')
  } catch (e) {
    return lista
  }
  return lista.map((p) => {
    const k = String(p.zona || '').toUpperCase().trim()
    const e = (p.pinid && cfg['ID:' + p.pinid]) || cfg[k]
    if (!e) return p
    const out = { ...p }
    if (e.min != null) out.min = e.min
    if (e.min2 != null) out.min2 = e.min2
    if (e.cap2 != null) out.cap2 = e.cap2
    if (e.extra != null) out.precioextra = e.extra
    if (e.extra2 != null) out.precioextra2 = e.extra2
    if (e.nino != null) out.precionino = e.nino
    if (e.nino2 != null) out.precionino2 = e.nino2
    return out
  })
}

// espejo de las variables derivadas al inicio de renderPrecios(): los
// respaldos por bloque de dia. Sin JUE-SAB configurado se HEREDA DOM-MIE, asi
// "se copian" los datos existentes sin migrar filas.
export function fila_precio(p) {
  return {
    ...p,
    // DOM-MIE
    minv: p.min != null ? p.min : 1,
    capv: p.cap != null ? p.cap : 15,
    // JUE-SAB
    min2v: p.min2 != null ? p.min2 : p.min != null ? p.min : 1,
    cap2v: p.cap2 != null ? p.cap2 : p.cap != null ? p.cap : 15,
    precio2v: p.precio2 != null ? p.precio2 : p.precio,
    extra2v: p.precioextra2 != null ? p.precioextra2 : p.precioextra,
    nino2v: p.precionino2 != null ? p.precionino2 : p.precionino,
    // Discada (solo DOM-MIE): sin configurar se muestran los valores por
    // defecto del negocio.
    discadav: p.preciodiscada != null ? p.preciodiscada : 7500,
    extradiscadav: p.precioextradiscada != null ? p.precioextradiscada : 500,
    ninodiscadav: p.precioninodiscada != null ? p.precioninodiscada : p.precionino || 0,
  }
}

export function filtrar_precios(lista, busqueda) {
  const q = String(busqueda || '').toLowerCase()
  if (!q) return lista
  return lista.filter(
    (p) =>
      String(p.zona || '').toLowerCase().includes(q) ||
      String(p.seccion || '').toLowerCase().includes(q) ||
      String(p.sku || '').toLowerCase().includes(q)
  )
}

export const badge_seccion = {
  Terraza: 'badge-orange',
  Palco: 'badge-purple',
  Platea: 'badge-blue',
  'Jardín': 'badge-green',
  General: 'badge-gray',
}
