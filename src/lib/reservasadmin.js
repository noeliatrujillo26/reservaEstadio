// ═══════════════════════════════════════════════════════════════════
// reservasadmin.js — logica de la vista "Reservas" del panel.
// espejo 1:1 de v1: renderSeccionesResTabla() y renderSeccionesResKPIs() de
// js/20-editor-mapa.js, mas los helpers que usa (getClienteEnSeccion,
// getAbonadoRes, getCreditoRes, _folioReserva, _totalPersonasSeccion,
// _reservaLiquidadaLocal, esReservaCortesia, _esPalcoCompartido).
// ═══════════════════════════════════════════════════════════════════

import { cobro_cancelado, es_cobro_credito } from './cobros'
import { categoria_sec, estado_zona } from './dashboard'

// la reserva viva de una seccion en un juego. Una seccion "Libre" jamas
// muestra cliente, por eso el llamador pasa null explicito.
export function cliente_en_seccion(reservas, juegoid, area) {
  const nombre_area = (area.nombre || '').trim().toLowerCase()
  return reservas.find((r) => {
    if (String(r.juegoid) !== String(juegoid)) return false
    if (String(r.estado || '').toLowerCase() === 'cancelada') return false
    if (r.zonaid) return r.zonaid === area.id
    return String(r.zona || '').trim().toLowerCase() === nombre_area
  })
}

// Folio visible: los ids numericos del panel se muestran como RES-001; los
// folios en linea (NRJ-…) y de emergencia (R…) ya traen prefijo.
export function folio_visible(reserva) {
  if (!reserva || !reserva.id) return '—'
  const id = String(reserva.id)
  return /^\d+$/.test(id) ? 'RES-' + id : id
}

// NOTA: la v1 amplia este conjunto con los folios del prospecto vinculado del
// Pipeline (abonos previos a generar la reserva). Ese modulo aun no se migra,
// asi que aqui solo entra el folio propio; al migrar Pipeline se completa.
function folios_de_reserva(reserva) {
  return new Set([String(reserva.id)])
}

// "Abonado" = DINERO REAL: los cobros a credito son cuenta por cobrar
// (credito_de_reserva) y jamas se muestran como dinero recibido.
export function abonado_de_reserva(reserva, cobros) {
  if (!reserva) return 0
  const folios = folios_de_reserva(reserva)
  const suma = cobros
    .filter((c) => !cobro_cancelado(c) && !es_cobro_credito(c) && folios.has(String(c.folio)))
    .reduce((s, c) => s + (Number(c.monto) || 0), 0)
  return Math.max(suma, Number(reserva.montopagado) || 0)
}

// monto comprometido a CREDITO (activo): mismo universo de folios, solo los
// cobros a credito no cancelados.
export function credito_de_reserva(reserva, cobros) {
  if (!reserva) return 0
  const folios = folios_de_reserva(reserva)
  return cobros
    .filter((c) => !cobro_cancelado(c) && es_cobro_credito(c) && folios.has(String(c.folio)))
    .reduce((s, c) => s + (Number(c.monto) || 0), 0)
}

// liquidada por marca de estado O por monto (cubre reservas pagadas 100% en
// linea cuya marca quedo vieja).
export function reserva_liquidada(r) {
  if (!r) return false
  const ep = String(r.estadopago || '').toLowerCase()
  if (['pagado', 'completado', 'liquidado'].indexOf(ep) >= 0) return true
  const neto = (Number(r.monto) || 0) - (Number(r.descuentomonto) || 0)
  return neto > 0 && Number(r.montopagado || 0) >= neto
}

export function es_cortesia(r) {
  if (!r) return false
  const bruto = Number(r.monto) || 0
  if (bruto <= 0) return false
  const desc = Number(r.descuentomonto) || 0
  return bruto - desc <= 0.009 // el centavo de tolerancia de siempre
}

export function es_palco_compartido(area) {
  return !!(area && area.escompartida)
}

