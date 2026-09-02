// ═══════════════════════════════════════════════════════════════════
// cascadas.js — LO QUE ARRASTRA UN COBRO.
//
// Registrar o cancelar un cobro nunca es escribir una sola fila. Ese peso
// cae en tres sitios mas, y dejar cualquiera a medias descuadra el dinero:
//
//   1. SALDO A FAVOR del cliente (`clientes.saldo_favor`)
//      · abonar a saldo a favor lo SUMA; cancelar ese abono lo RESTA
//      · pagar CON saldo a favor ya lo resto; cancelar ese pago lo DEVUELVE
//   2. SALDO DE LA RESERVA vinculada (`reservas.monto_pagado/estado_pago/pago`)
//      · el credito JAMAS toca monto_pagado: es compromiso, no dinero
//   3. ETAPA de la tarjeta del Pipeline (`pipeline_prospectos.etapa`)
//      · un abono puede subirla de columna. Solo ASCIENDE.
//
// espejo 1:1 de v1: _saldoFavorDe, _moverSaldoFavor, _revertirSaldoFavorDeCobro,
// _clienteIdDeCobro (js/modules/utils.js 1265-1400), _sincronizarPagoReserva y
// _restarPagoReserva (utils.js 752-808) y _pdSincronizarEtapa
// (js/modules/pipeline.js 1886-1935).
//
// NINGUNA lanza. Todas devuelven { ok, motivo, ... } y quien llama decide el
// aviso. El orden importa y esta documentado en cada punto de llamada: la
// cascada va SIEMPRE despues de que el cobro quedo guardado — si el insert o
// la cancelacion fallan, el dinero no debe moverse.
// ═══════════════════════════════════════════════════════════════════

import {
  actualizar_verificado, motivo_bloqueo, registrar_movimiento,
} from './escritura'
import { redondear_dinero } from './dinero'
import { es_cobro_desde_saldo_favor, es_cobro_credito } from './cobros'
import { buscar_cliente, nombre_norm, tel_norm } from './clientes'
import {
  abonado_etapa, debe_reclasificar, pct_abonado, pipeline_etapas, reservas_activas,
} from './pipeline'

export const saldo_favor_concepto = 'SALDO A FAVOR'

// ¿El CONCEPTO es un abono al saldo a favor? (el cliente entrega dinero para
// dejarlo a cuenta). Igualdad exacta normalizada, jamas substring.
export function es_abono_a_saldo_favor(concepto) {
  return String(concepto || '').toUpperCase().replace(/Á/g, 'A').trim() === saldo_favor_concepto
}

// ¿Este movimiento toca el saldo a favor, en cualquiera de sus dos sentidos?
// Decide si pedir comprobante: ninguno de los dos lados es un cobro nuevo con
// documento externo que adjuntar. Al ABONAR, el comprobante va en el cobro que
// metio el dinero; al APLICARLO, ese dinero ya entro antes y su comprobante ya
// esta archivado. Pedir uno nuevo seria pedir evidencia de algo que no mueve
// dinero.
export function toca_saldo_favor(concepto, forma) {
  return (
    es_abono_a_saldo_favor(concepto) ||
    es_cobro_desde_saldo_favor({ concepto, formapago: forma })
  )
}

// ── 1. SALDO A FAVOR ────────────────────────────────────────────

// Se lee de la BASE, no del espejo local: otra caja pudo haberlo movido hace
// un minuto y aplicar de mas seria dinero mal contado.
// null = no disponible (falta la columna, o el cliente no existe).
export async function saldo_favor_de(sb, clienteid) {
  if (clienteid == null || clienteid === '') return null
  try {
    const { data, error } = await sb
      .from('clientes').select('saldo_favor').eq('id', clienteid).maybeSingle()
    if (error) {
      // Sin la columna (migracion pendiente) el sistema sigue funcionando: el
      // saldo a favor simplemente no esta disponible todavia.
      if (/saldo_favor/.test(error.message || '')) return null
      throw error
    }
    return data ? Number(data.saldo_favor) || 0 : null
  } catch (e) {
    console.error('No se pudo leer el saldo a favor:', e.message || e)
    return null
  }
}

