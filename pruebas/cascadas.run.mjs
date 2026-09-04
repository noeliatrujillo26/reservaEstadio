// ═══════════════════════════════════════════════════════════════════
// cascadas.run.mjs — BANCO DIFERENCIAL de la cascada del dinero.
//
// Metodo de siempre para todo lo que toca dinero: se copia la funcion de la
// v1 TAL CUAL (mismas cuentas, mismos nombres de campo camelCase) y se corre
// contra la migrada sobre miles de casos aleatorios. Cero diferencias, o hay
// un bug. Es lo que atrapo en su dia que los creditos se contaban como
// ingresos por mirar `formapago` y no `formaPago`.
//
// Aqui la prueba es especialmente necesaria: al migrar se renombraron TODOS
// los campos a minusculas (montoPagado → montopagado, reservaIds →
// reservaids…). Este banco demuestra que el renombrado no movio ni un peso.
//
// Se corre con:  npm run verificar-cascadas
// ═══════════════════════════════════════════════════════════════════

import { spawnSync } from 'node:child_process'

const build = spawnSync(
  'npx',
  ['vite', 'build', '--ssr', 'pruebas/cascadas.js', '--outDir', 'pruebas/out-cascadas', '--logLevel', 'error'],
  { stdio: 'inherit', shell: true, env: { ...process.env, VITE_ESCRITURA_ADMIN: 'true' } }
)
if (build.status !== 0) {
  console.log('FALLA la compilacion del puente de pruebas')
  process.exit(1)
}
const v2 = await import('../pruebas/out-cascadas/cascadas.js')

// ══ ESTADO GLOBAL QUE USA LA V1 ═══════════════════════════════════
// La v1 lee arreglos globales; se declaran aqui y cada caso los rellena.
let reservasData = []
let pdPagos = {}
let pipelineData = []
let cotizaciones = []
let _clientesData = []
let _politicaEngancheMin = 50
const prospectoActivo = null

const pipelineEtapas = [
  { id: 'prospecto', label: 'Prospecto' },
  { id: 'cotizado', label: 'Cotizado' },
  { id: 'reserva_momentanea', label: 'Reserva Momentánea' },
  { id: 'reservado', label: 'Reservas' },
  { id: 'cerrado', label: 'Reserva completada' },
  { id: 'boletos_entregados', label: 'Boletos enviados' },
]

// ══ V1 COPIADA LITERAL ════════════════════════════════════════════

function redondearDinero(n) {
  const v = Number(n)
  if (!isFinite(v)) return 0
  const r = Math.round(Math.abs(v) * 100 + 1e-9) / 100
  return v < 0 ? -r : r
}

function _cobroCancelado(c) {
  return String((c && c.estado) || '').toLowerCase() === 'cancelado'
}

function _esPagoCredito(concepto, forma) {
  var norm = function (v) { return String(v || '').toUpperCase().replace(/É/g, 'E') }
  return norm(concepto) === 'CREDITO' || norm(forma) === 'CREDITO'
}
function _esCobroCredito(c) {
  return !!c && _esPagoCredito(c.concepto, c.formaPago || c.forma || c.forma_pago)
}

function _esPagoDesdeSaldoFavor(concepto, forma) {
  var norm = function (v) { return String(v || '').toUpperCase().replace(/Á/g, 'A').trim() }
  return norm(forma) === 'SALDO A FAVOR'
}
function _esCobroDesdeSaldoFavor(c) {
  return !!c && _esPagoDesdeSaldoFavor(c.concepto, c.formaPago || c.forma || c.forma_pago)
}
function _esAbonoASaldoFavor(concepto) {
  return String(concepto || '').toUpperCase().replace(/Á/g, 'A').trim() === 'SALDO A FAVOR'
}
function _tocaSaldoFavor(concepto, forma) {
  return _esAbonoASaldoFavor(concepto) || _esPagoDesdeSaldoFavor(concepto, forma)
}
function _cobroSinDineroNuevo(c) {
  return _esCobroCredito(c) || _esCobroDesdeSaldoFavor(c)
}

function _reservaLiquidadaLocal(r) {
  if (!r) return false
  const ep = String(r.estadoPago || r.estado_pago || '').toLowerCase()
  if (['pagado', 'completado', 'liquidado'].indexOf(ep) >= 0) return true
  const neto = (Number(r.monto) || 0) - Number(r.descuentoMonto || r.descuento_monto || 0)
  return neto > 0 && Number(r.montoPagado || r.monto_pagado || 0) >= neto
}

function _pdNumMonto(v) {
  if (typeof v === 'string') v = v.replace(/[$,\s]/g, '')
  var n = Number(v)
  return isNaN(n) ? 0 : n
}

function _pdReservasActivas(card) {
  return (card.reservaIds || [])
    .map(function (rid) { return reservasData.find(function (r) { return r.id === rid }) })
    .filter(function (r) { return r && String(r.estado || '').toLowerCase() !== 'cancelada' })
}

function _pdAbonadoEtapa(card) {
  if (!card) return 0
  var pagos = (typeof pdPagos !== 'undefined' && pdPagos[card.id]) ? pdPagos[card.id] : []
  return redondearDinero(pagos.reduce(function (s, p) { return s + (Number(p.monto) || 0) }, 0))
}

function _pdEngancheRequerido(card) {
  return redondearDinero(_pdNumMonto(card && card.monto) * _politicaEngancheMin / 100)
}

function _pdIndiceEtapa(etapaId) {
  return pipelineEtapas.findIndex(function (e) { return e.id === etapaId })
}

function _pdCotizOrigen(card) {
  if (!card || !card.cotizId) return null
  try {
    if (typeof cotizaciones === 'undefined' || !Array.isArray(cotizaciones)) return null
    return cotizaciones.find(function (c) { return c.id === card.cotizId }) || null
  } catch (e) { return null }
}

function _pdEsCotizEspecial(card) {
  if (!card) return false
  if (String(card.zonaId || '') === 'otro') return true
  if (card.esEspecial === true) return true
  if (card._esEspecial != null) return !!card._esEspecial
  if (!card.cotizId) return false
  var cot = _pdCotizOrigen(card)
  if (!cot) return null
  var esp = String(cot.zonaId || '') === 'otro' || String(cot.juegoId || '') === 'otros'
  card._esEspecial = esp
  return esp
}

function _pdNoRecalcularArea(card) {
  return _pdEsCotizEspecial(card) !== false
}

function _pdMontoActual() {
  // sin modal abierto: no hay #pd-monto-inp ni prospectoActivo.
  return prospectoActivo ? (prospectoActivo.monto || 0) : 0
}

function _pdTotalReservaCard(pid) {
  var card = (prospectoActivo && prospectoActivo.id === pid)
    ? prospectoActivo
    : pipelineData.find(function (c) { return c.id === pid })
  if (card && _pdNoRecalcularArea(card)) {
    return (prospectoActivo && prospectoActivo.id === pid)
      ? _pdMontoActual()
      : (Number(card.monto) || 0)
  }
  var activas = card ? _pdReservasActivas(card) : []
  if (activas.length) {
    return activas.reduce(function (s, r) {
      return s + Math.max(0, _pdNumMonto(r.monto) - _pdNumMonto(r.descuentoMonto))
    }, 0)
  }
  return _pdMontoActual()
}

function _pdSaldoPendienteCard(card) {
  var activas = _pdReservasActivas(card)
  var abonadoCard = ((typeof pdPagos !== 'undefined' && pdPagos[card.id]) || [])
    .reduce(function (s, p) { return s + _pdNumMonto(p.monto) }, 0)
  var TOL = 0.01
  if (_pdNoRecalcularArea(card)) {
    var _totalEsp = _pdTotalReservaCard(card.id)
    var _pagadoEsp = Math.max(abonadoCard, activas.reduce(function (s, r) {
      return s + _pdNumMonto(r.montoPagado)
    }, 0))
    var _saldoEsp = _totalEsp - _pagadoEsp
    return _saldoEsp <= TOL ? 0 : redondearDinero(_saldoEsp)
  }
  if (activas.length) {
    var netoTotal = 0, pagadoFilas = 0, todasLiquidadas = true
    activas.forEach(function (r) {
      var neto = Math.max(0, _pdNumMonto(r.monto) - _pdNumMonto(r.descuentoMonto))
      var pagado = _pdNumMonto(r.montoPagado)
      netoTotal += neto
      pagadoFilas += pagado
      var liq = pagado >= neto - TOL || (_reservaLiquidadaLocal(r) && !r.modificada)
      if (!liq) todasLiquidadas = false
    })
    if (todasLiquidadas) return 0
    var pagadoReal = Math.max(pagadoFilas, abonadoCard)
    var saldo = netoTotal - pagadoReal
    return saldo <= TOL ? 0 : redondearDinero(saldo)
  }
  var saldoSinReserva = _pdNumMonto(card.monto) - abonadoCard
  return saldoSinReserva <= TOL ? 0 : redondearDinero(saldoSinReserva)
}

function _pdEtapaPorAbono(card) {
  if (!card) return null
  if (!_pdReservasActivas(card).length) return null
  var monto = _pdNumMonto(card.monto)
  if (monto <= 0) return null
  var abonado = _pdAbonadoEtapa(card)
  if (abonado <= 0) return 'reserva_momentanea'
  if (_pdSaldoPendienteCard(card) <= 0 || abonado >= monto) return 'cerrado'
  return abonado >= _pdEngancheRequerido(card) ? 'reservado' : 'reserva_momentanea'
}

function _pdPctAbonado(card) {
  var monto = _pdNumMonto(card && card.monto)
  if (monto <= 0) return 0
  return Math.floor(_pdAbonadoEtapa(card) / monto * 100)
}

function _pdDebeReclasificar(card) {
  var destino = _pdEtapaPorAbono(card)
  if (!destino || !card) return null
  return _pdIndiceEtapa(destino) > _pdIndiceEtapa(card.etapa) ? destino : null
}

// _reconstruirPagosPipeline(), sin la red de seguridad de _cobrosSesion (que
// depende de la sesion del navegador, no de las cuentas).
function _reconstruirPagosPipeline(cobros) {
  pdPagos = {}
  pipelineData.forEach(function (p) {
    const folios = new Set([p.folio].concat(p.reservaIds || []).filter(Boolean).map(String))
    if (!folios.size) return
    const pagos = cobros.filter(function (c) {
      return folios.has(String(c.folio)) && !_cobroCancelado(c)
    })
    if (pagos.length) {
      pdPagos[p.id] = pagos.map(function (c) {
        return { cobroId: c.id, concepto: c.concepto, monto: c.monto, forma: c.formaPago }
      })
    }
  })
}

// _clienteIdDeCobro() con sus dependencias de identidad.
function _telNorm(t) { return String(t || '').replace(/\D/g, '').slice(-10) }
function _emailNorm(e) { return String(e || '').trim().toLowerCase() }
function _nombreNorm(n) {
  return String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim()
}
function _mismaIdentidadCliente(a, b) {
  const ta = _telNorm(a && a.tel), tb = _telNorm(b && b.tel)
  if (!ta || !tb || ta !== tb) return false
  const na = _nombreNorm(a && a.nombre), nb = _nombreNorm(b && b.nombre)
  if (!na || !nb) return true
  return na === nb
}
function _buscarClienteEnLista(lista, ref) {
  if (!lista || !ref) return null
  if (ref.id != null && ref.id !== '') {
    var porId = lista.find(function (x) { return x.id != null && String(x.id) === String(ref.id) })
    if (porId) return porId
  }
  var tRef = _telNorm(ref.tel)
  if (tRef) {
    var porIdent = lista.find(function (x) { return _mismaIdentidadCliente(x, ref) })
    if (porIdent) return porIdent
  }
  var e = _emailNorm(ref.email)
  if (!e || e === '—') return null
  return lista.find(function (x) {
    return _emailNorm(x.email) === e && !(tRef && _telNorm(x.tel))
  }) || null
}
function _reservaDeCobro(p) {
  if (!p || !p.folio) return null
  return reservasData.find(function (r) { return String(r.id) === String(p.folio) }) || null
}
function _telDeCobro(p) {
  var propio = _telNorm(p && (p.tel || p.telefono))
  if (propio) return propio
  var r = _reservaDeCobro(p)
  return r ? _telNorm(r.tel) : ''
}
function _clienteIdDeCobro(c) {
  if (!c) return null
  var lista = _clientesData
  var tel = _telDeCobro(c)
  var ficha = _buscarClienteEnLista(lista, { nombre: c.cliente, email: c.email, tel: tel })
  if (ficha && ficha.id != null) return ficha.id
  var nom = _nombreNorm(c.cliente)
  if (!nom) return null
  var homonimos = lista.filter(function (x) {
    return x && x.id != null && _nombreNorm(x.nombre) === nom
  })
  return homonimos.length === 1 ? homonimos[0].id : null
}

// ══ GENERADOR DE CASOS ════════════════════════════════════════════
// Semilla fija: una diferencia se reproduce corriendo la prueba otra vez.
let semilla = 20260902
function rnd() {
  semilla = (semilla * 1103515245 + 12345) & 0x7fffffff
  return semilla / 0x7fffffff
}
const elige = (a) => a[Math.floor(rnd() * a.length)]
const entre = (a, b) => a + rnd() * (b - a)
const dinero = (a, b) => Math.round(entre(a, b) * 100) / 100

const conceptos = ['ABONO', 'ANTICIPO', 'LIQUIDACION', 'CONSUMO', 'CRÉDITO', 'CREDITO',
  'SALDO A FAVOR', 'Saldo a Favor', 'BOLETOS', '']
const formas = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'CRÉDITO', 'CREDITO',
  'SALDO A FAVOR', 'Saldo A Favor', 'TARJETA DE CREDITO', '']
const estadospago = ['pagado', 'parcial', 'pendiente', 'completado', 'liquidado', '']
const nombres = ['ANA LOPEZ', 'José Pérez', 'JOSE PEREZ', 'Luis Ruiz', 'MARÍA SOTO', '']

// Una reserva en las DOS grafias, desde una sola fuente de verdad.
function nueva_reserva(id) {
  const monto = dinero(0, 40000)
  const desc = rnd() < 0.3 ? dinero(0, monto) : 0
  const base = {
    id,
    monto,
    montopagado: rnd() < 0.15 ? 0 : dinero(0, monto * 1.2),
    descuentomonto: desc,
    estadopago: elige(estadospago),
    estado: rnd() < 0.2 ? 'cancelada' : 'activa',
    tel: rnd() < 0.7 ? '66212345' + Math.floor(rnd() * 90 + 10) : '',
    cliente: elige(nombres),
  }
  return {
    v2: base,
    v1: {
      id: base.id,
      monto: base.monto,
      montoPagado: base.montopagado,
      descuentoMonto: base.descuentomonto,
      estadoPago: base.estadopago,
      estado: base.estado,
      tel: base.tel,
      cliente: base.cliente,
    },
  }
}

function nuevo_cobro(id, folios) {
  const base = {
    id,
    folio: elige(folios),
    monto: dinero(0, 30000),
    concepto: elige(conceptos),
    formapago: elige(formas),
    estado: rnd() < 0.25 ? 'cancelado' : '',
    cliente: elige(nombres),
    email: rnd() < 0.5 ? 'x@y.com' : '',
    tel: rnd() < 0.3 ? '66298765' + Math.floor(rnd() * 90 + 10) : '',
  }
  return {
    v2: base,
    v1: {
      id: base.id, folio: base.folio, monto: base.monto, concepto: base.concepto,
      formaPago: base.formapago, estado: base.estado, cliente: base.cliente,
      email: base.email, tel: base.tel,
    },
  }
}

// ══ COMPARADOR ════════════════════════════════════════════════════
let casos = 0
const difs = []
function comparar(etiqueta, a, b, ctx) {
  casos++
  const ja = JSON.stringify(a)
  const jb = JSON.stringify(b)
  if (ja !== jb && difs.length < 6) {
    difs.push({ etiqueta, v1: ja, v2: jb, ctx: JSON.stringify(ctx).slice(0, 400) })
  }
  return ja === jb
}
let fallos = 0

// ══ 1. PREDICADOS DE DINERO (30,000 casos) ════════════════════════
for (let i = 0; i < 10000; i++) {
  const concepto = elige(conceptos)
  const forma = elige(formas)
  const c1 = { concepto, formaPago: forma, monto: dinero(0, 1000) }
  const c2 = { concepto, formapago: forma, monto: c1.monto }
  if (!comparar('es_abono_a_saldo_favor', _esAbonoASaldoFavor(concepto),
    v2.es_abono_a_saldo_favor(concepto), { concepto })) fallos++
  if (!comparar('es_cobro_desde_saldo_favor', _esCobroDesdeSaldoFavor(c1),
    v2.es_cobro_desde_saldo_favor(c2), { concepto, forma })) fallos++
  if (!comparar('toca_saldo_favor', _tocaSaldoFavor(concepto, forma),
    v2.toca_saldo_favor(concepto, forma), { concepto, forma })) fallos++
  if (!comparar('cobro_sin_dinero_nuevo', _cobroSinDineroNuevo(c1),
    v2.cobro_sin_dinero_nuevo(c2), { concepto, forma })) fallos++
  if (!comparar('es_cobro_credito', _esCobroCredito(c1),
    v2.es_cobro_credito(c2), { concepto, forma })) fallos++
}

