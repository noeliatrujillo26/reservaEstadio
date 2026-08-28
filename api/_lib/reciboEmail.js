// Recibo de reserva por correo — compartido por stripe-webhook (envío
// automático al confirmarse el pago) y api/checkout (reenvío manual desde la
// pantalla de éxito).
//
// Variables de entorno en Vercel (y .env.local para vercel dev):
//   EMAIL_SERVER_HOST     — smtp.hostinger.com
//   EMAIL_SERVER_PORT     — 465 (SSL implícito; otro puerto usa STARTTLS)
//   EMAIL_SERVER_USER     — buzón completo, ej. contacto@reservaestadio.com
//   EMAIL_SERVER_PASSWORD — contraseña del buzón
//   EMAIL_FROM            — remitente, ej. "Zonas Naranjeros" <contacto@reservaestadio.com>
//   RESEND_API_KEY/RESEND_FROM — respaldo si no hay SMTP configurado
//   SITE_URL              — opcional; default https://reservaestadio.com
// Sin SMTP ni Resend, el recibo se publica igual y el correo se omite con log.

// Dominio del sitio (2026-07-27: migrado de www.abona2.com a reservaestadio.com,
// SIN www — el subdominio www no resuelve). Todos los enlaces de los correos
// (recibo, portal, cotización) se construyen con esta base.
const CFG = require('./config');
const SITE_URL = CFG.SITE_URL;
const NARANJA = '#E05C1A';
const LOGO_URL = CFG.logoUrl;   // logo local (config central)

