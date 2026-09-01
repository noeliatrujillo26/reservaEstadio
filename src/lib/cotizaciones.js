// ═══════════════════════════════════════════════════════════════════
// cotizaciones.js — propuestas comerciales.
// espejo 1:1 de v1: el map de cargarCotizacionesDesdeSupabase()
// (js/30-init.js), renderCotizKPIs(), renderCotizLista(), cotizMatchesTab(),
// COTIZ_ESTADOS y COTIZ_BADGE (js/modules/cotizaciones.js).
// ═══════════════════════════════════════════════════════════════════

// MAPEADOR COMPLETO: la fila de `cotizaciones` trae 30+ columnas en
// snake_case. Se migran todas, no solo las que pinta la tabla — el resumen
// financiero del detalle las necesita.
export function map_cotizacion(c) {
  return {
    id: c.id,
    fecha: c.fecha,
    cliente: c.cliente,
    tel: c.tel,
    email: c.email,
    empresa: c.empresa || '',
    descripcion: c.descripcion,
    volumenpct: Number(c.descuento_volumen_pct) || 0,
    volumennombre: c.descuento_volumen_nombre || '',
    juegoid: c.juego_id != null && c.juego_id !== '' ? String(c.juego_id) : '',
    juegos: c.juegos,
    zonaid: c.zona_id || '',
    zona: c.zona || '',
    personasincluidas: c.personas_incluidas || '',
    consumodesc: c.consumo_desc,
    areamonto: c.area_monto,
    consumomonto: c.consumo_monto,
    extramonto: c.extra_monto || 0,
    adultoextraprecio: c.adulto_extra_precio || 0,
    adultoextracant: c.adulto_extra_cant || 0,
    adultosextramonto: c.adultos_extra_monto || 0,
    ninoextraprecio: c.nino_extra_precio || 0,
    ninoextracant: c.nino_extra_cant || 0,
    ninosextramonto: c.ninos_extra_monto || 0,
    descuento: c.descuento,
    subtotal: c.subtotal,
    iva: c.iva,
    total: c.total,
    metodospago: c.metodos_pago || [],
    notas: c.notas,
    // solo 'discada' es alterna; cualquier otro valor es carne asada.
    tipocomida: c.tipo_comida === 'discada' ? 'discada' : 'carne_asada',
    valida: c.valida,
    vendedora: c.vendedora,
    estado: c.estado,
    enpipeline: c.en_pipeline,
  }
}

export const cotiz_estados = ['Activa', 'Aprobada', 'Concretada', 'Rechazada', 'Vencida']

export const cotiz_badge = {
  Activa: 'badge-blue',
  Aprobada: 'badge-teal',
  Concretada: 'badge-green',
  Rechazada: 'badge-red',
  Vencida: 'badge-orange',
}

export const cotiz_tabs = [
  { id: 'activas', label: 'Activas', icono: '📝' },
  { id: 'aprobadas', label: 'Aprobadas', icono: '👍' },
  { id: 'concretadas', label: 'Concretadas', icono: '✅' },
  { id: 'rechazadas', label: 'Rechazadas', icono: '❌' },
  { id: 'vencidas', label: 'Vencidas', icono: '⏳' },
]

// la pestaña por omision ('activas') recoge TODO lo que sea Activa.
export function coincide_tab(c, tab) {
  if (tab === 'aprobadas') return c.estado === 'Aprobada'
  if (tab === 'concretadas') return c.estado === 'Concretada'
  if (tab === 'rechazadas') return c.estado === 'Rechazada'
  if (tab === 'vencidas') return c.estado === 'Vencida'
  return c.estado === 'Activa'
}

export function filtrar_cotizaciones(lista, busqueda, tab) {
  const q = String(busqueda || '').toLowerCase()
  return lista.filter(
    (c) =>
      (!q ||
        String(c.cliente || '').toLowerCase().includes(q) ||
        String(c.descripcion || '').toLowerCase().includes(q)) &&
      coincide_tab(c, tab)
  )
}

// espejo del sort de renderCotizLista(): texto en minusculas, resto tal cual.
export function ordenar_cotizaciones(lista, col, dir) {
  if (!col) return lista
  const d = dir === 'asc' ? 1 : -1
  return [...lista].sort((a, b) => {
    let av = a[col] || ''
    let bv = b[col] || ''
    if (typeof av === 'string') { av = av.toLowerCase(); bv = String(bv).toLowerCase() }
    return av < bv ? -d : av > bv ? d : 0
  })
}

// los 5 KPIs se calculan sobre TODAS las cotizaciones, no sobre la pestaña
// activa — igual que renderCotizKPIs().
export function kpis_cotizaciones(lista) {
  return {
    total: lista.reduce((s, c) => s + (c.total || 0), 0),
    activas: lista.filter((c) => c.estado === 'Activa').length,
    aprobadas: lista.filter((c) => c.estado === 'Aprobada').length,
    concretadas: lista.filter((c) => c.estado === 'Concretada').length,
    rechazadas: lista.filter((c) => c.estado === 'Rechazada').length,
  }
}