// ══ 2. CLASIFICACION DE ETAPA (8,000 escenarios) ══════════════════
for (let i = 0; i < 8000; i++) {
  const nres = Math.floor(rnd() * 3) + 1
  const reservas = []
  for (let k = 0; k < nres; k++) reservas.push(nueva_reserva('R' + (i * 10 + k)))

  const folio = 'PROS-' + i
  const reservaids = reservas.filter(() => rnd() < 0.8).map((r) => r.v2.id)
  const monto = dinero(0, 60000)
  const especial = rnd()
  const cotizid = especial < 0.3 ? 'COT-' + i : ''
  const zonaid = especial > 0.9 ? 'otro' : 'sec-1'

  const card_v2 = { id: 'p-' + i, folio, nombre: 'C' + i, monto, etapa: elige(pipelineEtapas).id,
    reservaids, cotizid, zonaid }
  const card_v1 = { id: card_v2.id, folio, nombre: card_v2.nombre, monto, etapa: card_v2.etapa,
    reservaIds: reservaids, cotizId: cotizid, zonaId: zonaid }

  const ncob = Math.floor(rnd() * 4)
  const folios = [folio, folio.slice(5), 'ajeno'].concat(reservas.map((r) => String(r.v2.id)))
  const cobros = []
  for (let k = 0; k < ncob; k++) cobros.push(nuevo_cobro(i * 100 + k, folios))

  // cotizaciones: a veces la de origen NO esta cargada (el caso indeterminado
  // que la v1 documenta y que jamas debe recalcular el area).
  const cot_v1 = []
  const cot_v2 = []
  if (cotizid && rnd() < 0.7) {
    const esp_zona = rnd() < 0.4 ? 'otro' : 'sec-2'
    const esp_juego = rnd() < 0.4 ? 'otros' : 'j1'
    cot_v1.push({ id: cotizid, zonaId: esp_zona, juegoId: esp_juego })
    cot_v2.push({ id: cotizid, zonaid: esp_zona, juegoid: esp_juego })
  }

  _politicaEngancheMin = elige([30, 40, 50, 60, 100])

  // estado global de la v1
  reservasData = reservas.map((r) => r.v1)
  pipelineData = [card_v1]
  cotizaciones = cot_v1
  _reconstruirPagosPipeline(cobros.map((c) => c.v1))

  const ctx = {
    reservas: reservas.map((r) => r.v2),
    cobros: cobros.map((c) => c.v2),
    cotizaciones: cot_v2,
    enganchemin: _politicaEngancheMin,
  }
  const resumen = { monto, etapa: card_v2.etapa, reservaids, cotizid, zonaid,
    enganche: _politicaEngancheMin }

  // pagos_de_tarjeta debe dar EXACTAMENTE el mismo conjunto que pdPagos.
  const pagos_v1 = (pdPagos[card_v1.id] || []).map((p) => p.cobroId).sort()
  const pagos_v2 = v2.pagos_de_tarjeta(card_v2, ctx.cobros).map((c) => c.id).sort()
  if (!comparar('pagos_de_tarjeta', pagos_v1, pagos_v2, resumen)) fallos++

  if (!comparar('abonado_etapa', _pdAbonadoEtapa(card_v1),
    v2.abonado_etapa(card_v2, ctx.cobros), resumen)) fallos++
  if (!comparar('reservas_activas', _pdReservasActivas(card_v1).map((r) => r.id),
    v2.reservas_activas(card_v2, ctx.reservas).map((r) => r.id), resumen)) fallos++
  if (!comparar('enganche_requerido', _pdEngancheRequerido(card_v1),
    v2.enganche_requerido(card_v2, _politicaEngancheMin), resumen)) fallos++
  if (!comparar('es_cotiz_especial', _pdEsCotizEspecial({ ...card_v1 }),
    v2.es_cotiz_especial(card_v2, cot_v2), resumen)) fallos++
  if (!comparar('total_reserva_card', _pdTotalReservaCard(card_v1.id),
    v2.total_reserva_card(card_v2, ctx), resumen)) fallos++
  if (!comparar('saldo_pendiente_card', _pdSaldoPendienteCard(card_v1),
    v2.saldo_pendiente_card(card_v2, ctx), resumen)) fallos++
  if (!comparar('etapa_por_abono', _pdEtapaPorAbono(card_v1),
    v2.etapa_por_abono(card_v2, ctx), resumen)) fallos++
  if (!comparar('pct_abonado', _pdPctAbonado(card_v1),
    v2.pct_abonado(card_v2, ctx), resumen)) fallos++
  if (!comparar('debe_reclasificar', _pdDebeReclasificar(card_v1),
    v2.debe_reclasificar(card_v2, ctx), resumen)) fallos++
}

// ══ 3. A QUE CLIENTE PERTENECE UN COBRO (6,000 casos) ═════════════
for (let i = 0; i < 6000; i++) {
  const nclientes = Math.floor(rnd() * 4)
  const clientes = []
  for (let k = 0; k < nclientes; k++) {
    clientes.push({
      id: k + 1,
      nombre: elige(nombres),
      email: rnd() < 0.6 ? 'x@y.com' : '',
      tel: rnd() < 0.6 ? '66212345' + Math.floor(rnd() * 90 + 10) : '',
    })
  }
  const reservas = [nueva_reserva('R' + i)]
  const cobro = nuevo_cobro(i, [String(reservas[0].v2.id), '', 'otro'])

  _clientesData = clientes
  reservasData = reservas.map((r) => r.v1)

  if (!comparar('cliente_id_de_cobro', _clienteIdDeCobro(cobro.v1),
    v2.cliente_id_de_cobro(cobro.v2, { clientes, reservas: reservas.map((r) => r.v2) }),
    { cobro: cobro.v2, clientes })) fallos++
}

// ══ 4. ESCRITURAS CONTRA UNA BASE FALSA ═══════════════════════════
// Aqui no se compara con la v1: se comprueba QUE SE ESCRIBE y CUANDO no se
// escribe nada. Es la parte que las cuentas puras no pueden cubrir.
// `filas` puede traer una clave por tabla con la fila que la base "ya tiene".
// Para zona_juego_estado importa la distincion entre "existe" y "no existe":
// opciones.sinFila hace que el UPDATE no toque nada y el flujo caiga al INSERT.
function base_falsa(filas, opciones) {
  const o = opciones || {}
  const escrituras = []
  const api = {
    escrituras,
    from(tabla) {
      const q = {
        _tabla: tabla, _op: null, _payload: null, _filtros: {},
        update(p) { q._op = 'update'; q._payload = p; return q },
        insert(p) { q._op = 'insert'; q._payload = p; return q },
        upsert(p) { q._op = 'upsert'; q._payload = p; return q },
        delete() { q._op = 'delete'; return q },
        eq(col, val) { q._filtros[col] = val; return q },
        select() { return q },
        maybeSingle() {
          return Promise.resolve({ data: filas[tabla] || null, error: o.errorlectura || null })
        },
        then(res, rej) {
          escrituras.push({ tabla, op: q._op, payload: q._payload, filtros: { ...q._filtros } })
          // Un UPDATE sobre una fila que no existe no toca nada: es lo que
          // empuja a set_estado_zona a insertar.
          const noExiste = o.sinFila && q._op === 'update'
          const devuelve = (o.filas === 0 || noExiste)
            ? [] : [{ ...(filas[tabla] || {}), ...q._payload }]
          const err = o.error && !(o.errorSoloEn && o.errorSoloEn !== q._op) ? o.error : null
          return Promise.resolve({ data: err ? null : devuelve, error: err }).then(res, rej)
        },
      }
      return q
    },
  }
  return api
}

const admin = { id: 1, nombre: 'Admin', rol: 'Administrador', permisos: {} }
const cajero = { id: 2, nombre: 'Caja', rol: 'Cajero', permisos: { cobros: 'editar' } }
const solover = { id: 3, nombre: 'Ver', rol: 'Solo lectura', permisos: { reportes: 'ver' } }

let pruebas_sb = 0
let fallos_sb = 0
function afirmar(desc, cond) {
  pruebas_sb++
  if (!cond) { fallos_sb++; console.log(' FALLA ' + desc) }
}

// El credito NO toca monto_pagado. Es la regla mas importante del modulo.
{
  const sb = base_falsa({ reservas: { id: 'R1', monto: 10000, monto_pagado: 2000, descuento_monto: 0, estado: 'activa' } })
  const r = await v2.sincronizar_pago_reserva(sb, admin, 'R1', 5000, true)
  afirmar('credito: no escribe en reservas', sb.escrituras.length === 0)
  afirmar('credito: se reporta como credito', r.ok === true && r.credito === true && r.liquidada === false)
}
// Dinero real: suma y recalcula las etiquetas.
{
  const sb = base_falsa({ reservas: { id: 'R1', monto: 10000, monto_pagado: 2000, descuento_monto: 0, estado: 'activa' } })
  const r = await v2.sincronizar_pago_reserva(sb, admin, 'R1', 8000, false)
  const w = sb.escrituras[0]
  afirmar('pago real: escribe monto_pagado 10000', w.payload.monto_pagado === 10000)
  afirmar('pago real: liquidada', r.liquidada === true && w.payload.estado_pago === 'pagado' && w.payload.pago === 'Completo')
}
// Una reserva cancelada no recibe pagos.
{
  const sb = base_falsa({ reservas: { id: 'R1', monto: 10000, monto_pagado: 0, descuento_monto: 0, estado: 'cancelada' } })
  const r = await v2.sincronizar_pago_reserva(sb, admin, 'R1', 500, false)
  afirmar('reserva cancelada: no escribe', sb.escrituras.length === 0 && r.motivo === 'cancelada')
}
// Restar nunca deja el pagado en negativo.
{
  const sb = base_falsa({ reservas: { id: 'R1', monto: 10000, monto_pagado: 300, descuento_monto: 0, estado: 'activa' } })
  await v2.restar_pago_reserva(sb, admin, 'R1', 5000)
  const w = sb.escrituras[0]
  afirmar('restar: topa en 0 y queda pendiente',
    w.payload.monto_pagado === 0 && w.payload.estado_pago === 'pendiente' && w.payload.pago === 'Sin pago')
}
// 0 filas sin error = RLS bloqueando en silencio. Debe tratarse como fallo.
{
  const sb = base_falsa({ reservas: { id: 'R1', monto: 10000, monto_pagado: 0, descuento_monto: 0, estado: 'activa' } }, { filas: 0 })
  const r = await v2.sincronizar_pago_reserva(sb, admin, 'R1', 500, false)
  afirmar('0 filas se trata como fallo, no como exito', r.ok === false && r.motivo === 'sin_filas')
}
// Saldo a favor: la guarda de concurrencia reintenta, no falla.
{
  let intentos = 0
  const sb = {
    from() {
      const q = {
        update(p) { q._p = p; return q },
        eq() { return q },
        select() { return q },
        maybeSingle() { return Promise.resolve({ data: { saldo_favor: 100 }, error: null }) },
        then(res) {
          intentos++
          // las dos primeras veces "alguien se adelanto" (0 filas)
          const data = intentos < 3 ? [] : [{ saldo_favor: q._p.saldo_favor }]
          return Promise.resolve({ data, error: null }).then(res)
        },
      }
      return q
    },
  }
  const r = await v2.mover_saldo_favor(sb, admin, 1, 50)
  afirmar('saldo a favor: reintenta y acaba escribiendo', r.ok === true && r.saldo === 150 && intentos === 3)
}
// Restar de mas SIN tope: se rechaza (pagar con dinero que no existe).
{
  const sb = base_falsa({ clientes: { saldo_favor: 40 } })
  const r = await v2.mover_saldo_favor(sb, admin, 1, -100)
  afirmar('saldo insuficiente: se rechaza', r.ok === false && r.motivo === 'insuficiente')
  afirmar('saldo insuficiente: no escribe', sb.escrituras.length === 0)
}
// Restar de mas CON tope (reversion de un abono ya gastado): queda en 0.
{
  const sb = base_falsa({ clientes: { saldo_favor: 40 } })
  const r = await v2.mover_saldo_favor(sb, admin, 1, -100, { topeencero: true })
  afirmar('reversion topada: queda en 0', r.ok === true && r.saldo === 0 && r.topado === true)
}
// Un cobro normal no tiene nada que revertir: ni aviso ni escritura.
{
  const sb = base_falsa({ clientes: { saldo_favor: 500 } })
  const rev = await v2.revertir_saldo_favor_de_cobro(
    sb, admin, { monto: 100, concepto: 'ABONO', formapago: 'EFECTIVO', cliente: 'ANA' },
    { clientes: [{ id: 1, nombre: 'ANA' }], reservas: [] }
  )
  afirmar('cobro normal: no aplica reversion', rev.aplicado === false && sb.escrituras.length === 0)
  afirmar('cobro normal: sin aviso', v2.texto_reversion_saldo(rev) === null)
}
// Un ABONO a saldo a favor cancelado RESTA; un pago CON saldo DEVUELVE.
{
  const sb1 = base_falsa({ clientes: { saldo_favor: 500 } })
  const r1 = await v2.revertir_saldo_favor_de_cobro(
    sb1, admin, { monto: 100, concepto: 'SALDO A FAVOR', formapago: 'EFECTIVO', cliente: 'ANA' },
    { clientes: [{ id: 1, nombre: 'ANA' }], reservas: [] }
  )
  afirmar('abono cancelado: resta', r1.direccion === 'resta' && sb1.escrituras[0].payload.saldo_favor === 400)

  const sb2 = base_falsa({ clientes: { saldo_favor: 500 } })
  const r2 = await v2.revertir_saldo_favor_de_cobro(
    sb2, admin, { monto: 100, concepto: 'ABONO', formapago: 'SALDO A FAVOR', cliente: 'ANA' },
    { clientes: [{ id: 1, nombre: 'ANA' }], reservas: [] }
  )
  afirmar('pago con saldo cancelado: devuelve', r2.direccion === 'devuelve' && sb2.escrituras[0].payload.saldo_favor === 600)
}
// Sin ficha de cliente identificable: se avisa, no se adivina.
{
  const sb = base_falsa({ clientes: { saldo_favor: 500 } })
  const rev = await v2.revertir_saldo_favor_de_cobro(
    sb, admin, { monto: 100, concepto: 'SALDO A FAVOR', formapago: 'EFECTIVO', cliente: 'FANTASMA' },
    { clientes: [], reservas: [] }
  )
  afirmar('sin ficha: no escribe', sb.escrituras.length === 0)
  afirmar('sin ficha: avisa', (v2.texto_reversion_saldo(rev) || '').includes('no se encontró su ficha'))
}
// La etapa SOLO ASCIENDE.
{
  const card = { id: 'p1', folio: 'F1', nombre: 'X', monto: 10000, etapa: 'cerrado', reservaids: ['R1'] }
  const ctx = {
    reservas: [{ id: 'R1', monto: 10000, montopagado: 100, descuentomonto: 0, estado: 'activa', estadopago: 'parcial' }],
    cobros: [{ id: 1, folio: 'F1', monto: 100, concepto: 'ABONO', formapago: 'EFECTIVO', estado: '' }],
    cotizaciones: [], enganchemin: 50,
  }
  const sb = base_falsa({ pipeline_prospectos: { id: 'p1' } })
  const r = await v2.sincronizar_etapa(sb, admin, card, ctx)
  afirmar('etapa: no retrocede', r === null && sb.escrituras.length === 0)
}
// Enganche cubierto: sube a Reservas y deja rastro.
{
  const card = { id: 'p1', folio: 'F1', nombre: 'X', monto: 10000, etapa: 'cotizado', reservaids: ['R1'] }
  const ctx = {
    reservas: [{ id: 'R1', monto: 10000, montopagado: 6000, descuentomonto: 0, estado: 'activa', estadopago: 'parcial' }],
    cobros: [{ id: 1, folio: 'F1', monto: 6000, concepto: 'ABONO', formapago: 'EFECTIVO', estado: '' }],
    cotizaciones: [], enganchemin: 50,
  }
  const sb = base_falsa({ pipeline_prospectos: { id: 'p1' } })
  const r = await v2.sincronizar_etapa(sb, admin, card, ctx)
  const esc = sb.escrituras.filter((w) => w.tabla === 'pipeline_prospectos')[0]
  afirmar('etapa: asciende a reservado', r && r.a === 'reservado' && esc.payload.etapa === 'reservado')
  afirmar('etapa: explica el motivo', /enganche mínimo 50%/.test(r.motivo))
  afirmar('etapa: deja rastro en movimientos',
    sb.escrituras.some((w) => w.tabla === 'movimientos'))
}
// PERMISOS: un Cajero (cobros:editar) puede escribir cobros pero NO clientes.
// Es exactamente lo que hace la guardia por tabla de la v1.
{
  afirmar('cajero puede escribir cobros', v2.motivo_bloqueo(cajero, 'cobros') === null)
  afirmar('cajero NO puede mover saldo a favor', v2.motivo_bloqueo(cajero, 'clientes') === 'sin_permiso')
  const sb = base_falsa({ clientes: { saldo_favor: 500 } })
  const r = await v2.mover_saldo_favor(sb, cajero, 1, 100)
  afirmar('cajero: el saldo a favor no se toca', r.ok === false && sb.escrituras.length === 0)
}
{
  afirmar('solo lectura no escribe cobros', v2.motivo_bloqueo(solover, 'cobros') === 'sin_permiso')
  afirmar('administrador escribe todo', v2.motivo_bloqueo(admin, 'cobros') === null &&
    v2.motivo_bloqueo(admin, 'clientes') === null &&
    v2.motivo_bloqueo(admin, 'pipeline_prospectos') === null)
  afirmar('tabla sin dueno declarado: nunca se escribe', v2.motivo_bloqueo(admin, 'juegos') === 'sin_permiso')
}
// El comprobante: limite y nombre de objeto seguro.
{
  afirmar('comprobante de 11 MB se rechaza', v2.comprobante_excede_limite({ size: 11 * 1024 * 1024 }) === true)
  afirmar('comprobante de 9 MB pasa', v2.comprobante_excede_limite({ size: 9 * 1024 * 1024 }) === false)
  const ruta = v2.ruta_comprobante({ name: 'Recibo Transferencia #4 ñ.PDF' }, 'cobros', 1700000000000)
  afirmar('ruta sin acentos ni espacios', ruta === 'cobros/1700000000000_Recibo_Transferencia__4__.pdf')
}
// afecta_saldo_reserva: el credito NO resta al cancelarse (simetria).
{
  const reservas = [{ id: 'R1' }]
  afirmar('cobro real con folio de reserva: afecta',
    v2.afecta_saldo_reserva({ folio: 'R1', monto: 100, concepto: 'ABONO', formapago: 'EFECTIVO' }, reservas) === true)
  afirmar('credito: no afecta',
    v2.afecta_saldo_reserva({ folio: 'R1', monto: 100, concepto: 'CRÉDITO', formapago: 'CREDITO' }, reservas) === false)
  afirmar('folio de prospecto (no de reserva): no afecta',
    v2.afecta_saldo_reserva({ folio: 'PROS-1', monto: 100, concepto: 'ABONO', formapago: 'EFECTIVO' }, reservas) === false)
}

// ══ 5. REPORTE DEL DIA, HORA Y DATOS FISCALES ═════════════════════
// El reporte del dia es una cuenta de dinero (el total de la caja), asi que
// entra al diferencial como todo lo demas.

function formatFecha(str) {
  if (!str || str.length < 8) return str || '—'
  try {
    const d = new Date(str + 'T12:00:00')
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: '2-digit' })
  } catch { return str }
}

// enviarReporteDia(), sin el window.open final.
function _mensajeReporteDia(cobros, hoy) {
  const hoyData = cobros.filter(c => c.fecha === hoy && !_cobroCancelado(c))
  const total = hoyData.reduce((s, c) => s + (_cobroSinDineroNuevo(c) ? 0 : c.monto), 0)
  const creditoDia = hoyData.reduce((s, c) => s + (_esCobroCredito(c) ? c.monto : 0), 0)
  const porConcepto = {}
  hoyData.forEach(c => { porConcepto[c.concepto] = (porConcepto[c.concepto] || 0) + c.monto })

  let msg = '📊 *Reporte de cobros — ' + formatFecha(hoy) + '*\n\n'
  if (hoyData.length === 0) {
    msg += 'Sin cobros registrados hoy.'
  } else {
    hoyData.forEach(c => {
      msg += '• ' + c.cliente.split('/')[0].trim() + ' — ' + c.zona + ' — ' + c.concepto +
        (_esCobroCredito(c) ? ' (CRÉDITO · por cobrar)' : '') +
        ' — $' + c.monto.toLocaleString('es-MX', _MXN2) + '\n'
    })
    msg += '\n'
    Object.entries(porConcepto).forEach(([k, v]) => {
      msg += k + ': $' + v.toLocaleString('es-MX', _MXN2) + '\n'
    })
    msg += '\n*Total del día: $' + total.toLocaleString('es-MX', _MXN2) + '* (' + hoyData.length + ' cobros)'
    if (creditoDia > 0) msg += '\n💳 A crédito (NO cobrado): $' + creditoDia.toLocaleString('es-MX', _MXN2)
  }
  return msg
}