// Limpia una credencial pegada en Vercel/.env con basura accidental: espacios,
// saltos de línea o comillas envolventes ("pass" / 'pass'). Un solo carácter
// extra produce "535 authentication failed" aunque la contraseña sea correcta.
function _credencialLimpia(v) {
  return String(v == null ? '' : v).trim().replace(/^["']+|["']+$/g, '').trim();
}

// Transporte SMTP (Hostinger). Se crea al primer uso y solo si las tres
// variables mínimas están presentes; nodemailer se carga perezosamente para
// que el resto del módulo funcione aunque falte la dependencia.
let _smtp;
function getTransporteSMTP() {
  const host = _credencialLimpia(process.env.EMAIL_SERVER_HOST);
  const usuario = _credencialLimpia(process.env.EMAIL_SERVER_USER);
  const clave = _credencialLimpia(process.env.EMAIL_SERVER_PASSWORD);
  if (!host || !usuario || !clave) return null;
  if (!_smtp) {
    const nodemailer = require('nodemailer');
    const puerto = Number(_credencialLimpia(process.env.EMAIL_SERVER_PORT) || 465);
    _smtp = nodemailer.createTransport({
      host: host,
      port: puerto,
      secure: puerto === 465,
      auth: { user: usuario, pass: clave },
      // Timeouts acotados: una función serverless no puede quedarse colgada
      // esperando un SMTP lento — mejor fallar, reintentar una vez y loguear.
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });
  }
  return _smtp;
}

const { redondearDinero, fmtDinero } = require('./dinero');
// Dos decimales siempre: el recibo es el comprobante que ve el cliente.
const fmtMXN = (n) => '$' + fmtDinero(n) + ' MXN';

// ── Datos COMPARTIDOS correo ↔ recibo (homologación) ────────────────────────
// Método de pago, estado, historial y datos fiscales se derivan UNA sola vez
// aquí: el correo y el recibo web/PDF muestran exactamente el mismo conjunto.
function fiscalHtml(fontSize, colorTexto, colorNegritas) {
  const F = CFG.fiscal;   // datos fiscales desde la config central
  return '<div style="font-size:' + (fontSize || '11px') + ';color:' + (colorTexto || '#888') + ';line-height:1.55;margin-top:8px">' +
    '<b style="color:' + (colorNegritas || '#666') + '">' + F.razonSocial + '</b> · "' + F.nombreComercial + '"<br>' +
    'R.F.C. ' + F.rfc + '<br>' +
    F.domicilio + '<br>' +
    'TELS. ' + F.telefonos + '</div>';
}

function esPagoEnLinea(reserva, montos) {
  return !!(reserva.stripe_checkout_id || reserva.stripe_payment_id || montos.paymentIntent);
}

function metodoPagoDe(reserva, montos) {
  return montos.metodoPago || (esPagoEnLinea(reserva, montos) ? 'Tarjeta · Stripe' : 'Registrado en taquilla');
}

function estadoPagoDe(restante) {
  return restante > 0 ? 'Pago parcial' : 'Liquidado ✓';
}

// Bloque "💳 Historial de pagos" (mismo markup en correo y recibo).
function historialPagosHtml(montos) {
  const historial = Array.isArray(montos.historialPagos) ? montos.historialPagos : [];
  if (!historial.length) return '';
  return '<div style="background:#F7F5F0;border-radius:10px;padding:12px 16px;margin:14px 0">' +
    '<div style="font-size:13px;font-weight:800;color:#333;margin-bottom:6px">💳 Historial de pagos</div>' +
    '<table style="width:100%;border-collapse:collapse">' +
    historial.map(p => '<tr><td style="padding:4px 0;font-size:12px;color:#666;white-space:nowrap">' + (p.fecha || '—') + '</td>' +
      '<td style="padding:4px 8px;font-size:12px;color:#666">' + (p.concepto || 'Abono') + (p.forma ? ' · ' + p.forma : '') + '</td>' +
      '<td style="padding:4px 0;font-size:12px;font-weight:700;text-align:right;white-space:nowrap">' + fmtMXN(Number(p.monto) || 0) + '</td></tr>').join('') +
    '</table></div>';
}

// Ruta determinista del recibo por pago: webhook y reenvíos apuntan al MISMO
// archivo (upsert), sin duplicados y con enlace estable para el cliente.
function rutaRecibo(reservaId, paymentIntent) {
  const sufijo = String(paymentIntent || 'pago').replace(/[^A-Za-z0-9_-]/g, '').slice(-10);
  return 'recibos/recibo-' + String(reservaId).replace(/[^A-Za-z0-9._-]/g, '-') + '-' + sufijo + '.html';
}

function ligaRecibo(reservaId, paymentIntent) {
  return SITE_URL + '/api/recibo?f=' + encodeURIComponent(rutaRecibo(reservaId, paymentIntent));
}

// Recibo standalone (mismo lenguaje visual que los recibos del panel): se
// publica en comprobantes_pagos/recibos/ y se sirve vía /api/recibo. El botón
// de imprimir permite "Guardar como PDF" desde el navegador.
function buildReciboHtml(reserva, montos) {
  const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  const restante = Math.max(0, montos.totalNeto - montos.nuevoMontoPagado);
  const asistentes = asistentesReserva(reserva);
  return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>Recibo ' + reserva.id + ' — Naranjeros de Hermosillo</title><style>' +
  'body{font-family:"Segoe UI",Arial,sans-serif;color:#111;margin:0;background:#F7F5F0}' +
  '.wrap{max-width:560px;margin:0 auto;padding:24px 16px}' +
  '.card{background:#fff;border-radius:12px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06)}' +
  '.head{border-bottom:3px solid ' + NARANJA + ';padding-bottom:14px;margin-bottom:18px;text-align:center}' +
  '.h1{font-size:17px;font-weight:800}.sub{font-size:12px;color:#666}' +
  '.row{display:flex;justify-content:space-between;margin-bottom:9px;font-size:13px}' +
  '.row span:first-child{color:#666}.row span:last-child{font-weight:600;text-align:right}' +
  '.sep{border-top:1px solid #eee;margin:10px 0}' +
  '.tot span:last-child{color:' + NARANJA + ';font-size:17px;font-weight:800}' +
  '.foot{font-size:11px;color:#999;text-align:center;margin-top:16px}' +
  '.print-btn{display:block;width:100%;margin:16px 0 0;padding:12px;background:' + NARANJA + ';color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}' +
  '@media print{.print-btn{display:none}body{background:#fff}}' +
  '</style></head><body><div class="wrap"><div class="card">' +
  '<div class="head">' +
  '<img src="' + LOGO_URL + '" alt="Naranjeros de Hermosillo" style="height:44px;width:auto;display:block;margin:0 auto 8px">' +
  '<div class="h1">Naranjeros de Hermosillo</div>' +
  '<div class="sub">Zonas de Asadores · Recibo de pago · ' + fecha + '</div>' +
  // Datos fiscales oficiales del club (pantalla e impresión/PDF).
  fiscalHtml() + '</div>' +
  '<div class="row"><span>Folio de reserva</span><span>' + reserva.id + '</span></div>' +
  '<div class="row"><span>Cliente</span><span>' + (reserva.cliente || '—') + '</span></div>' +
  '<div class="row"><span>Zona</span><span>' + (reserva.zona || '—') + '</span></div>' +
  '<div class="row"><span>Juego</span><span>' + (reserva.juego || '—') + '</span></div>' +
  (asistentes ? '<div class="row"><span>Asistentes</span><span>' + asistentes + ' personas</span></div>' : '') +
  '<div class="sep"></div>' +
  '<div class="row tot"><span>Pago recibido</span><span>' + fmtMXN(montos.montoRecibido) + '</span></div>' +
  '<div class="row"><span>Método de pago</span><span>' + metodoPagoDe(reserva, montos) + '</span></div>' +
  '<div class="row"><span>Total de la reserva</span><span>' + fmtMXN(montos.totalNeto) + '</span></div>' +
  '<div class="row"><span>Pagado a la fecha</span><span>' + fmtMXN(montos.nuevoMontoPagado) + '</span></div>' +
  '<div class="row"><span>Saldo restante</span><span>' + (restante > 0 ? fmtMXN(restante) : 'Liquidado ✓') + '</span></div>' +
  '<div class="row"><span>Estado de pago</span><span>' + estadoPagoDe(restante) + '</span></div>' +
  historialPagosHtml(montos) +
  '<div style="background:#FFF8F0;border-left:3px solid ' + NARANJA + ';border-radius:0 8px 8px 0;padding:10px 14px;font-size:11px;color:#555;margin:14px 0;line-height:1.6">' +
    CFG.leyendas.comprobante + '<br>' + CFG.leyendas.factura + '</div>' +
  '<button class="print-btn" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>' +
  '</div><div class="foot">Presenta este recibo (impreso o en pantalla) el día del juego.<br>' +
  'Estadio Fernando Valenzuela · Hermosillo, Sonora</div></div></body></html>';
}

// Remitente del SMTP: el nombre para mostrar sale de EMAIL_FROM, pero la
// DIRECCIÓN es siempre EMAIL_SERVER_USER — Hostinger solo acepta enviar
// como el buzón autenticado (rechazo 553 en caso contrario). El formato
// {name, address} deja que nodemailer arme las comillas correctamente.
function _remitenteSMTP() {
  const usuario = _credencialLimpia(process.env.EMAIL_SERVER_USER);
  let nombre = 'Zonas Naranjeros';
  const m = String(process.env.EMAIL_FROM || '').match(/^\s*"?([^"<]*?)"?\s*</);
  if (m && m[1].trim()) nombre = m[1].trim();
  return { name: nombre, address: usuario };
}

// Log estructurado del error SMTP: code/command/response son lo que Hostinger
// realmente contestó (550, 421, 553, auth failed…) — visible en logs de Vercel.
function _logErrorSMTP(error, reservaId, destinatario, etapa) {
  console.error('Error detallado de SMTP Hostinger (' + etapa + '):', {
    reserva: reservaId,
    destinatario: destinatario,
    code: error && error.code,
    command: error && error.command,
    responseCode: error && error.responseCode,
    response: error && error.response,
    message: error && error.message,
  });
}

// Total de asistentes de una reserva online: en filas creadas por el checkout
// `adultos` viene NULL y `personas` ya es el total de adultos; los niños se
// suman aparte (misma regla que _totalPersonasReserva del panel).
function asistentesReserva(reserva) {
  const ninos = parseInt(reserva.ninos, 10) || 0;
  const personas = parseInt(reserva.personas, 10) || 0;
  const total = personas + (reserva.adultos == null || reserva.adultos === '' ? ninos : 0);
  return total > 0 ? total : null;
}

function buildEmailHtml(reserva, montos, liga) {
  const restante = Math.max(0, montos.totalNeto - montos.nuevoMontoPagado);
  const asistentes = asistentesReserva(reserva);
  const fila = (k, v) => '<tr><td style="padding:6px 0;color:#666;font-size:13px">' + k +
    '</td><td style="padding:6px 0;font-weight:600;font-size:13px;text-align:right">' + v + '</td></tr>';

  // ── Desglose financiero IDÉNTICO a la pantalla "¡Reserva confirmada!" ──
  // Descuento promo: cupón + volumen aplicados al crear la reserva.
  const descuentoMonto = Number(reserva.descuento_monto) || 0;
  const descuentoCodigo = reserva.descuento_codigo || '';
  // Pago EN LÍNEA (Stripe): lo cobrado = bd × 1.07 (misma fórmula de
  // calcularTotales), así que la comisión se deriva exacta del monto cobrado.
  const pagoEnLinea = esPagoEnLinea(reserva, montos);
  const bdPagado = pagoEnLinea && montos.montoRecibido > 0 ? redondearDinero(montos.montoRecibido / (1 + CFG.COMISION_PCT)) : 0;
  const comision = pagoEnLinea && montos.montoRecibido > 0 ? Math.max(0, redondearDinero(montos.montoRecibido - bdPagado)) : 0;
  const metodoPago = metodoPagoDe(reserva, montos);
  // Envío MANUAL desde el panel ("Enviar Reserva"): título/intro informativos
  // y etiqueta "Monto pagado" — igual que el recibo PDF/pantalla (no es la
  // confirmación de un pago recién hecho).
  const esInfo = !!montos.esReenvio;
  const historialHtml = historialPagosHtml(montos);
  return '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111">' +
  '<div style="border-bottom:3px solid ' + NARANJA + ';padding:16px 0;margin-bottom:16px">' +
  '<img src="' + LOGO_URL + '" alt="Naranjeros de Hermosillo" height="40" style="height:40px;display:block;margin-bottom:10px">' +
  '<div style="font-size:18px;font-weight:800">' + (esInfo ? '📋 Información de tu reserva' : '¡Tu reserva ha sido confirmada!') + '</div>' +
  '<div style="font-size:13px;color:#666">Naranjeros de Hermosillo · Zonas de Asadores</div>' +
  // Datos fiscales de la razón social (mismo bloque que el recibo, compacto).
  fiscalHtml('10.5px', '#999', '#777') + '</div>' +
  '<p style="font-size:14px">Hola <strong>' + (reserva.cliente || '') + '</strong>, ' +
  (esInfo ? 'te compartimos la información actualizada de tu reserva:' : '¡gracias por tu reserva! Recibimos tu pago. Estos son los datos de tu reserva:') + '</p>' +
  '<table style="width:100%;border-collapse:collapse;background:#F7F5F0;border-radius:10px;padding:8px" cellpadding="8">' +
  fila('Folio', '<strong>' + reserva.id + '</strong>') +
  fila('Cliente', reserva.cliente || '—') +
  fila('Zona', reserva.zona || '—') +
  fila('Juego', reserva.juego || '—') +
  (asistentes ? fila('Asistentes', asistentes + ' personas') : '') +
  '<tr><td colspan="2" style="border-top:1px solid #E5E0D8;padding:0"></td></tr>' +
  (descuentoMonto > 0
    ? '<tr><td style="padding:6px 0;color:#15803D;font-size:13px">Descuento promo' + (descuentoCodigo ? ' (' + descuentoCodigo + ')' : '') +
      '</td><td style="padding:6px 0;font-weight:700;font-size:13px;text-align:right;color:#15803D">−' + fmtMXN(descuentoMonto) + '</td></tr>'
    : '') +
  (comision > 0 ? fila('Comisión de servicio (7%)', fmtMXN(comision)) : '') +
  fila(esInfo ? 'Monto pagado' : 'Pagado hoy', '<span style="color:' + NARANJA + ';font-weight:800">' + fmtMXN(montos.montoRecibido) + '</span>') +
  fila('Método de pago', metodoPago) +
  '<tr><td colspan="2" style="border-top:1px solid #E5E0D8;padding:0"></td></tr>' +
  fila('Total de la reserva', fmtMXN(montos.totalNeto)) +
  fila('Saldo restante', restante > 0 ? fmtMXN(restante) : 'Liquidado ✓') +
  fila('Estado de pago', estadoPagoDe(restante)) +
  '</table>' +
  historialHtml +
  '<a href="' + liga + '" style="display:block;text-align:center;background:' + NARANJA + ';color:#fff;text-decoration:none;padding:13px;border-radius:8px;font-weight:700;font-size:14px;margin:18px 0 10px">Ver / descargar mi recibo (PDF)</a>' +
  '<a href="' + SITE_URL + '/mis-reservas" style="display:block;text-align:center;background:#fff;color:' + NARANJA + ';border:2px solid ' + NARANJA + ';text-decoration:none;padding:11px;border-radius:8px;font-weight:700;font-size:14px;margin:0 0 18px">Consultar mi reserva en línea</a>' +
  '<p style="font-size:12px;color:#666">Para entrar al portal usa tu folio <strong>' + reserva.id + '</strong> y este mismo correo. Guarda este mensaje: el enlace de tu recibo estará siempre disponible. Preséntalo el día del juego.</p>' +
  // Reglamento resumido del Área Social (la versión completa va en la
  // cotización PDF — js/modules/cotizaciones.js REGLAMENTO_AREA_SOCIAL).
  '<div style="background:#FFF7F2;border:1px solid #F4D9C8;border-radius:10px;padding:12px 16px;margin:14px 0">' +
  '<div style="font-size:13px;font-weight:800;color:' + NARANJA + ';margin-bottom:6px">📌 REGLAMENTO EN ÁREA SOCIAL</div>' +
  '<ul style="margin:0;padding-left:18px;font-size:12px;color:#555;line-height:1.7">' +
  '<li>Renta válida solo durante el juego.</li>' +
  '<li>Prohibido ingresar alimentos, bebidas, bocinas, piñatas o banners externos.</li>' +
  '<li>Cambios en personas/alimentos extras permitidos hasta 5 días antes.</li>' +
  '<li>Prohibido fumar y molestar en cabinas.</li>' +
  '<li>Cero tolerancia al consumo de alcohol en menores.</li>' +
  '</ul></div>' +
  '<p style="font-size:12px;color:#666;text-align:center;border-top:1px solid #eee;padding-top:14px">¿Necesitas ayuda con tu reserva? Escríbenos a <a href="mailto:' + CFG.contacto.email + '" style="color:' + NARANJA + '">' + CFG.contacto.email + '</a> o llámanos al <a href="tel:' + CFG.contacto.telAsistencia + '" style="color:' + NARANJA + '">' + CFG.contacto.telAsistenciaBonito + '</a>.</p>' +
  '<p style="font-size:11px;color:#999;text-align:center;margin-top:10px">Estadio Fernando Valenzuela · Hermosillo, Sonora · <a href="' + SITE_URL + '" style="color:#999">reservaestadio.com</a></p>' +
  '</div>';
}

// Publica el recibo en Storage y (si hay RESEND_API_KEY) envía el correo.
// Devuelve { enviado, liga }: enviado=false cuando falta la llave — el
// llamador decide si eso es un error (reenvío manual) o solo un log (webhook).
async function enviarReciboPorCorreo(sb, reserva, montos, opts) {
  opts = opts || {};
  if (!reserva.email) {
    console.log('Recibo por correo omitido: la reserva no tiene email.');
    return { enviado: false, liga: null, motivo: 'sin-email' };
  }

  // Historial de pagos "hasta la fecha": si el llamador no lo trae (webhook de
  // Stripe, reenvío del checkout), se lee aquí de cobros — así el correo Y el
  // recibo lo incluyen en TODOS los flujos. NO-fatal: sin historial se envía igual.
  if (!Array.isArray(montos.historialPagos)) {
    try {
      const { data: cobrosRes, error: cobrosErr } = await sb.from('cobros')
        .select('fecha, concepto, forma_pago, monto, estado').eq('folio', String(reserva.id));
      if (cobrosErr) throw cobrosErr;
      montos = Object.assign({}, montos, {
        historialPagos: (cobrosRes || [])
          .filter(c => String(c.estado || '').toLowerCase() !== 'cancelado')
          .map(c => ({ fecha: c.fecha, concepto: c.concepto, forma: c.forma_pago, monto: c.monto })),
      });
    } catch (eHist) {
      console.error('Historial de cobros no disponible (correo y recibo van sin historial):', eHist && eHist.message);
    }
  }

  const ruta = rutaRecibo(reserva.id, montos.paymentIntent);
  const html = buildReciboHtml(reserva, montos);
  const { error: upErr } = await sb.storage.from('comprobantes_pagos')
    .upload(ruta, Buffer.from(html, 'utf8'), { contentType: 'text/html', upsert: true });
  if (upErr) throw upErr;
  const liga = SITE_URL + '/api/recibo?f=' + encodeURIComponent(ruta);

  // Candado de envío único: el webhook de Stripe y el disparo desde la landing
  // comparten la misma clave (el id de la sesión de checkout), así el cliente
  // recibe UN solo correo aunque ambos caminos se ejecuten. El marcador se
  // sube sin upsert: el segundo intento falla con "already exists" y se omite.
  // El reenvío manual no pasa claveUnica y siempre envía.
  let marcaLock = null;
  if (opts.claveUnica) {
    const marca = 'recibos/.enviado-' + String(opts.claveUnica).replace(/[^A-Za-z0-9_-]/g, '').slice(-60) + '.txt';
    const { error: mErr } = await sb.storage.from('comprobantes_pagos')
      .upload(marca, Buffer.from(reserva.email, 'utf8'), { contentType: 'text/plain', upsert: false });
    if (mErr && /exist|duplicate|409/i.test(String(mErr.message || mErr.statusCode || ''))) {
      console.log('Correo de confirmación ya enviado antes para ' + reserva.id + ' — omitido.');
      return { enviado: false, liga, motivo: 'ya-enviado' };
    }
    if (mErr) console.error('Marcador de envío único falló (se envía de todas formas):', mErr);
    else marcaLock = marca;
  }
  // Si el envío falla (o no hay servicio configurado), el candado se libera:
  // un fallo NO debe dejar el marcador puesto o los reintentos posteriores
  // dirían "ya-enviado" y el cliente se quedaría sin correo para siempre.
  const liberarLock = async () => {
    if (!marcaLock) return;
    try { await sb.storage.from('comprobantes_pagos').remove([marcaLock]); } catch (e) {}
    marcaLock = null;
  };

  const asunto = '✅ Reserva confirmada · Folio ' + reserva.id + ' · Naranjeros de Hermosillo';
  const cuerpo = buildEmailHtml(reserva, montos, liga);
  const destinatario = String(reserva.email).trim().toLowerCase();

  // 1º SMTP de Hostinger (nodemailer); 2º Resend como respaldo.
  const smtp = getTransporteSMTP();
  if (smtp) {
    // Verificación previa de conexión+credenciales: deja en los logs del
    // servidor la razón exacta ANTES de intentar el envío (auth failed vs
    // timeout vs DNS), con mensaje legible para la UI del reenvío.
    try {
      await smtp.verify();
      console.log('SMTP Hostinger: conexión y autenticación verificadas para ' + _remitenteSMTP().address);
    } catch (eVer) {
      _logErrorSMTP(eVer, reserva.id, destinatario, 'transporter.verify — conexión/credenciales');
      await liberarLock();
      throw new Error('SMTP Hostinger: fallo de autenticación/conexión: ' + (eVer.response || eVer.message || 'razón desconocida'));
    }

    // Remitente SIEMPRE igual al buzón autenticado: Hostinger rechaza con
    // 553 cualquier From que no sea del propio usuario.
    const mensaje = { from: _remitenteSMTP(), to: destinatario, subject: asunto, html: cuerpo };
    try {
      try {
        await smtp.sendMail(mensaje);
      } catch (e1) {
        // Un timeout o corte puntual no debe perder el correo: un reintento.
        _logErrorSMTP(e1, reserva.id, destinatario, 'intento 1 — reintentando');
        await new Promise((r) => setTimeout(r, 1500));
        await smtp.sendMail(mensaje);
      }
    } catch (e2) {
      _logErrorSMTP(e2, reserva.id, destinatario, 'intento 2 — definitivo');
      await liberarLock();
      // Mensaje legible para el llamador (el reenvío manual lo muestra en la UI).
      throw new Error('SMTP Hostinger rechazó el envío: ' + (e2.response || e2.message || 'fallo desconocido'));
    }
    console.log('Recibo enviado por SMTP a ' + destinatario + ' (' + reserva.id + ')');
    return { enviado: true, liga };
  }

  if (!process.env.RESEND_API_KEY) {
    console.log('Recibo publicado en ' + liga + ' pero SIN enviar correo: faltan EMAIL_SERVER_* (SMTP) y RESEND_API_KEY.');
    await liberarLock();
    return { enviado: false, liga, motivo: 'sin-api-key' };
  }
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'Abona2 <onboarding@resend.dev>',
        to: [destinatario],
        subject: asunto,
        html: cuerpo,
      }),
    });
    if (!resp.ok) {
      const detalle = await resp.text().catch(() => '');
      throw new Error('Resend respondió ' + resp.status + ': ' + detalle);
    }
  } catch (eResend) {
    await liberarLock();
    throw eResend;
  }
  console.log('Recibo enviado por correo a ' + destinatario + ' (' + reserva.id + ')');
  return { enviado: true, liga };
}

module.exports = { rutaRecibo, ligaRecibo, buildReciboHtml, buildEmailHtml, enviarReciboPorCorreo, getTransporteSMTP, asistentesReserva, metodoPagoDe, estadoPagoDe, historialPagosHtml, fiscalHtml, _remitenteSMTP, _logErrorSMTP, SITE_URL };