// Suma (delta > 0) o resta (delta < 0) al saldo del cliente.
//
// opts.topeencero cambia que pasa cuando la resta se pasa. La diferencia
// importa y no es un detalle:
//   · Aplicando saldo a una reserva, quedarse corto debe FALLAR — pagar con
//     dinero que no existe es inventarlo.
//   · Deshaciendo un abono cancelado, rechazar seria peor que el problema:
//     dejaria intacto el credito fantasma que se esta tratando de quitar. Que
//     el abono ya no alcance solo significa que parte se gasto antes; el
//     respaldo desaparecio y el saldo correcto es 0.
//
// Hasta 3 intentos con GUARDA de concurrencia (`.eq('saldo_favor', actual)`):
// si otra caja movio el saldo entre la lectura y la escritura, la guarda
// rechaza, se vuelve a leer y se recalcula sobre el valor nuevo. Sin esto, dos
// cobros simultaneos se pisarian y el dinero cuadraria mal justo cuando mas
// movimiento hay.
//
// Aqui NO se usa actualizar_verificado a proposito: para el resto de las
// escrituras "0 filas" significa que RLS bloqueo en silencio, pero con una
// guarda de concurrencia significa "alguien se adelanto", que es reintentable.
// Confundir las dos cosas convertiria una colision normal en un error.
export async function mover_saldo_favor(sb, usuario, clienteid, delta, opts) {
  if (clienteid == null || clienteid === '') return { ok: false, motivo: 'sin-cliente' }
  const bloqueo = motivo_bloqueo(usuario, 'clientes')
  if (bloqueo) return { ok: false, motivo: bloqueo }

  const topeencero = !!(opts && opts.topeencero)
  const monto = redondear_dinero(Number(delta) || 0)
  if (!monto) return { ok: false, motivo: 'sin-monto' }

  for (let intento = 0; intento < 3; intento++) {
    const actual = await saldo_favor_de(sb, clienteid)
    if (actual === null) return { ok: false, motivo: 'sin-columna' }
    let nuevo = redondear_dinero(actual + monto)
    let topado = false
    if (nuevo < 0) {
      if (!topeencero) return { ok: false, motivo: 'insuficiente', saldo: actual }
      console.warn(
        'Saldo a favor topado en 0: se quiso mover ' + monto + ' sobre ' + actual +
        ' (cliente ' + clienteid + '). Parte del abono ya se habia gastado.'
      )
      nuevo = 0
      topado = true
    }

    const { data, error } = await sb
      .from('clientes')
      .update({ saldo_favor: nuevo })
      .eq('id', clienteid)
      .eq('saldo_favor', actual) // guarda: nadie lo movio mientras tanto
      .select('saldo_favor')
    if (error) {
      console.error('No se pudo actualizar el saldo a favor:', error)
      return { ok: false, motivo: 'error', error }
    }
    if (data && data.length) return { ok: true, saldo: nuevo, topado }
    // 0 filas = la guarda rechazo: alguien se adelanto. Se reintenta.
  }
  return { ok: false, motivo: 'concurrencia' }
}

// A que ficha de cliente pertenece un cobro. La tabla `cobros` no guarda
// cliente_id, asi que se resuelve por IDENTIDAD —nombre + telefono, la regla
// de la casa— contra el catalogo, tomando el telefono de la reserva a la que
// apunta el folio cuando el cobro no lo trae.
export function cliente_id_de_cobro(c, { clientes, reservas }) {
  if (!c) return null
  const lista = clientes || []
  const reserva = c.folio
    ? (reservas || []).find((r) => String(r.id) === String(c.folio))
    : null
  const tel = tel_norm(c.tel || c.telefono) || (reserva ? tel_norm(reserva.tel) : '')
  const ficha = buscar_cliente(lista, { nombre: c.cliente, email: c.email, tel })
  if (ficha && ficha.id != null) return ficha.id

  // Ultimo recurso, por NOMBRE. Hace falta porque un abono a saldo a favor no
  // cuelga de ninguna reserva: sin folio no hay telefono que buscar, y si el
  // correo del cobro quedo vacio o distinto al de la ficha, la identidad
  // normal no resuelve — justo en el movimiento que mas importa revertir.
  // Solo vale cuando el nombre es INEQUIVOCO: con dos fichas homonimas se
  // devuelve null y sale el aviso, porque quitarle el saldo al cliente
  // equivocado es peor que no quitarselo a nadie.
  const nom = nombre_norm(c.cliente)
  if (!nom) return null
  const homonimos = lista.filter((x) => x && x.id != null && nombre_norm(x.nombre) === nom)
  return homonimos.length === 1 ? homonimos[0].id : null
}

// Deshace lo que un cobro hizo con el saldo del cliente, en la direccion que
// corresponda. Devuelve { aplicado:false } cuando el cobro no tiene nada que
// ver con el saldo, que es el caso normal y no merece aviso.
export async function revertir_saldo_favor_de_cobro(sb, usuario, c, ctx) {
  if (!c) return { aplicado: false }
  const monto = redondear_dinero(Number(c.monto) || 0)
  if (!(monto > 0)) return { aplicado: false }

  const esabono = es_abono_a_saldo_favor(c.concepto)
  const esuso = es_cobro_desde_saldo_favor(c)
  if (!esabono && !esuso) return { aplicado: false }

  const cid = ctx && ctx.clienteid != null ? ctx.clienteid : cliente_id_de_cobro(c, ctx || {})
  if (cid == null) return { aplicado: true, ok: false, motivo: 'sin-cliente' }

  // Abono cancelado → se retira del saldo. Uso cancelado → se devuelve.
  // Al restar se topa en 0: si el abono ya se gasto en parte, lo que queda sin
  // respaldo es todo, y negarse dejaria el credito fantasma en pie.
  const mov = await mover_saldo_favor(sb, usuario, cid, esabono ? -monto : monto, {
    topeencero: esabono,
  })
  return {
    aplicado: true,
    ok: !!mov.ok,
    motivo: mov.motivo,
    saldo: mov.saldo,
    topado: !!mov.topado,
    direccion: esabono ? 'resta' : 'devuelve',
  }
}

