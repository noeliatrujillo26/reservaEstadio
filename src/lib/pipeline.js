// ═══════════════════════════════════════════════════════════════════
// pipeline.js — tablero comercial y ocupacion de palcos compartidos.
// espejo 1:1 de v1: el map de cargarPipelineDesdeSupabase() (js/30-init.js),
// pipelineEtapas, _pipDiasEnEtapa() y el filtrado de renderPipelineBoard()
// (js/modules/pipeline.js), mas _palcosDelMapa(), _ocupacionPalco(),
// _lugaresDeReserva() y _capacidadPalco() (palcos.js / utils.js).
// ═══════════════════════════════════════════════════════════════════

import { cobro_cancelado, es_cobro_credito } from './cobros'
import { redondear_dinero } from './dinero'
import { reserva_liquidada } from './reservasadmin'

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
// espejo EXACTO de _reconstruirPagosPipeline() (js/30-init.js): el historial
// de una tarjeta son sus cobros activos, y un cobro puede venir etiquetado
// con el folio del PROSPECTO (abonos antiguos) o con el ID de la RESERVA
// vinculada — asi los guardan el webhook de Stripe y los abonos nuevos.
//
// Antes aqui solo se miraba el folio del prospecto y sus alias 'PROS-xxx',
// y los ids de las reservas vinculadas quedaban fuera: una tarjeta pagada
// por Stripe mostraba "Abonado —" con el dinero cobrado. Ese mismo conjunto
// decide la etapa (ver abonado_etapa), asi que el fallo no era solo visual.
export function pagos_de_tarjeta(card, cobros) {
  const folios = new Set(
    [card.folio].concat(card.reservaids || []).filter(Boolean).map(String)
  )
  if (!folios.size) return []
  return cobros.filter((c) => !cobro_cancelado(c) && folios.has(String(c.folio || '')))
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

// ── completados ─────────────────────────────────────────────────
// espejo del filtro de renderCompletados(): el archivo del tablero son las
// tarjetas en etapa 'completado'.
//
// El buscador mira folio, nombre Y los folios de reserva vinculados — asi se
// puede localizar un proceso archivado por el folio de su reserva, que suele
// ser el que trae el cliente.
export function filtrar_completados(cards, { busqueda, juego, seriejuegoids }) {
  const q = String(busqueda || '').toLowerCase().trim()
  return cards.filter((c) => {
    if (c.etapa !== 'completado') return false
    if (
      q &&
      !(
        String(c.folio || '').toLowerCase().includes(q) ||
        String(c.nombre || '').toLowerCase().includes(q) ||
        (c.reservaids || []).some((rid) => String(rid).toLowerCase().includes(q))
      )
    ) {
      return false
    }
    if (juego && String(c.juego || '') !== juego) return false
    // una tarjeta SIN juego pasa el filtro de serie, igual que en el tablero.
    if (seriejuegoids && c.juego && seriejuegoids.indexOf(String(c.juego)) < 0) return false
    return true
  })
}

// los folios visibles de un completado: el del prospecto mas los de sus
// reservas vinculadas, en una sola celda.
export function folios_completado(c) {
  return [c.folio].concat(c.reservaids || []).filter(Boolean).join(' · ')
}

// ══ EN QUE COLUMNA LE TOCA ESTAR SEGUN LO ABONADO ══════════════════
// espejo 1:1 de v1 (js/modules/pipeline.js 1746-1875): _pdNumMonto,
// _pdSaldoPendienteCard, _pdReservasActivas, _pdAbonadoEtapa,
// _pdEngancheRequerido, _pdIndiceEtapa, _pdEtapaPorAbono y _pdDebeReclasificar.
//
// Son PURAS a proposito: reciben los datos ya cargados y no tocan la base. La
// escritura vive en cascadas.js, que las usa para decidir. Asi la regla del
// dinero se puede probar con miles de casos sin conectarse a nada.
//
// `ctx` = { reservas, cobros, cotizaciones, enganchemin }

export function num_monto(v) {
  let x = v
  if (typeof x === 'string') x = x.replace(/[$,\s]/g, '')
  const n = Number(x)
  return isNaN(n) ? 0 : n
}

export function reservas_activas(card, reservas) {
  return (card.reservaids || [])
    .map((rid) => (reservas || []).find((r) => r.id === rid))
    .filter((r) => r && String(r.estado || '').toLowerCase() !== 'cancelada')
}

// Abonado que cuenta PARA LA ETAPA. Aqui SI entra el credito: no es ingreso
// —por eso el encabezado de la columna y el "Abonado" de la tarjeta lo dejan
// fuera— pero asegura el lugar, asi que sube la etapa comercial. Es el mismo
// criterio con el que se valida el arrastre manual a Reservas: una sola
// funcion para que el gate manual y el ascenso automatico no puedan divergir.
export function abonado_etapa(card, cobros) {
  if (!card) return 0
  const pagos = pagos_de_tarjeta(card, cobros || [])
  return redondear_dinero(pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0))
}

