// ═══════════════════════════════════════════════════════════════════
// recibo.js — recibo imprimible de un cobro (boton 📄 PDF de la tabla).
// espejo 1:1 de v1: buildReciboCobroHtml() y descargarReciboCobro()
// (js/modules/cobros.js 214-262).
//
// Misma plantilla visual que el recibo del checkout y del correo: logo oficial
// centrado, desglose del cobro y boton Imprimir / Guardar como PDF. Se abre en
// pestana nueva, ya lista para imprimir.
//
// Todo lo que viene del cobro se ESCAPA antes de entrar al HTML: son datos que
// captura un usuario (cliente, notas) y acaban dentro de un documento.
// ═══════════════════════════════════════════════════════════════════

import { app_config } from './config'
import { folio_reserva, formato_fecha } from './cobros'
import { mxn2, redondear_dinero } from './dinero'

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function html_recibo_cobro(c, { reservas, areas }) {
  const fila = (k, v) =>
    v ? '<div class="row"><span>' + k + '</span><span>' + esc(v) + '</span></div>' : ''

  return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Recibo ' + esc(c.folio || c.id) + ' — Naranjeros de Hermosillo</title><style>' +
    'body{font-family:"Segoe UI",Arial,sans-serif;color:#111;margin:0;background:#F7F5F0}' +
    '.wrap{max-width:560px;margin:0 auto;padding:24px 16px}' +
    '.card{background:#fff;border-radius:12px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06)}' +
    '.head{border-bottom:3px solid #E05C1A;padding-bottom:14px;margin-bottom:18px;text-align:center}' +
    '.h1{font-size:17px;font-weight:800}.sub{font-size:12px;color:#666}' +
    '.row{display:flex;justify-content:space-between;margin-bottom:9px;font-size:13px}' +
    '.row span:first-child{color:#666}.row span:last-child{font-weight:600;text-align:right;max-width:60%}' +
    '.sep{border-top:1px solid #eee;margin:10px 0}' +
    '.tot span:last-child{color:#E05C1A;font-size:18px;font-weight:800}' +
    '.foot{font-size:11px;color:#999;text-align:center;margin-top:16px}' +
    '.print-btn{display:block;width:100%;margin:16px 0 0;padding:12px;background:#E05C1A;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}' +
    '@media print{.print-btn{display:none}body{background:#fff}}' +
    '</style></head><body><div class="wrap"><div class="card">' +
    '<div class="head">' +
    '<img src="' + esc(app_config.logourl) + '" alt="Naranjeros de Hermosillo" style="height:44px;width:auto;display:block;margin:0 auto 8px">' +
    '<div class="h1">Naranjeros de Hermosillo</div>' +
    '<div class="sub">Zonas de Asadores · Recibo de pago · ' + esc(formato_fecha(c.fecha)) + '</div></div>' +
    fila('N° de recibo', c.folio || 'COBRO-' + c.id) +
    fila('Cliente', c.cliente) +
    fila('Área / Zona', (c.area ? c.area + ' · ' : '') + (c.zona || '')) +
    fila('Concepto', c.concepto) +
    fila('Forma de pago', c.formapago) +
    fila('Recibió', c.recibio) +
    fila('Folio de reserva', folio_reserva(c, reservas, areas)) +
    '<div class="sep"></div>' +
    '<div class="row tot"><span style="font-weight:700">Monto recibido</span><span>$' +
    (Number(c.monto) || 0).toLocaleString('es-MX', mxn2) + ' MXN</span></div>' +
    (c.notas
      ? '<div class="sep"></div><div class="row"><span>Notas</span><span>' + esc(c.notas) + '</span></div>'
      : '') +
    '<div style="background:#FFF8F0;border-left:3px solid #E05C1A;border-radius:0 8px 8px 0;padding:10px 14px;font-size:11px;color:#555;margin:14px 0;line-height:1.6">' +
    esc(app_config.leyendas.comprobante) + '<br>' + esc(app_config.leyendas.factura) + '</div>' +
    '<button class="print-btn" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>' +
    '</div><div class="foot">Presenta este recibo (impreso o en pantalla) el día del juego.<br>' +
    'Estadio Fernando Valenzuela · Hermosillo, Sonora</div></div></body></html>'
}

// Abre el recibo en pestana nueva. Devuelve false si el navegador bloqueo la
// ventana emergente, para que quien llama lo diga en vez de no hacer nada.
export function abrir_recibo_cobro(c, ctx) {
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.open()
  w.document.write(html_recibo_cobro(c, ctx))
  w.document.close()
  return true
}

// Mismo desglose Área/IVA/Subtotal que el correo de confirmación
// (api/_lib/reciboEmail.js en el panel v1, _desgloseAreaIvaReserva): precios
// con IVA incluido, así que el Área "antes de IVA" se obtiene dividiendo
// entre 1.16 — nunca se inventa un monto nuevo, solo se desglosa el mismo
// total. `r.areabase` es el área + personas extra ANTES del descuento
// (calc_total_prospecto, usereservaexpress.js) — la misma semántica que
// montoBruto allá.
function _desglose_area_iva(r) {
  const areabase = Number(r.areabase) || 0
  if (!(areabase > 0)) return null
  const descuento = Math.max(0, Number(r.descuentototal) || 0)
  const area = redondear_dinero(areabase / 1.16)
  const iva = redondear_dinero(areabase - area)
  const pctdescuento = areabase > 0 ? Math.round((descuento / areabase) * 100) : 0
  return {
    area, iva, subtotal: areabase, descuento, pctdescuento,
    extra: Math.max(0, Number(r.extramonto) || 0),
    consumo: Math.max(0, Number(r.consumomonto) || 0),
  }
}

