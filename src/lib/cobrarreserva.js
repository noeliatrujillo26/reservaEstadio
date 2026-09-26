// ═══════════════════════════════════════════════════════════════════
// cobrarreserva.js — buscador y resumen financiero para la pestaña
// "Cobrar a Reserva" de /reserva-express.
//
// Sin equivalente en la v1: pantalla nueva. El buscador es de UN SOLO PASO
// (folio, cliente o teléfono → la reserva directa), a diferencia de
// nuevocobro.jsx (que primero elige cliente y luego su reserva) — aquí el
// caso de uso típico es "tengo el folio o el teléfono en la mano, cóbrale".
//
// DOCTRINA (26 sep 2026, corregida — reemplaza la del 25 sep): "Total
// reserva"/"Pagado"/"Restante" (los que se PINTAN) deben coincidir centavo a
// centavo con el Pipeline de asadores-panel-master, que es lo que Dirección
// compara. Eso significa usar la MISMA formula que getMontoTotalResBruto() /
// getAbonadoResBruto() de esa v1 (ahora portada a reservasadmin.js): el Total
// SI incluye una proyeccion de comision de Stripe sobre el saldo pendiente en
// reservas de origen web — no solo la comision ya incurrida. Es exactamente
// el patron "comisión proyectada" que reservas.js documenta como el bug del
// PORTAL del cliente (el total nunca bajaba); aqui NO es ese bug: es la regla
// de negocio vigente del Pipeline de v1, y Dirección pidió replicarla tal
// cual para que ámbas pantallas cuadren.
// ═══════════════════════════════════════════════════════════════════

import {
  abonado_reserva_bruto, credito_de_reserva, monto_total_reserva_bruto, folio_visible,
} from './reservasadmin'
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

// Resumen financiero de UNA reserva, en la doctrina de arriba: mismos
// helpers y misma cuenta que el recibo de v1 (js/modules/cobros.js) —
// restante = total − abonado, SIN restar el credito (el credito se muestra
// aparte, informativo, igual que alla).
export function resumen_reserva(reserva, cobros) {
  if (!reserva) {
    return { totalbruto: 0, descuento: 0, neto: 0, total: 0, abonado: 0, credito: 0, restante: 0, liquidada: false }
  }
  const totalbruto = Number(reserva.monto) || 0
  const descuento = Number(reserva.descuentomonto) || 0
  const neto = Math.max(0, redondear_dinero(totalbruto - descuento))
  const credito = redondear_dinero(credito_de_reserva(reserva, cobros))
  const total = redondear_dinero(monto_total_reserva_bruto(reserva, cobros))
  const abonado = redondear_dinero(abonado_reserva_bruto(reserva, cobros))
  const restante = Math.max(0, redondear_dinero(total - abonado))
  return { totalbruto, descuento, neto, total, abonado, credito, restante, liquidada: total > 0 && restante <= 0 }
}
