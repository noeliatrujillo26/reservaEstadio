// ═══════════════════════════════════════════════════════════════════
// cobrarreserva.js — buscador y resumen financiero para la pestaña
// "Cobrar a Reserva" de /reserva-express.
//
// Sin equivalente en la v1: pantalla nueva. El buscador es de UN SOLO PASO
// (folio, cliente o teléfono → la reserva directa), a diferencia de
// nuevocobro.jsx (que primero elige cliente y luego su reserva) — aquí el
// caso de uso típico es "tengo el folio o el teléfono en la mano, cóbrale".
//
// DOCTRINA (25 sep 2026, decidida a propósito): "bruto" aquí es SOLO
// reserva.monto (el precio de lista, antes de descuento_monto) — la MISMA
// noción que ya usa reservas.js (total_bruto) y nuevocobro.jsx (neto = monto
// − descuento). NO es la comisión de Stripe proyectada de la v1
// (asadores-panel-master/getMontoTotalResBruto): ese patrón quedó
// documentado en reservas.js como el problema que esta migración corrigió
// ("el total dependía de cuánto se hubiera pagado y jamás bajaba"). El
// Abonado y el Restante se calculan sobre el NETO, igual que en todo el
// resto del panel — nunca sobre el bruto, que solo es informativo.
// ═══════════════════════════════════════════════════════════════════

import { abonado_de_reserva, credito_de_reserva, folio_visible } from './reservasadmin'
import { redondear_dinero } from './dinero'

function tel_digitos(t) {
  return String(t || '').replace(/\D/g, '')
}

// ¿La reserva coincide con lo tecleado? Folio (su id, con o sin el prefijo
// visible "RES-"), nombre del cliente, o teléfono por DÍGITOS — mismo
// criterio de teléfono que cliente_coincide() en lib/clientes.js.
export function reserva_coincide(r, q) {
  const lq = String(q || '').trim().toLowerCase()
  if (!lq) return false // sin texto no hay para quién buscar: lista vacía, no "todas".
  const folio = String(r.id || '').toLowerCase()
  if (folio.includes(lq) || folio_visible(r).toLowerCase().includes(lq)) return true
  if (String(r.cliente || '').toLowerCase().includes(lq)) return true
  const digitos = lq.replace(/\D/g, '')
  if (digitos && tel_digitos(r.tel).includes(digitos)) return true
  return false
}

// Reservas VIVAS que coinciden — las canceladas no se cobran, cobrarles
// dinero real dejaría el pago colgado de una reserva que ya no existe.
export function buscar_reservas(reservas, q) {
  if (!String(q || '').trim()) return []
  return (reservas || [])
    .filter((r) => String(r.estado || '').toLowerCase() !== 'cancelada')
    .filter((r) => reserva_coincide(r, q))
    .slice(0, 25) // tope razonable para un buscador en vivo, mismo criterio que los demás del panel.
}

// Resumen financiero de UNA reserva, en la doctrina de arriba.
export function resumen_reserva(reserva, cobros) {
  if (!reserva) {
    return { totalbruto: 0, descuento: 0, neto: 0, abonado: 0, credito: 0, restante: 0, liquidada: false }
  }
  const totalbruto = Number(reserva.monto) || 0
  const descuento = Number(reserva.descuentomonto) || 0
  const neto = Math.max(0, redondear_dinero(totalbruto - descuento))
  const abonado = redondear_dinero(abonado_de_reserva(reserva, cobros))
  const credito = redondear_dinero(credito_de_reserva(reserva, cobros))
  const restante = Math.max(0, redondear_dinero(neto - abonado - credito))
  return { totalbruto, descuento, neto, abonado, credito, restante, liquidada: neto > 0 && restante <= 0 }
}