// _horaCobro() e _instanteCobro().
function _tsDeCobro(c) {
  let ts = c.createdAt || null
  if (!ts && c.notas) {
    const m = String(c.notas).match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/)
    if (m) ts = m[0]
  }
  return ts
}
function _instanteCobro(c) {
  if (!c) return 0
  const ts = _tsDeCobro(c)
  if (ts) { const t = Date.parse(ts); if (!isNaN(t)) return t }
  return typeof c.id === 'number' ? c.id : 0
}
function _horaCobro(c) {
  const ts = _tsDeCobro(c)
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Hermosillo',
  }) + ' hrs'
}

// _buscarFacturacionCliente(), solo con la fuente de la BASE (la v2 no migra
// el espejo de localStorage a proposito).
function _buscarFacturacionCliente(email, nombre, tel, lista) {
  const norm = s => String(s || '').toLowerCase().trim()
  const telBuscado = _telNorm(tel)
  const nomBuscado = _nombreNorm(nombre)
  let c = null
  if (telBuscado) {
    c = lista.find(x => {
      const t = _telNorm(x.tel)
      if (!t || t !== telBuscado) return false
      const n = _nombreNorm(x.nombre)
      return !n || !nomBuscado || n === nomBuscado
    })
  }
  if (!c && nomBuscado) c = lista.find(x => _nombreNorm(x.nombre) === nomBuscado)
  if (!c && email) c = lista.find(x => norm(x.email) === norm(email))
  if (c && c.facturacion) return c.facturacion
  return null
}

const _MXN2 = { minimumFractionDigits: 2, maximumFractionDigits: 2 }
const zonas = ['Terraza Derecha 1', 'Palco All-Inc 2', 'Platea Izq 3', '']
const fechas = ['2026-09-02', '2026-09-01', '2026-10-14', '']

for (let i = 0; i < 4000; i++) {
  const hoy = elige(fechas.filter(Boolean))
  const n = Math.floor(rnd() * 6)
  const lista_v1 = []
  const lista_v2 = []
  for (let k = 0; k < n; k++) {
    const base = {
      id: i * 10 + k,
      fecha: elige(fechas),
      cliente: elige(nombres) + (rnd() < 0.2 ? ' / SEGUNDO' : ''),
      zona: elige(zonas),
      concepto: elige(conceptos),
      monto: dinero(0, 20000),
      estado: rnd() < 0.2 ? 'cancelado' : '',
      notas: rnd() < 0.3 ? 'Registrado 2026-09-02T14:35:07Z' : '',
    }
    const forma = elige(formas)
    lista_v1.push({ ...base, formaPago: forma, createdAt: rnd() < 0.5 ? '2026-09-02T21:35:07Z' : null })
    lista_v2.push({ ...base, formapago: forma, createdat: lista_v1[k].createdAt })
  }

  if (!comparar('mensaje_reporte_dia', _mensajeReporteDia(lista_v1, hoy),
    v2.mensaje_reporte_dia(lista_v2, hoy), { hoy, n })) fallos++

  lista_v1.forEach((c, k) => {
    if (!comparar('hora_cobro', _horaCobro(c), v2.hora_cobro(lista_v2[k]), { c })) fallos++
    if (!comparar('instante_cobro', _instanteCobro(c), v2.instante_cobro(lista_v2[k]), { c })) fallos++
    if (!comparar('formato_fecha', formatFecha(c.fecha), v2.formato_fecha(c.fecha), { f: c.fecha })) fallos++
  })

  // datos fiscales
  const fichas = []
  for (let k = 0; k < Math.floor(rnd() * 4); k++) {
    fichas.push({
      id: k + 1,
      nombre: elige(nombres),
      email: rnd() < 0.6 ? 'x@y.com' : '',
      tel: rnd() < 0.6 ? '66212345' + Math.floor(rnd() * 90 + 10) : '',
      facturacion: rnd() < 0.7 ? { rfc: 'XAXX010101000', regimen: '626', cp: '83000' } : null,
    })
  }
  const ref = { email: rnd() < 0.5 ? 'x@y.com' : '', nombre: elige(nombres), tel: rnd() < 0.5 ? '6621234511' : '' }
  if (!comparar('buscar_facturacion_cliente',
    _buscarFacturacionCliente(ref.email, ref.nombre, ref.tel, fichas),
    v2.buscar_facturacion_cliente(ref.email, ref.nombre, ref.tel, fichas), { ref })) fallos++
}

// ══ 6. RECIBO Y STORAGE ═══════════════════════════════════════════
{
  // El recibo lleva datos que captura un usuario y acaban dentro de un
  // documento HTML: tienen que salir escapados.
  const html = v2.html_recibo_cobro(
    { id: 1, folio: 'R-1', cliente: '<script>alert(1)</script>', fecha: '2026-09-02',
      area: 'ASADOR', zona: 'Terraza & Palco', concepto: 'ABONO', formapago: 'EFECTIVO',
      recibio: 'FER', monto: 1234.5, notas: 'nota "con comillas" & <b>' },
    { reservas: [], areas: [] }
  )
  afirmar('recibo: escapa el nombre del cliente', !html.includes('<script>alert(1)</script>'))
  afirmar('recibo: escapa el ampersand de la zona', html.includes('Terraza &amp; Palco'))
  afirmar('recibo: escapa las comillas de las notas', html.includes('&quot;con comillas&quot;'))
  afirmar('recibo: imprime el monto con dos decimales', html.includes('$1,234.50 MXN'))
  afirmar('recibo: incluye las dos leyendas legales',
    html.includes('Consérvalo para cualquier aclaración') && html.includes('solicitarla dentro del mes'))
}
{
  const base = 'https://x.supabase.co/storage/v1/object'
  afirmar('ruta de URL firmada',
    v2.ruta_de_url(base + '/sign/comprobantes_pagos/cobros/1_x.pdf?token=abc') === 'cobros/1_x.pdf')
  afirmar('ruta de URL publica',
    v2.ruta_de_url(base + '/public/comprobantes_pagos/zonas/a.png') === 'zonas/a.png')
  afirmar('URL ajena: no es del bucket', v2.ruta_de_url('https://otro.com/a.pdf') === null)
  afirmar('ruta suelta reconocida', v2.es_ruta_bucket('facturas/1_cfdi.pdf') === true)
  afirmar('una URL no es una ruta suelta', v2.es_ruta_bucket(base + '/sign/x/y') === false)
  afirmar('recibo automatico detectado', v2.es_recibo_auto('/api/recibo?f=recibos/1.html') === true)
  afirmar('comprobante subido no es recibo automatico',
    v2.es_recibo_auto(base + '/sign/comprobantes_pagos/cobros/1_x.pdf') === false)
}
{
  // El regimen se lee con su clave Y su nombre: emitir con el equivocado es grave.
  afirmar('regimen legible', v2.regimen_legible('626') === '626 · Régimen Simplificado de Confianza (RESICO)')
  afirmar('sin regimen', v2.regimen_legible('') === '—')
  afirmar('regimen desconocido no inventa nombre', v2.regimen_legible('999') === '999 · ')
}

// ══ 7. RESERVAS: ECONOMIA, FOLIOS Y ESTADO DE ZONA ════════════════
// La economia de una reserva es dinero puro, y el renombrado de campos
// (montoPagado → montopagado, descuentoMonto → descuentomonto) la atraviesa
// entera. Va al diferencial como todo lo demas.

// _resEconomiaAGuardar(), con el bruto y el pct ya resueltos por el llamador.
function _resEconomiaAGuardar(brutoHeredado, precioBase, descuentoPct) {
  const bruto = brutoHeredado != null ? brutoHeredado : (Number(precioBase) || 0)
  const descuento = Math.min(redondearDinero(bruto * descuentoPct), bruto)
  return { bruto: bruto, descuento: descuento, neto: Math.max(0, bruto - descuento) }
}

// _resHeredarEconomia(): de (monto, descuento_monto) al par (bruto, pct).
function _resHeredarEconomia(bruto, descuento) {
  const b = Math.max(0, redondearDinero(Number(bruto) || 0))
  const d = Math.min(Math.max(0, redondearDinero(Number(descuento) || 0)), b)
  return { brutoHeredado: b > 0 ? b : null, descuentoPct: b > 0 ? d / b : 0 }
}

// El calculo de `cobrar` y `estadoPago` de _guardarReservaManualInterno().
function _cobrarV1(pago, neto, montoManual) {
  if (pago === 'Enganche 30%') return redondearDinero(neto * 0.3)
  if (pago === 'Sin pago') return 0
  if (pago === 'Monto') return parseFloat(montoManual) || 0
  return neto
}
function _estadoPagoV1(cobrar, neto) {
  return cobrar <= 0 ? 'pendiente' : (cobrar >= neto ? 'pagado' : 'parcial')
}

function _emailValidoV1(v) { return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(String(v || '').trim()) }

// getPrecioSec() y getMinSec(), con preciosData pasado como argumento.
function _getCategoriaSecV1(nombre) {
  const n = String(nombre || '').toUpperCase()
  if (n.includes('TERRAZA')) return 'Terraza'
  if (n.includes('PALCO')) return 'Palco'
  if (n.includes('PLATEA')) return 'Platea'
  if (n.includes('JARD')) return 'Jardín'
  return 'General'
}
function _getPrecioSecV1(area, preciosData) {
  const porId = area.id ? preciosData.find(p => p.pinId && p.pinId === area.id) : null
  if (porId) return porId.precio
  const n = (area.nombre || '').toLowerCase()
  for (const p of preciosData) {
    const palabras = p.zona.toLowerCase().split(' ')
    if (palabras.every(w => n.includes(w))) return p.precio
  }
  const cat = _getCategoriaSecV1(area.nombre)
  return { Terraza: 8000, Palco: 12000, Platea: 7000, 'Jardín': 6000, General: 5500 }[cat] || null
}
function _getMinSecV1(area, preciosData, finde) {
  const minDe = (p) => (finde && p.min2 != null) ? (p.min2 || 1) : (p.min || 1)
  const porId = area.id ? preciosData.find(p => p.pinId && p.pinId === area.id) : null
  if (porId) return minDe(porId)
  const n = (area.nombre || '').toLowerCase()
  for (const p of preciosData) {
    const palabras = p.zona.toLowerCase().split(' ')
    if (palabras.every(w => n.includes(w))) return minDe(p)
  }
  const cat = _getCategoriaSecV1(area.nombre)
  return { Terraza: 20, Palco: 20, Platea: 15, 'Jardín': 10, General: 10 }[cat] || 1
}

// Los folios que se cancelan al borrar una reserva (eliminarReservaSec).
function _foliosBorradoV1(reserva, pipelineData) {
  return [String(reserva.id)].concat(
    pipelineData
      .filter(p => (p.reservaIds || []).map(String).includes(String(reserva.id)))
      .flatMap(p => {
        const f = String(p.folio || '').trim()
        if (!f) return []
        return [f, f.toUpperCase().startsWith('PROS-') ? f.slice(5) : 'PROS-' + f]
      }))
}

const nombres_sec = ['Terraza Derecha 1', 'PALCO ALL-INC 2', 'Platea Izquierda', 'Jardín Central',
  'Bleachers 9', 'Zona Rara']
const pagos = ['Sin pago', 'Enganche 30%', 'Completo', 'Monto']
const correos = ['a@x.com', 'sin-arroba', 'b@y', 'c@z.mx', '  d@w.com  ', '']

for (let i = 0; i < 6000; i++) {
  // ── economia
  const brutoCrudo = rnd() < 0.15 ? 0 : dinero(0, 60000)
  const descCrudo = rnd() < 0.4 ? dinero(0, brutoCrudo * 1.4) : 0
  const her = _resHeredarEconomia(brutoCrudo, descCrudo)
  const v1eco = _resEconomiaAGuardar(her.brutoHeredado, 0, her.descuentoPct)
  const v2eco = v2.economia_reserva(her.brutoHeredado != null ? her.brutoHeredado : 0, her.descuentoPct)
  if (!comparar('economia_reserva', v1eco, v2eco, { brutoCrudo, descCrudo })) fallos++

  // ── cobro inicial y estado de pago
  const pago = elige(pagos)
  const montoManual = dinero(0, 50000)
  // 'Enganche 30%' con la politica en 30 debe dar EXACTAMENTE lo mismo que la
  // v1, que lleva el 0.3 escrito a mano.
  const v1cobrar = _cobrarV1(pago, v1eco.neto, montoManual)
  const v2cobrar = v2.cobro_inicial(pago, v2eco.neto, montoManual, 30)
  if (!comparar('cobro_inicial', v1cobrar, v2cobrar, { pago, neto: v1eco.neto })) fallos++
  if (!comparar('estado_pago_reserva', _estadoPagoV1(v1cobrar, v1eco.neto),
    v2.estado_pago_reserva(v2cobrar, v2eco.neto), { v1cobrar, neto: v1eco.neto })) fallos++

  // ── validaciones
  const correo = elige(correos)
  if (!comparar('email_valido', _emailValidoV1(correo), v2.email_valido(correo), { correo })) fallos++

  // ── precio y aforo de la seccion, en las DOS grafias del catalogo
  const nsec = Math.floor(rnd() * 4)
  const cat_v1 = []
  const cat_v2 = []
  for (let k = 0; k < nsec; k++) {
    const base = {
      zona: elige(nombres_sec),
      precio: dinero(1000, 30000),
      min: Math.floor(rnd() * 30) + 1,
      min2: rnd() < 0.5 ? Math.floor(rnd() * 30) + 1 : null,
    }
    const pin = rnd() < 0.7 ? 'sec-' + k : null
    cat_v1.push({ pinId: pin, zona: base.zona, precio: base.precio, min: base.min, min2: base.min2 })
    cat_v2.push({ pinid: pin, zona: base.zona, precio: base.precio, min: base.min, min2: base.min2 })
  }
  const areaCaso = { id: rnd() < 0.6 ? 'sec-' + Math.floor(rnd() * 4) : null, nombre: elige(nombres_sec) }
  const finde = rnd() < 0.5
  const juegoCaso = { fecha: finde ? '2026-10-16' : '2026-10-13' } // viernes / martes
  if (!comparar('precio_seccion', _getPrecioSecV1(areaCaso, cat_v1),
    v2.precio_seccion(areaCaso, cat_v2), { areaCaso })) fallos++
  if (!comparar('min_seccion', _getMinSecV1(areaCaso, cat_v1, finde),
    v2.min_seccion(areaCaso, cat_v2, juegoCaso), { areaCaso, finde })) fallos++

  // ── folios que se cancelan al borrar
  const rid = 'NRJ-ADM-' + i
  const pipe_v1 = []
  const pipe_v2 = []
  for (let k = 0; k < Math.floor(rnd() * 3); k++) {
    const folio = rnd() < 0.3 ? 'PROS-00' + k : (rnd() < 0.5 ? '00' + k : '')
    const ids = rnd() < 0.7 ? [rid] : ['otro']
    pipe_v1.push({ id: 'p' + k, folio, reservaIds: ids })
    pipe_v2.push({ id: 'p' + k, folio, reservaids: ids })
  }
  if (!comparar('folios_de_reserva_borrada', _foliosBorradoV1({ id: rid }, pipe_v1),
    v2.folios_de_reserva_borrada({ id: rid }, pipe_v2), { rid })) fallos++
}

// ── folios: unicidad y forma ──
{
  const usados = new Set()
  let choques = 0
  for (let i = 0; i < 20000; i++) {
    const f = v2.generar_folio_reserva('admin', [])
    if (!/^NRJ-ADM-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/.test(f)) choques = -1
    if (usados.has(f)) choques++
    usados.add(f)
  }
  afirmar('folio con la forma NRJ-ADM-XXXXX y sin 0/O/1/I/L', choques >= 0)
  // 20,000 folios sobre 28.6M combinaciones: por el problema del cumpleaños se
  // esperan ~7 colisiones. El generador las evita mirando las reservas ya
  // existentes; aqui la lista va vacia a proposito, para medir el espacio.
  afirmar('espacio de folios suficientemente grande', choques < 40)
  afirmar('folio web usa su propio prefijo',
    v2.generar_folio_reserva('web', []).startsWith('NRJ-WEB-'))
  // El generador NO devuelve un folio que ya exista.
  const existentes = []
  for (let i = 0; i < 200; i++) existentes.push({ id: v2.generar_folio_reserva('admin', existentes) })
  afirmar('nunca repite un folio ya usado',
    new Set(existentes.map(r => r.id)).size === existentes.length)
}

// ── estado de zona: escrituras contra la base falsa ──
{
  const estados = { j1: { 'sec-1': 'reservada', 'sec-2': 'bloqueada' } }
  afirmar('sin fila, la seccion nace libre', v2.estado_vivo(estados, 'j1', 'sec-9') === 'libre')
  afirmar('estado vivo se lee tal cual', v2.estado_vivo(estados, 'j1', 'sec-2') === 'bloqueada')
  afirmar('una seccion reservada NO se puede bloquear',
    v2.puede_bloquearse(estados, 'j1', 'sec-1') === false)
  afirmar('una libre si se puede bloquear', v2.puede_bloquearse(estados, 'j1', 'sec-9') === true)
}
{
  const sb = base_falsa({ zona_juego_estado: { juego_id: 'j1', zona_id: 'sec-9' } })
  const r = await v2.set_estado_zona(sb, admin, 'j1', 'sec-9', 'reservada')
  afirmar('estado de zona: escribe', r.ok === true && sb.escrituras[0].tabla === 'zona_juego_estado')
  // Sobre una fila existente el estado viaja en el payload del UPDATE y los
  // ids en sus filtros — ya no en un unico payload de upsert.
  afirmar('estado de zona: manda el estado y filtra por juego y zona',
    sb.escrituras[0].payload.estado === 'reservada' &&
    sb.escrituras[0].filtros.juego_id === 'j1' &&
    sb.escrituras[0].filtros.zona_id === 'sec-9')
}
{
  // Un estado inventado no llega a la base.
  const sb = base_falsa({ zona_juego_estado: {} })
  const r = await v2.set_estado_zona(sb, admin, 'j1', 'sec-9', 'ocupadisima')
  afirmar('estado invalido: no escribe', r.ok === false && sb.escrituras.length === 0)
}
{
  // 0 filas sin error tambien aqui es fallo, no exito.
  const sb = base_falsa({ zona_juego_estado: {} }, { filas: 0 })
  const r = await v2.set_estado_zona(sb, admin, 'j1', 'sec-9', 'libre')
  afirmar('estado de zona: 0 filas es fallo', r.ok === false && r.motivo === 'sin_filas')
}
{
  // Bloquear una RESERVADA se rechaza y deja rastro del intento.
  const sb = base_falsa({ zona_juego_estado: {}, movimientos: {} })
  const r = await v2.alternar_bloqueo(sb, admin, {
    juegoid: 'j1', zonaid: 'sec-1', nombre: 'Terraza 1',
    areasestados: { j1: { 'sec-1': 'reservada' } },
  })
  afirmar('bloqueo de reservada: rechazado', r.ok === false && r.motivo === 'reservada')
  afirmar('bloqueo de reservada: no toca zona_juego_estado',
    !sb.escrituras.some(w => w.tabla === 'zona_juego_estado'))
  afirmar('bloqueo de reservada: queda el intento en movimientos',
    sb.escrituras.some(w => w.tabla === 'movimientos' && /RECHAZADO/.test(w.payload.descripcion)))
}
{
  // Alternar de verdad: libre → bloqueada → libre.
  const sb1 = base_falsa({ zona_juego_estado: {}, movimientos: {} })
  const r1 = await v2.alternar_bloqueo(sb1, admin, {
    juegoid: 'j1', zonaid: 'sec-9', nombre: 'Platea 9', areasestados: {},
  })
  afirmar('libre → bloqueada', r1.ok === true && r1.estado === 'bloqueada')

  const sb2 = base_falsa({ zona_juego_estado: {}, movimientos: {} })
  const r2 = await v2.alternar_bloqueo(sb2, admin, {
    juegoid: 'j1', zonaid: 'sec-9', nombre: 'Platea 9',
    areasestados: { j1: { 'sec-9': 'bloqueada' } },
  })
  afirmar('bloqueada → libre', r2.ok === true && r2.estado === 'libre')
  afirmar('liberar deja rastro', sb2.escrituras.some(w => w.tabla === 'movimientos'))
}
{
  // PERMISOS: la v1 deja zona_juego_estado FUERA de su guardia por tabla, asi
  // que cualquiera con sesion podia sacar una seccion de venta. Aqui pide el
  // mismo nivel que reservar esa seccion.
  const vendedora = { id: 9, nombre: 'Vero', rol: 'Vendedora', permisos: { seccionesreservadas: 'editar' } }
  afirmar('vendedora con reservas:editar puede cambiar estados',
    v2.motivo_bloqueo(vendedora, 'zona_juego_estado') === null)
  afirmar('cajero NO puede cambiar estados de zona',
    v2.motivo_bloqueo(cajero, 'zona_juego_estado') === 'sin_permiso')
  const sb = base_falsa({ zona_juego_estado: {} })
  const r = await v2.set_estado_zona(sb, cajero, 'j1', 'sec-9', 'bloqueada')
  afirmar('cajero: el estado de zona no se toca', r.ok === false && sb.escrituras.length === 0)
}