// Enganche minimo en pesos segun la politica VIGENTE (tabla politica_pagos).
// Nunca un porcentaje fijo en codigo: si el admin cambia la politica, el gate
// manual y el ascenso automatico se mueven con ella.
export function enganche_requerido(card, enganchemin) {
  return redondear_dinero((num_monto(card && card.monto) * (Number(enganchemin) || 0)) / 100)
}

// Posicion de una etapa en el embudo, para no retroceder nunca.
export function indice_etapa(etapaid) {
  return pipeline_etapas.findIndex((e) => e.id === etapaid)
}

// Etapas desde las que una tarjeta puede ascender sola a Reservas.
export const etapas_previas_reserva = ['prospecto', 'cotizado', 'reserva_momentanea']

export function cotiz_origen(card, cotizaciones) {
  if (!card || !card.cotizid) return null
  if (!Array.isArray(cotizaciones)) return null
  return cotizaciones.find((c) => c.id === card.cotizid) || null
}

// ── COTIZACION ESPECIAL ("Otros") ─────────────────────────────
// Cuando la cotizacion se hizo con Juego u "Otro (especificar)" en Seccion, el
// trato NO corresponde a una zona del catalogo: son varios juegos y varias
// secciones con un importe negociado a mano. Su precio es el "Monto Area"
// capturado en la cotizacion y NADA debe recalcularlo con las tarifas.
//
// Devuelve true (especial), false (normal) o NULL cuando todavia no se puede
// afirmar — `cotizaciones` llega asincrona, y dar por normal lo que aun no se
// sabe recalculaba el area acordada contra el catalogo.
// Ante la duda NO se toca el dinero: hace falta un `false` explicito.
export function es_cotiz_especial(card, cotizaciones) {
  if (!card) return false
  if (String(card.zonaid || '') === 'otro') return true
  if (card.esespecial === true) return true
  // Sin cotizacion de origen es una tarjeta normal, y eso si es concluyente.
  if (!card.cotizid) return false
  const cot = cotiz_origen(card, cotizaciones)
  if (!cot) return null // aun no cargada: indeterminado
  return String(cot.zonaid || '') === 'otro' || String(cot.juegoid || '') === 'otros'
}

// "No consta que sea normal": true tanto para las especiales como mientras no
// se pueda determinar. Es la condicion con la que se BLOQUEA cualquier
// recalculo del area.
export function no_recalcular_area(card, cotizaciones) {
  return es_cotiz_especial(card, cotizaciones) !== false
}

// espejo de _pdTotalReservaCard() SIN EL MODAL ABIERTO, que es el unico caso
// que existe aqui: la v1 consulta ahi #pd-monto-inp y `prospectoActivo`, dos
// cosas que solo viven mientras se edita una tarjeta en pantalla.
//
// Fuera del modal la v1 se comporta asi, y asi se migra:
//   · especial o indeterminada → el monto de la TARJETA (nada lo recalcula)
//   · normal con reservas activas → la suma de sus netos
//   · normal SIN reservas activas → 0
// Ese ultimo 0 puede sorprender —parece que deberia ser el monto de la
// tarjeta— pero es lo que devuelve _pdMontoActual() sin modal, y cambiarlo
// aqui haria que la v2 diera un total distinto al de la v1 sobre los mismos
// datos. La cascada nunca llega a esa rama: saldo_pendiente_card solo llama
// aqui dentro del caso "especial", que sale por la primera linea.
export function total_reserva_card(card, ctx) {
  if (!card) return 0
  if (no_recalcular_area(card, ctx.cotizaciones)) return Number(card.monto) || 0
  const activas = reservas_activas(card, ctx.reservas)
  if (activas.length) {
    return activas.reduce(
      (s, r) => s + Math.max(0, num_monto(r.monto) - num_monto(r.descuentomonto)),
      0
    )
  }
  return 0
}