// ── TICKET DE RESERVA (sin pago) ────────────────────────────────
// Mismo documento imprimible que html_recibo_cobro, para una reserva que
// AUN NO tiene ningun cobro registrado — el caso de Reserva Exprés, que
// aparta la zona y genera el folio formal en el mismo clic, antes de que
// exista un abono que documentar. Por eso no hay "monto recibido" de
// verdad (nada se ha cobrado todavía): se muestra el desglose COMPLETO del
// precio —Área, IVA, Subtotal, Descuento, Extra, Consumo— homologado con
// el correo de confirmación (02 oct 2026), y el total queda como saldo por
// cobrar en vez de un pago.
export function html_ticket_reserva(r) {
  const fila = (k, v) =>
    v ? '<div class="row"><span>' + k + '</span><span>' + esc(v) + '</span></div>' : ''
  const mxn = (n) => '$' + redondear_dinero(Number(n) || 0).toLocaleString('es-MX', mxn2) + ' MXN'
  const desglose = _desglose_area_iva(r)
  const total = Number(r.monto) || 0

  return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Reserva ' + esc(r.folio || '') + ' — Naranjeros de Hermosillo</title><style>' +
    'body{font-family:"Segoe UI",Arial,sans-serif;color:#111;margin:0;background:#F7F5F0}' +
    '.wrap{max-width:560px;margin:0 auto;padding:24px 16px}' +
    '.card{background:#fff;border-radius:12px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06)}' +
    '.head{border-bottom:3px solid #E05C1A;padding-bottom:14px;margin-bottom:18px;text-align:center}' +
    '.h1{font-size:17px;font-weight:800}.sub{font-size:12px;color:#666}' +
    '.row{display:flex;justify-content:space-between;margin-bottom:9px;font-size:13px}' +
    '.row span:first-child{color:#666}.row span:last-child{font-weight:600;text-align:right;max-width:60%}' +
    '.sep{border-top:1px solid #eee;margin:10px 0}' +
    '.tot span:last-child{color:#E05C1A;font-size:18px;font-weight:800}' +
    '.foot{font-size:11px;color:#999;text-align:center;margin-top:16px}' +
    '.print-btn{display:block;width:100%;margin:16px 0 0;padding:12px;background:#E05C1A;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}' +
    '@media print{.print-btn{display:none}body{background:#fff}}' +
    '</style></head><body><div class="wrap"><div class="card">' +
    '<div class="head">' +
    '<img src="' + esc(app_config.logourl) + '" alt="Naranjeros de Hermosillo" style="height:44px;width:auto;display:block;margin:0 auto 8px">' +
    '<div class="h1">Naranjeros de Hermosillo</div>' +
    '<div class="sub">Zonas de Asadores · Ticket de reserva · ' + esc(r.fecha || '') + '</div></div>' +
    fila('Folio', r.folio) +
    fila('Cliente', r.cliente) +
    fila('Teléfono', r.tel) +
    fila('Área / Zona', r.zona) +
    fila('Juego', r.juego) +
    fila('Personas', r.personas ? r.personas + '' : '') +
    fila('Vendedora', r.vendedora) +
    '<div class="sep"></div>' +
    // Desglose Área/IVA/Subtotal/Descuento/Extra/Consumo (02 oct 2026):
    // mismo cálculo y mismo orden que el correo de confirmación — antes
    // este ticket solo mostraba el total final, sin decir de qué se
    // compone. Sin `areabase` (llamador viejo o dato incompleto) se omite
    // el bloque entero en vez de pintar ceros inventados.
    (desglose
      ? fila('Área', mxn(desglose.area)) +
        fila('IVA (16%)', mxn(desglose.iva)) +
        fila('Subtotal', mxn(desglose.subtotal)) +
        (desglose.descuento > 0 ? fila('Descuento (' + desglose.pctdescuento + '%)', '−' + mxn(desglose.descuento)) : '') +
        (desglose.extra > 0 ? fila('Extra', mxn(desglose.extra)) : '') +
        (desglose.consumo > 0 ? fila('Consumo', mxn(desglose.consumo)) : '') +
        '<div class="sep"></div>'
      : '') +
    '<div class="row tot"><span style="font-weight:700">Total de la reserva</span><span>' + mxn(total) + '</span></div>' +
    fila('Monto pagado', mxn(0)) +
    fila('Forma de pago', 'Sin pago') +
    fila('Saldo restante', mxn(total)) +
    fila('Estado de pago', 'Por cobrar') +
    fila('Estado', r.estado) +
    '<div style="background:#FFF8F0;border-left:3px solid #E05C1A;border-radius:0 8px 8px 0;padding:10px 14px;font-size:11px;color:#555;margin:14px 0;line-height:1.6">' +
    esc(app_config.leyendas.comprobante) + '<br>' + esc(app_config.leyendas.factura) + '</div>' +
    '<button class="print-btn" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>' +
    '</div><div class="foot">Presenta este ticket (impreso o en pantalla) el día del juego.<br>' +
    'Estadio Fernando Valenzuela · Hermosillo, Sonora</div></div></body></html>'
}

// Nombre del archivo que se sube a Storage: "ticket-NRJ-ADM-XXXXX-<hora>.html".
export function nombre_archivo_ticket(folio) {
  return 'ticket-' + (folio || 'reserva') + '-' + Date.now() + '.html'
}