// ══ 8. PIPELINE: TOTAL DE LA COTIZACION Y REGLAS DE COLUMNA ═══════
// El total de un prospecto es el precio que acaba cobrandose, y las reglas de
// columna son las que dejan avanzar dinero. Las dos al diferencial.

let descuentosVolumenData = []

// _reglaVolumenActiva() y _descuentoVolumenAplicable().
function _reglaVolumenActiva(rg) {
  if (!rg) return false
  const crudo = (rg.activo != null) ? rg.activo : rg.estado
  if (crudo == null) return false
  if (typeof crudo === 'boolean') return crudo
  const n = String(crudo).trim().toLowerCase()
  return n === 'true' || n === 'activo' || n === 'active' || n === '1' || n === 'si' || n === 'sí'
}
function _descuentoVolumenAplicable(personas, juegoId, zonaId) {
  const reglas = descuentosVolumenData || []
  let mejor = null
  reglas.forEach(function (rg) {
    if (!_reglaVolumenActiva(rg)) return
    if (!((parseInt(personas, 10) || 0) >= (parseInt(rg.minPersonas, 10) || 0))) return
    const js = Array.isArray(rg.juegos) && rg.juegos.length ? rg.juegos.map(String) : null
    if (js && (!juegoId || js.indexOf(String(juegoId)) < 0)) return
    const zs = Array.isArray(rg.zonas) && rg.zonas.length ? rg.zonas.map(String) : null
    if (zs && (!zonaId || zs.indexOf(String(zonaId)) < 0)) return
    if (!mejor || (Number(rg.porcentaje) || 0) > (Number(mejor.porcentaje) || 0)) mejor = rg
  })
  return mejor
}

// calcPipTotal(), con los valores del formulario como argumentos.
function _calcPipTotalV1(f, cuponFijo, juegoId, zonaId) {
  const area = parseFloat(f.area || 0) || 0
  const consumo = parseFloat(f.consumo || 0) || 0
  const extra = parseFloat(f.extra || 0) || 0
  const adultoPrecio = parseFloat(f.adultoPrecio || 0) || 0
  const adultoCant = parseInt(f.adultoCant, 10) || 0
  const ninoPrecio = parseFloat(f.ninoPrecio || 0) || 0
  const ninoCant = parseInt(f.ninoCant, 10) || 0
  let desc = parseFloat(f.desc || 0) || 0
  const minimo = parseInt(f.minimo, 10) || 0

  const adultosExtra = adultoPrecio * adultoCant
  const ninosExtra = ninoPrecio * ninoCant
  const subtotal = area + consumo + extra + adultosExtra + ninosExtra
  const totalAdultos = minimo + adultoCant
  const personas = totalAdultos + ninoCant

  const rg = _descuentoVolumenAplicable(personas, juegoId, zonaId)
  const volPct = rg ? (Number(rg.porcentaje) || 0) : 0
  if (cuponFijo) {
    const pesos = Math.min(Number(cuponFijo.valor) || 0, subtotal)
    desc = subtotal > 0 ? (pesos / subtotal) * 100 : 0
  }
  const pctTotal = Math.min(100, Math.max(0, desc + volPct))
  const descuentoTotal = redondearDinero(subtotal * pctTotal / 100)
  const total = Math.max(0, redondearDinero(subtotal - descuentoTotal))
  return { subtotal: redondearDinero(subtotal), total, descuentoTotal, volumenPct: volPct,
    personas, adultoCant, ninoCant, totalAdultos }
}

// _pdBrutoTarjeta(), con montoBase como argumento.
function _pdBrutoTarjetaV1(card, montoBase) {
  if (!card) return 0
  const sub = (Number(montoBase) || 0) + (Number(card.consumoMonto) || 0) +
    (Number(card.extraMonto) || 0) +
    (Number(card.adultoExtraPrecio) || 0) * (Number(card.adultos) || 0) +
    (Number(card.ninoExtraPrecio) || 0) * (Number(card.ninos) || 0)
  return redondearDinero(sub > 0 ? sub : (Number(card.monto) || 0))
}

// _nuevoProspectoFolio(), derivando el contador como hace la carga inicial.
function _nuevoProspectoFolioV1(pipelineData) {
  const maxFolio = pipelineData.reduce((m, p) => {
    const n = parseInt(String(p.folio || '').replace(/^PROS-0*/, ''), 10)
    return isNaN(n) ? m : Math.max(m, n)
  }, 0)
  return 'PROS-' + String(maxFolio + 1).padStart(3, '0')
}

// Las CINCO reglas del handler de `drop`, devolviendo el motivo del bloqueo.
function _validarMoverV1(card, destinoId, politicaEng) {
  if (card.etapa === destinoId) return 'misma'
  const origenIdx = pipelineEtapas.findIndex(e => e.id === card.etapa)
  const destinoIdx = pipelineEtapas.findIndex(e => e.id === destinoId)
  if (origenIdx !== -1 && destinoIdx !== -1 && (destinoIdx - origenIdx) > 1) return 'salto'

  if (destinoId === 'reserva_momentanea') {
    if (!_pdReservasActivas(card).length) return 'sin-reserva'
  }
  if (destinoId === 'reservado') {
    const abonado = _pdAbonadoEtapa(card)
    const requerido = redondearDinero(_pdNumMonto(card.monto) * politicaEng / 100)
    if (abonado < requerido) return 'sin-enganche'
    const vinc = (card.reservaIds || [])
      .map(rid => reservasData.find(r => r.id === rid))
      .filter(r => r && String(r.estado || '').toLowerCase() !== 'cancelada')
    if (!vinc.length) return 'sin-reserva'
  }
  if (destinoId === 'cerrado') {
    const ids = card.reservaIds || []
    const res = ids.map(rid => reservasData.find(r => r.id === rid)).filter(Boolean)
    if (res.length === 0) return 'sin-reserva'
    const abonado = (pdPagos[card.id] || []).reduce((s, p) => s + (p.monto || 0), 0)
    if (abonado < (card.monto || 0)) return 'sin-liquidar'
  }
  if (destinoId === 'boletos_entregados') {
    const vinc = (card.reservaIds || [])
      .map(rid => reservasData.find(r => r.id === rid))
      .filter(r => r && String(r.estado || '').toLowerCase() !== 'cancelada')
    if (!vinc.some(r => Array.isArray(r.folios) && r.folios.length > 0)) return 'sin-folio'
  }
  return null
}

// _pdPuedeGenerarReserva().
function _puedeGenerarReservaV1(card, pendiente) {
  if (_pdReservasActivas(card).length > 0) return false
  if (_pdAbonadoEtapa(card) > 0) return true
  return !!pendiente
}

for (let i = 0; i < 6000; i++) {
  // ── reglas de volumen, en las DOS grafias
  const nreglas = Math.floor(rnd() * 4)
  const reg_v1 = []
  const reg_v2 = []
  for (let k = 0; k < nreglas; k++) {
    const base = {
      porcentaje: Math.floor(rnd() * 40),
      juegos: rnd() < 0.3 ? ['j1'] : null,
      zonas: rnd() < 0.3 ? ['sec-1'] : null,
      activo: rnd() < 0.75,
    }
    const minp = Math.floor(rnd() * 60)
    reg_v1.push({ ...base, minPersonas: minp })
    reg_v2.push({ ...base, minpersonas: minp })
  }
  descuentosVolumenData = reg_v1

  const f = {
    area: dinero(0, 30000), consumo: dinero(0, 8000), extra: dinero(0, 4000),
    adultoPrecio: dinero(0, 900), adultoCant: Math.floor(rnd() * 30),
    ninoPrecio: dinero(0, 400), ninoCant: Math.floor(rnd() * 20),
    desc: rnd() < 0.35 ? Math.floor(rnd() * 120) : 0,
    minimo: Math.floor(rnd() * 30),
  }
  const cuponFijo = rnd() < 0.2 ? { tipo: 'fijo', valor: dinero(0, 6000) } : null
  const juegoId = rnd() < 0.7 ? 'j1' : ''
  const zonaId = rnd() < 0.7 ? 'sec-1' : ''

  const v1calc = _calcPipTotalV1(f, cuponFijo, juegoId, zonaId)
  const v2calc = v2.calc_total_prospecto({
    areamonto: f.area, consumomonto: f.consumo, extramonto: f.extra,
    adultoextraprecio: f.adultoPrecio, adultoextracant: f.adultoCant,
    ninoextraprecio: f.ninoPrecio, ninoextracant: f.ninoCant,
    descuento: f.desc, minpersonas: f.minimo, juegoid: juegoId, zonaid: zonaId,
    cupon: cuponFijo,
  }, { descuentosvolumen: reg_v2 })

  if (!comparar('calc_total_prospecto.total', v1calc.total, v2calc.total, { f, cuponFijo })) fallos++
  if (!comparar('calc_total_prospecto.subtotal', v1calc.subtotal, v2calc.subtotal, { f })) fallos++
  if (!comparar('calc_total_prospecto.descuento', v1calc.descuentoTotal, v2calc.descuentototal, { f })) fallos++
  if (!comparar('calc_total_prospecto.personas', v1calc.personas, v2calc.personas, { f })) fallos++
  if (!comparar('calc_total_prospecto.volumen', v1calc.volumenPct, v2calc.volumenpct, { f })) fallos++

  // ── bruto de la tarjeta, en las DOS grafias
  const cbase = {
    monto: dinero(0, 40000), consumo: dinero(0, 5000), extra: dinero(0, 3000),
    ap: dinero(0, 800), np: dinero(0, 300),
    ad: Math.floor(rnd() * 20), ni: Math.floor(rnd() * 15),
  }
  const card_v1 = { monto: cbase.monto, consumoMonto: cbase.consumo, extraMonto: cbase.extra,
    adultoExtraPrecio: cbase.ap, ninoExtraPrecio: cbase.np, adultos: cbase.ad, ninos: cbase.ni }
  const card_v2 = { monto: cbase.monto, consumomonto: cbase.consumo, extramonto: cbase.extra,
    adultoextraprecio: cbase.ap, ninoextraprecio: cbase.np, adultos: cbase.ad, ninos: cbase.ni }
  const mb = rnd() < 0.3 ? 0 : dinero(0, 20000)
  if (!comparar('bruto_tarjeta', _pdBrutoTarjetaV1(card_v1, mb),
    v2.bruto_tarjeta(card_v2, mb), { cbase, mb })) fallos++

  // ── folio del prospecto
  const pipe = []
  for (let k = 0; k < Math.floor(rnd() * 5); k++) {
    pipe.push({ folio: rnd() < 0.2 ? '' : 'PROS-' + String(Math.floor(rnd() * 400)).padStart(3, '0') })
  }
  if (!comparar('nuevo_folio_prospecto', _nuevoProspectoFolioV1(pipe),
    v2.nuevo_folio_prospecto(pipe), { pipe })) fallos++
}

// ── LAS CINCO REGLAS DE COLUMNA (8,000 escenarios) ──
for (let i = 0; i < 8000; i++) {
  const nres = Math.floor(rnd() * 3)
  const res_v1 = []
  const res_v2 = []
  for (let k = 0; k < nres; k++) {
    const base = {
      id: 'R' + i + '-' + k,
      estado: rnd() < 0.25 ? 'cancelada' : 'activa',
      folios: rnd() < 0.4 ? ['F' + k] : (rnd() < 0.5 ? [] : null),
      monto: dinero(0, 30000),
    }
    res_v1.push({ ...base, montoPagado: dinero(0, base.monto), descuentoMonto: 0 })
    res_v2.push({ ...base, montopagado: dinero(0, base.monto), descuentomonto: 0 })
  }
  const folio = 'PROS-' + String(i).padStart(3, '0')
  const ids = res_v1.filter(() => rnd() < 0.8).map(r => r.id)
  const monto = dinero(0, 50000)
  const etapaOrigen = elige(pipelineEtapas).id
  const destino = elige(pipelineEtapas).id
  const eng = elige([30, 40, 50, 60, 100])

  const cob = []
  for (let k = 0; k < Math.floor(rnd() * 4); k++) {
    const fol = elige([folio].concat(ids.map(String)).concat(['ajeno']))
    cob.push({ id: i * 100 + k, folio: fol, monto: dinero(0, 25000),
      concepto: elige(conceptos), estado: rnd() < 0.2 ? 'cancelado' : '' })
  }
  const cob_v1 = cob.map(c => ({ ...c, formaPago: elige(formas) }))
  const cob_v2 = cob_v1.map(c => ({ ...c, formapago: c.formaPago }))

  const card_v1 = { id: 'p' + i, folio, nombre: 'C', monto, etapa: etapaOrigen, reservaIds: ids }
  const card_v2 = { id: 'p' + i, folio, nombre: 'C', monto, etapa: etapaOrigen, reservaids: ids }

  reservasData = res_v1
  pipelineData = [card_v1]
  _politicaEngancheMin = eng
  _reconstruirPagosPipeline(cob_v1)

  const ctxv2 = { reservas: res_v2, cobros: cob_v2, enganchemin: eng }
  const v1motivo = _validarMoverV1(card_v1, destino, eng)
  const r2 = v2.validar_mover_etapa(card_v2, destino, ctxv2)
  const v2motivo = r2 ? r2.motivo : null
  if (!comparar('validar_mover_etapa', v1motivo, v2motivo,
    { etapaOrigen, destino, ids, monto, eng })) fallos++

  const pend = rnd() < 0.5
  if (!comparar('puede_generar_reserva', _puedeGenerarReservaV1(card_v1, pend),
    v2.puede_generar_reserva(card_v2, { reservas: res_v2, cobros: cob_v2, pendiente: pend }),
    { ids, pend })) fallos++
}

// ── validaciones del alta y de la edicion ──
{
  const ok = { nombre: 'Ana', tel: '6621234567', email: 'a@x.com', juegoid: 'j1' }
  afirmar('alta valida no reporta errores', v2.validar_prospecto(ok).length === 0)
  afirmar('sin correo se rechaza',
    v2.validar_prospecto({ ...ok, email: '' }).some(e => e.campo === 'email'))
  afirmar('correo invalido se rechaza',
    v2.validar_prospecto({ ...ok, email: 'sin-arroba' }).some(e => e.campo === 'email'))
  afirmar('telefono de 9 digitos se rechaza',
    v2.validar_prospecto({ ...ok, tel: '662123456' }).some(e => e.campo === 'tel'))
  afirmar('sin juego se rechaza',
    v2.validar_prospecto({ ...ok, juegoid: '' }).some(e => e.campo === 'juego'))
  afirmar('el orden de los mensajes es el de la v1',
    v2.validar_prospecto({ nombre: '', tel: '', email: '', juegoid: '' })
      .map(e => e.campo).join(',') === 'nombre,tel,email,juego')

  // La EDICION es mas laxa a proposito: correo y telefono solo se validan si
  // vienen, porque una tarjeta vieja puede no tenerlos.
  afirmar('editar sin correo se permite', v2.validar_edicion_prospecto({ nombre: 'Ana' }).length === 0)
  afirmar('editar sin nombre se rechaza',
    v2.validar_edicion_prospecto({ nombre: '' }).some(e => e.campo === 'nombre'))
  afirmar('editar con correo invalido se rechaza',
    v2.validar_edicion_prospecto({ nombre: 'Ana', email: 'malo' }).some(e => e.campo === 'email'))
}

// ── reglas de volumen: solo lo afirmativo cuenta ──
{
  afirmar('activo true aplica', v2.regla_volumen_activa({ activo: true }) === true)
  afirmar('activo false no aplica', v2.regla_volumen_activa({ activo: false }) === false)
  afirmar('sin señal explicita NO aplica', v2.regla_volumen_activa({}) === false)
  afirmar('estado "Activo" aplica', v2.regla_volumen_activa({ estado: 'Activo' }) === true)
  afirmar('estado "Inactivo" NO aplica', v2.regla_volumen_activa({ estado: 'Inactivo' }) === false)
  // De dos reglas que aplican gana la de mayor porcentaje.
  const mejor = v2.descuento_volumen_aplicable(
    [{ minpersonas: 10, porcentaje: 5, activo: true }, { minpersonas: 10, porcentaje: 12, activo: true }],
    20, 'j1', 'sec-1'
  )
  afirmar('gana la regla de mayor porcentaje', mejor && mejor.porcentaje === 12)
  // Una regla con lista especifica NO aplica sin juego elegido.
  afirmar('regla con juego especifico no aplica sin juego',
    v2.descuento_volumen_aplicable([{ minpersonas: 1, porcentaje: 9, activo: true, juegos: ['j1'] }],
      20, '', '') === null)
}

