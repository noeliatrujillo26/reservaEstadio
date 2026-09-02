// ═══════════════════════════════════════════════════════════════════
// reportedia.js — el reporte de cobros del dia que se manda por WhatsApp.
// espejo 1:1 de v1: enviarReporteDia() (js/modules/cobros.js 569-593).
//
// El armado del mensaje va aparte y PURO a proposito: es una cuenta de dinero
// —el total del dia— y como tal se prueba con el banco diferencial. Abrir
// WhatsApp es lo unico que queda en el componente.
//
// La regla del dinero, igual que en el resto del modulo:
//   · el TOTAL del dia es dinero cobrado de verdad
//   · el credito NO suma ahi: se desglosa aparte como "por cobrar"
//   · el saldo a favor aplicado tampoco: ese dinero ya entro antes
//   · los cobros cancelados no aparecen
// Pero el desglose POR CONCEPTO suma el monto tal cual, sin excluir nada — asi
// lo hace la v1, y es correcto: ese bloque dice que se registro, no cuanto
// entro a la caja.
// ═══════════════════════════════════════════════════════════════════

import { cobro_cancelado, cobro_sin_dinero_nuevo, formato_fecha } from './cobros'
import { es_cobro_credito } from './dashboard'
import { mxn2 } from './dinero'

const money = (n) => (Number(n) || 0).toLocaleString('es-MX', mxn2)

export function cobros_del_dia(cobros, hoy) {
  return (cobros || []).filter((c) => c.fecha === hoy && !cobro_cancelado(c))
}

export function mensaje_reporte_dia(cobros, hoy) {
  const hoydata = cobros_del_dia(cobros, hoy)
  const total = hoydata.reduce((s, c) => s + (cobro_sin_dinero_nuevo(c) ? 0 : c.monto), 0)
  const creditodia = hoydata.reduce((s, c) => s + (es_cobro_credito(c) ? c.monto : 0), 0)
  const porconcepto = {}
  hoydata.forEach((c) => {
    porconcepto[c.concepto] = (porconcepto[c.concepto] || 0) + c.monto
  })

  let msg = '📊 *Reporte de cobros — ' + formato_fecha(hoy) + '*\n\n'
  if (hoydata.length === 0) {
    msg += 'Sin cobros registrados hoy.'
    return msg
  }
  hoydata.forEach((c) => {
    msg +=
      '• ' + String(c.cliente || '').split('/')[0].trim() + ' — ' + c.zona + ' — ' + c.concepto +
      (es_cobro_credito(c) ? ' (CRÉDITO · por cobrar)' : '') +
      ' — $' + money(c.monto) + '\n'
  })
  msg += '\n'
  Object.entries(porconcepto).forEach(([k, v]) => {
    msg += k + ': $' + money(v) + '\n'
  })
  msg += '\n*Total del día: $' + money(total) + '* (' + hoydata.length + ' cobros)'
  if (creditodia > 0) msg += '\n💳 A crédito (NO cobrado): $' + money(creditodia)
  return msg
}

export function url_whatsapp_reporte(mensaje) {
  return 'https://wa.me/?text=' + encodeURIComponent(mensaje)
}
