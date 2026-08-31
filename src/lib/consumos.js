// ═══════════════════════════════════════════════════════════════════
// consumos.js — saldo de consumo incluido por reserva.
// espejo 1:1 de v1: _consumoActivo() y renderConsumoPorReserva()
// (js/01-nucleo.js).
// ═══════════════════════════════════════════════════════════════════

// solo cuenta el consumo VIVO: con saldo y sobre una reserva no cancelada.
export function consumo_activo(r) {
  return (r.saldoconsumo || 0) > 0 && String(r.estado || '').toLowerCase() !== 'cancelada'
}

export function filtrar_consumos(reservas, { busqueda, juegoid }) {
  const q = String(busqueda || '').toLowerCase()
  return reservas
    .filter(consumo_activo)
    .filter(
      (r) =>
        !q ||
        String(r.cliente || '').toLowerCase().includes(q) ||
        String(r.zona || '').toLowerCase().includes(q)
    )
    .filter((r) => !juegoid || String(r.juegoid) === String(juegoid))
}

// juegos que de verdad tienen reservas con consumo, ordenados por fecha.
export function juegos_con_consumo(reservas, juegos) {
  const con_saldo = reservas.filter(consumo_activo)
  const ids = [...new Set(con_saldo.map((r) => r.juegoid).filter(Boolean))]
  return ids
    .map((id) => juegos.find((j) => String(j.id) === String(id)))
    .filter(Boolean)
    .sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')))
}

export function total_consumo(reservas) {
  return reservas.reduce((s, r) => s + (Number(r.saldoconsumo) || 0), 0)
}