// ── el tope del 100% y el cupon fijo ──
{
  // 80% manual + 30% de grupo = 110% → se acota a 100, nunca total negativo.
  const c = v2.calc_total_prospecto(
    { areamonto: 10000, descuento: 80, minpersonas: 20 },
    { descuentosvolumen: [{ minpersonas: 1, porcentaje: 30, activo: true }] }
  )
  afirmar('descuento combinado topado al 100%', c.total === 0 && c.descuentototal === 10000)

  // $500 fijos siguen siendo $500 aunque cambie el area.
  const c1 = v2.calc_total_prospecto(
    { areamonto: 10000, cupon: { tipo: 'fijo', valor: 500 } }, { descuentosvolumen: [] })
  const c2 = v2.calc_total_prospecto(
    { areamonto: 20000, cupon: { tipo: 'fijo', valor: 500 } }, { descuentosvolumen: [] })
  afirmar('cupon fijo vale lo mismo con otro subtotal',
    c1.descuentototal === 500 && c2.descuentototal === 500)
  // Y nunca descuenta mas que el subtotal.
  const c3 = v2.calc_total_prospecto(
    { areamonto: 300, cupon: { tipo: 'fijo', valor: 5000 } }, { descuentosvolumen: [] })
  afirmar('cupon fijo no supera el subtotal', c3.total === 0 && c3.descuentototal === 300)
}

// ── mover: escrituras y bloqueos contra la base falsa ──
{
  // Saltarse etapas se bloquea.
  const r = v2.validar_mover_etapa(
    { id: 'p1', etapa: 'prospecto', monto: 1000, reservaids: [] },
    'reservado', { reservas: [], cobros: [], enganchemin: 50 })
  afirmar('no se pueden saltar etapas', r && r.motivo === 'salto')
}
{
  // Retroceder SIEMPRE se permite: si se cae una reserva, la tarjeta baja.
  const r = v2.validar_mover_etapa(
    { id: 'p1', etapa: 'cerrado', monto: 1000, reservaids: [] },
    'reservado', { reservas: [], cobros: [], enganchemin: 50 })
  afirmar('retroceder no se bloquea por salto', !r || r.motivo !== 'salto')
}
{
  // Misma columna: ni error ni escritura. Reiniciaba el contador de dias.
  const r = v2.validar_mover_etapa(
    { id: 'p1', etapa: 'cotizado', monto: 1000, reservaids: [] },
    'cotizado', { reservas: [], cobros: [], enganchemin: 50 })
  afirmar('misma columna no es cambio', r && r.motivo === 'misma' && r.mensaje === null)
}
{
  // A Reserva Momentanea solo con reserva ACTIVA: una cancelada no cuenta.
  const cancelada = [{ id: 'R1', estado: 'cancelada' }]
  const r = v2.validar_mover_etapa(
    { id: 'p1', etapa: 'cotizado', monto: 1000, reservaids: ['R1'] },
    'reserva_momentanea', { reservas: cancelada, cobros: [], enganchemin: 50 })
  afirmar('una reserva cancelada no habilita Reserva Momentánea', r && r.motivo === 'sin-reserva')
}
{
  // El enganche que bloquea a mano es el MISMO que deja subir solo.
  const reservas = [{ id: 'R1', estado: 'activa', monto: 1000, montopagado: 0, descuentomonto: 0 }]
  const card = { id: 'p1', etapa: 'reserva_momentanea', monto: 1000, folio: 'F1', reservaids: ['R1'] }
  const corto = [{ id: 1, folio: 'F1', monto: 400, concepto: 'ABONO', formapago: 'EFECTIVO', estado: '' }]
  const justo = [{ id: 1, folio: 'F1', monto: 500, concepto: 'ABONO', formapago: 'EFECTIVO', estado: '' }]
  afirmar('con 40% no sube a Reservas con enganche 50',
    (v2.validar_mover_etapa(card, 'reservado', { reservas, cobros: corto, enganchemin: 50 }) || {}).motivo === 'sin-enganche')
  afirmar('con 50% exacto si sube',
    v2.validar_mover_etapa(card, 'reservado', { reservas, cobros: justo, enganchemin: 50 }) === null)
  // El CREDITO cuenta para la etapa aunque no sea dinero cobrado.
  const credito = [{ id: 1, folio: 'F1', monto: 500, concepto: 'CRÉDITO', formapago: 'CREDITO', estado: '' }]
  afirmar('el credito habilita el avance de etapa',
    v2.validar_mover_etapa(card, 'reservado', { reservas, cobros: credito, enganchemin: 50 }) === null)
}
{
  // Boletos enviados exige folio de boletos registrado.
  const sinfolio = [{ id: 'R1', estado: 'activa', folios: [] }]
  const confolio = [{ id: 'R1', estado: 'activa', folios: ['ABC-1'] }]
  const card = { id: 'p1', etapa: 'cerrado', monto: 100, folio: 'F1', reservaids: ['R1'] }
  afirmar('sin folio de boletos se bloquea',
    (v2.validar_mover_etapa(card, 'boletos_entregados', { reservas: sinfolio, cobros: [], enganchemin: 50 }) || {}).motivo === 'sin-folio')
  afirmar('con folio de boletos pasa',
    v2.validar_mover_etapa(card, 'boletos_entregados', { reservas: confolio, cobros: [], enganchemin: 50 }) === null)
}
{
  // PERMISOS: el pipeline es su propio dueño.
  const vendedora = { id: 9, nombre: 'Vero', rol: 'Vendedora', permisos: { pipeline: 'editar' } }
  afirmar('vendedora con pipeline:editar mueve tarjetas',
    v2.motivo_bloqueo(vendedora, 'pipeline_prospectos') === null)
  afirmar('vendedora con pipeline:editar puede crear la reserva',
    v2.motivo_bloqueo(vendedora, 'reservas') === null)
  afirmar('cajero NO mueve tarjetas',
    v2.motivo_bloqueo(cajero, 'pipeline_prospectos') === 'sin_permiso')
}

// ══ 9. LA GUARDIA NO PUEDE PARTIR UN ACTO EN DOS ══════════════════
// El fallo que motiva estas pruebas: generar una reserva desde el Pipeline
// creaba la fila en `reservas` (permitida por el modulo pipeline) y despues
// NO podia marcar la seccion, porque zona_juego_estado no incluia 'pipeline'
// entre sus dueños. La reserva quedaba vendida y la seccion libre a la vez.
//
// La regla, escrita como prueba: QUIEN PUEDE CREAR UNA RESERVA TIENE QUE PODER
// MARCAR SU SECCION. Cualquier perfil, sin excepciones.
{
  const perfiles = [
    { nombre: 'Administrador', rol: 'Administrador', permisos: {} },
    { nombre: 'Vendedora (pipeline)', rol: 'Vendedora', permisos: { pipeline: 'editar' } },
    { nombre: 'Vendedora (reservas)', rol: 'Vendedora', permisos: { seccionesreservadas: 'editar' } },
    { nombre: 'Cajero (cobros)', rol: 'Cajero', permisos: { cobros: 'editar' } },
    { nombre: 'Palcos', rol: 'Vendedora', permisos: { palcos: 'editar' } },
    { nombre: 'Editor del mapa', rol: 'Vendedora', permisos: { crear: 'editar' } },
    { nombre: 'Solo lectura', rol: 'Solo lectura', permisos: { reportes: 'ver' } },
  ]
  // La invariante es sobre quien CREA O LIBERA reservas, no sobre todo el que
  // toca la tabla: Cajero escribe `reservas` para mover el saldo de una que ya
  // existe, y eso no aparta ninguna seccion.
  const crea_reservas = ['pipeline', 'seccionesreservadas', 'palcos']
  perfiles.forEach((p) => {
    const crea = p.rol === 'Administrador' ||
      crea_reservas.some((m) => (p.permisos || {})[m] === 'editar')
    const puedeMapa = v2.motivo_bloqueo(p, 'zona_juego_estado') === null
    afirmar('quien aparta secciones puede marcarlas · ' + p.nombre, !crea || puedeMapa)
  })
  afirmar('cajero escribe reservas pero NO aparta secciones',
    v2.motivo_bloqueo({ rol: 'Cajero', permisos: { cobros: 'editar' } }, 'reservas') === null &&
    v2.motivo_bloqueo({ rol: 'Cajero', permisos: { cobros: 'editar' } }, 'zona_juego_estado') === 'sin_permiso')
  // Y en concreto el perfil que provoco el fallo.
  const soloPipeline = { rol: 'Vendedora', permisos: { pipeline: 'editar' } }
  afirmar('pipeline:editar puede escribir zona_juego_estado',
    v2.motivo_bloqueo(soloPipeline, 'zona_juego_estado') === null)
  // El editor del mapa bloquea zonas sin pasar por una reserva: tambien entra.
  const soloCrear = { rol: 'Vendedora', permisos: { crear: 'editar' } }
  afirmar('crear:editar puede escribir zona_juego_estado',
    v2.motivo_bloqueo(soloCrear, 'zona_juego_estado') === null)
  // Pero no se abre a cualquiera: sin ninguno de esos modulos, no.
  const soloClientes = { rol: 'Vendedora', permisos: { clientes: 'editar' } }
  afirmar('clientes:editar NO puede sacar secciones de venta',
    v2.motivo_bloqueo(soloClientes, 'zona_juego_estado') === 'sin_permiso')
}

// El diagnostico tiene que NOMBRAR la causa: las tres se arreglan distinto.
{
  const sinPermiso = { ok: false, motivo: 'sin_permiso' }
  const sinFilas = { ok: false, motivo: 'sin_filas' }
  const error = { ok: false, motivo: 'error', error: { message: 'boom' } }
  afirmar('sin permiso se explica como permiso',
    /permiso/.test(v2.texto_fallo_estado(sinPermiso, 'Terraza 1')))
  afirmar('0 filas apunta a RLS',
    /RLS/.test(v2.texto_fallo_estado(sinFilas)) &&
    /ni la actualización ni el alta/.test(v2.texto_fallo_estado(sinFilas)))
  afirmar('el error de la base se muestra tal cual',
    /boom/.test(v2.texto_fallo_estado(error)))
  afirmar('un exito no genera aviso', v2.texto_fallo_estado({ ok: true }) === null)
  afirmar('el aviso nombra la seccion',
    /Terraza 1/.test(v2.texto_fallo_estado(sinPermiso, 'Terraza 1')))
}

// La fila que se manda viaja en el resultado, para poder comparar los ids con
// lo que la tabla guarda cuando algo no cuadra.
{
  const sb = base_falsa({ zona_juego_estado: {} })
  const r = await v2.set_estado_zona(sb, admin, 'j7', 'sec-2', 'reservada')
  afirmar('el resultado lleva la fila enviada',
    r.fila && r.fila.juego_id === 'j7' && r.fila.zona_id === 'sec-2' && r.fila.estado === 'reservada')
  const sb2 = base_falsa({ zona_juego_estado: {} }, { filas: 0 })
  const r2 = await v2.set_estado_zona(sb2, admin, 'j7', 'sec-2', 'reservada')
  afirmar('al fallar tambien se sabe que se intento escribir',
    r2.ok === false && r2.fila && r2.fila.juego_id === 'j7')
}

// Los estados se escriben con el vocabulario que el mapa LEE. 'reservado' en
// masculino no existe: estado_vivo devolveria 'libre' y la seccion seguiria
// apareciendo disponible.
{
  afirmar('el vocabulario de estados es el que lee el mapa',
    v2.estados_zona.join(',') === 'libre,reservada,bloqueada')
  const sb = base_falsa({ zona_juego_estado: {} })
  const r = await v2.set_estado_zona(sb, admin, 'j1', 'sec-1', 'reservado')
  afirmar('"reservado" (masculino) se rechaza, no se escribe',
    r.ok === false && r.motivo === 'estado-invalido' && sb.escrituras.length === 0)
  afirmar('lo escrito se lee igual',
    v2.estado_vivo({ j1: { 'sec-1': 'reservada' } }, 'j1', 'sec-1') === 'reservada')
  // Y los ids se comparan como TEXTO en los dos sentidos: un juego_id numerico
  // en la base y un id de texto en el panel tienen que cruzar igual.
  afirmar('los ids cruzan aunque cambie el tipo',
    v2.estado_vivo({ 7: { 'sec-1': 'reservada' } }, '7', 'sec-1') === 'reservada' &&
    v2.estado_vivo({ 7: { 'sec-1': 'reservada' } }, 7, 'sec-1') === 'reservada')
}

// ── set_estado_zona: UPDATE primero, INSERT solo si hace falta ──
// Deja de depender de que la tabla tenga la clave unica (juego_id, zona_id)
// declarada: sin ella, un upsert insertaba una fila mas y la seccion acababa
// con dos estados a la vez.
{
  // La fila YA existe: basta el update, no debe insertar nada.
  const sb = base_falsa({ zona_juego_estado: { juego_id: 'j1', zona_id: 'sec-1' } })
  const r = await v2.set_estado_zona(sb, admin, 'j1', 'sec-1', 'reservada')
  afirmar('fila existente: se actualiza', r.ok === true && r.via === 'update')
  afirmar('fila existente: NO se inserta',
    !sb.escrituras.some((w) => w.tabla === 'zona_juego_estado' && w.op === 'insert'))
  afirmar('el update filtra por juego y zona',
    sb.escrituras[0].filtros.juego_id === 'j1' && sb.escrituras[0].filtros.zona_id === 'sec-1')
}
{
  // NO existe: el update no toca nada y entra el insert con la fila completa.
  const sb = base_falsa({ zona_juego_estado: {} }, { sinFila: true })
  const r = await v2.set_estado_zona(sb, admin, 'j9', 'sec-9', 'reservada')
  afirmar('sin fila: cae al insert', r.ok === true && r.via === 'insert')
  const ins = sb.escrituras.filter((w) => w.op === 'insert')[0]
  afirmar('el insert lleva juego, zona y estado',
    ins && ins.payload.juego_id === 'j9' && ins.payload.zona_id === 'sec-9' &&
    ins.payload.estado === 'reservada')
}
{
  // Dos cajas a la vez: el insert choca con la unica, y eso significa que la
  // otra ya creo la fila — se reintenta el update en vez de dar error.
  let ops = 0
  const sbCarrera = {
    escrituras: [],
    from(tabla) {
      const q = {
        _op: null, _p: null,
        update(p) { q._op = 'update'; q._p = p; return q },
        insert(p) { q._op = 'insert'; q._p = p; return q },
        eq() { return q },
        select() { return q },
        then(res) {
          ops++
          sbCarrera.escrituras.push({ tabla, op: q._op })
          // 1º update: nada. 2º insert: choca. 3º update: ahora si.
          if (ops === 1) return Promise.resolve({ data: [], error: null }).then(res)
          if (ops === 2) {
            return Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key' } }).then(res)
          }
          return Promise.resolve({ data: [{ estado: q._p.estado }], error: null }).then(res)
        },
      }
      return q
    },
  }
  const r = await v2.set_estado_zona(sbCarrera, admin, 'j1', 'sec-1', 'reservada')
  afirmar('carrera: el duplicado se resuelve reintentando el update',
    r.ok === true && r.via === 'update-tras-carrera' && ops === 3)
}
{
  // RLS callando: ni update ni insert devuelven fila, y ninguno da error.
  const sb = base_falsa({ zona_juego_estado: {} }, { filas: 0 })
  const r = await v2.set_estado_zona(sb, admin, 'j1', 'sec-1', 'libre')
  afirmar('0 filas en las dos vias sigue siendo fallo', r.ok === false && r.motivo === 'sin_filas')
}

// ══ 10. ELIMINAR UN PROSPECTO Y REGISTRAR SUS PAGOS ═══════════════

// Los tres folios con los que puede estar etiquetado un cobro de la tarjeta.
// espejo del arreglo que arma eliminarProspecto().
function _foliosProspectoV1(card) {
  const f = []
  ;(card.reservaIds || []).forEach((rid) => f.push(String(rid)))
  if (card.folio) {
    const x = String(card.folio).trim()
    f.push(x)
    f.push(x.toUpperCase().startsWith('PROS-') ? x.slice(5) : 'PROS-' + x)
  }
  f.push(String(card.id))
  return f
}

for (let i = 0; i < 4000; i++) {
  const folio = elige(['PROS-00' + (i % 9), String(i % 9), ''])
  const ids = []
  for (let k = 0; k < Math.floor(rnd() * 3); k++) ids.push('NRJ-ADM-' + i + k)
  const card_v1 = { id: 'p' + i, folio, reservaIds: ids }
  const card_v2 = { id: 'p' + i, folio, reservaids: ids }
  if (!comparar('folios_de_prospecto', _foliosProspectoV1(card_v1),
    v2.folios_de_prospecto(card_v2), { folio, ids })) fallos++
}

// En "Boletos enviados" NO se elimina: los boletos ya salieron y liberar el
// espacio dejaria una doble venta.
{
  pipelineEtapas.forEach((e) => {
    const permitido = v2.puede_eliminarse({ etapa: e.id })
    afirmar('eliminar en ' + e.id + (e.id === 'boletos_entregados' ? ' se prohibe' : ' se permite'),
      permitido === (e.id !== 'boletos_entregados'))
  })
  afirmar('el mensaje de bloqueo menciona los boletos', /boletos enviados/i.test(v2.msg_no_eliminable))
}

