// ═══════════════════════════════════════════════════════════════════
// dashboard.js — calculo de los KPIs y listas del Dashboard.
// espejo 1:1 de v1: loadDashboardStats() de js/modules/dashboard.js, mas los
// helpers que usa: _cobroCancelado(), _esPagoCredito(), getEstadoZona() y
// getCategoriaSec().
//
// logica pura, sin react: recibe los datos ya cargados y devuelve las cifras.
// asi se puede comparar contra la v1 sin montar nada.
// ═══════════════════════════════════════════════════════════════════

import { redondear_dinero } from './dinero'
import { hoy_hermosillo } from './fechas'

// ── helpers de cobro ────────────────────────────────────────────
// 'cancelado' es el borrado suave del panel: no suma en nada.
export function cobro_cancelado(c) {
  return String((c && c.estado) || '').toLowerCase() === 'cancelado'
}

// Igualdad EXACTA normalizada — jamas substring: "TARJETA DE CREDITO" y
// "Tarjeta de crédito" son dinero real y no deben caer aqui.
export function es_pago_credito(concepto, forma) {
  const norm = (v) => String(v || '').toUpperCase().replace(/É/g, 'E')
  return norm(concepto) === 'CREDITO' || norm(forma) === 'CREDITO'
}

// Se aceptan las CUATRO grafias del campo a proposito: la fila cruda de
// supabase trae `forma_pago`, el mapeador de la v1 producia `formaPago` y el
// nuestro produce `formapago`. Mirar solo una dejaba pasar los creditos como
// dinero real e inflaba los ingresos del mes — detectado con la prueba
// diferencial contra la v1.
export function es_cobro_credito(c) {
  if (!c) return false
  return es_pago_credito(c.concepto, c.formapago || c.formaPago || c.forma || c.forma_pago)
}

// ── helpers de zona ─────────────────────────────────────────────
export function categoria_sec(nombre) {
  const n = (nombre || '').toUpperCase()
  if (n.includes('TERRAZA')) return 'Terraza'
  if (n.includes('PALCO')) return 'Palco'
  if (n.includes('PLATEA')) return 'Platea'
  if (n.includes('JARD')) return 'Jardín'
  return 'General'
}

// String() en las dos llaves: la base puede devolver el id del juego como
// numero o como texto, y una comparacion por tipo hacia que NINGUNA fila de
// zona_juego_estado cruzara. El sintoma no era un error sino algo peor: todos
// los juegos caian al estado base y mostraban KPIs identicos, como si el
// selector no reaccionara.
export function estado_zona(areasestados, areas, juegoid, zonaid) {
  const porjuego = areasestados[String(juegoid)]
  const local = areas.find((a) => String(a.id) === String(zonaid))
  if (!porjuego) return (local && local.estado) || 'libre'
  return porjuego[String(zonaid)] || (local && local.estado) || 'libre'
}

export const colores_categoria = {
  Terraza: 'var(--naranja)',
  Platea: '#2563EB',
  Palco: '#7C3AED',
  'Jardín': '#16A34A',
  General: '#5A6478',
}

