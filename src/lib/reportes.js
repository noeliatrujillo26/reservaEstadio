// ═══════════════════════════════════════════════════════════════════
// reportes.js — analisis de ventas, cobros y ocupacion por temporada.
// espejo 1:1 de v1: _temporadaRango(), _repIsoLocal(), _repRango(),
// _repDatos(), _repMesLabel(), _formaPagoLegibleRep() y _repMasFrecuente()
// (js/modules/cobros.js).
//
// CONSOLIDADO DIARIO / ARQUEO (Fase 2): la v1 NO tiene esta pantalla — su
// unico "reporte del dia" es enviarReporteDia() (js/modules/cobros.js), un
// mensaje de WhatsApp agrupado solo por concepto, sin desglose por forma de
// pago ni vendedor y sin exportar nada (ver reportedia.js, ya migrado tal
// cual). Lo que pide un corte de caja real —cuadrar lo que dice el sistema
// contra lo que hay en caja, terminal o banco— ya vive a medias en esta
// misma pantalla: `datos_reporte()` agrupa por forma de pago (porforma) y por
// quien recibio el cobro (porvend), y el selector de periodo ya trae "Hoy".
// arqueo_por_forma() y filas_csv_arqueo() son la pieza que faltaba: el
// desglose CONTABLE (cuantos cobros y cuanto dinero por forma de pago, no solo
// el monto) y el detalle exportable, ambos sobre el MISMO rango ya filtrado.
// ═══════════════════════════════════════════════════════════════════

import {
  cobro_cancelado, es_cobro_credito, es_credito_vigente, formato_fecha, hora_cobro,
  instante_cobro, requiere_factura,
} from './cobros'
import { hoy_hermosillo } from './fechas'
import { redondear_dinero } from './dinero'

const dia_ms = 86400000

// La temporada corre de julio a julio. Año del NEGOCIO (America/Hermosillo),
// no del reloj UTC del navegador.
export function temporada_rango(etiqueta) {
  const m = String(etiqueta || '').match(/(\d{4})\s*-\s*(\d{4})/)
  const y1 = m ? parseInt(m[1], 10) : parseInt(hoy_hermosillo().slice(0, 4), 10)
  return {
    desde: y1 + '-07-01',
    hasta: y1 + 1 + '-07-01',
    etiqueta: etiqueta || 'Temporada ' + y1 + '-' + (y1 + 1),
  }
}

export function iso_local(d) {
  return (
    d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
  )
}

// Presets intersectados con la temporada. 'toda' = temporada completa.
// Formato ISO local, [desde, hasta) EXCLUSIVO por la derecha.
export function rango_reporte(etiquetatemporada, periodo, fechaini, fechafin) {
  const temporada = temporada_rango(etiquetatemporada)
  // "Hoy" es el hoy del NEGOCIO, anclado a mediodia para que la aritmetica de
  // dias no cruce de fecha.
  const hoy = new Date(hoy_hermosillo() + 'T12:00')
  let desde = null
  let hasta = null
  let etiquetaperiodo = 'Toda la temporada'

  if (periodo === 'hoy') {
    desde = iso_local(hoy)
    hasta = iso_local(new Date(hoy.getTime() + dia_ms))
    etiquetaperiodo = 'Hoy (' + desde + ')'
  } else if (periodo === 'ayer') {
    const ayer = new Date(hoy.getTime() - dia_ms)
    desde = iso_local(ayer)
    hasta = iso_local(hoy)
    etiquetaperiodo = 'Ayer (' + desde + ')'
  } else if (periodo === '7dias') {
    desde = iso_local(new Date(hoy.getTime() - 6 * dia_ms))
    hasta = iso_local(new Date(hoy.getTime() + dia_ms))
    etiquetaperiodo = 'Últimos 7 días'
  } else if (periodo === 'mes') {
    desde = iso_local(new Date(hoy.getFullYear(), hoy.getMonth(), 1, 12))
    hasta = iso_local(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1, 12))
    etiquetaperiodo =
      'Este mes (' + hoy.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }) + ')'
  } else if (periodo === 'personalizado') {
    if (fechaini && fechafin && fechaini <= fechafin) {
      desde = fechaini
      // fin INCLUSIVE: se suma un dia porque el rango es exclusivo.
      hasta = iso_local(new Date(new Date(fechafin + 'T12:00').getTime() + dia_ms))
      etiquetaperiodo = 'Del ' + fechaini + ' al ' + fechafin
    }
    // sin ambas fechas validas todavia: se muestra la temporada completa.
  }

  if (!desde) return { ...temporada, periodo: 'toda', etiquetaperiodo: 'Toda la temporada' }

  // Interseccion con la temporada: elegir 2025-2026 + "Hoy" da vacio, que es
  // lo honesto.
  return {
    desde: desde > temporada.desde ? desde : temporada.desde,
    hasta: hasta < temporada.hasta ? hasta : temporada.hasta,
    etiqueta: temporada.etiqueta,
    periodo,
    etiquetaperiodo,
  }
}