// Aviso comun: un saldo que no se pudo revertir hay que corregirlo a mano, y
// callarlo dejaria al cliente con credito fantasma.
export function texto_reversion_saldo(rev) {
  if (!rev || !rev.aplicado || rev.ok) return null
  return (
    '⚠️ El cobro se canceló, pero el SALDO A FAVOR del cliente no se pudo ajustar' +
    (rev.motivo === 'sin-cliente' ? ' (no se encontró su ficha).' : '.') +
    ' Revísalo en su ficha antes de que lo use.'
  )
}

// ── 2. SALDO DE LA RESERVA ──────────────────────────────────────

// Etiquetas derivadas del pagado, en un solo sitio: las tres funciones de
// abajo las calculaban por separado y tenian que coincidir siempre.
function estado_de_pago(nuevopagado, neto) {
  const liquidada = neto > 0 && nuevopagado >= neto
  return {
    liquidada,
    estadopago: liquidada ? 'pagado' : nuevopagado > 0 ? 'parcial' : 'pendiente',
    pagolabel: liquidada ? 'Completo' : nuevopagado > 0 ? 'Parcial' : 'Sin pago',
  }
}

// Suma un pago al saldo de la reserva.
// CREDITO: compromiso de pago, NO dinero cobrado — monto_pagado y estado_pago
// quedan intactos para que el portal, el checkout y los reportes sigan viendo
// el saldo vivo. El avance de etapa del Pipeline lo evalua sincronizar_etapa
// por su cuenta (ahi el credito SI cuenta).
export async function sincronizar_pago_reserva(sb, usuario, reservaid, monto, escredito) {
  if (!reservaid || !(monto > 0)) return { ok: false, motivo: 'sin-datos' }
  if (escredito) return { ok: true, credito: true, liquidada: false }

  const rr = await sb
    .from('reservas').select('id, monto, monto_pagado, descuento_monto, estado')
    .eq('id', String(reservaid)).maybeSingle()
  if (rr.error || !rr.data) return { ok: false, motivo: 'reserva-no-encontrada' }
  if (String(rr.data.estado || '').toLowerCase() === 'cancelada') {
    return { ok: false, motivo: 'cancelada' }
  }

  const nuevopagado = Number(rr.data.monto_pagado || 0) + Number(monto)
  const neto = Math.max(0, (Number(rr.data.monto) || 0) - (Number(rr.data.descuento_monto) || 0))
  const { liquidada, estadopago, pagolabel } = estado_de_pago(nuevopagado, neto)
  // La v1 aqui deja 'parcial'/'Parcial' aunque el pagado sea 0; como esta rama
  // exige monto > 0, nuevopagado nunca es 0 y las dos coinciden.
  const res = await actualizar_verificado(
    sb, usuario, 'reservas',
    { monto_pagado: nuevopagado, estado_pago: estadopago, pago: pagolabel },
    String(reservaid),
    ['monto_pagado', 'estado_pago', 'pago']
  )
  if (!res.ok) return { ok: false, motivo: res.motivo, error: res.error }
  // se devuelven tambien las etiquetas para que quien llama refresque su copia
  // local sin recalcularlas — la v1 lo hace mutando reservasData en el sitio.
  return { ok: true, pagado: nuevopagado, liquidada, estadopago, pagolabel }
}

// Resta un pago CANCELADO del saldo de la reserva (espejo del anterior pero
// hacia abajo): lectura fresca → monto_pagado baja sin quedar negativo →
// estado_pago/pago recalculados.
export async function restar_pago_reserva(sb, usuario, reservaid, monto) {
  if (!reservaid || !(monto > 0)) return { ok: false, motivo: 'sin-datos' }

  const rr = await sb
    .from('reservas').select('id, monto, monto_pagado, descuento_monto, estado')
    .eq('id', String(reservaid)).maybeSingle()
  if (rr.error || !rr.data) return { ok: false, motivo: 'reserva-no-encontrada' }

  const nuevopagado = Math.max(0, Number(rr.data.monto_pagado || 0) - Number(monto))
  const neto = Math.max(0, (Number(rr.data.monto) || 0) - (Number(rr.data.descuento_monto) || 0))
  const { estadopago, pagolabel } = estado_de_pago(nuevopagado, neto)
  const res = await actualizar_verificado(
    sb, usuario, 'reservas',
    { monto_pagado: nuevopagado, estado_pago: estadopago, pago: pagolabel },
    String(reservaid),
    ['monto_pagado', 'estado_pago', 'pago']
  )
  if (!res.ok) {
    console.error('No se pudo recalcular el saldo de la reserva ' + reservaid + ':', res.error)
    return { ok: false, motivo: res.motivo, error: res.error }
  }
  return { ok: true, pagado: nuevopagado, estadopago, pagolabel }
}

