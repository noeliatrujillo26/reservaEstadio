// ═══════════════════════════════════════════════════════════════════
// reservasadmin.js — logica de la vista "Reservas" del panel.
// espejo 1:1 de v1: renderSeccionesResTabla() y renderSeccionesResKPIs() de
// js/20-editor-mapa.js, mas los helpers que usa (getClienteEnSeccion,
// getAbonadoRes, getCreditoRes, _folioReserva, _totalPersonasSeccion,
// _reservaLiquidadaLocal, esReservaCortesia, _esPalcoCompartido).
// ═══════════════════════════════════════════════════════════════════

import { cobro_cancelado, es_cobro_credito } from './cobros'
import { categoria_sec, estado_zona } from './dashboard'
import { redondear_dinero } from './dinero'

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

// ══ ESCRITURA: LO QUE HACE FALTA PARA GUARDAR UNA RESERVA ══════════
// espejo 1:1 de v1: generarFolioReserva() (js/modules/utils.js),
// _resEconomiaAGuardar(), _emailValido() y el calculo de estado_pago de
// _guardarReservaManualInterno() (js/20-editor-mapa.js 2402-2495).
// Todo PURO: se prueba con el banco diferencial, sin tocar la base.

// Folios con distintivo de ORIGEN: 'admin' → NRJ-ADM-XXXXX (creadas desde el
// panel), 'web' → NRJ-WEB-XXXXX (el checkout genera el suyo con la misma
// regla en el serverless).
//
// 5 caracteres SIN 0/O ni 1/I/L: se dictan por telefono sin confusion. Con
// 28.6 millones de combinaciones, 20 colisiones seguidas es practicamente
// imposible; aun asi queda el respaldo por tiempo.
//
// La verificacion local no basta —otra sesion puede generar el mismo codigo
// en el mismo instante— y por eso quien inserta reintenta ante un 23505.
const abc_folio = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generar_folio_reserva(origen, reservas, aleatorio) {
  const rnd = aleatorio || Math.random
  const pref = 'NRJ-' + (origen === 'web' ? 'WEB' : 'ADM') + '-'
  for (let intento = 0; intento < 20; intento++) {
    let cod = ''
    for (let i = 0; i < 5; i++) cod += abc_folio[Math.floor(rnd() * abc_folio.length)]
    const folio = pref + cod
    if (!(reservas || []).some((r) => String(r.id) === folio)) return folio
  }
  return pref + Date.now().toString(36).toUpperCase().slice(-5)
}

// Economia persistida: monto = BRUTO y descuento_monto aparte. Todo lo que se
// cobra o se compara va contra el NETO. Cobrar el precio de lista de una
// reserva con descuento era el bug del portal.
export function economia_reserva(bruto, descuentopct) {
  const b = Number(bruto) || 0
  const descuento = Math.min(redondear_dinero(b * (Number(descuentopct) || 0)), b)
  return { bruto: b, descuento, neto: Math.max(0, b - descuento) }
}

// Cuanto se cobra HOY segun la opcion de pago elegida.
export function cobro_inicial(pago, neto, montomanual, engancheminpct) {
  if (pago === 'Sin pago') return 0
  if (pago === 'Monto') return parseFloat(montomanual) || 0
  // "Enganche 30%" es la etiqueta historica del <select> de la v1, que aplica
  // un 0.3 fijo. Se conserva el literal para no cambiar lo que ya se guardo,
  // pero el porcentaje sale de la politica vigente cuando se conoce — es el
  // mismo criterio del resto del sistema: nunca un numero escrito a mano.
  if (String(pago).indexOf('Enganche') === 0) {
    const pct = Number(engancheminpct) > 0 ? Number(engancheminpct) : 30
    return redondear_dinero(neto * (pct / 100))
  }
  return neto
}

