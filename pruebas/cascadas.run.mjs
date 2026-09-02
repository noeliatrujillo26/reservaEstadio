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
          const devuelve = o.filas === 0 ? [] : [{ ...(filas[tabla] || {}), ...q._payload }]
          return Promise.resolve({ data: o.error ? null : devuelve, error: o.error || null })
            .then(res, rej)
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
  afirmar('estado de zona: escribe el upsert', r.ok === true && sb.escrituras[0].tabla === 'zona_juego_estado')
  afirmar('estado de zona: manda juego, zona y estado',
    sb.escrituras[0].payload.juego_id === 'j1' && sb.escrituras[0].payload.estado === 'reservada')
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
