// ═══════════════════════════════════════════════════════════════════
// prospectos.js — reglas de negocio del Pipeline Comercial.
// espejo 1:1 de v1: _nuevoProspectoFolio(), calcPipTotal(),
// _descuentoVolumenAplicable(), _reglaVolumenActiva(), _pdBrutoTarjeta(),
// _pdPuedeGenerarReserva() y las CINCO validaciones del handler de `drop`
// (js/modules/pipeline.js 389-490, 2695-2790 · js/modules/utils.js).
//
// Todo PURO: recibe los datos ya cargados y no toca la base. La escritura vive
// en hooks/useprospectos.js. Asi las reglas que deciden si una tarjeta puede
// avanzar —que son reglas de DINERO— se prueban con miles de casos.
// ═══════════════════════════════════════════════════════════════════

import { redondear_dinero } from './dinero'
import { pipeline_etapas, reservas_activas, abonado_etapa, enganche_requerido } from './pipeline'
import { email_valido, tel_valido } from './reservasadmin'

// ── FOLIO ────────────────────────────────────────────────────────
// PROS-001, PROS-002… El siguiente sale del maximo ya usado, igual que la v1
// al cargar el tablero. Se recalcula cada vez en vez de guardarse en una
// variable de modulo: dos pestañas abiertas compartian contador y se pisaban.
export function nuevo_folio_prospecto(pipeline) {
  const max = (pipeline || []).reduce((m, p) => {
    const n = parseInt(String(p.folio || '').replace(/^PROS-0*/, ''), 10)
    return isNaN(n) ? m : Math.max(m, n)
  }, 0)
  return 'PROS-' + String(max + 1).padStart(3, '0')
}

// ── DESCUENTO POR VOLUMEN / GRUPO ────────────────────────────────
// ¿La regla esta REALMENTE activa? Solo lo afirmativo cuenta. Antes se
// rechazaba unicamente `activo === false`, asi que una regla guardada como
// 'Inactivo' se aplicaba igual: el descuento salia en cotizaciones y checkout
// aunque el admin la hubiera desactivado.
export function regla_volumen_activa(rg) {
  if (!rg) return false
  const crudo = rg.activo != null ? rg.activo : rg.estado
  if (crudo == null) return false // sin señal explicita: NO aplica
  if (typeof crudo === 'boolean') return crudo
  const n = String(crudo).trim().toLowerCase()
  return n === 'true' || n === 'activo' || n === 'active' || n === '1' || n === 'si' || n === 'sí'
}

// La mejor regla ACTIVA (mayor %) que cumpla: personas >= minimo, juego dentro
// de la lista (NULL/[] = todos) y zona dentro de la lista (NULL/[] = todas).
// Una regla con lista especifica NO aplica si aun no hay juego/zona elegidos.
export function descuento_volumen_aplicable(reglas, personas, juegoid, zonaid) {
  let mejor = null
  ;(reglas || []).forEach((rg) => {
    if (!regla_volumen_activa(rg)) return
    if (!((parseInt(personas, 10) || 0) >= (parseInt(rg.minpersonas, 10) || 0))) return
    const js = Array.isArray(rg.juegos) && rg.juegos.length ? rg.juegos.map(String) : null
    if (js && (!juegoid || js.indexOf(String(juegoid)) < 0)) return
    const zs = Array.isArray(rg.zonas) && rg.zonas.length ? rg.zonas.map(String) : null
    if (zs && (!zonaid || zs.indexOf(String(zonaid)) < 0)) return
    if (!mejor || (Number(rg.porcentaje) || 0) > (Number(mejor.porcentaje) || 0)) mejor = rg
  })
  return mejor
}

