// ═══════════════════════════════════════════════════════════════════
// cobros.js — filtros, orden y resumenes del Registro de Cobros.
// espejo 1:1 de v1: js/modules/cobros.js (renderCobrosKPIs, filtrarCobros,
// getSortedCobros, renderResumen, renderVendedoras) y los helpers de
// js/modules/utils.js que usa.
//
// OJO CON LOS NOMBRES DE CAMPO: `formaPago` viene del mapeador y `forma_pago`
// de la fila cruda. Igual que en el dashboard, aqui se aceptan todas las
// grafias — mirar solo una deja pasar creditos como dinero real.
// ═══════════════════════════════════════════════════════════════════

import { cobro_cancelado, es_cobro_credito, es_pago_credito } from './dashboard'
import { hoy_hermosillo } from './fechas'

export { cobro_cancelado, es_cobro_credito }

// mismo campo, cuatro grafias posibles segun de donde venga la fila.
function forma_de(c) {
  return (c && (c.formapago || c.formaPago || c.forma || c.forma_pago)) || ''
}

// ¿el concepto es un abono al saldo a favor? igualdad exacta normalizada.
export function es_pago_desde_saldo_favor(concepto, forma) {
  const n = norm_concepto(concepto)
  const f = norm_concepto(forma)
  return n === 'SALDO A FAVOR' || f === 'SALDO A FAVOR'
}

export function es_cobro_desde_saldo_favor(c) {
  return !!c && es_pago_desde_saldo_favor(c.concepto, forma_de(c))
}

// dinero que NO entra nuevo a la caja: credito (por cobrar) o saldo a favor
// (dinero que ya habia entrado antes).
export function cobro_sin_dinero_nuevo(c) {
  return es_cobro_credito(c) || es_cobro_desde_saldo_favor(c)
}

// ¿el folio de un cobro sigue apuntando a algo VIVO? un credito cuyo folio ya
// no existe es un huerfano: no hay a quien cobrarle y NO debe sumar.
export function folio_vigente(folio, reservas) {
  const f = String(folio || '')
  if (!f) return false
  const r = (reservas || []).find((x) => String(x.id) === f)
  if (r) return String(r.estado || '').toLowerCase() !== 'cancelada'
  return false
}

// credito que de verdad se puede cobrar: activo, a credito y con folio vivo.
export function es_credito_vigente(c, reservas) {
  return es_cobro_credito(c) && !cobro_cancelado(c) && folio_vigente(c && c.folio, reservas)
}

export function requiere_factura(c) {
  return c.factura === 'REQUERIDA'
}

export function estado_cobro(c) {
  return cobro_cancelado(c) ? 'Cancelado' : 'Activo'
}

