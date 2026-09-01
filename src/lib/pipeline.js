// ═══════════════════════════════════════════════════════════════════
// pipeline.js — tablero comercial y ocupacion de palcos compartidos.
// espejo 1:1 de v1: el map de cargarPipelineDesdeSupabase() (js/30-init.js),
// pipelineEtapas, _pipDiasEnEtapa() y el filtrado de renderPipelineBoard()
// (js/modules/pipeline.js), mas _palcosDelMapa(), _ocupacionPalco(),
// _lugaresDeReserva() y _capacidadPalco() (palcos.js / utils.js).
// ═══════════════════════════════════════════════════════════════════

import { cobro_cancelado, es_cobro_credito } from './cobros'

// Etapas FIJAS del tablero, en su orden.
export const pipeline_etapas = [
  { id: 'prospecto', label: 'Prospecto', color: '#9AA3B4' },
  { id: 'cotizado', label: 'Cotizado', color: '#CA8A04' },
  // "Reserva Momentánea": apartado temporal entre la cotizacion y la reserva
  // firme. Sustituye a la retirada "Contactado".
  { id: 'reserva_momentanea', label: 'Reserva Momentánea', color: '#7C3AED' },
  { id: 'reservado', label: 'Reservas', color: '#E05C1A' },
  { id: 'cerrado', label: 'Reserva completada', color: '#16A34A' },
  { id: 'boletos_entregados', label: 'Boletos enviados', color: '#0369A1' },
]

const ids_etapa = pipeline_etapas.map((e) => e.id)

// MAPEADOR COMPLETO de pipeline_prospectos.
export function map_prospecto(p) {
  return {
    id: p.id,
    folio: p.folio || '',
    nombre: p.nombre,
    email: p.email || '',
    zona: p.zona,
    zonaid: p.zona_id || '',
    serie: p.serie,
    monto: p.monto,
    // Una tarjeta con etapa vieja o personalizada cae a 'prospecto' para no
    // desaparecer del tablero. 'completado' (archivo de Completados) y
    // 'descartado' (lapidas de eliminados) son estados terminales VALIDOS
    // fuera del tablero: se conservan tal cual, jamas se normalizan.
    etapa:
      ids_etapa.indexOf(p.etapa) >= 0 || p.etapa === 'completado' || p.etapa === 'descartado'
        ? p.etapa
        : 'prospecto',
    badge: p.badge,
    notas: p.notas,
    notaslog: p.notas_log || [],
    descripcion: p.descripcion || '',
    vendedora: p.vendedora,
    juego: p.juego != null && p.juego !== '' ? String(p.juego) : '',
    tel: p.tel,
    adultos: p.adultos || 0,
    ninos: p.ninos || 0,
    descuento: p.descuento || 0,
    // codigo de cupon con el que se creo el prospecto (para reportes).
    codigodescuento: p.codigo_descuento || '',
    consumomonto: p.consumo_monto || 0,
    extramonto: p.extra_monto || 0,
    adultoextraprecio: p.adulto_extra_precio || 0,
    ninoextraprecio: p.nino_extra_precio || 0,
    cotizid: p.cotiz_id || '',
    clienteid: p.cliente_id != null ? p.cliente_id : null,
    reservaids: p.reserva_ids || [],
    tipocomida: p.tipo_comida === 'discada' ? 'discada' : 'carne_asada',
    // para el badge "⏱️ N días": momento del ultimo cambio de etapa, con
    // created_at como respaldo para registros previos a la migracion.
    etapacambiadaen: p.etapa_cambiada_en || p.created_at || null,
  }
}

// espejo de _pipDiasEnEtapa(): si no hay marca de cambio de etapa, el ultimo
// recurso es la fecha embebida en el id (formato p-<epoch>).
export function dias_en_etapa(card) {
  if (!card) return null
  let base = card.etapacambiadaen ? new Date(card.etapacambiadaen) : null
  if ((!base || isNaN(base.getTime())) && /^p-\d{12,}$/.test(String(card.id || ''))) {
    base = new Date(Number(String(card.id).slice(2)))
  }
  if (!base || isNaN(base.getTime())) return null
  const dias = Math.floor((Date.now() - base.getTime()) / 86400000)
  return dias < 0 ? 0 : dias
}