// ── LIBERAR RESERVAS: LAS DOS SALVAGUARDAS ──
{
  // Salvaguarda 1: NO se libera si otra reserva activa ocupa la misma
  // (zona, juego). Liberarla dejaba vendida una zona que otro seguia usando.
  const reservas = [
    { id: 'R1', estado: 'activa', juegoid: 'j1', zonaid: 'sec-1', zona: 'Terraza 1' },
    { id: 'R2', estado: 'activa', juegoid: 'j1', zonaid: 'sec-1', zona: 'Terraza 1' },
  ]
  const sb = base_falsa({ reservas: { id: 'R1' }, zona_juego_estado: { juego_id: 'j1' }, movimientos: {} })
  const r = await v2.liberar_reservas_de_prospecto(sb, admin, { id: 'p1', nombre: 'X', reservaids: ['R1'] }, {
    reservas, areas: [{ id: 'sec-1', nombre: 'Terraza 1' }],
    areasestados: { j1: { 'sec-1': 'reservada' } },
  })
  afirmar('la reserva se cancela', sb.escrituras.some((w) => w.tabla === 'reservas' && w.payload.estado === 'Cancelada'))
  afirmar('cancelar borra el saldo de consumo',
    sb.escrituras.some((w) => w.tabla === 'reservas' && w.payload.saldo_consumo === 0))
  afirmar('con otra reserva activa la seccion NO se libera',
    r.liberadas.length === 0 && !sb.escrituras.some((w) => w.tabla === 'zona_juego_estado'))
}
{
  // Sin otra reserva activa: si se libera.
  const reservas = [{ id: 'R1', estado: 'activa', juegoid: 'j1', zonaid: 'sec-1', zona: 'Terraza 1' }]
  const sb = base_falsa({ reservas: { id: 'R1' }, zona_juego_estado: { juego_id: 'j1' }, movimientos: {} })
  const r = await v2.liberar_reservas_de_prospecto(sb, admin, { id: 'p1', nombre: 'X', reservaids: ['R1'] }, {
    reservas, areas: [{ id: 'sec-1', nombre: 'Terraza 1' }],
    areasestados: { j1: { 'sec-1': 'reservada' } },
  })
  afirmar('sin otra reserva activa la seccion se libera', r.liberadas.length === 1)
  afirmar('se escribe libre en zona_juego_estado',
    sb.escrituras.some((w) => w.tabla === 'zona_juego_estado' && w.payload.estado === 'libre'))
  afirmar('queda rastro de la seccion liberada',
    sb.escrituras.some((w) => w.tabla === 'movimientos' && /Sección liberada/.test(w.payload.descripcion)))
}
{
  // Salvaguarda 2: un 'bloqueada' es una decision MANUAL del admin y cancelar
  // una reserva no puede deshacerla.
  const reservas = [{ id: 'R1', estado: 'activa', juegoid: 'j1', zonaid: 'sec-1', zona: 'Terraza 1' }]
  const sb = base_falsa({ reservas: { id: 'R1' }, zona_juego_estado: {}, movimientos: {} })
  const r = await v2.liberar_reservas_de_prospecto(sb, admin, { id: 'p1', nombre: 'X', reservaids: ['R1'] }, {
    reservas, areas: [{ id: 'sec-1', nombre: 'Terraza 1' }],
    areasestados: { j1: { 'sec-1': 'bloqueada' } },
  })
  afirmar('un bloqueo manual NO se pisa al cancelar',
    r.liberadas.length === 0 && !sb.escrituras.some((w) => w.tabla === 'zona_juego_estado'))
}
{
  // Una reserva ya cancelada no se vuelve a tocar.
  const reservas = [{ id: 'R1', estado: 'Cancelada', juegoid: 'j1', zonaid: 'sec-1' }]
  const sb = base_falsa({ reservas: { id: 'R1' }, movimientos: {} })
  const r = await v2.liberar_reservas_de_prospecto(sb, admin, { id: 'p1', nombre: 'X', reservaids: ['R1'] }, {
    reservas, areas: [{ id: 'sec-1', nombre: 'Terraza 1' }], areasestados: {},
  })
  afirmar('una reserva ya cancelada no se toca',
    r.liberadas.length === 0 && sb.escrituras.length === 0)
}
{
  // La seccion se resuelve por zona_id y, a falta de el, por nombre exacto.
  const reservas = [{ id: 'R1', estado: 'activa', juegoid: 'j1', zonaid: '', zona: 'Terraza 1' }]
  const sb = base_falsa({ reservas: { id: 'R1' }, zona_juego_estado: {}, movimientos: {} })
  const r = await v2.liberar_reservas_de_prospecto(sb, admin, { id: 'p1', nombre: 'X', reservaids: ['R1'] }, {
    reservas, areas: [{ id: 'sec-1', nombre: 'Terraza 1' }],
    areasestados: { j1: { 'sec-1': 'reservada' } },
  })
  afirmar('sin zona_id la seccion se resuelve por nombre', r.liberadas.length === 1)
}

// ── CANCELAR EN CASCADA LOS COBROS DE UNOS FOLIOS ──
{
  const cobros = [
    { id: 1, folio: 'PROS-001', monto: 100, concepto: 'ABONO', formapago: 'EFECTIVO', estado: '', notas: 'previo' },
    { id: 2, folio: 'NRJ-ADM-1', monto: 200, concepto: 'ABONO', formapago: 'EFECTIVO', estado: '' },
    { id: 3, folio: 'ajeno', monto: 300, concepto: 'ABONO', formapago: 'EFECTIVO', estado: '' },
    { id: 4, folio: 'PROS-001', monto: 50, concepto: 'ABONO', formapago: 'EFECTIVO', estado: 'cancelado' },
  ]
  const sb = base_falsa({ cobros: {}, clientes: { saldo_favor: 0 } })
  const r = await v2.cancelar_cobros_de_folios(
    sb, admin, ['PROS-001', 'NRJ-ADM-1'], 'se eliminó el prospecto',
    { cobros, clientes: [], reservas: [] }
  )
  afirmar('cancela solo los folios pedidos', r.cancelados === 2)
  const tocados = sb.escrituras.filter((w) => w.tabla === 'cobros').map((w) => w.filtros.id).sort()
  afirmar('no toca el cobro ajeno ni el ya cancelado',
    tocados.length === 2 && tocados.indexOf(3) < 0 && tocados.indexOf(4) < 0)
  afirmar('deja el motivo escrito en las notas',
    sb.escrituras.some((w) => w.tabla === 'cobros' && /se eliminó el prospecto/.test(w.payload.notas)))
  afirmar('conserva las notas anteriores',
    sb.escrituras.some((w) => w.tabla === 'cobros' && /^previo · /.test(w.payload.notas)))
  afirmar('es borrado SUAVE, no delete',
    sb.escrituras.filter((w) => w.tabla === 'cobros').every((w) => w.op === 'update' && w.payload.estado === 'cancelado'))
}
{
  // Un abono a saldo a favor cancelado en cascada tambien revierte el saldo.
  const cobros = [{
    id: 1, folio: 'PROS-001', monto: 400, concepto: 'SALDO A FAVOR',
    formapago: 'EFECTIVO', estado: '', cliente: 'ANA',
  }]
  const sb = base_falsa({ cobros: {}, clientes: { saldo_favor: 1000 } })
  await v2.cancelar_cobros_de_folios(sb, admin, ['PROS-001'], 'x',
    { cobros, clientes: [{ id: 1, nombre: 'ANA' }], reservas: [] })
  afirmar('la cascada revierte el saldo a favor',
    sb.escrituras.some((w) => w.tabla === 'clientes' && w.payload.saldo_favor === 600))
}
{
  // Sin folios no hay nada que hacer, y no se escribe.
  const sb = base_falsa({ cobros: {} })
  const r = await v2.cancelar_cobros_de_folios(sb, admin, [], 'x', { cobros: [], clientes: [], reservas: [] })
  afirmar('sin folios no escribe', r.cancelados === 0 && sb.escrituras.length === 0)
}

// ══ 11. RECIBO DIGITAL AUTOMATICO ══════════════════════════════════
// El recibo AMPARA DINERO RECIBIDO: sus totales tienen que coincidir
// centavo a centavo con lo que la v1 calcula.

function _matchAreaByZonaNombreV1(zonaNombre, areasData) {
  if (!zonaNombre) return null
  const clean = (s) => (s || '').toLowerCase().replace(/[^a-z0-9áéíóúñ\s]/gi, ' ').split(/\s+/).filter(Boolean)
  const targetWords = clean(zonaNombre)
  let best = null, bestScore = 0
  areasData.forEach((a) => {
    const aWords = clean(a.nombre)
    let score = 0
    targetWords.forEach((tw) => { if (aWords.some((aw) => aw === tw || aw.startsWith(tw) || tw.startsWith(aw))) score++ })
    if (score > bestScore) { bestScore = score; best = a }
  })
  return bestScore >= 2 ? best : null
}

function _sumaPagosDineroV1(pagos) {
  return pagos.reduce((s, p) => s + (_esCobroCredito(p) ? 0 : (Number(p.monto) || 0)), 0)
}