export function mes_label(k) {
  const d = String(k).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  // clave de DIA exacto (rangos cortos): '12 ago 2026'.
  if (d) {
    return new Date(k + 'T12:00').toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  }
  const m = String(k).match(/^(\d{4})-(\d{2})$/)
  if (!m) return k
  const nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  return (nombres[parseInt(m[2], 10) - 1] || m[2]) + ' ' + m[1]
}

export function forma_pago_legible(v) {
  const s = String(v || '').toUpperCase()
  if (!s) return 'Sin especificar'
  if (s.indexOf('STRIPE') >= 0) return 'Stripe (en línea)'
  if (s.indexOf('TRANSFER') >= 0) return 'Transferencia'
  if (s.indexOf('EFECTIVO') >= 0) return 'Efectivo'
  if (s.indexOf('TARJETA') >= 0) return 'Tarjeta'
  if (s.indexOf('CRÉDITO') >= 0 || s.indexOf('CREDITO') >= 0) return 'Crédito'
  if (s.indexOf('CHEQUE') >= 0) return 'Cheque'
  if (s.indexOf('DEPÓSITO') >= 0 || s.indexOf('DEPOSITO') >= 0) return 'Depósito'
  return String(v)
}

export function mas_frecuente(obj) {
  let mejor = '—'
  let n = 0
  Object.keys(obj || {}).forEach((k) => {
    if (obj[k] > n) { n = obj[k]; mejor = k }
  })
  return mejor
}

// ── datos del reporte ───────────────────────────────────────────
// espejo de _repDatos(). INGRESOS = dinero real; el credito es cuenta por
// cobrar y se reporta APARTE, y los creditos huerfanos quedan fuera.
export function datos_reporte({ cobros, reservas, juegos, areas, rango }) {
  // rangos cortos (<= 45 dias): la serie se agrupa POR DIA exacto en lugar de
  // por mes — un solo dia o una semana no se aplasta en una barra.
  const span = Math.round(
    (new Date(rango.hasta + 'T12:00') - new Date(rango.desde + 'T12:00')) / 86400000
  )
  const pordia = span > 0 && span <= 45

  const cs = cobros.filter((c) => {
    if (cobro_cancelado(c)) return false
    const f = String(c.fecha || '')
    return f >= rango.desde && f < rango.hasta
  })
  const cs_dinero = cs.filter((c) => !es_cobro_credito(c))
  const credito_por_cobrar = cs.reduce(
    (s, c) => s + (es_credito_vigente(c, reservas) ? Number(c.monto) || 0 : 0), 0
  )
  const total = cs_dinero.reduce((s, c) => s + (Number(c.monto) || 0), 0)

  const juegos_t = juegos.filter((j) => {
    const f = String(j.fecha || '')
    return f >= rango.desde && f < rango.hasta
  })
  const ids_juegos = {}
  juegos_t.forEach((j) => { ids_juegos[String(j.id)] = true })
  const reservas_t = reservas.filter(
    (r) => String(r.estado || '').toLowerCase() !== 'cancelada' && ids_juegos[String(r.juegoid)]
  )
  // sin juegos en el rango se usa 1 para no dividir entre cero.
  const disponibles = areas.length * (juegos_t.length || 1)

  const pormes = {}
  const porzona = {}
  const porvend = {}
  const porforma = {}
  const porcliente = {}

  cs_dinero.forEach((c) => {
    const monto = Number(c.monto) || 0
    const meskey = /^\d{4}-\d{2}/.test(String(c.fecha || ''))
      ? String(c.fecha).slice(0, pordia ? 10 : 7)
      : c.mes || '—'
    pormes[meskey] = (pormes[meskey] || 0) + monto

    const z = c.zona || 'Sin zona'
    porzona[z] = (porzona[z] || 0) + monto

    const v = String(c.recibio || '').trim() || 'Sin registrar'
    if (!porvend[v]) porvend[v] = { n: 0, total: 0 }
    porvend[v].n++
    porvend[v].total += monto

    const fp = forma_pago_legible(c.formapago)
    porforma[fp] = (porforma[fp] || 0) + monto

    const cl = String(c.cliente || '').trim() || 'Sin nombre'
    if (!porcliente[cl]) porcliente[cl] = { total: 0, facturado: 0, zonas: {}, conceptos: {} }
    porcliente[cl].total += monto
    if (requiere_factura(c)) porcliente[cl].facturado += monto
    if (c.zona) porcliente[cl].zonas[c.zona] = (porcliente[cl].zonas[c.zona] || 0) + 1
    if (c.concepto) porcliente[cl].conceptos[c.concepto] = (porcliente[cl].conceptos[c.concepto] || 0) + 1
  })

  const ocupacion = disponibles ? Math.round((reservas_t.length / disponibles) * 100) : 0
  const ticket = reservas_t.length ? total / reservas_t.length : 0

  return {
    rango, cs, cs_dinero, total, credito_por_cobrar, juegos_t, reservas_t, disponibles,
    pormes, porzona, porvend, porforma, porcliente, pordia, ocupacion, ticket,
  }
}

