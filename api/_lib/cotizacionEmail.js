// Correo de cotización — usado por api/send-quotation-email (disparado desde
// la tabla de Cotizaciones y la ficha del prospecto en el Pipeline).
// Reutiliza el transporte SMTP de Hostinger (verify + reintento + logging
// detallado) y el respaldo Resend del recibo de reserva.

const { getTransporteSMTP, _remitenteSMTP, _logErrorSMTP, SITE_URL } = require('./reciboEmail');

const NARANJA = '#E05C1A';
const CFG = require('./config');
const LOGO_URL = CFG.logoUrl;   // logo local (config central)
const fmtMXN = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MXN';

// Total de personas de la cotización: base incluida + adultos y niños extra.
function personasCotizacion(c) {
  const base = parseInt(c.personas_incluidas, 10) || 0;
  const adultos = parseInt(c.adulto_extra_cant, 10) || 0;
  const ninos = parseInt(c.nino_extra_cant, 10) || 0;
  const total = base + adultos + ninos;
  return total > 0 ? total : null;
}

function buildCotizEmailHtml(c, ligaPdf) {
  const personas = personasCotizacion(c);
  const fila = (k, v, extraTd) => '<tr><td style="padding:6px 0;color:#666;font-size:13px">' + k +
    '</td><td style="padding:6px 0;font-weight:600;font-size:13px;text-align:right;' + (extraTd || '') + '">' + v + '</td></tr>';
  const sep = '<tr><td colspan="2" style="border-top:1px solid #E5E0D8;padding:0"></td></tr>';

  let desglose = '';
  if (Number(c.area_monto)) desglose += fila('Zona ' + (c.zona ? '(' + c.zona + ')' : '') + (c.personas_incluidas ? ' · incluye ' + c.personas_incluidas + ' personas' : ''), fmtMXN(c.area_monto));
  if (Number(c.consumo_monto)) desglose += fila('Consumo' + (c.consumo_desc ? ' (' + c.consumo_desc + ')' : ''), fmtMXN(c.consumo_monto));
  if (Number(c.adultos_extra_monto)) desglose += fila('Adultos extra (' + (c.adulto_extra_cant || 0) + ' × ' + fmtMXN(c.adulto_extra_precio) + ')', fmtMXN(c.adultos_extra_monto));
  if (Number(c.ninos_extra_monto)) desglose += fila('Niños extra (' + (c.nino_extra_cant || 0) + ' × ' + fmtMXN(c.nino_extra_precio) + ')', fmtMXN(c.ninos_extra_monto));
  if (Number(c.extra_monto)) desglose += fila('Extras', fmtMXN(c.extra_monto));
  if (Number(c.descuento)) desglose += fila('Descuento', '−' + fmtMXN(c.descuento), 'color:#15803D');
  desglose += sep;
  if (Number(c.subtotal)) desglose += fila('Subtotal', fmtMXN(c.subtotal));
  if (Number(c.iva)) desglose += fila('IVA (16%)', fmtMXN(c.iva));
  desglose += fila('Total cotizado', '<span style="color:' + NARANJA + ';font-size:16px;font-weight:800">' + fmtMXN(c.total) + '</span>');

  return '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111">' +
  '<div style="border-bottom:3px solid ' + NARANJA + ';padding:16px 0;margin-bottom:16px">' +
  '<img src="' + LOGO_URL + '" alt="Naranjeros de Hermosillo" height="40" style="height:40px;display:block;margin-bottom:10px">' +
  '<div style="font-size:18px;font-weight:800">¡Aquí está tu cotización de Zonas Naranjeros!</div>' +
  '<div style="font-size:13px;color:#666">Naranjeros de Hermosillo · Zonas de Asadores</div></div>' +
  '<p style="font-size:14px">Hola <strong>' + (c.cliente || '') + '</strong>, gracias por tu interés. Este es el detalle de tu cotización:</p>' +
  '<table style="width:100%;border-collapse:collapse;background:#F7F5F0;border-radius:10px;padding:8px" cellpadding="8">' +
  fila('Cotización', '<strong>' + c.id + '</strong>') +
  (c.juegos ? fila('Evento / Juego', c.juegos) : '') +
  (c.zona ? fila('Zona', c.zona) : '') +
  (personas ? fila('Total de personas', personas + ' personas') : '') +
  sep + desglose +
  '</table>' +
  // Reglamento del Área Social — mismo contenido que la cotización PDF, en
  // contenedor destacado ANTES del botón de reservar. Solo CSS en línea
  // (compatible Gmail/Outlook, legible en móvil y escritorio).
  '<div style="background:#F7F5F0;border:1px solid #E5E0D8;border-radius:10px;padding:14px 18px;margin:16px 0 4px">' +
  '<div style="font-size:13px;font-weight:800;color:' + NARANJA + ';text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Reglamento en Área Social</div>' +
  '<ul style="margin:0;padding-left:18px;font-size:12px;color:#555;line-height:1.7">' +
  '<li>La renta del Área social solo es durante el juego. Una vez terminado, deberán desocupar el área.</li>' +
  '<li>El Anfitrión del evento es el responsable de cuidar el orden de su área asignada.</li>' +
  '<li>Prohibido la compra, venta y consumo de bebidas alcohólicas en menores de edad.</li>' +
  '<li>No se permite introducir alimentos y bebidas que no se hayan comprado dentro del estadio.</li>' +
  '<li>Prohibido ingresar lonas con marcas, bocinas, piñatas, grupos musicales, banners.</li>' +
  '<li>Se podrá aumentar el número de personas y carne extras solo hasta 5 días antes del evento.</li>' +
  '<li>En caso de cancelación del juego por parte del club (antes de iniciar) se reprogramará el evento si hay fechas disponibles o se hará la devolución del dinero.</li>' +
  '<li>En caso de cancelación del evento por parte del cliente, No se devuelve el dinero.</li>' +
  '<li>No molestar en cabinas.</li>' +
  '<li>No Fumar.</li>' +
  '</ul></div>' +
  '<a href="' + SITE_URL + '/" style="display:block;text-align:center;background:' + NARANJA + ';color:#fff;text-decoration:none;padding:14px;border-radius:8px;font-weight:800;font-size:15px;margin:18px 0 10px">Confirmar y Reservar Ahora</a>' +
  (ligaPdf ? '<a href="' + ligaPdf + '" style="display:block;text-align:center;background:#fff;color:' + NARANJA + ';border:2px solid ' + NARANJA + ';text-decoration:none;padding:11px;border-radius:8px;font-weight:700;font-size:14px;margin:0 0 18px">Ver cotización completa (PDF)</a>' : '') +
  '<p style="font-size:12px;color:#666">' + (c.valida
    ? 'Esta cotización es válida hasta el <strong>' + c.valida + '</strong>.'
    : 'Esta cotización tiene una vigencia limitada.') +
  ' Los precios y la disponibilidad de zonas están sujetos a cambios después de esa fecha.</p>' +
  '<p style="font-size:12px;color:#666;text-align:center;border-top:1px solid #eee;padding-top:14px">¿Dudas o quieres ajustar tu cotización? Escríbenos a <a href="mailto:' + CFG.contacto.email + '" style="color:' + NARANJA + '">' + CFG.contacto.email + '</a> o llámanos al <a href="tel:' + CFG.contacto.telAsistencia + '" style="color:' + NARANJA + '">' + CFG.contacto.telAsistenciaBonito + '</a>.</p>' +
  '<p style="font-size:11px;color:#999;text-align:center;margin-top:10px">Estadio Fernando Valenzuela · Hermosillo, Sonora · <a href="' + SITE_URL + '" style="color:#999">reservaestadio.com</a></p>' +
  '</div>';
}

