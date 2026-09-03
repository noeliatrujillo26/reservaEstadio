// ═══════════════════════════════════════════════════════════════════
// clientes.js — expediente de clientes del panel.
// espejo 1:1 de v1: initClientesPage(), _agruparClientes(),
// _claveIdentidadCliente(), _buscarClienteEnLista() y sus normalizadores
// (js/22-usuarios-clientes.js y js/modules/utils.js).
//
// IDENTIDAD = NOMBRE + TELEFONO, nunca el correo. La v1 lo documenta: una
// misma persona cambia de correo, y dos personas pueden compartirlo (el de la
// empresa, el del conyuge). Agrupar por email fundia en una sola ficha a
// personas distintas y su historial nacia ya mezclado.
// ═══════════════════════════════════════════════════════════════════

import { cobro_cancelado, cobro_sin_dinero_nuevo, es_cobro_credito } from './cobros'
import { es_cortesia } from './reservasadmin'
import { redondear_dinero } from './dinero'

export function tel_norm(t) {
  return String(t || '').replace(/\D/g, '').slice(-10)
}

export function email_norm(e) {
  return String(e || '').trim().toLowerCase()
}

// nombre comparable: sin acentos, en mayusculas y con espacios colapsados
// ("José  Pérez" === "JOSE PEREZ").
export function nombre_norm(n) {
  return String(n || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function clave_identidad(c) {
  if (!c) return ''
  const t = tel_norm(c.tel)
  if (t) return 'k:' + nombre_norm(c.nombre) + '|' + t
  const e = email_norm(c.email)
  if (e && e !== '—') return 'e:' + e
  const n = nombre_norm(c.nombre)
  return n ? 'n:' + n : ''
}

// sin telefono no hay identidad comparable, asi que no hay coincidencia.
export function misma_identidad(a, b) {
  const ta = tel_norm(a && a.tel)
  const tb = tel_norm(b && b.tel)
  if (!ta || !tb || ta !== tb) return false
  const na = nombre_norm(a && a.nombre)
  const nb = nombre_norm(b && b.nombre)
  // si a alguno le falta el nombre manda el telefono: es el mismo titular y
  // el alta solo viene a completar la ficha.
  if (!na || !nb) return true
  return na === nb
}

export function buscar_cliente(lista, ref) {
  if (!lista || !ref) return null
  if (ref.id != null && ref.id !== '') {
    const porid = lista.find((x) => x.id != null && String(x.id) === String(ref.id))
    if (porid) return porid
  }
  const tref = tel_norm(ref.tel)
  if (tref) {
    const porident = lista.find((x) => misma_identidad(x, ref))
    if (porident) return porident
  }
  const e = email_norm(ref.email)
  if (!e || e === '—') return null
  // por correo SOLO si ninguno de los dos tiene telefono que comparar.
  return lista.find((x) => email_norm(x.email) === e && !(tref && tel_norm(x.tel))) || null
}

// ── expediente ──────────────────────────────────────────────────
// espejo de initClientesPage(): parte de la tabla `clientes` y le cuelga las
// reservas vivas de cada titular, con su pagado, su credito y su saldo.
//
// NOTA: la v1 amplia los folios de cada reserva con los de la tarjeta del
// Pipeline vinculada (abonos registrados antes de generar la reserva). Ese
// modulo aun no se migra, asi que aqui solo entra el folio propio — la misma
// limitacion anotada en reservasadmin.js.
// alias de un folio de prospecto en sus DOS formas: 'PROS-002' y '002'. Un
// abono puede haberse etiquetado en cualquiera de las dos segun la epoca del
// registro.
function alias_folio(f) {
  const s = String(f || '').trim()
  if (!s) return []
  return s.toUpperCase().startsWith('PROS-') ? [s, s.slice(5)] : [s, 'PROS-' + s]
}

// Telefono de quien pago: el propio del cobro si algun dia la tabla lo trae,
// y si no el de la reserva a la que apunta su folio.
function tel_de_cobro(p, reservas) {
  const propio = tel_norm(p && (p.tel || p.telefono))
  if (propio) return propio
  const r = p && p.folio ? (reservas || []).find((x) => String(x.id) === String(p.folio)) : null
  return r ? tel_norm(r.tel) : ''
}

// Folios de las tarjetas del Pipeline vinculadas a UNA reserva: las de sus
// `reserva_ids` que la incluyan, en sus dos formas. espejo del mapa
// `_foliosPipelinePorReserva` que arma initClientesPage() antes de recorrer
// las reservas -- sin esto, un abono registrado con el folio de la tarjeta
// ('081') antes de generar la reserva no sumaba, y "Pagado" mostraba solo el
// ultimo abono capturado despues en vez del total real.
function folios_pipeline_por_reserva(pipeline) {
  const mapa = {}
  ;(pipeline || []).forEach((p) => {
    if (!p || !p.folio || !Array.isArray(p.reservaids)) return
    p.reservaids.forEach((rid) => {
      const k = String(rid)
      if (!mapa[k]) mapa[k] = []
      alias_folio(p.folio).forEach((f) => mapa[k].push(f))
    })
  })
  return mapa
}

// Los folios que identifican a un CLIENTE (no a una reserva suelta): los de
// todas sus reservas, mas los de las tarjetas del Pipeline ligadas a ellas --
// en sus dos formas. espejo de _foliosDeCliente().
export function folios_de_cliente(c, pipeline) {
  const folios = new Set((c.reservas || []).map((x) => String(x.folio)))
  ;(pipeline || []).forEach((p) => {
    if (!p || !p.folio || !Array.isArray(p.reservaids)) return
    if (!p.reservaids.some((rid) => folios.has(String(rid)))) return
    alias_folio(p.folio).forEach((f) => folios.add(f))
  })
  return folios
}

// El cobro es DE este cliente? espejo de _cobroEsDelCliente(): vinculo
// explicito por cliente_id, folio de una de SUS reservas o tarjetas, o
// identidad (telefono+nombre -- o solo nombre cuando no hay telefono que
// comparar en ninguno de los dos lados). NUNCA el correo, que es lo que
// fundia en una sola ficha a titulares distintos del mismo corporativo.
export function cobro_es_del_cliente(p, c, foliosdecliente, reservas) {
  if (!p || !c) return false
  const cid = p.clienteid
  if (cid != null && cid !== '' && c.id != null && c.id !== '') return String(cid) === String(c.id)
  if (p.folio && foliosdecliente && foliosdecliente.has(String(p.folio))) return true
  const telpago = tel_de_cobro(p, reservas)
  const telcli = tel_norm(c.tel)
  if (telpago && telcli) {
    if (telpago !== telcli) return false
    const np = nombre_norm(p.cliente)
    const nc = nombre_norm(c.nombre)
    return !np || !nc || np === nc
  }
  return nombre_norm(p.cliente) === nombre_norm(c.nombre) && !!nombre_norm(c.nombre)
}

// TODOS los cobros validos de un cliente, activos y con la reserva que
// pagan (si tienen una) tambien activa. Es EL MISMO filtro que usa el pase
// final de armar_clientes() para el total, y el que pinta la tabla "Pagos
// realizados" del expediente -- una sola definicion para que nunca puedan
// decir cosas distintas.
export function pagos_de_cliente(c, cobros, reservas, pipeline) {
  const foliosc = folios_de_cliente(c, pipeline)
  return (cobros || []).filter((p) => {
    if (cobro_cancelado(p)) return false
    if (!cobro_es_del_cliente(p, c, foliosc, reservas)) return false
    const rdelpago = p.folio ? (reservas || []).find((x) => String(x.id) === String(p.folio)) : null
    return !(rdelpago && String(rdelpago.estado || '').toLowerCase() === 'cancelada')
  })
}

// -- expediente --------------------------------------------------
// espejo de initClientesPage(): PRIMERA pasada, por reserva (arma
// `c.reservas` y una suma provisional); SEGUNDA pasada, por cliente -- el
// "PASE FINAL DE CONSISTENCIA" que reconcilia el total contra TODOS sus
// cobros, no solo los de sus reservas propias.
export function armar_clientes({ clientes, reservas, cobros, pipeline }) {
  // PRIMERO las reservas, con la lista de clientes VACIA -- espejo del orden
  // exacto de initClientesPage(): alli `_clientesData` arranca sembrada solo
  // por pedidos locales (que la v2 no migra a proposito, ver cabecera), y la
  // tabla `clientes` de Supabase se fusiona DESPUES, ya con el historial
  // construido. El orden importa de verdad: dos clientes de la tabla con el
  // MISMO NOMBRE (uno con telefono, otro sin el) solo se distinguen si sus
  // reservas se atribuyen ANTES de que ambos esten en la lista a la vez --
  // fusionarlos desde el inicio deja el segundo homonimo sin sus reservas,
  // porque la primera coincidencia por identidad se las queda a las dos.
  const lista = []

  // Mapa reserva -> folios de su tarjeta del Pipeline, UNA sola vez para
  // todas las reservas (evita recalcularlo dentro del forEach).
  const foliospipeline = folios_pipeline_por_reserva(pipeline)

  reservas.forEach((r) => {
    // basta con saber de quien es: nombre o telefono. Exigir correo dejaba
    // fuera del expediente a las reservas capturadas solo con WhatsApp.
    if (!r.email && !r.tel && !r.cliente) return
    // las CANCELADAS quedan fuera del expediente: es el soft-delete del
    // proyecto y no deben sumar en ninguna metrica.
    if (String(r.estado || '').toLowerCase() === 'cancelada') return

    // los folios de ESTA reserva: el propio MAS los de la tarjeta del
    // Pipeline que la generase -- un abono capturado antes de existir la
    // reserva, con el folio del prospecto, tambien es suyo.
    const folios = [String(r.id)].concat(foliospipeline[String(r.id)] || [])
    let credito = 0
    // PAGADO REAL = solo DINERO; el credito se acumula aparte porque es
    // cuenta por cobrar.
    const cobrado = (cobros || []).reduce((s, p) => {
      if (cobro_cancelado(p) || folios.indexOf(String(p.folio || '')) < 0) return s
      if (es_cobro_credito(p)) { credito += Number(p.monto) || 0; return s }
      return s + (Number(p.monto) || 0)
    }, 0)

    const base = r.montopagado != null
      ? Number(r.montopagado) || 0
      : r.pago === 'Completo' ? r.monto
      : r.pago === 'Sin pago' ? 0
      : redondear_dinero(r.monto * 0.3)
    const montopagado = Math.max(base, cobrado)
    // saldo contra el precio NETO (monto − descuento), nunca negativo.
    const neto = Math.max(0, (Number(r.monto) || 0) - (Number(r.descuentomonto) || 0))

    const item = {
      zona: r.zona, juego: r.juego, montopagado, neto, credito,
      saldo: Math.max(0, neto - montopagado), folio: r.id,
      // con neto 0 el expediente diria "Pagado", que es cierto pero no dice
      // nada: se marca para distinguir la cortesia del cobro real.
      cortesia: es_cortesia(r),
    }

    let c = buscar_cliente(lista, { nombre: r.cliente, email: r.email, tel: r.tel })
    // de-duplicacion estricta por folio: la misma reserva jamas se cuenta dos veces.
    if (c && c.reservas.some((x) => String(x.folio) === String(r.id))) return
    if (!c) {
      c = {
        id: null, nombre: r.cliente || '—', email: r.email || '—', tel: r.tel || '—',
        empresa: '', creditoautorizado: false, saldofavor: 0,
        reservas: [], totalpagado: 0, saldototal: 0, creditototal: 0,
      }
      lista.push(c)
    }
    c.reservas.push(item)
    c.totalpagado += item.montopagado
    c.saldototal += item.saldo
    c.creditototal += item.credito
  })

  // SEGUNDO, se fusiona la tabla `clientes` de Supabase: si ya hay un
  // derivado con su identidad, se le pega el id y los datos propios de la
  // ficha (credito autorizado, saldo a favor); si no, se agrega una entrada
  // nueva sin reservas -- espejo del merge de initClientesPage().
  ;(clientes || []).forEach((c) => {
    const existente = buscar_cliente(lista, { nombre: c.nombre, email: c.email, tel: c.tel })
    if (existente) {
      existente.id = c.id
      if (c.nombre) existente.nombre = c.nombre
      if (c.tel) existente.tel = c.tel
      existente.empresa = c.empresa || existente.empresa || ''
      existente.creditoautorizado = !!c.credito_autorizado
      existente.saldofavor = Number(c.saldo_favor) || 0
    } else {
      lista.push({
        id: c.id,
        nombre: c.nombre || '—',
        email: c.email || '—',
        tel: c.tel || '—',
        empresa: c.empresa || '',
        creditoautorizado: !!c.credito_autorizado,
        saldofavor: Number(c.saldo_favor) || 0,
        reservas: [], totalpagado: 0, saldototal: 0, creditototal: 0,
      })
    }
  })

  // -- PASE FINAL DE CONSISTENCIA (tarjetas vs historial) ----------
  // TOTAL PAGADO = lo MAYOR entre lo atribuido por reserva y la SUMA real de
  // TODOS los cobros validos del cliente (cliente_id, folio o
  // nombre+telefono -- NUNCA el correo). Asi un pago registrado bajo un
  // folio de prospecto huerfano (una tarjeta sin reserva vinculada) cuenta
  // igual que en el historial: nunca "$0 arriba, $9,750 abajo".
  // SALDO PENDIENTE = neto total de sus reservas activas menos ese pagado.
  lista.forEach((c) => {
    const netototal = c.reservas.reduce((s, r) => s + (Number(r.neto) || 0), 0)
    const pagadoporreservas = c.reservas.reduce((s, r) => s + (Number(r.montopagado) || 0), 0)
    // dinero real; el credito y las APLICACIONES de saldo a favor quedan
    // fuera -- ninguno de los dos es dinero nuevo: el credito es cuenta por
    // cobrar, y el saldo a favor ya conto como pagado cuando se abono. Solo
    // el credito importa para el badge "A credito" de arriba.
    const pagadoporcobros = pagos_de_cliente(c, cobros, reservas, pipeline).reduce(
      (s, p) => s + (cobro_sin_dinero_nuevo(p) ? 0 : Number(p.monto) || 0), 0
    )
    c.totalpagado = Math.max(pagadoporreservas, pagadoporcobros) || 0
    c.saldototal = Math.max(0, netototal - c.totalpagado)
  })

  return lista
}

// ── buscador y orden ────────────────────────────────────────────
export function filtrar_clientes(lista, busqueda) {
  const q = String(busqueda || '').trim().toLowerCase()
  if (!q) return lista
  return lista.filter(
    (c) =>
      String(c.nombre || '').toLowerCase().includes(q) ||
      String(c.email || '').toLowerCase().includes(q) ||
      String(c.tel || '').toLowerCase().includes(q)
  )
}

export function ordenar_clientes(lista, col, dir) {
  const s = dir === 'asc' ? 1 : -1
  return [...lista].sort((a, b) => {
    if (col === 'reservas') return (a.reservas.length - b.reservas.length) * s
    if (col === 'totalpagado') return (a.totalpagado - b.totalpagado) * s
    if (col === 'saldototal') return (a.saldototal - b.saldototal) * s
    return String(a[col] || '').localeCompare(String(b[col] || ''), 'es') * s
  })
}

export const por_pagina = 25

// ── CATALOGO PARA LOS BUSCADORES DE CLIENTE ─────────────────────
// espejo 1:1 de v1: _resGetClientes(), _fichaMasCompleta() y _cliCoincide()
// (js/20-editor-mapa.js). Lo usan los formularios que piden "elige un
// cliente" — el alta de reserva y el registro de cobro.
//
// Sale de las fichas de `clientes` MAS los titulares que solo existen en una
// reserva (los que reservaron en linea sin darse de alta). Se deduplica por
// IDENTIDAD, no por id de fila: dos registros de la misma persona salian los
// dos en el buscador, y elegir "el equivocado" mandaba el cobro a una ficha
// sin saldo a favor.
function ficha_mas_completa(a, b) {
  if (!a) return b
  if (!b) return a
  const puntos = (c) =>
    (c.id != null && c.id !== '' ? 4 : 0) +
    (String(c.email || '').trim() && c.email !== '—' ? 2 : 0) +
    (String(c.tel || '').trim() && c.tel !== '—' ? 2 : 0) +
    (String(c.empresa || '').trim() ? 1 : 0) +
    (String(c.nombre || '').trim() ? 1 : 0)
  return puntos(b) > puntos(a) ? b : a
}

export function catalogo_clientes({ clientes, reservas }) {
  const poridentidad = new Map()
  const agregar = (c) => {
    if (!c) return
    // Sin nombre ni correo ni telefono no hay nada que ofrecer.
    if (!String(c.nombre || '').trim() && !String(c.email || '').trim() && !String(c.tel || '').trim()) return
    const k = clave_identidad(c)
    if (!k) return
    // De dos fichas de la misma persona se ofrece la MAS COMPLETA.
    poridentidad.set(k, poridentidad.has(k) ? ficha_mas_completa(poridentidad.get(k), c) : c)
  }

  ;(clientes || []).forEach((c) =>
    agregar({
      id: c.id,
      nombre: c.nombre || '',
      email: c.email && c.email !== '—' ? c.email : '',
      tel: c.tel && c.tel !== '—' ? c.tel : '',
      empresa: c.empresa || '',
    })
  )
  ;(reservas || []).forEach((r) =>
    agregar({ nombre: r.cliente || '', email: r.email || '', tel: r.tel || '' })
  )

  // Alfabetico por nombre, que es como el usuario busca.
  return Array.from(poridentidad.values()).sort((a, b) =>
    String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' })
  )
}

// ¿El cliente coincide con lo tecleado? Busca en nombre, correo, empresa Y
// TELEFONO — el telefono comparado por DIGITOS, para que "662 123" encuentre
// a quien tiene guardado "6621234567".
export function cliente_coincide(c, q) {
  const lq = String(q || '').trim().toLowerCase()
  if (!lq) return true
  if (String(c.nombre || '').toLowerCase().includes(lq)) return true
  if (String(c.email || '').toLowerCase().includes(lq)) return true
  if (String(c.empresa || '').toLowerCase().includes(lq)) return true
  const digitos = lq.replace(/\D/g, '')
  if (digitos && String(c.tel || '').replace(/\D/g, '').includes(digitos)) return true
  return false
}

// Reservas VIVAS de un cliente. Solo las suyas y solo las vivas: cobrar contra
// una reserva cancelada dejaria el dinero colgando de algo que ya no existe.
// La identidad se compara por telefono y, a falta de el, por nombre — misma
// regla que _ncReservasDelCliente().
export function reservas_del_cliente(cliente, reservas) {
  if (!cliente) return []
  const tel = tel_norm(cliente.tel)
  const nom = nombre_norm(cliente.nombre)
  return (reservas || []).filter((r) => {
    if (String(r.estado || '').toLowerCase() === 'cancelada') return false
    const tr = tel_norm(r.tel)
    if (tel && tr) return tel === tr
    return nombre_norm(r.cliente) === nom
  })
}