const TOL = 0.01 // tolerancia de centavos por redondeos

export function saldo_pendiente_card(card, ctx) {
  const activas = reservas_activas(card, ctx.reservas)
  // Suma REAL de abonos del historial (la misma que pinta "Abonado" en la
  // tarjeta): la validacion jamas debe contradecir lo que el usuario ve.
  const abonadocard = pagos_de_tarjeta(card, ctx.cobros || [])
    .reduce((s, p) => s + num_monto(p.monto), 0)

  // COTIZACION ESPECIAL: el total lo manda la tarjeta. Con el neto de la
  // reserva, el restante salia mal y la tarjeta se daba por liquidada con la
  // mayor parte del trato sin cobrar.
  if (no_recalcular_area(card, ctx.cotizaciones)) {
    const totalesp = total_reserva_card(card, ctx)
    const pagadoesp = Math.max(
      abonadocard,
      activas.reduce((s, r) => s + num_monto(r.montopagado), 0)
    )
    const saldoesp = totalesp - pagadoesp
    return saldoesp <= TOL ? 0 : redondear_dinero(saldoesp)
  }

  if (activas.length) {
    let netototal = 0
    let pagadofilas = 0
    let todasliquidadas = true
    activas.forEach((r) => {
      const neto = Math.max(0, num_monto(r.monto) - num_monto(r.descuentomonto))
      const pagado = num_monto(r.montopagado)
      netototal += neto
      pagadofilas += pagado
      // Liquidada por monto (incluye sobrepago con comision) o por marca
      // valida. `modificada` solo existe mientras el Pipeline edita la reserva
      // en memoria: no es columna de la base, y aqui siempre viene sin marcar.
      const liq = pagado >= neto - TOL || (reserva_liquidada(r) && !r.modificada)
      if (!liq) todasliquidadas = false
    })
    if (todasliquidadas) return 0
    // total neto − lo MAYOR entre lo registrado en la fila y la suma real de
    // abonos: cubre la fila desincronizada (monto_pagado en 0 con abonos
    // completos en cobros) que inventaba un "saldo pendiente" fantasma.
    const pagadoreal = Math.max(pagadofilas, abonadocard)
    const saldo = netototal - pagadoreal
    return saldo <= TOL ? 0 : redondear_dinero(saldo)
  }

  const sinreserva = num_monto(card.monto) - abonadocard
  return sinreserva <= TOL ? 0 : redondear_dinero(sinreserva)
}

// Con una reserva activa vinculada, el porcentaje pagado decide la columna:
//   sin abono            → Reserva Momentanea (el apartado sin cobro)
//   abono < enganche     → Reserva Momentanea
//   enganche ≤ x < total → Reservas (reserva firme)
//   liquidada            → Reserva Completada
// El corte NO es un 50 escrito a mano: es el % vigente de politica_pagos, el
// mismo que valida el arrastre manual.
export function etapa_por_abono(card, ctx) {
  if (!card) return null
  if (!reservas_activas(card, ctx.reservas).length) return null
  const monto = num_monto(card.monto)
  if (monto <= 0) return null
  const abonado = abonado_etapa(card, ctx.cobros)
  if (abonado <= 0) return 'reserva_momentanea'
  if (saldo_pendiente_card(card, ctx) <= 0 || abonado >= monto) return 'cerrado'
  return abonado >= enganche_requerido(card, ctx.enganchemin) ? 'reservado' : 'reserva_momentanea'
}

// Porcentaje abonado, solo para explicarlo en avisos e historial.
export function pct_abonado(card, ctx) {
  const monto = num_monto(card && card.monto)
  if (monto <= 0) return 0
  return Math.floor((abonado_etapa(card, ctx.cobros) / monto) * 100)
}

// ¿Le toca cambiar de columna sola? Solo ASCIENDE: una cancelacion de cobro no
// devuelve la tarjeta a una columna anterior — eso sigue siendo decision de
// quien la arrastra.
export function debe_reclasificar(card, ctx) {
  const destino = etapa_por_abono(card, ctx)
  if (!destino || !card) return null
  return indice_etapa(destino) > indice_etapa(card.etapa) ? destino : null
}
