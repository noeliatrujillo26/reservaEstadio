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
import { mxn2 } from './dinero'

function esc(s) {
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
