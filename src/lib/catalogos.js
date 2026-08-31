// ═══════════════════════════════════════════════════════════════════
// catalogos.js — Temporadas, Descuentos y Metodos de pago.
// espejo 1:1 de v1:
//   temporadas → renderTempStats()/renderTempTabla() (js/modules/areas-juegos.js)
//   descuentos → cargarDescuentosDesdeSupabase(), renderDescuentos(),
//                renderDescKPIs(), descVigente(), fmtDescValor()
//   metodos    → cargarMetodosDesdeSupabase(), renderMetodos()
// ═══════════════════════════════════════════════════════════════════

import { redondear_dinero, mxn2 } from './dinero'

// ── temporadas ──────────────────────────────────────────────────
export const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export const meses_orden = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export const meses_label = {
  ene: 'Enero', feb: 'Febrero', mar: 'Marzo', abr: 'Abril', may: 'Mayo', jun: 'Junio',
  jul: 'Julio', ago: 'Agosto', sep: 'Septiembre', oct: 'Octubre', nov: 'Noviembre', dic: 'Diciembre',
}

export const estado_badge_juego = {
  Confirmado: 'badge-green',
  Programado: 'badge-blue',
  Pospuesto: 'badge-yellow',
  Cancelado: 'badge-red',
}

// espejo del filtro de renderTempTabla(): mes y año se combinan.
export function filtrar_juegos(juegos, mes, anio) {
  return juegos.filter(
    (j) =>
      (mes === 'todos' || j.mes === mes) &&
      (!anio || String(j.fecha || '').slice(0, 4) === anio)
  )
}

// espejo de renderTempStats(): las 4 cifras salen del calendario COMPLETO, no
// del filtrado — igual que en la v1.
export function stats_temporada(juegos) {
  return {
    total: juegos.length,
    confirmados: juegos.filter((j) => j.estado === 'Confirmado').length,
    series: [...new Set(juegos.map((j) => j.serie))].length,
    rivales: [...new Set(juegos.map((j) => j.rival))].length,
  }
}

export function etiqueta_dia(fecha) {
  if (!fecha) return '—'
  const d = new Date(fecha + 'T12:00')
  return dias[d.getDay()] + ' ' + d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

// años presentes en el calendario, para los botones de la v1 (2026/2027).
export function anios_de(juegos) {
  return [...new Set(juegos.map((j) => String(j.fecha || '').slice(0, 4)).filter(Boolean))].sort()
}

// ── descuentos ──────────────────────────────────────────────────
// espejo del map de cargarDescuentosDesdeSupabase(): supabase entrega
// snake_case y el resto del codigo espera camelCase.
export function map_descuento(d) {
  return {
    id: d.id,
    codigo: d.codigo,
    tipo: d.tipo,
    valor: d.valor,
    descripcion: d.descripcion,
    usos: d.usos,
    usosmax: d.usos_max,
    vigencia: d.vigencia,
    estado: d.estado,
    juegosaplicables: d.juegos_aplicables || [],
  }
}

// espejo del map de cargarDescuentosVolumenDesdeSupabase().
export function map_descuento_volumen(d) {
  return {
    id: d.id,
    nombre: d.nombre || '',
    minpersonas: d.min_personas || 0,
    porcentaje: Number(d.porcentaje) || 0,
    juegos: Array.isArray(d.juegos) ? d.juegos : null,
    zonas: Array.isArray(d.zonas) ? d.zonas : null,
    activo: d.activo !== false,
  }
}

export function fmt_desc_valor(d) {
  return d.tipo === 'porcentaje'
    ? d.valor + '%'
    : '$' + redondear_dinero(d.valor).toLocaleString('es-MX', mxn2)
}

// sin fecha de vigencia el codigo no caduca.
export function desc_vigente(d) {
  if (!d.vigencia) return true
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return new Date(d.vigencia + 'T23:59') >= hoy
}

export function filtrar_descuentos(lista, busqueda) {
  const q = String(busqueda || '').toUpperCase()
  if (!q) return lista
  return lista.filter(
    (d) =>
      String(d.codigo || '').toUpperCase().includes(q) ||
      String(d.descripcion || '').toUpperCase().includes(q)
  )
}

export function kpis_descuentos(lista) {
  return {
    total: lista.length,
    activos: lista.filter((d) => d.estado === 'Activo').length,
    usos: lista.reduce((s, d) => s + (d.usos || 0), 0),
    // "vencido" mira SOLO la vigencia; un codigo inactivo pero en fecha no
    // cuenta aqui, igual que en la v1.
    vencidos: lista.filter((d) => !desc_vigente(d)).length,
  }
}

// un codigo Activo pero fuera de fecha se muestra como "Vencido", no como
// activo: es la distincion que hace renderDescuentos().
export function estado_descuento(d) {
  if (d.estado !== 'Activo') return { badge: 'badge-gray', texto: 'Inactivo' }
  return desc_vigente(d)
    ? { badge: 'badge-green', texto: 'Activo' }
    : { badge: 'badge-yellow', texto: 'Vencido' }
}

export function usos_label(d) {
  return d.usosmax && d.usosmax > 0 ? d.usos + ' / ' + d.usosmax : d.usos + ' / ∞'
}

export function vence_label(d) {
  return d.vigencia
    ? new Date(d.vigencia + 'T12:00').toLocaleDateString('es-MX', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : 'Sin límite'
}

// ── metodos de pago ─────────────────────────────────────────────
export const metodo_icon = {
  Efectivo: '💵',
  Transferencia: '🏦',
  'Tarjeta de crédito': '💳',
  'Tarjeta de débito': '💳',
  Cheque: '🧾',
  'Depósito en ventanilla': '🏧',
  Otro: '💠',
}

// espejo del map de cargarMetodosDesdeSupabase(). El rediseño muestra un solo
// texto "detalle"; cuando la columna viene vacia se arma con las columnas
// originales (banco, cuenta, clabe, titular, notas).
export function map_metodo(m) {
  return {
    id: m.id,
    tipo: m.tipo,
    nombre: m.nombre,
    detalle:
      m.detalle ||
      [
        m.banco,
        m.cuenta ? 'Cuenta ' + m.cuenta : '',
        m.clabe ? 'CLABE ' + m.clabe : '',
        m.titular,
        m.notas,
      ]
        .filter(Boolean)
        .join(' · '),
    activo: m.activo,
  }
}