// ── pagos de una tarjeta ────────────────────────────────────────
// los cobros ligados al folio del prospecto. DINERO REAL: los de credito son
// cuenta por cobrar y no cuentan como abonado, mismo criterio que el resto.
export function pagos_de_tarjeta(card, cobros) {
  const folio = String(card.folio || '')
  if (!folio) return []
  // un folio de prospecto puede vivir como 'PROS-002' o como '002' segun la
  // epoca del registro: se aceptan AMBAS formas.
  const alias = folio.toUpperCase().startsWith('PROS-')
    ? [folio, folio.slice(5)]
    : [folio, 'PROS-' + folio]
  return cobros.filter((c) => !cobro_cancelado(c) && alias.indexOf(String(c.folio || '')) >= 0)
}

export function suma_pagos_dinero(pagos) {
  return pagos.reduce((s, p) => s + (es_cobro_credito(p) ? 0 : Number(p.monto) || 0), 0)
}

// ── filtrado del tablero ────────────────────────────────────────
// espejo del filter de renderPipelineBoard(): vendedora, juego, serie y el
// buscador de texto, todos combinados (AND).
export function coincide_texto(c, texto) {
  const q = String(texto || '').trim().toLowerCase()
  if (!q) return true
  return [c.nombre, c.email, c.tel, c.folio, c.zona, c.descripcion]
    .some((v) => String(v || '').toLowerCase().includes(q))
}

export function filtrar_tarjetas(cards, etapaid, { vendedora, juego, seriejuegoids, texto }) {
  return cards.filter(
    (c) =>
      c.etapa === etapaid &&
      (!vendedora || (c.vendedora || '') === vendedora) &&
      (!juego || (c.juego || '') === juego) &&
      // una tarjeta SIN juego pasa el filtro de serie: la v1 lo permite a
      // proposito para que los prospectos aun sin partido no desaparezcan.
      (!seriejuegoids || !c.juego || seriejuegoids.indexOf(c.juego) >= 0) &&
      coincide_texto(c, texto)
  )
}

// las dos columnas donde hay dinero entrando llevan el abonado acumulado.
export function columna_lleva_abonado(etapaid) {
  return etapaid === 'reservado' || etapaid === 'reserva_momentanea'
}

// series del calendario, agrupadas por rival, para el selector.
export function series_de(juegos) {
  const sm = {}
  juegos.forEach((j) => {
    if (!sm[j.serie]) sm[j.serie] = { rival: j.rival, fechas: [] }
    sm[j.serie].fechas.push(j.fecha)
  })
  return Object.entries(sm).map(([sid, s]) => {
    const fechas = [...s.fechas].sort()
    return { id: sid, rival: s.rival, desde: fechas[0], hasta: fechas[fechas.length - 1] }
  })
}

// ── palcos compartidos ──────────────────────────────────────────
export function capacidad_palco(area) {
  if (!area) return 0
  return Number(area.capacidadmaxima) || Number(area.cap) || 0
}

// lugares que ocupa una reserva: `lugares` manda; si no, adultos + ninos; y
// si tampoco, el total de personas. Nunca menos de 1.
export function lugares_de_reserva(r) {
  if (!r) return 0
  const n = Number(r.lugares)
  if (n > 0) return n
  let personas = (Number(r.adultos) || 0) + (Number(r.ninos) || 0)
  if (personas > 0) return personas
  personas = Number(r.personas) || 0
  return personas > 0 ? personas : 1
}

// foto de ocupacion de un palco en un juego.
export function ocupacion_palco(area, juegoid, reservas) {
  const cap = capacidad_palco(area)
  const propias = reservas.filter(
    (r) =>
      String(r.zonaid || '') === String(area.id) &&
      String(r.juegoid || '') === String(juegoid) &&
      String(r.estado || '').toLowerCase() !== 'cancelada'
  )
  const ocupados = propias.reduce((t, r) => t + lugares_de_reserva(r), 0)
  return {
    capacidad: cap,
    ocupados,
    libres: Math.max(0, cap - ocupados),
    agotado: cap > 0 && ocupados >= cap,
    pct: cap > 0 ? Math.min(100, Math.round((ocupados * 100) / cap)) : 0,
    reservas: propias,
  }
}

export function palcos_del_mapa(areas) {
  return (areas || []).filter((a) => a && a.escompartida)
}
