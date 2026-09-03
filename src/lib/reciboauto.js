// ═══════════════════════════════════════════════════════════════════
// reciboauto.js — recibo digital AUTOMATICO de un pago sin comprobante
// manual (tipicamente EFECTIVO, registrado desde la tarjeta del Pipeline).
// espejo 1:1 de v1: buildReciboPDFHtml() y _pdDatosRecibo()
// (js/modules/pipeline.js 3339-3467).
//
// Se publica en Storage (carpeta recibos/) y se sirve por /api/recibo, que lo
// entrega con Content-Type text/html real: Supabase Storage sirve los .html
// como text/plain (medida anti-phishing de su dominio), y sin este proxy el
// navegador mostraria el codigo fuente en vez del documento.
//
// DESVIACION DELIBERADA: la v1 permite personalizar logo/color/nombre desde
// una plantilla guardada en localStorage (nrj_cotiz_plantilla) — un ajuste
// que vive SOLO en el navegador de quien lo configuro, y por tanto nunca en
// otro equipo. Aqui se usa siempre la identidad oficial de app_config, el
// mismo criterio del resto del sistema: el servidor manda, el navegador no
// es la fuente de verdad.
//
// Todo lo que viene del pago o de la tarjeta se ESCAPA antes de entrar al
// HTML: son datos que captura un usuario y acaban dentro de un documento.
// ═══════════════════════════════════════════════════════════════════

import { app_config } from './config'
import { esc } from './recibo'
import { area_por_nombre_zona, formato_fecha } from './cobros'
import { suma_pagos_dinero } from './pipeline'
import { min_seccion } from './reservasadmin'
import { mxn2 } from './dinero'

const money = (n) => (Number(n) || 0).toLocaleString('es-MX', mxn2)

// espejo de _juegoCotizLabel(): "14 oct 2026 · vs Mayos · Juego 3".
export function juego_label_recibo(juegoid, juegos) {
  const j = (juegos || []).find((x) => String(x.id) === String(juegoid))
  if (!j) return ''
  const f = new Date(j.fecha + 'T12:00').toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
  return f + ' · vs ' + j.rival + ' · Juego ' + j.num
}

// Los datos del recibo de UN pago concreto. `pagos` es el historial completo
// de la tarjeta EN ORDEN de registro (mismo orden que la tabla `cobros`,
// ascendente por id) y `idx` el indice del pago que se esta documentando —
// el equivalente a pdPagos.push() + su posicion en la v1.
//
// El recibo AMPARA DINERO RECIBIDO: lo asignado a credito no suma al "Pagado
// a la fecha" ni puede marcar "Liquidado" un saldo que sigue siendo por
// cobrar (suma_pagos_dinero ya deja fuera los creditos).
export function datos_recibo_pago(card, pagos, idx, { areas, catalogo, juegos }) {
  const pago = pagos[idx]
  if (!pago || !card) return null

  const totalreserva = Number(card.monto) || 0
  const totalpagado = suma_pagos_dinero(pagos.slice(0, idx + 1))
  const restante = totalreserva - totalpagado

  // Homologacion con el correo/recibo del portal: asistentes = base de la
  // zona (catalogo de Precios) + los extras capturados en la tarjeta.
  const area = area_por_nombre_zona(card.zona || '', areas || [])
  const juego = (juegos || []).find((j) => String(j.id) === String(card.juego)) || null
  const base = area ? min_seccion(area, catalogo || [], juego) || 0 : 0
  const asistentes = base > 0
    ? base + (parseInt(card.adultos, 10) || 0) + (parseInt(card.ninos, 10) || 0)
    : null

  return {
    folio: card.folio || card.id,
    cliente: card.nombre, tel: card.tel, email: card.email,
    zona: card.zona || '', juego: juego_label_recibo(card.juego, juegos) || card.juego || '',
    concepto: pago.concepto, monto: pago.monto, forma: pago.formapago,
    fecha: formato_fecha(pago.fecha), registradopor: pago.recibio,
    totalreserva, totalpagado, restante, asistentes,
    estadopago: totalreserva > 0 ? (restante <= 0.01 ? 'Liquidado ✓' : 'Pago parcial') : null,
    // "hasta la fecha": el mismo desglose que ve el cliente en su correo.
    historial: pagos.slice(0, idx + 1).map((p) => ({
      fecha: formato_fecha(p.fecha), concepto: p.concepto, forma: p.formapago, monto: p.monto,
    })),
  }
}