// Envía la cotización al correo registrado en ella. Sin candado de envío
// único: reenviar cotizaciones las veces necesarias es parte del flujo
// comercial. Lanza Error con mensaje legible si el envío falla.
async function enviarCotizacionPorCorreo(c, ligaPdf) {
  const destinatario = String(c.email || '').trim().toLowerCase();
  if (!destinatario) return { enviado: false, motivo: 'sin-email' };

  const asunto = '📋 Tu cotización ' + c.id + ' · Zonas Naranjeros de Hermosillo';
  const cuerpo = buildCotizEmailHtml(c, ligaPdf);

  const smtp = getTransporteSMTP();
  if (smtp) {
    try {
      await smtp.verify();
      console.log('SMTP Hostinger: conexión y autenticación verificadas para ' + _remitenteSMTP().address);
    } catch (eVer) {
      _logErrorSMTP(eVer, c.id, destinatario, 'cotización · transporter.verify');
      throw new Error('SMTP Hostinger: fallo de autenticación/conexión: ' + (eVer.response || eVer.message || 'razón desconocida'));
    }
    const mensaje = { from: _remitenteSMTP(), to: destinatario, subject: asunto, html: cuerpo };
    try {
      try {
        await smtp.sendMail(mensaje);
      } catch (e1) {
        _logErrorSMTP(e1, c.id, destinatario, 'cotización · intento 1 — reintentando');
        await new Promise((r) => setTimeout(r, 1500));
        await smtp.sendMail(mensaje);
      }
    } catch (e2) {
      _logErrorSMTP(e2, c.id, destinatario, 'cotización · intento 2 — definitivo');
      throw new Error('SMTP Hostinger rechazó el envío: ' + (e2.response || e2.message || 'fallo desconocido'));
    }
    console.log('Cotización ' + c.id + ' enviada por SMTP a ' + destinatario);
    return { enviado: true, email: destinatario };
  }

  if (!process.env.RESEND_API_KEY) {
    console.log('Cotización ' + c.id + ' SIN enviar: faltan EMAIL_SERVER_* (SMTP) y RESEND_API_KEY.');
    return { enviado: false, motivo: 'sin-api-key' };
  }
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
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
  console.log('Cotización ' + c.id + ' enviada por correo a ' + destinatario);
  return { enviado: true, email: destinatario };
}

module.exports = { buildCotizEmailHtml, enviarCotizacionPorCorreo, personasCotizacion };
