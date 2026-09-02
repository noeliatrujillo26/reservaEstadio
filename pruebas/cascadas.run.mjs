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