// El documento imprimible. Mismo diseño que la v1 (logo, franja de color,
// datos fiscales oficiales, desglose del pago, saldo de la reserva e
// historial), con la identidad SIEMPRE oficial — ver la nota de arriba.
export function html_recibo_pago(r) {
  const color = '#E05C1A'
  const fila = (k, v) =>
    v ? '<div class="row"><span>' + k + '</span><span>' + esc(v) + '</span></div>' : ''

  return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">' +
    '<title>Recibo ' + esc(r.folio || '') + ' — Naranjeros de Hermosillo</title>' +
    '<style>' +
    '@page{margin:18mm}body{font-family:"Segoe UI",Arial,sans-serif;color:#111;margin:0}' +
    '.wrap{max-width:680px;margin:0 auto;padding:8px}' +
    '.head{display:flex;align-items:center;gap:14px;border-bottom:3px solid ' + color + ';padding-bottom:16px;margin-bottom:22px}' +
    '.h1{font-size:18px;font-weight:800}.sub{font-size:12px;color:#666}.folio{margin-left:auto;text-align:right}' +
    '.recibo-tag{font-size:32px;font-weight:900;letter-spacing:1px;color:' + color + ';line-height:1}' +
    '.lbl{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px}' +
    '.box{background:#F8F7F4;border-radius:9px;padding:16px;margin:14px 0}' +
    '.row{display:flex;justify-content:space-between;margin-bottom:9px;font-size:13px}.row span:first-child{color:#666}.row span:last-child{font-weight:600}' +
    '.sep{border-top:1px solid #ddd;margin:6px 0}' +
    '.tot span:last-child{color:' + color + ';font-size:18px;font-weight:800}' +
    '.condiciones{background:#FFF8F0;border-left:3px solid ' + color + ';border-radius:0 8px 8px 0;padding:10px 14px;font-size:11px;color:#555;margin:14px 0;line-height:1.6}' +
    '.foot{font-size:11px;color:#999;text-align:center;margin-top:18px}' +
    '.fiscal{font-size:11px;color:#777;line-height:1.55;margin:-10px 0 18px;border-bottom:1px solid #eee;padding-bottom:12px}' +
    '.fiscal b{color:#555;letter-spacing:.2px}' +
    '.print-btn{display:block;width:100%;max-width:680px;margin:16px auto 0;padding:12px;background:' + color + ';color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}' +
    '@media print{.print-btn{display:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}' +
    '</style></head><body>' +
    '<div class="wrap">' +
    '<div class="head">' +
    '<img src="' + esc(app_config.logourl) + '" style="max-height:52px;max-width:120px;object-fit:contain" alt="Naranjeros de Hermosillo">' +
    '<div><div class="h1">Naranjeros de Hermosillo</div><div class="sub">' + esc(app_config.marcasubtitulo) + '</div></div>' +
    '<div class="folio"><div class="recibo-tag">RECIBO</div><div class="sub">Folio ' + esc(r.folio || '—') + ' · ' + esc(r.fecha || '') + '</div>' +
    (r.registradopor ? '<div class="sub">Recibió: ' + esc(r.registradopor) + '</div>' : '') + '</div></div>' +
    '<div class="fiscal"><b>' + esc(app_config.fiscal.razonsocial) + '</b> · "' + esc(app_config.fiscal.nombrecomercial) + '"<br>' +
    'R.F.C. ' + esc(app_config.fiscal.rfc) + '<br>' +
    esc(app_config.fiscal.domicilio) + '<br>' +
    'TELS. ' + esc(app_config.fiscal.telefonos) + '</div>' +
    '<div class="lbl">Cliente</div><div style="font-size:16px;font-weight:700;margin-bottom:2px">' + esc(r.cliente) + '</div>' +
    ((r.tel || r.email) ? '<div class="sub" style="margin-bottom:6px">' + esc([r.tel, r.email].filter(Boolean).join(' · ')) + '</div>' : '') +
    '<div class="box">' +
    fila('Zona', r.zona) +
    fila('Juego', r.juego) +
    (r.asistentes ? fila('Asistentes', r.asistentes + ' personas') : '') +
    fila('Concepto', r.concepto) +
    fila('Forma de pago', r.forma) +
    '<div class="sep"></div>' +
    '<div class="row tot"><span style="font-weight:700;color:#111">Monto pagado</span><span>$' + money(r.monto) + ' MXN</span></div>' +
    '</div>' +
    (r.totalreserva > 0 ?
      '<div class="box">' +
      '<div class="row"><span>Total de la reserva</span><span>$' + money(r.totalreserva) + '</span></div>' +
      '<div class="row"><span>Pagado a la fecha</span><span style="color:#16A34A">$' + money(r.totalpagado) + '</span></div>' +
      '<div class="sep"></div>' +
      '<div class="row"><span style="font-weight:700">Saldo restante</span><span style="font-weight:800;color:' + (r.restante > 0 ? '#DC2626' : '#16A34A') + '">$' + money(Math.max(0, r.restante)) + '</span></div>' +
      (r.estadopago ? '<div class="row"><span>Estado de pago</span><span style="font-weight:700;color:' + (r.restante > 0 ? '#B45309' : '#16A34A') + '">' + esc(r.estadopago) + '</span></div>' : '') +
      '</div>' : '') +
    (r.historial && r.historial.length ?
      '<div class="box">' +
      '<div class="lbl" style="margin-bottom:8px">💳 Historial de pagos</div>' +
      r.historial.map((p) =>
        '<div class="row"><span>' + esc((p.fecha || '—') + ' · ' + (p.concepto || 'Abono') + (p.forma ? ' · ' + p.forma : '')) + '</span>' +
        '<span>$' + money(p.monto) + '</span></div>'
      ).join('') +
      '</div>' : '') +
    '<div class="condiciones">' + esc(app_config.leyendas.comprobante) + '<br>' + esc(app_config.leyendas.factura) + '</div>' +
    '<div class="foot">Naranjeros de Hermosillo · Estadio Fernando Valenzuela, Hermosillo, Sonora</div>' +
    '</div>' +
    '<button class="print-btn" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>' +
    '</body></html>'
}

// Nombre del archivo que se sube a Storage: "recibo-PROS-030-2.html".
export function nombre_archivo_recibo(folio, numero) {
  return 'recibo-' + (folio || 'pago') + '-' + numero + '.html'
}