// ── TOTAL DE UNA COTIZACION DE PROSPECTO ─────────────────────────
// espejo de calcPipTotal(). Las cantidades capturadas son personas
// ADICIONALES al minimo que ya incluye el precio del area, y cada una se cobra
// SIEMPRE a su tarifa extra — sin restar el minimo de la seccion.
//
// El descuento por grupo es ADITIVO al manual (mismo modelo que el checkout:
// cupon + volumen sobre el subtotal), y el combinado se acota al 100%: sin ese
// tope, un manual del 80% mas un grupo del 30% daba un total NEGATIVO.
//
// Un cupon de MONTO FIJO se convierte a su % equivalente sobre el subtotal de
// ESTE momento, para que $500 sigan siendo $500 si despues cambia el area o se
// agregan personas. Congelar el % hacia que el descuento cambiara de valor en
// silencio.
export function calc_total_prospecto(d, ctx) {
  const area = Number(d.areamonto) || 0
  const consumo = Number(d.consumomonto) || 0
  const extra = Number(d.extramonto) || 0
  const adultoprecio = Number(d.adultoextraprecio) || 0
  const adultocant = parseInt(d.adultoextracant, 10) || 0
  const ninoprecio = Number(d.ninoextraprecio) || 0
  const ninocant = parseInt(d.ninoextracant, 10) || 0
  const minimo = parseInt(d.minpersonas, 10) || 0

  const subtotal = area + consumo + extra + adultoprecio * adultocant + ninoprecio * ninocant
  const totaladultos = minimo + adultocant
  const personas = totaladultos + ninocant

  const regla = descuento_volumen_aplicable(
    (ctx && ctx.descuentosvolumen) || [], personas, d.juegoid, d.zonaid
  )
  const volumenpct = regla ? Number(regla.porcentaje) || 0 : 0

  let manualpct = Number(d.descuento) || 0
  const cupon = d.cupon || null
  if (cupon && cupon.tipo === 'fijo') {
    const pesos = Math.min(Number(cupon.valor) || 0, subtotal)
    manualpct = subtotal > 0 ? (pesos / subtotal) * 100 : 0
  }

  const pcttotal = Math.min(100, Math.max(0, manualpct + volumenpct))
  const descuentototal = redondear_dinero((subtotal * pcttotal) / 100)
  const total = Math.max(0, redondear_dinero(subtotal - descuentototal))

  return {
    subtotal: redondear_dinero(subtotal),
    total,
    descuentototal,
    volumenpct,
    manualpct,
    personas,
    adultocant,
    ninocant,
    totaladultos,
  }
}

// Subtotal BRUTO de la tarjeta: area + consumo + extra + personas extra, SIN
// descuentos. Es la base con la que se deriva descuento_monto para la reserva
// (regla de la casa: monto = BRUTO, descuento aparte).
//
// Sin detalle cargado (montobase en 0) no hay bruto confiable: se cae al monto
// de la tarjeta, que ya trae el descuento aplicado.
export function bruto_tarjeta(card, montobase) {
  if (!card) return 0
  const sub = (Number(montobase) || 0) +
    (Number(card.consumomonto) || 0) +
    (Number(card.extramonto) || 0) +
    (Number(card.adultoextraprecio) || 0) * (Number(card.adultos) || 0) +
    (Number(card.ninoextraprecio) || 0) * (Number(card.ninos) || 0)
  return redondear_dinero(sub > 0 ? sub : Number(card.monto) || 0)
}

// ── VALIDACION DEL ALTA ──────────────────────────────────────────
// Mismos campos, mismo orden y mismos textos que la v1. Devuelve la lista de
// problemas: el llamador enseña el primero y cuenta los demas.
export function validar_prospecto(d) {
  const errores = []
  const nombre = String(d.nombre || '').trim()
  const tel = String(d.tel || '').trim()
  const email = String(d.email || '').trim()

  if (!nombre) errores.push({ campo: 'nombre', mensaje: 'Selecciona un cliente existente o ingresa uno nuevo' })
  if (!tel) errores.push({ campo: 'tel', mensaje: 'El cliente necesita un teléfono' })
  else if (!tel_valido(tel)) errores.push({ campo: 'tel', mensaje: 'El teléfono debe tener 10 dígitos' })
  // El correo es OBLIGATORIO: es el canal por el que salen la confirmacion y
  // el recibo, y la llave con la que el cliente entra a "Mis Reservas". Un
  // prospecto sin correo nace incontactable y arrastra el problema a la
  // reserva y a la ficha de cliente.
  if (!email) errores.push({ campo: 'email', mensaje: 'El cliente necesita un correo electrónico' })
  else if (!email_valido(email)) errores.push({ campo: 'email', mensaje: 'El email no es válido' })
  if (!d.juegoid) errores.push({ campo: 'juego', mensaje: 'Selecciona el juego de interés' })

  return errores
}

// Validacion del guardado de la EDICION (guardarMovimientoProspecto): el
// nombre es obligatorio, y correo y telefono solo se validan si vienen.
export function validar_edicion_prospecto(d) {
  const errores = []
  if (!String(d.nombre || '').trim()) {
    errores.push({ campo: 'nombre', mensaje: 'El nombre / empresa es obligatorio' })
  }
  const email = String(d.email || '').trim()
  if (email && !email_valido(email)) {
    errores.push({ campo: 'email', mensaje: 'El email no es válido' })
  }
  const tel = String(d.tel || '').trim()
  if (tel && tel.replace(/\D/g, '').length !== 10) {
    errores.push({ campo: 'tel', mensaje: 'El teléfono debe tener 10 dígitos' })
  }
  return errores
}

