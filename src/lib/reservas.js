// ═══════════════════════════════════════════════════════════════════
// reservas.js — traduce una fila de `reservas` al modelo del portal.
// espejo 1:1 de v1: money(), _formaPagoSola(), _metodoPagoLegible() y
// _mapReserva() de panel-reserva.html.
//
// aqui viven las reglas de dinero y de conteo de personas que la v1 documenta
// como corregidas a pulso; se conservan al pie de la letra.
// ═══════════════════════════════════════════════════════════════════

export const money = (n) => '$' + Number(n || 0).toLocaleString('es-MX')

const bonita = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '')

export function forma_pago_sola(c) {
  const forma = String(c.forma_pago || '').trim()
  return /stripe/i.test(forma) ? 'Tarjeta Stripe' : bonita(forma.replace(/_/g, ' '))
}

export function metodo_pago_legible(c) {
  const concepto = String(c.concepto || '').trim()
  const forma_txt = forma_pago_sola(c)
  if (forma_txt && concepto && concepto.toLowerCase() !== String(c.forma_pago || '').trim().toLowerCase()) {
    return forma_txt + ' — ' + bonita(concepto)
  }
  return forma_txt || bonita(concepto) || 'Pago'
}

export function map_reserva(r, cobros) {
  const total_bruto = Number(r.monto) || 0
  const descuento = Number(r.descuento_monto) || 0

  const cobros_reserva = cobros.filter((c) => String(c.folio || '') === String(r.id))
  // Los cobros a CREDITO son un compromiso de pago, no dinero recibido: fuera
  // de la suma de abonos.
  const suma_historial = cobros_reserva
    .filter((c) => !c.es_credito)
    .reduce((sum, p) => sum + Number(p.monto || 0), 0)
  const pagado_registrado = r.monto_pagado != null ? Number(r.monto_pagado) : 0
  // pagado_real lo deriva el servidor. El fallback de la v1 INVENTABA dinero:
  // con la etiqueta "Completo" ponia pagado = bruto, asi que una cortesia del
  // 100% se leia como "Pagado $9,750" sin un peso.
  const pagado =
    r.pagado_real != null
      ? Number(r.pagado_real) || 0
      : Math.max(pagado_registrado, suma_historial)

  // FUENTE UNICA DE VERDAD del total: el servidor publica total_neto. La v1
  // lo recomponia por su cuenta sumando una "comision" INFERIDA de lo abonado,
  // asi que el total dependia de cuanto se hubiera pagado y jamas bajaba.
  const total =
    r.total_neto != null
      ? Math.max(0, Number(r.total_neto) || 0)
      : Math.max(0, total_bruto - descuento)

  // Compromiso a CREDITO vigente: no es dinero cobrado, pero si cubre el
  // saldo — el cliente no debe ver un "Por pagar" por algo ya pactado.
  const credito = Number(r.credito_monto) || 0
  const por_pagar =
    r.por_pagar != null
      ? Math.max(0, Number(r.por_pagar) || 0)
      : Math.max(0, total - pagado - credito)

  const liquidada_en_base =
    ['pagado', 'completado', 'liquidado'].indexOf(String(r.estado_pago || '').toLowerCase()) >= 0
  const es_liquidado = liquidada_en_base || (total > 0 && por_pagar <= 0)

  // ── Personas: REGLA ESTRICTA de negocio ──────────────────────────
  //   total_adultos = capacidad_base_seccion + adultos_extra
  //   total_ninos   = ninos_extra
  // Checkout en linea (adultos NULL): `personas` YA son los adultos totales.
  // Filas del panel (`adultos` = solo extras): SIEMPRE se suma la base de la
  // seccion — nunca se resta ni se confia en un `personas` sin la base.
  const ninos = Number(r.ninos) || 0
  const es_online_pura = r.adultos == null || r.adultos === ''
  const base_seccion = Number(r.base_capacity) || 0
  let adultos
  if (es_online_pura) {
    adultos = Number(r.personas) || Math.max(0, Number(r.personas) || 0) || 1
  } else if (base_seccion > 0) {
    adultos = base_seccion + (Number(r.adultos) || 0)
  } else {
    // sin base conocida: el mayor entre el total guardado menos ninos y los
    // extras — jamas menos que los extras capturados.
    adultos = Math.max((Number(r.personas) || 0) - ninos, Number(r.adultos) || 0) || 1
  }
  const personas = adultos + ninos
  const cancelada = String(r.estado || '').toLowerCase() === 'cancelada'

  // Historial: CADA cobro ligado al folio es un renglon individual. El
  // renglon sintetizado solo aparece como respaldo cuando hay monto pagado
  // pero ninguna fila en el historial (reservas previas al registro).
  let pagos = cobros_reserva
    .slice()
    .sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')))
    .map((c) => ({
      fecha: c.fecha || '',
      monto: Number(c.monto) || 0,
      metodo: metodo_pago_legible(c),
      forma: forma_pago_sola(c),
      escredito: !!c.es_credito,
    }))
  if (pagos.length === 0 && pagado > 0) {
    pagos = [{
      fecha: '', monto: pagado,
      metodo: r.metodo || 'Pago en línea (Stripe)',
      forma: r.metodo || 'Pago en línea (Stripe)',
      escredito: false,
    }]
  }

  // Metodo DINAMICO para la tarjeta de detalles: el del PAGO MAS RECIENTE.
  // El campo estatico r.metodo siempre decia "Tarjeta" aunque los abonos
  // reales fueran en efectivo o transferencia.
  const pagos_en_dinero = pagos.filter((p) => !p.escredito)
  const ultimo_pago = pagos_en_dinero[pagos_en_dinero.length - 1] || null
  const metodo_dinamico = ultimo_pago ? ultimo_pago.forma || ultimo_pago.metodo || '—' : 'Pendiente'

  // beneficios reales de la reserva (lo que si sabemos de la base).
  const beneficios = []
  if (adultos) beneficios.push(adultos + ' adulto' + (adultos === 1 ? '' : 's') + ' incluido' + (adultos === 1 ? '' : 's'))
  if (ninos) beneficios.push(ninos + ' niño' + (ninos === 1 ? '' : 's') + ' incluido' + (ninos === 1 ? '' : 's'))
  if (Number(r.saldo_consumo) > 0) beneficios.push('Saldo de consumo incluido: ' + money(r.saldo_consumo))
  if (Array.isArray(r.folios) && r.folios.length) beneficios.push('Folios ligados: ' + r.folios.join(', '))

  // Invitados: columna jsonb `invitados` (migracion opcional). Si no existe,
  // se generan los asientos segun el numero de personas, con el titular como
  // anfitrion. La v1 conservaba las ediciones en localStorage hasta migrar;
  // aqui solo se LEEN (esta fase no escribe nada).
  let invitados = Array.isArray(r.invitados) && r.invitados.length ? r.invitados : null
  if (!invitados) {
    invitados = Array.from({ length: personas }, (_, i) =>
      i === 0
        ? { nombre: r.cliente || '', correo: r.email || '', celular: r.tel || '', asiento: String(i + 1), estado: 'Anfitrion' }
        : { nombre: '', correo: '', celular: '', asiento: String(i + 1), estado: 'Sin asignar' }
    )
  }

  return {
    id: String(r.id),
    estado: cancelada ? 'pasada' : 'activa',
    badge: cancelada ? 'Cancelada' : 'Activa',
    cliente: r.cliente || '', email: r.email || '', tel: r.tel || '',
    partido: r.juego || 'Juego por confirmar',
    fecha: '',
    seccion: r.zona || '—',
    personas, adultos, ninos,
    metodo: metodo_dinamico,
    // Liquidada por saldo $0 O por estado_pago 'pagado' en la base =>
    // Pago completo (boton de saldo bloqueado y POR PAGAR $0).
    estadopago: es_liquidado ? 'pagado' : pagado > 0 ? 'parcial' : 'pendiente',
    // Cubierta con el compromiso a credito (sin dinero suficiente aun): el
    // portal lo dice con claridad en vez de fingir "Pago completo".
    cubiertaconcredito: credito > 0 && por_pagar <= 0 && !liquidada_en_base,
    saldoconsumo: Number(r.saldo_consumo) || 0,
    descuento, totalbruto: total_bruto,
    total, pagado, credito, porpagar: por_pagar, pagos, beneficios, invitados,
    // true si la columna jsonb ya existe en la base.
    persistible: Array.isArray(r.invitados),
  }
}