// estado_pago es INDEPENDIENTE de `estado` (que es el status general de la
// reserva): pendiente/parcial/pagado segun cuanto se cobro contra el neto.
export function estado_pago_reserva(cobrado, neto) {
  if (cobrado <= 0) return 'pendiente'
  return cobrado >= neto ? 'pagado' : 'parcial'
}

export function email_valido(v) {
  return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(String(v || '').trim())
}

// 10 digitos, la regla de la casa para telefonos mexicanos.
export function tel_valido(v) {
  return String(v || '').trim().length === 10
}

// Etiqueta del juego tal como se guarda en `reservas.juego`: "14 oct · Juego 3".
export function etiqueta_juego(j) {
  if (!j) return ''
  return new Date(j.fecha + 'T12:00').toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short',
  }) + ' · Juego ' + j.num
}

// ── BORRAR UNA RESERVA: QUE COBROS SE CAEN CON ELLA ─────────────
// Al desaparecer la reservacion sus cobros quedan huerfanos: seguirian sumando
// en el Registro de Cobros y en los Ingresos de Reportes sin nada que los
// respalde. Se cancelan por el folio de la reserva Y por los de la tarjeta del
// Pipeline vinculada, en sus dos formas ('PROS-002' y '002') — las tres
// maneras con las que un cobro puede estar etiquetado.
export function folios_de_reserva_borrada(reserva, pipeline) {
  const folios = [String(reserva.id)]
  ;(pipeline || []).forEach((p) => {
    if (!(p.reservaids || []).map(String).includes(String(reserva.id))) return
    const f = String(p.folio || '').trim()
    if (!f) return
    folios.push(f)
    folios.push(f.toUpperCase().startsWith('PROS-') ? f.slice(5) : 'PROS-' + f)
  })
  return folios
}

// ── PRECIO Y AFORO DE UNA SECCION (catalogo del panel) ──────────
// espejo 1:1 de v1: getPrecioSec(), getMinSec() y getCategoriaSec()
// (js/20-editor-mapa.js). El catalogo son las filas de mapa_secciones ya
// mapeadas por map_precio().
//
// El match va SIEMPRE por el id unico del pin primero: dos zonas con el mismo
// nombre (dos "Platea Izquierda") tienen precios independientes, y buscarlas
// por nombre las confundia. El nombre queda de respaldo, exigiendo que TODAS
// las palabras del catalogo aparezcan en el nombre de la seccion.
function fila_catalogo(area, catalogo) {
  if (!area) return null
  const lista = catalogo || []
  if (area.id) {
    const porid = lista.find((p) => p.pinid && p.pinid === area.id)
    if (porid) return porid
  }
  const n = String(area.nombre || '').toLowerCase()
  return lista.find((p) => String(p.zona || '').toLowerCase().split(' ').every((w) => n.includes(w))) || null
}

// Respaldos por categoria: solo aplican cuando la seccion no esta en el
// catalogo. Son los mismos numeros de la v1.
const precio_respaldo = { Terraza: 8000, Palco: 12000, Platea: 7000, 'Jardín': 6000, General: 5500 }
const min_respaldo = { Terraza: 20, Palco: 20, Platea: 15, 'Jardín': 10, General: 10 }

export function precio_seccion(area, catalogo) {
  const fila = fila_catalogo(area, catalogo)
  if (fila) return fila.precio
  return precio_respaldo[categoria_sec(area && area.nombre)] || null
}

// Personas INCLUIDAS en la seccion. Jueves, viernes y sabado usan la columna
// alterna (min2) cuando esta configurada — la misma regla de dia que los
// precios.
export function min_seccion(area, catalogo, juego) {
  const finde = !!(juego && juego.fecha && new Date(juego.fecha + 'T12:00').getDay() >= 4)
  const fila = fila_catalogo(area, catalogo)
  if (fila) return finde && fila.min2 != null ? fila.min2 || 1 : fila.min || 1
  return min_respaldo[categoria_sec(area && area.nombre)] || 1
}