// ── 3. ETAPA DE LA TARJETA DEL PIPELINE ─────────────────────────

// La tarjeta a la que pertenece un folio: el suyo propio o el de cualquiera de
// sus reservas vinculadas. Mismo criterio con el que cancelarCobro y
// guardarNuevoCobro la buscan en la v1.
export function tarjeta_de_folio(folio, pipeline) {
  if (!folio) return null
  return (pipeline || []).find((p) => {
    const folios = [p.folio].concat(p.reservaids || []).filter(Boolean).map(String)
    return folios.indexOf(String(folio)) >= 0
  }) || null
}

// Reevalua en que columna le toca estar a la tarjeta y la mueve si asciende.
// Devuelve null cuando no hay nada que cambiar, o { de, a, motivo, texto }.
//
// Solo ASCIENDE: una cancelacion no devuelve sola una tarjeta a su columna
// anterior — eso sigue siendo decision de quien la arrastra.
export async function sincronizar_etapa(sb, usuario, card, ctx) {
  if (!card) return null
  const activas = reservas_activas(card, ctx.reservas)
  const etapasconreserva = ['reservado', 'cerrado', 'boletos_entregados']
  let nuevaetapa = null
  let motivo = ''

  if (!activas.length && etapasconreserva.indexOf(card.etapa) >= 0) {
    nuevaetapa = 'cotizado'
    motivo = 'sin reservas activas vinculadas — regresa a Cotizado'
  } else if (activas.length) {
    const destino = debe_reclasificar(card, ctx)
    if (destino) {
      nuevaetapa = destino
      const etiqueta = (pipeline_etapas.find((e) => e.id === destino) || {}).label || destino
      motivo =
        destino === 'cerrado'
          ? 'reserva liquidada — sube a Reserva Completada'
          : abonado_etapa(card, ctx.cobros) <= 0
            ? 'zona apartada sin cobro todavía — pasa a ' + etiqueta
            : 'abono del ' + pct_abonado(card, ctx) + '% (enganche mínimo ' +
              ctx.enganchemin + '%) — pasa a ' + etiqueta
    }
  }
  if (!nuevaetapa || nuevaetapa === card.etapa) return null

  const etapaprevia = card.etapa
  const labelprevia =
    (pipeline_etapas.find((e) => e.id === etapaprevia) || {}).label || etapaprevia
  const etapaobj = pipeline_etapas.find((e) => e.id === nuevaetapa)
  const cambiadaen = new Date().toISOString()

  const res = await actualizar_verificado(
    sb, usuario, 'pipeline_prospectos',
    { etapa: nuevaetapa, etapa_cambiada_en: cambiadaen },
    card.id,
    ['etapa']
  )
  if (!res.ok) {
    console.error('No se pudo sincronizar la etapa:', res.error || res.motivo)
    return null
  }

  // Historial: queda la etapa de la que venia, a la que fue y POR QUE, para
  // que despues se pueda explicar por que una tarjeta cambio sola de columna.
  registrar_movimiento(sb, {
    tipo: 'Pipeline',
    desc:
      'Movida automáticamente · ' + card.nombre + ' · ' + labelprevia + ' → ' +
      (etapaobj ? etapaobj.label : nuevaetapa) + ' · ' + motivo,
    ref: card.folio || 'Pipeline Comercial',
    usuario: usuario ? usuario.nombre : '—',
  })

  return {
    de: etapaprevia,
    a: nuevaetapa,
    motivo,
    texto: '🔁 Tarjeta actualizada: ' + (etapaobj ? etapaobj.label : nuevaetapa) + ' (' + motivo + ')',
  }
}

// ── util compartido por los dos flujos ──────────────────────────
// Un cobro suma o resta al monto_pagado de la reserva SOLO si es dinero real y
// su folio apunta de verdad a una reserva. Los creditos jamas suman, asi que
// cancelarlos tampoco resta (simetria del dinero real).
export function afecta_saldo_reserva(c, reservas) {
  if (!c || !c.folio) return false
  if (es_cobro_credito(c)) return false
  return (reservas || []).some((r) => String(r.id) === String(c.folio))
}