// ── KPIs y listas ───────────────────────────────────────────────
// espejo de loadDashboardStats(). Devuelve todo lo que pinta la vista.
export function calcular_dashboard({ cobros, reservas, juegos, areas, areasestados, movimientos }) {
  const hoy = new Date()
  const hoyiso = hoy_hermosillo() // dia del NEGOCIO, no UTC
  const mes_actual = hoyiso.slice(0, 7)
  const mes_anterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 15).toISOString().slice(0, 7)

  // 1) Ingresos del mes. DINERO REAL: cancelados y creditos (cuenta por
  // cobrar) jamas suman.
  const sum_mes = (m) =>
    cobros
      .filter((c) => (c.fecha || '').startsWith(m) && !cobro_cancelado(c) && !es_cobro_credito(c))
      .reduce((s, c) => s + (c.monto || 0), 0)
  const ing_mes = sum_mes(mes_actual)
  const ing_prev = sum_mes(mes_anterior)

  let ingresos_delta = null // { pct } o null
  let ingresos_texto = ''
  if (!ing_mes && !ing_prev) ingresos_texto = 'Sin cobros registrados este mes'
  else if (ing_prev > 0) ingresos_delta = { pct: Math.round(((ing_mes - ing_prev) / ing_prev) * 100) }
  else ingresos_texto = 'Primer mes con cobros registrados'

  // 2) Reservas activas (todas las no canceladas)
  const activas = reservas.filter((r) => String(r.estado || '').toLowerCase() !== 'cancelada')
  const pagadas = activas.filter((r) => r.estadopago === 'pagado' || r.pago === 'Completo').length

  // 3) Ocupacion promedio: % de secciones reservadas en los juegos por venir
  const futuros = juegos.filter((j) => (j.fecha || '') >= hoyiso)
  let ocupacion = 0
  if (futuros.length && areas.length) {
    const total_reservadas = futuros.reduce(
      (s, j) => s + areas.filter((a) => estado_zona(areasestados, areas, j.id, a.id) === 'reservada').length,
      0
    )
    ocupacion = Math.round((total_reservadas / (futuros.length * areas.length)) * 100)
  }

  // 4) Enganches pendientes: saldo por cobrar de reservas sin liquidar
  const con_saldo = activas
    .map((r) => ({ r, saldo: Math.max(0, (Number(r.monto) || 0) - (Number(r.montopagado) || 0)) }))
    .filter((x) => x.saldo > 0 && x.r.estadopago !== 'pagado' && x.r.pago !== 'Completo')
  const enganches = con_saldo.reduce((s, x) => s + x.saldo, 0)

  // 5) Ingresos por juego: pagos acumulados de las reservas, por partido
  const por_juego = {}
  reservas.forEach((r) => {
    const mp = Number(r.montopagado) || 0
    if (mp > 0 && r.juegoid) por_juego[r.juegoid] = (por_juego[r.juegoid] || 0) + mp
  })
  // los 6 mas recientes por fecha
  const con_ingreso = juegos.filter((j) => por_juego[j.id] > 0).slice(-6)
  const max_ingreso = con_ingreso.length ? Math.max(...con_ingreso.map((j) => por_juego[j.id])) : 0

  // 6) Ocupacion por seccion (categorias) para el proximo juego
  const proximo = futuros[0] || null
  let grupos = null
  if (proximo && areas.length) {
    grupos = {}
    areas.forEach((a) => {
      const cat = categoria_sec(a.nombre)
      if (!grupos[cat]) grupos[cat] = { total: 0, res: 0 }
      grupos[cat].total++
      if (estado_zona(areasestados, areas, proximo.id, a.id) === 'reservada') grupos[cat].res++
    })
  }

  // 7) Actividad reciente: ultimos 5 movimientos
  const actividad = (movimientos || []).slice(0, 5)

  // 8) Proximas series en casa: juegos futuros agrupados por rival
  const series = []
  futuros.forEach((j) => {
    const ult = series[series.length - 1]
    if (ult && ult.rival === j.rival) ult.juegos.push(j)
    else series.push({ rival: j.rival, juegos: [j] })
  })

  return {
    ingresos: redondear_dinero(ing_mes),
    ingresos_delta,
    ingresos_texto,
    reservas_activas: activas.length,
    reservas_texto: activas.length ? pagadas + ' con pago completo' : 'Sin reservas registradas',
    ocupacion,
    ocupacion_texto: futuros.length
      ? 'promedio de ' + futuros.length + ' juego(s) por venir'
      : 'Sin juegos programados',
    enganches: redondear_dinero(enganches),
    enganches_texto: con_saldo.length
      ? con_saldo.length + ' liquidación(es) por cobrar'
      : 'Sin liquidaciones por cobrar',
    por_juego, con_ingreso, max_ingreso,
    proximo, grupos,
    actividad,
    series: series.slice(0, 3),
  }
}