// total de lugares de la seccion: el mayor entre la base, la base mas extras y
// el total guardado. `adultos` en null marca una fila del checkout en linea,
// donde `personas` YA incluye la base.
export function total_personas_seccion(area, reserva) {
  const base = parseInt(area.cap, 10) || 0
  if (!reserva) return base
  const adultos = parseInt(reserva.adultos, 10) || 0
  const ninos = parseInt(reserva.ninos, 10) || 0
  const per = parseInt(reserva.personas, 10) || 0
  const por_extras = base + adultos + ninos
  const adultos_null = reserva.adultos == null || reserva.adultos === ''
  const por_total = per ? (adultos_null ? per + ninos : per) : 0
  return Math.max(base, por_extras, por_total)
}

// ── filas y KPIs de la vista ────────────────────────────────────
// espejo de renderSeccionesResTabla(). El universo COMPLETO alimenta los KPIs;
// los filtros aplican solo a las filas visibles. La v1 anota que filtrar antes
// de contar dejaba las 4 tarjetas en 0 cuando el juego no tenia reservas.
export function filas_reservas({ areas, reservas, cobros, areasestados, juego, soloocupadas, tipozona }) {
  if (!juego) return null

  const todas = areas.map((a) => {
    const est = estado_zona(areasestados, areas, juego.id, a.id)
    return {
      a,
      est,
      cat: categoria_sec(a.nombre),
      // una seccion "Libre" jamas muestra cliente.
      reserva: est === 'libre' ? null : cliente_en_seccion(reservas, juego.id, a) || null,
    }
  })

  // "Solo ocupadas" muestra TODO lo que no esta libre: reservadas Y
  // bloqueadas. Antes solo reservadas, y las bloqueadas desaparecian.
  const filas = todas
    .filter((r) => !tipozona || (tipozona === 'compartida' ? es_palco_compartido(r.a) : !es_palco_compartido(r.a)))
    .filter((r) => !soloocupadas || r.est !== 'libre')

  const total = todas.length
  const libres = todas.filter((r) => r.est === 'libre').length
  const reservadas = todas.filter((r) => r.est === 'reservada').length
  const bloqueadas = todas.filter((r) => r.est === 'bloqueada').length
  const pctocup = total > 0 ? Math.round((reservadas / total) * 100) : 0

  // estado de pago de cada fila reservada.
  const conpago = filas.map((f) => {
    if (f.est !== 'reservada' || !f.reserva) return { ...f, pago: null }
    const abonado = abonado_de_reserva(f.reserva, cobros)
    const credito = credito_de_reserva(f.reserva, cobros)
    const neto = Math.max(0, (Number(f.reserva.monto) || 0) - (Number(f.reserva.descuentomonto) || 0))
    // Verde SOLO con dinero real.
    const pagook = reserva_liquidada(f.reserva) || f.reserva.pago === 'Completo'
    // A credito: sin liquidar con dinero, pero dinero + credito cubren el neto.
    const cubierto_credito = !pagook && credito > 0 && abonado + credito >= neto - 0.01
    // CORTESIA antes que nada: sin neto que cobrar, "Pendiente" seria falso
    // —no hay nada esperando— y "Completo" daria a entender que entro dinero.
    const cortesia = es_cortesia(f.reserva)
    const badge = cortesia ? 'badge-purple'
      : pagook ? 'badge-green'
      : cubierto_credito ? 'badge-orange'
      : abonado > 0 ? 'badge-yellow' : 'badge-red'
    const label = cortesia ? 'Cortesía'
      : pagook ? 'Completo'
      : cubierto_credito ? '💳 A Crédito'
      : abonado > 0 ? 'Incompleto' : 'Pendiente'
    return { ...f, pago: { badge, label } }
  })

  return { filas: conpago, total, libres, reservadas, bloqueadas, pctocup }
}

export const badge_estado = {
  libre: 'badge-green',
  reservada: 'badge-blue',
  bloqueada: 'badge-red',
}

export const label_estado = {
  libre: 'Libre',
  reservada: 'Reservada',
  bloqueada: 'Bloqueada',
}

export const badge_categoria = {
  Terraza: 'badge-orange',
  Palco: 'badge-purple',
  Platea: 'badge-blue',
  'Jardín': 'badge-green',
  General: 'badge-gray',
}