// ordena un objeto {clave: monto} para pintarlo como barras. Cronologico para
// la serie de meses/dias, por monto descendente para el resto.
export function barras(obj, cronologico) {
  const entries = Object.keys(obj).map((k) => [k, obj[k]])
  entries.sort(
    cronologico
      ? (a, b) => String(a[0]).localeCompare(String(b[0]))
      : (a, b) => b[1] - a[1]
  )
  if (!entries.length) return []
  const max = entries.reduce((mx, e) => Math.max(mx, e[1]), 1)
  // minimo 2% para que una barra pequeña siga siendo visible.
  return entries.map(([k, v]) => ({ clave: k, valor: v, pct: Math.max(2, Math.round((v / max) * 100)) }))
}

// ── ARQUEO / CORTE DE CAJA ────────────────────────────────────────
// Cuantos cobros y cuanto dinero entro por cada forma de pago, en el rango ya
// filtrado — la pregunta que responde un arqueo real (cuadrar lo que dice el
// sistema contra lo que hay en caja, terminal o banco). SOLO dinero real
// (cs_dinero de datos_reporte): un credito no es caja, es una promesa de pago.
export function arqueo_por_forma(cs_dinero) {
  const m = {}
  ;(cs_dinero || []).forEach((c) => {
    const fp = forma_pago_legible(c.formapago)
    if (!m[fp]) m[fp] = { forma: fp, n: 0, total: 0 }
    m[fp].n++
    m[fp].total += Number(c.monto) || 0
  })
  return Object.values(m).sort((a, b) => b.total - a.total)
}

// ── DETALLE EXPORTABLE ───────────────────────────────────────────
// Filas del detalle de arqueo, en orden CRONOLOGICO, una por cobro. Es la
// misma informacion linea por linea que enviarReporteDia() manda por
// WhatsApp (ver reportedia.js, ya migrado), con fecha/hora/forma/vendedor
// agregados para que sirva de arqueo y no solo de aviso del dia. Objetos con
// llave, no arreglos posicionales: la tabla del panel y el CSV leen las mismas
// filas sin acoplarse al ORDEN de las columnas.
export function filas_arqueo(cs_dinero) {
  return (cs_dinero || [])
    .slice()
    .sort((a, b) => instante_cobro(a) - instante_cobro(b))
    .map((c) => ({
      fecha: formato_fecha(c.fecha),
      hora: hora_cobro(c),
      cliente: c.cliente || '—',
      zona: c.zona || '—',
      concepto: c.concepto || '—',
      forma: forma_pago_legible(c.formapago),
      recibio: c.recibio || '—',
      monto: redondear_dinero(c.monto),
    }))
}

const columnas_arqueo = ['fecha', 'hora', 'cliente', 'zona', 'concepto', 'forma', 'recibio', 'monto']
const encabezados_arqueo = [
  'Fecha', 'Hora', 'Cliente', 'Zona', 'Concepto', 'Forma de pago', 'Recibió', 'Monto',
]

function csv_celda(v) {
  const s = String(v == null ? '' : v)
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

// CSV separado por comas, con BOM UTF-8 (Excel en Windows lo necesita para no
// mostrar los acentos rotos). Puro: arma el texto: el componente dispara la
// descarga — misma division que el resto del panel (calculo aqui, DOM alla).
const bom_utf8 = '﻿'

export function csv_arqueo(cs_dinero) {
  const filas = filas_arqueo(cs_dinero).map((f) => columnas_arqueo.map((k) => f[k]))
  return bom_utf8 + [encabezados_arqueo, ...filas].map((f) => f.map(csv_celda).join(',')).join('\r\n')
}
