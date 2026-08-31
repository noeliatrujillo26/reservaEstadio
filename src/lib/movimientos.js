// ═══════════════════════════════════════════════════════════════════
// movimientos.js — auditoria de acciones del sistema.
// espejo 1:1 de v1: _movDesdeFila(), _formatMovTs(), _MOV_BADGE,
// _movFiltros() y cargarMovimientosPagina() (js/30-init.js y
// js/22-usuarios-clientes.js).
// ═══════════════════════════════════════════════════════════════════

export const mov_por_pagina = 20

export const mov_badge = {
  Pago: 'badge-green',
  Reserva: 'badge-blue',
  Enganche: 'badge-orange',
  Admin: 'badge-purple',
  Bloqueo: 'badge-red',
  Liberar: 'badge-green',
}

export const tipos_mov = ['Reserva', 'Pago', 'Enganche', 'Bloqueo', 'Liberar', 'Admin']

// Hora del NEGOCIO (America/Hermosillo). Sin la zona explicita, cada navegador
// mostraba los movimientos con SU reloj local.
export function formato_mov_ts(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const fecha = d.toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', timeZone: 'America/Hermosillo',
  })
  const hora = d.toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Hermosillo',
  })
  return fecha + ' · ' + hora
}

// espejo de _movDesdeFila().
export function map_movimiento(m) {
  return {
    id: m.id,
    fecha: (m.created_at || '').slice(0, 10),
    ts: formato_mov_ts(m.created_at),
    tipo: m.tipo,
    desc: m.descripcion,
    ref: m.ref,
    usuario: m.usuario,
    monto: m.monto,
  }
}

// Arma la consulta paginada contra supabase, igual que cargarMovimientosPagina().
// El techo viejo de 200 filas era la razon de que los movimientos antiguos
// "desaparecieran": nunca se borraron, simplemente no se traian.
export function consulta_movimientos(sb, filtros, pagina) {
  const desde = (pagina - 1) * mov_por_pagina
  let q = sb.from('movimientos').select('*', { count: 'exact' })

  if (filtros.tipo) q = q.eq('tipo', filtros.tipo)
  // El rango de fechas se compara contra created_at con el MISMO criterio que
  // muestra la tabla, y el dia "hasta" se incluye ENTERO: con un lte a
  // medianoche se perdian los movimientos de ese mismo dia.
  if (filtros.desde) q = q.gte('created_at', filtros.desde)
  if (filtros.hasta) q = q.lte('created_at', filtros.hasta + 'T23:59:59.999')
  if (filtros.q) {
    // Comas y parentesis parten la sintaxis de or() de PostgREST.
    const t = filtros.q.replace(/[(),*]/g, ' ').trim()
    if (t) {
      q = q.or('descripcion.ilike.%' + t + '%,usuario.ilike.%' + t + '%,ref.ilike.%' + t + '%')
    }
  }

  return q.order('created_at', { ascending: false }).range(desde, desde + mov_por_pagina - 1)
}