function _juegoCotizLabelV1(juegoId, juegos) {
  const j = juegos.find((x) => String(x.id) === String(juegoId))
  if (!j) return ''
  const f = new Date(j.fecha + 'T12:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  return f + ' · vs ' + j.rival + ' · Juego ' + j.num
}

// _pdDatosRecibo(), con `pagos`/`idx`/areasData/preciosData/juegos pasados a
// mano en vez de leidos de globales.
function _pdDatosReciboV1(card, pagos, idx, areasData, preciosData, juegos) {
  const pago = pagos[idx]
  if (!pago || !card) return null
  const totalReserva = card.monto || 0
  const totalPagado = _sumaPagosDineroV1(pagos.slice(0, idx + 1))
  const restante = totalReserva - totalPagado
  const areaRec = _matchAreaByZonaNombreV1(card.zona || '', areasData)
  const finde = (() => {
    const j = juegos.find((x) => String(x.id) === String(card.juego))
    return !!(j && j.fecha && new Date(j.fecha + 'T12:00').getDay() >= 4)
  })()
  const baseRec = areaRec ? (parseInt(_getMinSecV1(areaRec, preciosData, finde), 10) || 0) : 0
  const asistentes = baseRec > 0 ? baseRec + (parseInt(card.adultos, 10) || 0) + (parseInt(card.ninos, 10) || 0) : null
  return {
    folio: card.folio || card.id, cliente: card.nombre, tel: card.tel, email: card.email,
    zona: card.zona || '', juego: _juegoCotizLabelV1(card.juego, juegos) || card.juego || '',
    concepto: pago.concepto, monto: pago.monto, forma: pago.forma, fecha: pago.fecha,
    registradoPor: pago.registradoPor, totalReserva, totalPagado, restante, asistentes,
    estadoPago: totalReserva > 0 ? (restante <= 0.01 ? 'Liquidado ✓' : 'Pago parcial') : null,
    historial: pagos.slice(0, idx + 1).map((p) => ({ fecha: p.fecha, concepto: p.concepto, forma: p.forma, monto: p.monto })),
  }
}

for (let i = 0; i < 4000; i++) {
  const nsec = Math.floor(rnd() * 4)
  const cat_v1 = []
  const cat_v2 = []
  for (let k = 0; k < nsec; k++) {
    const base = { zona: elige(nombres_sec), min: Math.floor(rnd() * 30) + 1, min2: rnd() < 0.5 ? Math.floor(rnd() * 30) + 1 : null }
    const pin = rnd() < 0.7 ? 'sec-' + k : null
    cat_v1.push({ pinId: pin, zona: base.zona, min: base.min, min2: base.min2 })
    cat_v2.push({ pinid: pin, zona: base.zona, min: base.min, min2: base.min2 })
  }
  const areas_v1 = [{ id: 'sec-1', nombre: elige(nombres_sec) }, { id: 'sec-2', nombre: elige(nombres_sec) }]
  const areas_v2 = areas_v1

  const juegos_caso = [
    { id: 'j1', fecha: '2026-10-16', rival: 'Mayos', num: 3 },
    { id: 'j2', fecha: '2026-10-13', rival: 'Tomateros', num: 1 },
  ]

  const npagos = Math.floor(rnd() * 4) + 1
  const pagos_v1 = []
  const pagos_v2 = []
  for (let k = 0; k < npagos; k++) {
    const c = { concepto: elige(conceptos), forma: elige(formas), monto: dinero(0, 20000), fecha: '2 sep, 26', registradoPor: 'FER' }
    pagos_v1.push(c)
    pagos_v2.push({ concepto: c.concepto, formapago: c.forma, monto: c.monto, fecha: c.fecha, recibio: c.registradoPor })
  }
  const idx = npagos - 1
  const card_v1 = {
    id: 'p' + i, folio: 'PROS-' + i, nombre: 'Cliente ' + i, tel: '6621234567', email: 'c@x.com',
    zona: elige(areas_v1.map((a) => a.nombre).concat([''])), juego: elige(['j1', 'j2', '']),
    monto: dinero(0, 60000), adultos: Math.floor(rnd() * 20), ninos: Math.floor(rnd() * 10),
  }

  const v1 = _pdDatosReciboV1(card_v1, pagos_v1, idx, areas_v1, cat_v1, juegos_caso)
  const v2r = v2.datos_recibo_pago(card_v1, pagos_v2, idx, { areas: areas_v2, catalogo: cat_v2, juegos: juegos_caso })

  if (!comparar('datos_recibo_pago.totalpagado', v1.totalPagado, v2r.totalpagado, { card_v1 })) fallos++
  if (!comparar('datos_recibo_pago.restante', v1.restante, v2r.restante, { card_v1 })) fallos++
  if (!comparar('datos_recibo_pago.asistentes', v1.asistentes, v2r.asistentes, { card_v1 })) fallos++
  if (!comparar('datos_recibo_pago.estadopago', v1.estadoPago, v2r.estadopago, { card_v1 })) fallos++
  if (!comparar('datos_recibo_pago.juego', v1.juego, v2r.juego, { card_v1 })) fallos++
}

// ── el HTML del recibo escapa lo que captura un usuario ──
{
  const r = v2.datos_recibo_pago(
    { id: 1, folio: 'PROS-1', nombre: '<script>alert(1)</script>', tel: '', email: '', zona: 'Terraza & Palco', juego: '', monto: 1000, adultos: 0, ninos: 0 },
    [{ concepto: 'ABONO', formapago: 'EFECTIVO', monto: 500, fecha: '2026-09-02', recibio: 'FER "Jefa"' }],
    0, { areas: [], catalogo: [], juegos: [] }
  )
  const html = v2.html_recibo_pago(r)
  afirmar('recibo automatico: escapa el nombre del cliente', !html.includes('<script>alert(1)</script>'))
  afirmar('recibo automatico: escapa el ampersand de la zona', html.includes('Terraza &amp; Palco'))
  afirmar('recibo automatico: escapa las comillas de quien recibio', html.includes('&quot;Jefa&quot;'))
  afirmar('recibo automatico: usa SIEMPRE la identidad oficial, nunca una de localStorage',
    html.includes('Naranjeros de Hermosillo') && !/nrj_cotiz_plantilla/.test(html))
}
{
  // El nombre del archivo es predecible y sin espacios: viaja como URL.
  const n = v2.nombre_archivo_recibo('PROS-030', 2)
  afirmar('nombre de archivo del recibo', n === 'recibo-PROS-030-2.html')
}

// ══ 12. PALCOS: OCUPACION Y ESTADO DE LAS COMPRAS ══════════════════
// LA OCUPACION NO SE GUARDA EN NINGUN LADO — se suma de las reservas activas
// cada vez que se pinta. Si esta cuenta se desalinea con la v1, un palco
// puede aparecer con lugares libres que ya se vendieron (sobreventa) o
// agotado sin estarlo (venta perdida). Va al diferencial como el dinero.

function _capacidadPalcoV1(z) {
  if (!z) return 0
  return Number(z.capacidadMaxima) || Number(z.cap) || 0
}
function _lugaresDeReservaV1(r) {
  if (!r) return 0
  const n = Number(r.lugares)
  if (n > 0) return n
  let personas = (Number(r.adultos) || 0) + (Number(r.ninos) || 0)
  if (personas > 0) return personas
  personas = Number(r.personas) || 0
  return personas > 0 ? personas : 1
}
function _ocupacionPalcoV1(z, juegoId, reservasData) {
  const cap = _capacidadPalcoV1(z)
  const reservas = reservasData.filter((r) =>
    String(r.zonaId || '') === String(z.id) &&
    String(r.juegoid || '') === String(juegoId) &&
    String(r.estado || '').toLowerCase() !== 'cancelada'
  )
  const ocupados = reservas.reduce((t, r) => t + _lugaresDeReservaV1(r), 0)
  return {
    capacidad: cap, ocupados, libres: Math.max(0, cap - ocupados),
    agotado: cap > 0 && ocupados >= cap,
    pct: cap > 0 ? Math.min(100, Math.round(ocupados * 100 / cap)) : 0,
    reservas,
  }
}
function _palcosDelMapaV1(areasData) {
  return areasData.filter((a) => !!a.esCompartida)
}
// _palcoTarjeta(): las cuentas de neto/pagado/saldo/liquidada/pendiente.
function _palcoEstadoV1(r) {
  const neto = Math.max(0, (Number(r.monto) || 0) - (Number(r.descuentoMonto) || 0))
  const pagado = Number(r.montoPagado) || 0
  const saldo = Math.max(0, neto - pagado)
  const liquidada = neto > 0 && pagado >= neto
  const pendiente = String(r.estado || '').toLowerCase() === 'pendiente'
  return { neto, pagado, saldo, liquidada, pendiente }
}

for (let i = 0; i < 8000; i++) {
  const palcobase = {
    id: 'sec-' + (i % 5),
    capacidadmaxima: rnd() < 0.7 ? Math.floor(rnd() * 80) : null,
    cap: Math.floor(rnd() * 60) + 10,
  }
  // dos objetos, mismos numeros, cada uno con el vocabulario de su version —
  // igual que reservas y cobros: pasar el mismo objeto camelCase a las dos
  // funciones no prueba nada, solo demuestra que una de las dos NO lo lee.
  const palco = { ...palcobase, esCompartida: true, capacidadMaxima: palcobase.capacidadmaxima }
  const palco_v2 = { ...palcobase, escompartida: true }
  const nres = Math.floor(rnd() * 6)
  const res_v1 = []
  const res_v2 = []
  for (let k = 0; k < nres; k++) {
    const mismazona = rnd() < 0.75
    const mismojuego = rnd() < 0.85
    const base = {
      id: 'R' + i + '-' + k,
      estado: rnd() < 0.15 ? 'cancelada' : (rnd() < 0.1 ? 'pendiente' : 'activa'),
      lugares: rnd() < 0.2 ? Math.floor(rnd() * 6) : null,
      adultos: Math.floor(rnd() * 8), ninos: Math.floor(rnd() * 4),
      personas: Math.floor(rnd() * 10),
      monto: dinero(0, 20000), descuentoMonto: dinero(0, 5000),
      montoPagado: dinero(0, 20000),
    }
    res_v1.push({
      ...base, zonaId: mismazona ? palco.id : 'otra', juegoid: mismojuego ? 'j1' : 'j2',
    })
    res_v2.push({
      ...base, zonaid: mismazona ? palco.id : 'otra', juegoid: mismojuego ? 'j1' : 'j2',
      descuentomonto: base.descuentoMonto, montopagado: base.montoPagado,
    })
  }

  const v1 = _ocupacionPalcoV1(palco, 'j1', res_v1)
  const v2r = v2.ocupacion_palco(palco_v2, 'j1', res_v2)
  if (!comparar('ocupacion_palco.capacidad', v1.capacidad, v2r.capacidad, { palco })) fallos++
  if (!comparar('ocupacion_palco.ocupados', v1.ocupados, v2r.ocupados, { palco })) fallos++
  if (!comparar('ocupacion_palco.libres', v1.libres, v2r.libres, { palco })) fallos++
  if (!comparar('ocupacion_palco.agotado', v1.agotado, v2r.agotado, { palco })) fallos++
  if (!comparar('ocupacion_palco.pct', v1.pct, v2r.pct, { palco })) fallos++
  if (!comparar('ocupacion_palco.reservas', v1.reservas.map((r) => r.id).sort(),
    v2r.reservas.map((r) => r.id).sort(), { palco })) fallos++

  // el estado de pago de cada compra dentro del palco
  res_v1.forEach((r1, k) => {
    if (!comparar('estado_pago_palco', _palcoEstadoV1(r1), v2.estado_pago_palco(res_v2[k]), { r1 })) fallos++
    if (!comparar('lugares_de_reserva', _lugaresDeReservaV1(r1), v2.lugares_de_reserva(res_v2[k]), { r1 })) fallos++
  })
}

// ── que secciones cuentan como palco compartido ──
{
  const areas_v1 = [
    { id: 'a1', esCompartida: true }, { id: 'a2', esCompartida: false }, { id: 'a3' },
  ]
  const areas_v2 = [
    { id: 'a1', escompartida: true }, { id: 'a2', escompartida: false }, { id: 'a3' },
  ]
  const v1 = _palcosDelMapaV1(areas_v1).map((a) => a.id)
  const v2r = v2.palcos_del_mapa(areas_v2).map((a) => a.id)
  afirmar('palcos_del_mapa selecciona solo los compartidos', JSON.stringify(v1) === JSON.stringify(v2r) && v1.join(',') === 'a1')
}

// ── sin dato explicito de lugares, NUNCA se cuenta 0 ──
// Contar 0 haria invisible una compra y dejaria vender lugares ya tomados.
{
  afirmar('sin ningun dato, se cuenta 1 lugar (nunca 0)', v2.lugares_de_reserva({}) === 1)
  afirmar('lugares explicito manda sobre personas', v2.lugares_de_reserva({ lugares: 3, personas: 10 }) === 3)
  afirmar('sin lugares, adultos+ninos manda sobre personas',
    v2.lugares_de_reserva({ adultos: 2, ninos: 1, personas: 10 }) === 3)
}

// ── capacidad: capacidadmaxima manda sobre cap ──
{
  afirmar('capacidadmaxima manda sobre cap', v2.capacidad_palco({ capacidadmaxima: 40, cap: 60 }) === 40)
  afirmar('sin capacidadmaxima cae a cap', v2.capacidad_palco({ cap: 60 }) === 60)
  afirmar('sin ninguna, capacidad 0', v2.capacidad_palco({}) === 0)
}

// ── la cuenta de la tarjeta: liquidada / pendiente / resta ──
{
  const liquidada = v2.estado_pago_palco({ monto: 10000, descuentomonto: 0, montopagado: 10000, estado: 'activa' })
  afirmar('pagado == neto es liquidada', liquidada.liquidada === true && liquidada.saldo === 0)
  const parcial = v2.estado_pago_palco({ monto: 10000, descuentomonto: 2000, montopagado: 5000, estado: 'activa' })
  afirmar('el descuento resta del neto antes de comparar', parcial.neto === 8000 && parcial.saldo === 3000 && parcial.liquidada === false)
  const pendiente = v2.estado_pago_palco({ monto: 10000, descuentomonto: 0, montopagado: 0, estado: 'Pendiente' })
  afirmar('estado Pendiente (con mayuscula) se detecta igual', pendiente.pendiente === true)
}

// ══ 13. CLIENTES: EXPEDIENTE UNIFICADO Y VINCULACION CON PIPELINE ═══
// El total pagado de un cliente decide su saldo pendiente y si aparece
// "Liquidado" o con deuda: es dinero, y va al diferencial como todo lo demas.

function _emailNormV1(e) { return String(e || '').trim().toLowerCase() }
function _mismaIdentidadV1(a, b) {
  const ta = _telNorm(a && a.tel), tb = _telNorm(b && b.tel)
  if (!ta || !tb || ta !== tb) return false
  const na = _nombreNorm(a && a.nombre), nb = _nombreNorm(b && b.nombre)
  if (!na || !nb) return true
  return na === nb
}
function _buscarClienteEnListaV1(lista, ref) {
  if (!lista || !ref) return null
  if (ref.id != null && ref.id !== '') {
    const porId = lista.find((x) => x.id != null && String(x.id) === String(ref.id))
    if (porId) return porId
  }
  const tRef = _telNorm(ref.tel)
  if (tRef) {
    const porIdent = lista.find((x) => _mismaIdentidadV1(x, ref))
    if (porIdent) return porIdent
  }
  const e = _emailNormV1(ref.email)
  if (!e || e === '—') return null
  return lista.find((x) => _emailNormV1(x.email) === e && !(tRef && _telNorm(x.tel))) || null
}
function _esReservaCortesiaV1(r) {
  const bruto = Number(r.monto) || 0
  if (bruto <= 0) return false
  const desc = Number(r.descuentoMonto != null ? r.descuentoMonto : r.descuento_monto) || 0
  return bruto - desc <= 0.009
}
function _reservaDeCobroV1(p, reservasData) {
  if (!p || !p.folio) return null
  return reservasData.find((r) => String(r.id) === String(p.folio)) || null
}
function _telDeCobroV1(p, reservasData) {
  const propio = _telNorm(p && (p.tel || p.telefono))
  if (propio) return propio
  const r = _reservaDeCobroV1(p, reservasData)
  return r ? _telNorm(r.tel) : ''
}
function _cobroEsDelClienteV1(p, c, foliosCliente, reservasData) {
  if (!p || !c) return false
  const cid = p.clienteId != null ? p.clienteId : p.cliente_id
  if (cid != null && cid !== '' && c.id != null && c.id !== '') return String(cid) === String(c.id)
  if (p.folio && foliosCliente && foliosCliente.has(String(p.folio))) return true
  const telPago = _telDeCobroV1(p, reservasData), telCli = _telNorm(c.tel)
  if (telPago && telCli) {
    if (telPago !== telCli) return false
    const nP = _nombreNorm(p.cliente), nC = _nombreNorm(c.nombre)
    return !nP || !nC || nP === nC
  }
  return _nombreNorm(p.cliente) === _nombreNorm(c.nombre) && !!_nombreNorm(c.nombre)
}
function _aliasFolioV1(f) {
  const s = String(f || '').trim()
  if (!s) return []
  return s.toUpperCase().startsWith('PROS-') ? [s, s.slice(5)] : [s, 'PROS-' + s]
}
function _foliosDeClienteV1(c, pipelineData) {
  const folios = new Set((c.reservas || []).map((x) => String(x.folio)))
  pipelineData.forEach((p) => {
    if (!p || !p.folio || !Array.isArray(p.reservaIds)) return
    if (!p.reservaIds.some((rid) => folios.has(String(rid)))) return
    _aliasFolioV1(p.folio).forEach((f) => folios.add(f))
  })
  return folios
}

// initClientesPage(), sin el DOM ni el merge de clientesExtra (localStorage,
// no migrado a proposito -- ver commit de Pipeline).
function _initClientesPageV1(clientesTabla, reservasData, cobros, pipelineData) {
  let _clientesData = []

  const _aliasFolio = _aliasFolioV1
  const _foliosPipelinePorReserva = {}
  pipelineData.forEach((p) => {
    if (!p || !p.folio || !Array.isArray(p.reservaIds)) return
    p.reservaIds.forEach((rid) => {
      const k = String(rid)
      ;(_foliosPipelinePorReserva[k] = _foliosPipelinePorReserva[k] || []).push.apply(
        _foliosPipelinePorReserva[k] = _foliosPipelinePorReserva[k] || [], _aliasFolio(p.folio))
    })
  })

  reservasData.forEach((r) => {
    if (!r.email && !r.tel && !r.cliente) return
    if (String(r.estado || '').toLowerCase() === 'cancelada') return
    const foliosDeReserva = [String(r.id)].concat(_foliosPipelinePorReserva[String(r.id)] || [])
    let creditoReserva = 0
    const cobradoReal = cobros.reduce((s, p) => {
      if (_cobroCancelado(p) || foliosDeReserva.indexOf(String(p.folio || '')) < 0) return s
      if (_esCobroCredito(p)) { creditoReserva += Number(p.monto) || 0; return s }
      return s + (Number(p.monto) || 0)
    }, 0)
    const base = (r.montoPagado != null) ? (Number(r.montoPagado) || 0)
      : r.pago === 'Completo' ? r.monto : r.pago === 'Sin pago' ? 0 : redondearDinero(r.monto * 0.3)
    const montoPagado = Math.max(base, cobradoReal)
    const neto = Math.max(0, (Number(r.monto) || 0) - (Number(r.descuentoMonto) || 0))
    const reservaItem = { zona: r.zona, juego: r.juego, montoPagado, neto, credito: creditoReserva,
      saldo: Math.max(0, neto - montoPagado), folio: r.id, fecha: '', cortesia: _esReservaCortesiaV1(r) }
    let c = _buscarClienteEnListaV1(_clientesData, { nombre: r.cliente, email: r.email, tel: r.tel })
    if (c && c.reservas.some((x) => String(x.folio) === String(r.id))) return
    if (!c) {
      c = { nombre: r.cliente, email: r.email, tel: r.tel || '—', reservas: [], totalPagado: 0, saldoTotal: 0 }
      _clientesData.push(c)
    }
    c.reservas.push(reservaItem)
    c.totalPagado += reservaItem.montoPagado
    c.saldoTotal += reservaItem.saldo
  })

  clientesTabla.forEach((c) => {
    const existing = _buscarClienteEnListaV1(_clientesData, c)
    if (existing) {
      existing.id = c.id
      if (c.nombre) existing.nombre = c.nombre
      if (c.tel) existing.tel = c.tel
      existing.creditoAutorizado = !!c.credito_autorizado
      existing.saldoFavor = Number(c.saldo_favor) || 0
    } else {
      _clientesData.push({ id: c.id, nombre: c.nombre, email: c.email, tel: c.tel || '—',
        creditoAutorizado: !!c.credito_autorizado, saldoFavor: Number(c.saldo_favor) || 0,
        reservas: [], totalPagado: 0, saldoTotal: 0 })
    }
  })

  _clientesData.forEach((c) => {
    const netoTotal = c.reservas.reduce((s2, r) => s2 + (Number(r.neto) || 0), 0)
    const pagadoPorReservas = c.reservas.reduce((s2, r) => s2 + (Number(r.montoPagado) || 0), 0)
    const foliosC = _foliosDeClienteV1(c, pipelineData)
    const cobrosCliente = cobros.filter((pg) => {
      if (_cobroCancelado(pg)) return false
      if (!_cobroEsDelClienteV1(pg, c, foliosC, reservasData)) return false
      const rDelPago = _reservaDeCobroV1(pg, reservasData)
      return !(rDelPago && String(rDelPago.estado || '').toLowerCase() === 'cancelada')
    })
    const pagadoPorCobros = cobrosCliente.reduce((s2, pg) => s2 + (_cobroSinDineroNuevo(pg) ? 0 : (Number(pg.monto) || 0)), 0)
    c.totalPagado = Math.max(pagadoPorReservas, pagadoPorCobros) || 0
    c.saldoTotal = Math.max(0, netoTotal - c.totalPagado)
  })

  return _clientesData
}

// ── generador de un escenario completo: N clientes DB, M reservas, K cobros,
// J tarjetas de pipeline, con cruces deliberados por folio de prospecto,
// alias PROS-xxx, e identidad telefono+nombre ──
const zonas_cliente = ['Terraza Derecha 1', 'Palco All-Inc 2', 'Platea Izq 3']

function generarEscenarioClientes(i) {
  const nombresset = ['ANA LOPEZ', 'José Pérez', 'Luis Ruiz', 'MARÍA SOTO']
  const telsset = ['6621234511', '6621234512', '6621234513', '']

  const nclientes = Math.floor(rnd() * 3)
  const clientesdb_v1 = []
  const clientesdb_v2 = []
  for (let k = 0; k < nclientes; k++) {
    const base = { id: k + 1, nombre: elige(nombresset), email: rnd() < 0.6 ? 'x' + k + '@y.com' : '',
      tel: elige(telsset), credito_autorizado: rnd() < 0.3, saldo_favor: rnd() < 0.4 ? dinero(0, 2000) : 0 }
    clientesdb_v1.push(base)
    clientesdb_v2.push(base)
  }

  const nreservas = Math.floor(rnd() * 4)
  const reservas_v1 = []
  const reservas_v2 = []
  for (let k = 0; k < nreservas; k++) {
    const monto = dinero(0, 30000)
    const desc = rnd() < 0.3 ? dinero(0, monto) : 0
    const base = {
      id: 'R' + i + '-' + k,
      cliente: elige(nombresset), email: rnd() < 0.5 ? 'x' + (k % 3) + '@y.com' : '',
      tel: elige(telsset), zona: elige(zonas_cliente), juego: 'vs Mayos',
      monto, estado: rnd() < 0.15 ? 'cancelada' : 'activa',
      pago: elige(['Completo', 'Sin pago', 'Enganche 30%']),
    }
    const pagado = rnd() < 0.5 ? dinero(0, monto) : null
    reservas_v1.push({ ...base, montoPagado: pagado, descuentoMonto: desc })
    reservas_v2.push({ ...base, montopagado: pagado, descuentomonto: desc })
  }

  // tarjetas del Pipeline: algunas ligadas a una reserva (widen), otras a un
  // cliente por cliente_id, otras sueltas.
  const npipe = Math.floor(rnd() * 3)
  const pipe_v1 = []
  const pipe_v2 = []
  for (let k = 0; k < npipe; k++) {
    const folio = 'PROS-' + String(i * 10 + k).padStart(3, '0')
    const ligaareserva = reservas_v1.length && rnd() < 0.6
    const rids = ligaareserva ? [elige(reservas_v1).id] : []
    const clienteid = clientesdb_v1.length && rnd() < 0.4 ? elige(clientesdb_v1).id : null
    pipe_v1.push({ id: 'p' + i + k, folio, reservaIds: rids, clienteId: clienteid, vendedora: 'FER', etapa: 'reservado' })
    pipe_v2.push({ id: 'p' + i + k, folio, reservaids: rids, clienteid, vendedora: 'FER', etapa: 'reservado' })
  }

  // cobros: algunos con folio de reserva, otros con folio (o alias) de una
  // tarjeta de pipeline huerfana -- el caso que exige el pase de reconciliacion.
  const ncobros = Math.floor(rnd() * 5)
  const cobros_v1 = []
  const cobros_v2 = []
  for (let k = 0; k < ncobros; k++) {
    let folio
    const r = rnd()
    if (r < 0.4 && reservas_v1.length) folio = elige(reservas_v1).id
    else if (r < 0.7 && pipe_v1.length) folio = elige(_aliasFolioV1(elige(pipe_v1).folio))
    else folio = 'ajeno-' + k
    const base = { id: i * 100 + k, folio, cliente: elige(nombresset), email: '',
      tel: elige(telsset), monto: dinero(0, 20000), concepto: elige(conceptos),
      estado: rnd() < 0.2 ? 'cancelado' : '' }
    const forma = elige(formas)
    cobros_v1.push({ ...base, formaPago: forma })
    cobros_v2.push({ ...base, formapago: forma })
  }

  return { clientesdb_v1, clientesdb_v2, reservas_v1, reservas_v2, pipe_v1, pipe_v2, cobros_v1, cobros_v2 }
}

for (let i = 0; i < 3000; i++) {
  const esc = generarEscenarioClientes(i)
  const v1lista = _initClientesPageV1(esc.clientesdb_v1, esc.reservas_v1, esc.cobros_v1, esc.pipe_v1)
  const v2lista = v2.armar_clientes({
    clientes: esc.clientesdb_v2, reservas: esc.reservas_v2, cobros: esc.cobros_v2, pipeline: esc.pipe_v2,
  })

  // se comparan por clave de identidad (nombre+tel), no por orden de arreglo:
  // armar_clientes puede insertar en distinto orden que initClientesPage
  // sin que eso sea una diferencia real.
  const clave = (c) => (c.id != null ? 'id:' + c.id : 'n:' + (c.nombre || '').toUpperCase().trim() + '|' + (c.tel || ''))
  const v1map = {}
  v1lista.forEach((c) => { v1map[clave(c)] = c })
  const v2map = {}
  v2lista.forEach((c) => { v2map[clave(c.id != null ? c : { nombre: c.nombre, tel: c.tel })] = c })

  const claves = new Set([...Object.keys(v1map), ...Object.keys(v2map)])
  claves.forEach((k) => {
    const a = v1map[k], b = v2map[k]
    if (!comparar('armar_clientes.existe', !!a, !!b, { k, escenario: esc })) { fallos++; return }
    if (!a || !b) return
    // dos sumas independientes (v1 en 'var'/reduce distinto orden, v2 en
    // otro) pueden diferir en polvo de punto flotante bien por debajo del
    // centavo: se compara redondeado en LOS DOS LADOS, como se compara
    // cualquier monto que se le muestra al usuario.
    if (!comparar('armar_clientes.totalpagado', redondearDinero(a.totalPagado), redondearDinero(b.totalpagado), { k, esc })) fallos++
    if (!comparar('armar_clientes.saldototal', redondearDinero(a.saldoTotal), redondearDinero(b.saldototal), { k, esc })) fallos++
    if (!comparar('armar_clientes.nreservas', a.reservas.length, b.reservas.length, { k, esc })) fallos++
  })
}

// ── consumos_de_cliente y su identidad de respaldo ──
{
  const cliente = { id: 1, nombre: 'ANA LOPEZ', tel: '6621234511', reservas: [{ folio: 'R1' }] }
  const reservas = [
    { id: 'R1', saldoconsumo: 500, estado: 'activa', cliente: 'ANA LOPEZ', tel: '6621234511' },
    { id: 'R2', saldoconsumo: 300, estado: 'activa', cliente: 'ANA LOPEZ', tel: '6621234511' },
    { id: 'R3', saldoconsumo: 200, estado: 'activa', cliente: 'ANA LOPEZ', tel: '' },
    { id: 'R4', saldoconsumo: 0, estado: 'activa', cliente: 'ANA LOPEZ', tel: '6621234511' },
    { id: 'R5', saldoconsumo: 100, estado: 'cancelada', cliente: 'ANA LOPEZ', tel: '6621234511' },
    { id: 'R6', saldoconsumo: 100, estado: 'activa', cliente: 'OTRO', tel: '6629999999' },
  ]
  const foliosc = v2.folios_de_cliente(cliente, [])
  const r = v2.consumos_de_cliente(cliente, reservas, foliosc)
  const ids = r.map((x) => x.id).sort()
  afirmar('consumos_de_cliente: por folio propio', ids.indexOf('R1') >= 0)
  afirmar('consumos_de_cliente: por identidad telefono+nombre', ids.indexOf('R2') >= 0)
  afirmar('consumos_de_cliente: por nombre cuando no hay telefono en la reserva', ids.indexOf('R3') >= 0)
  afirmar('consumos_de_cliente: sin saldo, fuera', ids.indexOf('R4') < 0)
  afirmar('consumos_de_cliente: cancelada, fuera', ids.indexOf('R5') < 0)
  afirmar('consumos_de_cliente: otro cliente, fuera', ids.indexOf('R6') < 0)
}

// ── cobro_es_del_cliente: el orden de prioridad exacto de la v1 ──
{
  const cliente = { id: 5, nombre: 'ANA LOPEZ', tel: '6621234511' }
  afirmar('cliente_id explicito manda sobre todo lo demas',
    v2.cobro_es_del_cliente({ clienteid: 5, folio: 'ajeno', cliente: 'OTRO NOMBRE' }, cliente, new Set(), []) === true)
  afirmar('cliente_id de otro cliente descarta aunque el folio coincida',
    v2.cobro_es_del_cliente({ clienteid: 9, folio: 'F1' }, cliente, new Set(['F1']), []) === false)
  afirmar('folio en el set del cliente basta sin telefono ni nombre',
    v2.cobro_es_del_cliente({ folio: 'F1', cliente: 'nadie que ver' }, cliente, new Set(['F1']), []) === true)
  afirmar('mismo telefono y nombres distintos: NO es del cliente',
    v2.cobro_es_del_cliente({ folio: '', tel: '6621234511', cliente: 'OTRA PERSONA' }, cliente, new Set(), []) === false)
  afirmar('mismo telefono y mismo nombre: SI',
    v2.cobro_es_del_cliente({ folio: '', tel: '6621234511', cliente: 'Ana Lopez' }, cliente, new Set(), []) === true)
  afirmar('sin telefono en ninguno de los dos lados, cae al nombre exacto',
    v2.cobro_es_del_cliente({ folio: '', tel: '', cliente: 'Ana Lopez' }, { id: 6, nombre: 'ANA LOPEZ', tel: '' }, new Set(), []) === true)
  afirmar('el correo NUNCA decide', v2.cobro_es_del_cliente(
    { folio: '', tel: '', cliente: 'OTRO', email: 'a@x.com' },
    { id: 7, nombre: 'ANA LOPEZ', tel: '', email: 'a@x.com' }, new Set(), []) === false)
  // telefono de la RESERVA, cuando el cobro no trae el suyo propio.
  const reservas = [{ id: 'R9', tel: '6621234511' }]
  afirmar('sin telefono propio, usa el de la reserva de su folio',
    v2.cobro_es_del_cliente({ folio: 'R9', tel: '', cliente: 'Ana Lopez' }, cliente, new Set(), reservas) === true)
}

// ── escritura de consumos: eliminar deja el saldo en $0 ──
{
  const sb = base_falsa({ reservas: { id: 'R1', saldo_consumo: 500 }, movimientos: {} })
  const r = await v2.actualizar_verificado(sb, admin, 'reservas', { saldo_consumo: 0 }, 'R1', ['saldo_consumo'])
  afirmar('eliminar consumo: escribe 0', r.ok === true)
  afirmar('eliminar consumo: el payload es EXACTAMENTE saldo_consumo:0',
    Object.keys(sb.escrituras[0].payload).length === 1 && sb.escrituras[0].payload.saldo_consumo === 0)
}
{
  // permisos: quien puede editar seccionesreservadas puede vaciar un consumo
  // (el mismo dueño de la tabla `reservas`); quien solo tiene 'consumos' no
  // basta por si solo -- la guardia de `reservas` no reconoce ese modulo.
  const vendedora = { rol: 'Vendedora', permisos: { seccionesreservadas: 'editar' } }
  const soloconsumos = { rol: 'Vendedora', permisos: { consumos: 'editar' } }
  afirmar('seccionesreservadas:editar puede vaciar el consumo',
    v2.motivo_bloqueo(vendedora, 'reservas') === null)
  afirmar('consumos:editar por si solo NO alcanza (espejo del hueco de la v1)',
    v2.motivo_bloqueo(soloconsumos, 'reservas') === 'sin_permiso')
}

// ══ 14. "CAJA TAQUILLA ESTADIO": EFECTIVO SIN COMPROBANTE ══════════
// No existe una v1 con la que diferenciar aqui — la v1 solo reconoce el
// literal 'EFECTIVO', y el ajuste que pide el negocio es EXACTAMENTE
// ampliar eso. Van pruebas directas en vez de diferenciales.

{
  afirmar('EFECTIVO es efectivo, sin catalogo', v2.es_forma_efectivo('EFECTIVO', []) === true)
  afirmar('Caja taquilla estadio es efectivo AUNQUE NO este en el catalogo',
    v2.es_forma_efectivo('Caja taquilla estadio', []) === true)
  afirmar('el reconocimiento de taquilla no distingue mayusculas/minusculas',
    v2.es_forma_efectivo('caja TAQUILLA Estadio', []) === true)
  afirmar('un metodo del catalogo con tipo Efectivo cuenta igual, sea cual sea su nombre',
    v2.es_forma_efectivo('Ventanilla del club', [{ nombre: 'Ventanilla del club', tipo: 'Efectivo' }]) === true)
  afirmar('la garantia por NOMBRE de taquilla manda incluso si el catalogo trae mal el tipo',
    v2.es_forma_efectivo('Caja taquilla estadio', [{ nombre: 'Caja taquilla estadio', tipo: 'Transferencia' }]) === true)
  afirmar('otro metodo con tipo distinto de Efectivo NO cuenta como efectivo',
    v2.es_forma_efectivo('Deposito Oxxo', [{ nombre: 'Deposito Oxxo', tipo: 'Transferencia' }]) === false)
  afirmar('TRANSFERENCIA no es efectivo', v2.es_forma_efectivo('TRANSFERENCIA', []) === false)
  afirmar('una forma que no esta en ningun lado no es efectivo',
    v2.es_forma_efectivo('Deposito Oxxo', []) === false)
  afirmar('vacio no es efectivo', v2.es_forma_efectivo('', []) === false)
}

{
  afirmar('sin catalogo, el respaldo generico SIEMPRE trae taquilla',
    v2.nombres_formas_pago([]).some((n) => n.toLowerCase() === 'caja taquilla estadio'))

  const catalogosincaja = [{ nombre: 'Transferencia BBVA', estado: 'Activo' }, { nombre: 'TPV', estado: 'Activo' }]
  const conCaja = v2.nombres_formas_pago(catalogosincaja)
  afirmar('si el catalogo activo no la trae, se agrega al final',
    conCaja.length === 3 && conCaja[2].toLowerCase() === 'caja taquilla estadio')

  const catalogoconcaja = catalogosincaja.concat([{ nombre: 'Caja taquilla estadio', estado: 'Activo', tipo: 'Efectivo' }])
  afirmar('si ya esta en el catalogo activo, NO se duplica',
    v2.nombres_formas_pago(catalogoconcaja).length === 3)

  // Si la UNICA fila de taquilla en el catalogo esta Inactiva, se filtra como
  // cualquier metodo inactivo -- pero la garantia la repone de todos modos,
  // cayendo al respaldo generico + taquilla.
  const soloinactiva = [{ nombre: 'Caja taquilla estadio', estado: 'Inactivo', tipo: 'Efectivo' }]
  const repuesta = v2.nombres_formas_pago(soloinactiva)
  afirmar('taquilla inactiva en el catalogo no la hace desaparecer del selector',
    repuesta.some((n) => n.toLowerCase() === 'caja taquilla estadio'))
}

// ── extremo a extremo: registrar un pago en Caja taquilla estadio ──
// sin archivo, sin bloquear, y con recibo digital automatico.
{
  const metodos = [{ nombre: 'Caja taquilla estadio', tipo: 'Efectivo', estado: 'Activo' }]
  const espendiente = false
  const escredito = v2.es_pago_credito('ABONO', 'Caja taquilla estadio')
  const esefectivo = !espendiente && v2.es_forma_efectivo('Caja taquilla estadio', metodos)
  const essaldofavor = false
  afirmar('Caja taquilla estadio no se confunde con credito', escredito === false)
  afirmar('Caja taquilla estadio SI se reconoce como efectivo en el flujo real', esefectivo === true)
  const exigecomprobante = !escredito && !espendiente && !esefectivo && !essaldofavor && !null
  afirmar('con taquilla reconocida, NO exige comprobante', exigecomprobante === false)

  // El insert del cobro se hace SIN evidencia (nadie subio archivo) y el
  // flujo de recibo automatico (misma condicion que useprospectos.js) debe
  // encontrar la puerta abierta: sin pendiente, sin credito, sin evidencia.
  const evidencia = ''
  const generarecibo = !espendiente && !escredito && !evidencia
  afirmar('se dispara la generacion del recibo digital', generarecibo === true)
}

// ══ 15. COTIZACIONES: ESCRITURA, CONVERSION A PROSPECTO Y ARQUEO ══
// Cotizaciones no tiene una prueba diferencial propia aqui: calcular_cotizacion
// reutiliza calc_total_prospecto()/descuento_volumen_aplicable() —esas SI se
// prueban contra la v1 en la seccion 8— y le agrega el desglose de IVA y el
// tope de 100% documentado en la cabecera de lib/cotizaciones.js. El
// Consolidado Diario tampoco existe en la v1 (su unico "reporte del dia" es
// el mensaje de WhatsApp, ya probado en la seccion 5): arqueo_por_forma() y
// csv_arqueo() son piezas nuevas. Van pruebas directas para ambas.

// ── folio_cotizacion ──
{
  afirmar('folio arranca en COT-001 sin cotizaciones previas', v2.folio_cotizacion([]) === 'COT-001')
  afirmar('folio sigue el maximo YA usado, no la cuenta de filas',
    v2.folio_cotizacion([{ id: 'COT-002' }, { id: 'COT-007' }]) === 'COT-008')
  afirmar('un id que no matchea el patron no rompe el calculo',
    v2.folio_cotizacion([{ id: 'basura' }, { id: 'COT-003' }]) === 'COT-004')
}

// ── validar_cotizacion: solo el cliente es obligatorio, igual que guardarCotiz() ──
{
  afirmar('sin cliente, falla', v2.validar_cotizacion({ cliente: '' }).length === 1)
  afirmar('cliente solo, pasa', v2.validar_cotizacion({ cliente: 'Juan' }).length === 0)
  afirmar('telefono de 9 digitos falla', v2.validar_cotizacion({ cliente: 'Juan', tel: '123456789' }).length === 1)
  afirmar('telefono de 10 digitos pasa', v2.validar_cotizacion({ cliente: 'Juan', tel: '6621234567' }).length === 0)
  afirmar('email invalido falla', v2.validar_cotizacion({ cliente: 'Juan', email: 'no-es-correo' }).length === 1)
  afirmar('email valido pasa', v2.validar_cotizacion({ cliente: 'Juan', email: 'a@b.com' }).length === 0)
  afirmar('sin tel ni email no exige nada extra',
    v2.validar_cotizacion({ cliente: 'Juan' }).length === 0)
}

// ── fecha_validez_cotizacion (_validaCotizFecha) ──
{
  afirmar('15 dias', v2.fecha_validez_cotizacion('2026-01-01', 15) === '2026-01-16')
  afirmar('30 dias', v2.fecha_validez_cotizacion('2026-01-01', 30) === '2026-01-31')
  afirmar('dias invalido cae a 15 por defecto', v2.fecha_validez_cotizacion('2026-01-01', 'x') === '2026-01-16')
}

// ── calcular_cotizacion: desglose de IVA y, sobre todo, la correccion del
// total negativo que SI tiene la v1 (ver deviacion #1 en lib/cotizaciones.js) ──
{
  const base = { areamonto: 10000, consumomonto: 0, extramonto: 0, descuento: 0, personasincluidas: 50, juegoid: 'j1', zonaid: 'z1' }

  const c1 = v2.calcular_cotizacion(base, { descuentosvolumen: [] })
  afirmar('sin descuentos: subtotal = total', c1.subtotal === 10000 && c1.total === 10000)
  afirmar('IVA incluido: base + iva = total al centavo', Math.abs((c1.base + c1.iva) - c1.total) < 0.001)
  afirmar('base = total / 1.16', Math.abs(c1.base - 10000 / 1.16) < 0.01)

  const c2 = v2.calcular_cotizacion({ ...base, descuento: 20 }, { descuentosvolumen: [] })
  afirmar('descuento manual 20%: total = 8000', c2.total === 8000)

  const reglas = [{ nombre: 'Grupo grande', minpersonas: 40, porcentaje: 10, juegos: null, zonas: null, activo: true }]
  const c3 = v2.calcular_cotizacion(base, { descuentosvolumen: reglas })
  afirmar('descuento por grupo automatico (10%): total = 9000', c3.total === 9000)
  afirmar('el nombre de la regla ganadora viaja para guardarse', c3.volumennombre === 'Grupo grande')

  // EL BUG DE LA V1: calcCotiz() resta el % manual y el de grupo POR
  // SEPARADO, sin topar la suma — un 80% manual mas un 30% de grupo deja el
  // total NEGATIVO. calc_total_prospecto() (reutilizada aqui) SI topa la
  // suma en 100%.
  const reglagrande = [{ nombre: 'Mega grupo', minpersonas: 1, porcentaje: 30, juegos: null, zonas: null, activo: true }]
  const extremo = { ...base, descuento: 80 }
  const subtotalv1 = 10000
  const totalcomo_v1 = subtotalv1 - (subtotalv1 * 80 / 100) - (subtotalv1 * 30 / 100)
  const c4 = v2.calcular_cotizacion(extremo, { descuentosvolumen: reglagrande })
  afirmar('la v1 SIN tope hubiera dado un total negativo (el bug que se corrige)', totalcomo_v1 < 0)
  afirmar('v2 CON el tope nunca da un total negativo', c4.total >= 0)
  afirmar('v2 topa el combinado en 100% del subtotal: total = 0', c4.total === 0)
}

// ── cotiz_transicion_bloqueada (_cotizConcretaSoloViaPipeline) ──
{
  afirmar('Activa → Concretada bloqueada', v2.cotiz_transicion_bloqueada('Activa', 'Concretada') === true)
  afirmar('Aprobada → Concretada bloqueada', v2.cotiz_transicion_bloqueada('Aprobada', 'Concretada') === true)
  afirmar('Concretada → Rechazada NO bloqueada (esa transicion no esta candada)',
    v2.cotiz_transicion_bloqueada('Concretada', 'Rechazada') === false)
  afirmar('Activa → Rechazada NO bloqueada', v2.cotiz_transicion_bloqueada('Activa', 'Rechazada') === false)
}

// ── cotizacion_activa_en_pipeline (_cotizSigueEnPipeline, mitad de lectura) ──
{
  const c = { id: 'COT-001', enpipeline: true }
  const viva = [{ cotizid: 'COT-001', etapa: 'cotizado' }]
  const descartada = [{ cotizid: 'COT-001', etapa: 'descartado' }]
  afirmar('bandera true + tarjeta viva → activa', v2.cotizacion_activa_en_pipeline(c, viva) === true)
  afirmar('bandera true + tarjeta descartada → NO activa (bandera colgada)',
    v2.cotizacion_activa_en_pipeline(c, descartada) === false)
  afirmar('bandera true + sin tarjeta que la respalde → NO activa',
    v2.cotizacion_activa_en_pipeline(c, []) === false)
  afirmar('bandera false → NO activa aunque exista una tarjeta con ese cotiz_id',
    v2.cotizacion_activa_en_pipeline({ ...c, enpipeline: false }, viva) === false)
}

// ── cotizacion_a_prospecto_payload (confirmarMoverCotizPipeline) ──
{
  const areas = [{ id: 'z1', nombre: 'Palco Norte' }]
  const c = {
    id: 'COT-005', cliente: 'MARIA LOPEZ', email: 'm@x.com', tel: '6621112233',
    zonaid: 'z1', juegoid: 'j9', descripcion: 'Cumpleaños', total: 12000, descuento: 15,
    adultoextracant: 3, ninoextracant: 2, consumomonto: 500, extramonto: 0,
    adultoextraprecio: 200, ninoextraprecio: 100, notas: 'nota', vendedora: 'Ana',
    tipocomida: 'discada',
  }
  const pay = v2.cotizacion_a_prospecto_payload(c, { areas, pipeline: [] })
  afirmar('id con prefijo p-', pay.id === 'p-COT-005')
  afirmar('folio con el formato de prospectos (pipeline vacio)', pay.folio === 'PROS-001')
  afirmar('zona por el nombre real del catalogo', pay.zona === 'Palco Norte')
  afirmar('monto = total de la cotizacion cuando es > 0', pay.monto === 12000)
  afirmar('etapa "cotizado"', pay.etapa === 'cotizado')
  afirmar('cotiz_id enlaza de regreso a la cotizacion de origen', pay.cotiz_id === 'COT-005')
  afirmar('tipo_comida viaja tal cual', pay.tipo_comida === 'discada')

  // Respaldo: total en 0 (fila vieja o guardada a medias) se recompone
  // sumando sus partidas YA GUARDADAS (adultos_extra_monto/ninos_extra_monto
  // son columnas propias, igual que en la v1 — no se recalculan aqui a partir
  // del precio × cantidad) en vez de dejar el prospecto con monto 0.
  const c2 = { ...c, total: 0, areamonto: 8000, adultosextramonto: 600, ninosextramonto: 200 }
  const pay2 = v2.cotizacion_a_prospecto_payload(c2, { areas, pipeline: [] })
  // 8000 (area) + 500 (consumo) + 0 (extra) + 600 (adultos) + 200 (niños) = 9300
  afirmar('total en 0 se recompone de las partidas', pay2.monto === 9300)
}

// ── arqueo_por_forma: cuantos cobros y cuanto dinero por forma de pago ──
{
  const cs = [
    { formapago: 'Caja taquilla estadio', monto: 1000 },
    { formapago: 'Caja taquilla estadio', monto: 500 },
    { formapago: 'TRANSFERENCIA BBVA', monto: 2000 },
    { formapago: 'TARJETA VISA', monto: 300 },
  ]
  const arq = v2.arqueo_por_forma(cs)
  const taquilla = arq.find((x) => x.forma === 'Caja taquilla estadio')
  const transferencia = arq.find((x) => x.forma === 'Transferencia')
  afirmar('Caja taquilla estadio se agrupa con su nombre exacto (no es una forma generica)',
    !!taquilla && taquilla.n === 2 && taquilla.total === 1500)
  afirmar('formas genericas se normalizan (TRANSFERENCIA BBVA → Transferencia)',
    !!transferencia && transferencia.n === 1 && transferencia.total === 2000)
  afirmar('ordenado por total descendente', arq[0].total >= arq[1].total)
}

// ── filas_arqueo / csv_arqueo: el detalle exportable ──
{
  const cs = [{
    fecha: '2026-09-04', formapago: 'Caja taquilla estadio', monto: 1500.5,
    cliente: 'Juan, Pérez', zona: 'Palco 3', concepto: 'ABONO', recibio: 'Ana',
  }]
  const filas = v2.filas_arqueo(cs)
  afirmar('una fila por cobro', filas.length === 1)
  afirmar('el monto viaja como numero, no como texto formateado (para sumarlo en la hoja)',
    filas[0].monto === 1500.5)

  const csv = v2.csv_arqueo(cs)
  afirmar('trae el encabezado de columnas', csv.includes('Fecha,Hora,Cliente'))
  afirmar('un cliente con coma en el nombre queda entre comillas (CSV valido)',
    csv.includes('"Juan, Pérez"'))
  afirmar('arranca con el BOM UTF-8 (para que Excel no rompa los acentos)',
    csv.charCodeAt(0) === 0xFEFF)
}

// ══ RESULTADO ═════════════════════════════════════════════════════
console.log('\n── diferencial contra la v1 ──')
console.log('  comparaciones: ' + casos.toLocaleString('es-MX'))
console.log('  diferencias:   ' + fallos)
if (difs.length) {
  console.log('\n  primeras diferencias:')
  difs.forEach((d) => {
    console.log('   · ' + d.etiqueta + '\n     v1: ' + d.v1 + '\n     v2: ' + d.v2 + '\n     caso: ' + d.ctx)
  })
}
console.log('\n── escrituras contra base falsa ──')
console.log('  comprobaciones: ' + pruebas_sb)
console.log('  fallos:         ' + fallos_sb)
console.log('\n' + (fallos === 0 && fallos_sb === 0
  ? 'CASCADA VERIFICADA: 0 diferencias con la v1'
  : 'HAY DIFERENCIAS CON LA V1'))
process.exit(fallos === 0 && fallos_sb === 0 ? 0 : 1)