// ── ¿SE PUEDE CONVERTIR ESTA TARJETA EN RESERVA? ─────────────────
// Dos condiciones, ambas en vivo:
//   1. QUE NO EXISTA YA. Con una reserva activa vinculada se apaga: volver a
//      pulsarlo creaba una segunda reserva por descuido.
//   2. QUE HAYA RESPALDO. Un abono REGISTRADO (no el numero tecleado en la
//      caja de pago), o el apartado "Pendiente", que es la zona sin cobro.
export function puede_generar_reserva(card, ctx) {
  if (reservas_activas(card, ctx.reservas).length > 0) return false
  if (abonado_etapa(card, ctx.cobros) > 0) return true
  return !!ctx.pendiente
}

export const msg_sin_pago =
  'Debes registrar un pago y confirmar la transacción antes de generar la reserva' +
  ' — o marca "Pendiente" si vas a apartar la zona sin cobro por ahora'

export const msg_ya_generada =
  'Este prospecto ya tiene su reserva. Para vincular otra, usa el desplegable de ' +
  'reservas existentes; si eliminas la vinculada, el botón vuelve a activarse.'

// ── MOVER DE COLUMNA: LAS CINCO REGLAS ───────────────────────────
// espejo exacto del handler de `drop`. Devuelve null si el movimiento procede,
// o { motivo, mensaje } si se bloquea.
//
// Avance estrictamente SECUENCIAL, un paso a la vez. El orden se deriva de
// pipeline_etapas —la misma fuente que pinta las columnas— para que nunca se
// desincronice si se agrega una etapa.
// RETROCEDER queda libre: si se cae una reserva, la tarjeta baja sin pelear.
// Solo se bloquea saltarse etapas hacia ADELANTE.
export function validar_mover_etapa(card, destinoid, ctx) {
  if (!card) return { motivo: 'sin-tarjeta', mensaje: 'No hay tarjeta que mover.' }

  // MISMA COLUMNA: no es un cambio de etapa. Soltarla donde ya estaba
  // reiniciaba el contador a "Hoy" y borraba el tiempo que llevaba esperando,
  // que es justo lo que el badge sirve para vigilar.
  if (card.etapa === destinoid) return { motivo: 'misma', mensaje: null }

  const origenidx = pipeline_etapas.findIndex((e) => e.id === card.etapa)
  const destinoidx = pipeline_etapas.findIndex((e) => e.id === destinoid)
  if (origenidx !== -1 && destinoidx !== -1 && destinoidx - origenidx > 1) {
    return {
      motivo: 'salto',
      mensaje: '⚠️ Movimiento inválido: Los prospectos deben seguir el proceso paso a paso (no se pueden saltar etapas).',
    }
  }

  const activas = reservas_activas(card, ctx.reservas)

  if (destinoid === 'reserva_momentanea' && !activas.length) {
    return {
      motivo: 'sin-reserva',
      mensaje: 'Debe generar una reserva para este prospecto antes de pasarlo a Reserva Momentánea. Usa "🏟 Generar Reserva" en su detalle.',
    }
  }

  if (destinoid === 'reservado') {
    // Regla #1 — enganche minimo DINAMICO: lo que bloquea a mano es
    // exactamente lo que deja subir solo (mismo calculo que el ascenso
    // automatico). Nunca un % escrito a mano.
    const abonado = abonado_etapa(card, ctx.cobros)
    const requerido = enganche_requerido(card, ctx.enganchemin)
    if (abonado < requerido) {
      return {
        motivo: 'sin-enganche',
        mensaje: 'No puedes mover este prospecto a esta etapa hasta que se haya cubierto el enganche mínimo requerido (' +
          ctx.enganchemin + '% del monto total).',
      }
    }
    // Regla #2 — debe existir al menos una reserva vinculada activa.
    if (!activas.length) {
      return {
        motivo: 'sin-reserva',
        mensaje: 'No se puede mover el prospecto porque no cuenta con una reserva vinculada.',
      }
    }
  }

  if (destinoid === 'cerrado') {
    // Aqui se miran TODAS las vinculadas, canceladas incluidas: la v1 usa
    // filter(Boolean) y no descarta las canceladas en esta regla.
    const vinculadas = (card.reservaids || [])
      .map((rid) => (ctx.reservas || []).find((r) => r.id === rid))
      .filter(Boolean)
    if (!vinculadas.length) {
      return { motivo: 'sin-reserva', mensaje: 'La reserva no está liquidada en su totalidad.' }
    }
    const abonado = abonado_etapa(card, ctx.cobros)
    if (abonado < (Number(card.monto) || 0)) {
      return {
        motivo: 'sin-liquidar',
        mensaje: 'El prospecto no tiene liquidado el total de su cuenta.',
        abonado,
        total: Number(card.monto) || 0,
      }
    }
  }

  if (destinoid === 'boletos_entregados') {
    const conf = activas.some((r) => Array.isArray(r.folios) && r.folios.length > 0)
    if (!conf) {
      return {
        motivo: 'sin-folio',
        mensaje: 'No es posible mover a Boletos Enviados sin haber registrado el Folio de Boletos en la reserva.',
      }
    }
  }

  return null
}