export function norm_concepto(v) {
  return String(v || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

// grupos del filtro de concepto: una opcion puede cubrir varias grafias.
const concepto_grupos = {
  ABONO: (c) => c === 'ABONO' || c.indexOf('ANTICIPO') === 0,
  LIQUIDACION: (c) => c.indexOf('LIQUIDACION') === 0 || c === 'PAGO COMPLETO EN LINEA',
  'SALDO A FAVOR': (c) => c === 'SALDO A FAVOR',
  CREDITO: (c) => c === 'CREDITO',
  BOLETOS: (c) => c === 'BOLETOS',
  COMIDA: (c) => c === 'COMIDA' || c === 'CONSUMO',
}

export function concepto_coincide(filtro, valor) {
  if (!filtro) return true
  const grupo = concepto_grupos[norm_concepto(filtro)]
  return grupo ? grupo(norm_concepto(valor)) : norm_concepto(valor) === norm_concepto(filtro)
}

export function forma_pago_clave(v) {
  const n = norm_concepto(v)
  return /STRIPE/.test(n) ? 'STRIPE' : n
}

// ¿el cobro fue recibido por el vendedor seleccionado? coincidencia exacta o
// por PRIMER NOMBRE: los cobros historicos guardaban solo "FER"/"MELI",
// mientras el filtro nuevo lista nombres completos.
export function mismo_vendedor(recibio, seleccionado) {
  const a = String(recibio || '').trim().toUpperCase()
  const b = String(seleccionado || '').trim().toUpperCase()
  if (!a || !b) return false
  if (a === b) return true
  return a.split(/\s+/)[0] === b.split(/\s+/)[0]
}

// ── filtrado ────────────────────────────────────────────────────
// espejo de filtrarCobros(): OR entre las opciones marcadas del MISMO filtro
// y AND entre filtros distintos. Lista vacia = ese filtro no aplica.
// Los cancelados siguen saliendo por defecto (se conservan para auditoria,
// tachados); el filtro de estado solo permite aislarlos.
export function filtrar_cobros(cobros, f) {
  const busq = (f.busqueda || '').toLowerCase()
  return cobros.filter((c) => {
    const match_busq =
      !busq ||
      String(c.cliente || '').toLowerCase().includes(busq) ||
      String(c.zona || '').toLowerCase().includes(busq) ||
      String(c.folio || '').toLowerCase().includes(busq) ||
      String(c.notas || '').toLowerCase().includes(busq)
    const match_mes = !f.mes.length || f.mes.includes(c.mes)
    const match_concepto = !f.concepto.length || f.concepto.some((x) => concepto_coincide(x, c.concepto))
    const match_forma =
      !f.forma.length || f.forma.some((x) => forma_pago_clave(x) === forma_pago_clave(forma_de(c)))
    const match_recibio = !f.recibio.length || f.recibio.some((v) => mismo_vendedor(c.recibio, v))
    const match_factura =
      !f.factura.length || f.factura.some((v) => (v === 'SI' ? requiere_factura(c) : !requiere_factura(c)))
    const match_fecha = !f.fecha || c.fecha === f.fecha
    const match_estado =
      !f.estado || (f.estado === 'cancelado' ? cobro_cancelado(c) : !cobro_cancelado(c))
    return (
      match_busq && match_mes && match_concepto && match_forma &&
      match_recibio && match_factura && match_fecha && match_estado
    )
  })
}

// ── orden ───────────────────────────────────────────────────────
// espejo de getSortedCobros(). La columna `fecha` es solo 'YYYY-MM-DD': dentro
// de un mismo dia no desempataba nada y las horas salian en el orden en que
// viniera el arreglo. El desempate usa el instante REAL (created_at).
export function ordenar_cobros(data, col, dir) {
  const s = dir === 'asc' ? 1 : -1
  return [...data].sort((a, b) => {
    if (col === 'monto') return (a.monto - b.monto) * s
    // por la etiqueta visible, no por el campo crudo: `estado` viene vacio en
    // los activos y ordenar '' contra 'cancelado' no dice nada al leerlo.
    if (col === 'estado') return estado_cobro(a).localeCompare(estado_cobro(b), 'es') * s
    if (col === 'fecha') {
      const cmp = String(a.fecha || '').localeCompare(String(b.fecha || ''))
      if (cmp !== 0) return cmp * s
      return String(a.createdat || '').localeCompare(String(b.createdat || '')) * s
    }
    if (col === 'formapago') {
      return String(forma_de(a)).localeCompare(String(forma_de(b)), 'es') * s
    }
    return String(a[col] || '').localeCompare(String(b[col] || ''), 'es') * s
  })
}

// ── KPIs ────────────────────────────────────────────────────────
// espejo de renderCobrosKPIs(): con la tabla filtrada las tarjetas reflejan LO
// FILTRADO en vivo. Cancelados jamas suman. "Total cobrado" es DINERO REAL:
// los registros a credito son cuenta por cobrar y van en su propio KPI.
export function kpis_cobros(subset, reservas) {
  const activos = subset.filter((c) => !cobro_cancelado(c))
  const dinero = activos.filter((c) => !es_cobro_credito(c))
  const total = dinero.reduce((s, c) => s + c.monto, 0)
  const credito_por_cobrar = activos.reduce(
    (s, c) => s + (es_credito_vigente(c, reservas) ? c.monto : 0), 0
  )
  const requieren_factura = activos.filter(requiere_factura).length
  const anticipos = dinero.filter((c) => c.concepto === 'ANTICIPO').reduce((s, c) => s + c.monto, 0)
  const transferencias = dinero
    .filter((c) => forma_de(c) === 'TRANSFERENCIA')
    .reduce((s, c) => s + c.monto, 0)

  const kpis = [
    { label: 'Total cobrado', valor: total, dinero: true, color: 'var(--naranja)', icono: '💰' },
    { label: 'Cobros registrados', valor: activos.length, dinero: false, color: 'var(--azul)', icono: '🧾' },
    { label: 'Anticipos activos', valor: anticipos, dinero: true, color: 'var(--amarillo)', icono: '⏳' },
    { label: 'Via transferencia', valor: transferencias, dinero: true, color: '#16A34A', icono: '🏦' },
    { label: 'Requieren factura', valor: requieren_factura + ' cobros', dinero: false, color: 'var(--rojo)', icono: '⚠️' },
  ]
  if (credito_por_cobrar > 0) {
    kpis.splice(1, 0, {
      label: 'Crédito por cobrar', valor: credito_por_cobrar, dinero: true,
      color: 'var(--naranja)', icono: '💳',
    })
  }
  return kpis
}

// ── resumen por zona ────────────────────────────────────────────
// solo DINERO REAL cobrado: cancelados y creditos fuera.
export function resumen_por_zona(cobros) {
  const zonas = {}
  cobros.forEach((c) => {
    if (cobro_cancelado(c) || es_cobro_credito(c)) return
    if (!zonas[c.zona]) zonas[c.zona] = { n: 0, anticipos: 0, abonos: 0, liq: 0, total: 0 }
    zonas[c.zona].n++
    zonas[c.zona].total += c.monto
    if (c.concepto === 'ANTICIPO') zonas[c.zona].anticipos += c.monto
    else if (c.concepto === 'ABONO') zonas[c.zona].abonos += c.monto
    else if (c.concepto === 'LIQUIDACION') zonas[c.zona].liq += c.monto
  })
  return Object.entries(zonas).sort((a, b) => b[1].total - a[1].total)
}

// ── por vendedora ───────────────────────────────────────────────
export function resumen_por_vendedora(cobros) {
  const vends = {}
  cobros.forEach((c) => {
    if (!c.recibio || cobro_cancelado(c) || es_cobro_credito(c)) return
    if (!vends[c.recibio]) vends[c.recibio] = { n: 0, total: 0, conceptos: {}, zonas: {} }
    vends[c.recibio].n++
    vends[c.recibio].total += c.monto
    vends[c.recibio].conceptos[c.concepto] = (vends[c.recibio].conceptos[c.concepto] || 0) + 1
    vends[c.recibio].zonas[c.zona] = (vends[c.recibio].zonas[c.zona] || 0) + 1
  })
  // el total general SI descuenta el saldo a favor, no solo el credito.
  const total_general = cobros.reduce(
    (s, c) => s + (cobro_cancelado(c) || cobro_sin_dinero_nuevo(c) ? 0 : c.monto), 0
  )
  return {
    lista: Object.entries(vends).sort((a, b) => b[1].total - a[1].total),
    total_general,
  }
}

export const colores_vendedora = {
  FER: '#E05C1A', MELI: '#2563EB', LUNA: '#9B59B6', VANE: '#16A34A', ALIN: '#E91E8C',
}

export const meses_label = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export { hoy_hermosillo }

// ── folio de la reserva ligada a un cobro ───────────────────────
// espejo de getReservaFolio(), _normZona() y _matchAreaByZonaNombre() de
// js/20-editor-mapa.js. La columna "N° Recibo" es c.folio; esta otra se
// DERIVA cruzando cliente + zona, y no son el mismo dato.
export function norm_zona(s) {
  return (s || '').replace(/[\s-]/g, '').toLowerCase()
}

// mejor coincidencia de zona por palabras: pide al menos 2 aciertos para no
// emparejar por casualidad.
export function area_por_nombre_zona(zonanombre, areas) {
  if (!zonanombre) return null
  const limpiar = (s) =>
    (s || '').toLowerCase().replace(/[^a-z0-9áéíóúñ\s]/gi, ' ').split(/\s+/).filter(Boolean)
  const objetivo = limpiar(zonanombre)
  let mejor = null
  let mejor_puntos = 0
  areas.forEach((a) => {
    const palabras = limpiar(a.nombre)
    let puntos = 0
    objetivo.forEach((t) => {
      if (palabras.some((p) => p === t || p.startsWith(t) || t.startsWith(p))) puntos++
    })
    if (puntos > mejor_puntos) { mejor_puntos = puntos; mejor = a }
  })
  return mejor_puntos >= 2 ? mejor : null
}

export function folio_reserva(c, reservas, areas) {
  const cliente_norm = (c.cliente || '').toLowerCase().trim()
  const area = areas.find((a) => a.id === c.zona) || area_por_nombre_zona(c.zona, areas)
  const r = reservas.find((x) => {
    if (String(x.cliente || '').toLowerCase().trim() !== cliente_norm) return false
    if (!area) return norm_zona(x.zona) === norm_zona(c.zona)
    const xarea = area_por_nombre_zona(x.zona, areas)
    return xarea && xarea.id === area.id
  })
  return r ? r.id : ''
}
