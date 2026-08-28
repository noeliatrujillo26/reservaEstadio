const { getSupabaseAdmin } = require('./_lib/supabaseAdmin');
const { enviarReciboPorCorreo } = require('./_lib/reciboEmail');

// Correo de confirmación de reserva, disparado en segundo plano por la landing
// justo después de confirmar el pago (función 6 de 12 del plan Hobby).
//
// POST /api/send-reservation-email  { folio, email }
//
// Seguridad y comportamiento:
//  - Solo envía si el correo coincide con el de la reserva (mismo modelo
//    folio+email del portal): nadie puede usar el endpoint para spamear.
//  - Candado de envío único compartido con el webhook de Stripe (claveUnica =
//    id de la sesión de checkout): el cliente recibe UN correo, no dos.
//  - Un fallo aquí NUNCA revierte la reserva: responde 200 con enviado:false
//    y deja el detalle en los logs del servidor.

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido' }); return; }
  try {
    const body = req.body || {};
    const folio = String(body.folio || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    if (!folio || !email) { res.status(400).json({ error: 'Faltan folio o correo.' }); return; }

    const sb = getSupabaseAdmin();
    const { data: reserva, error } = await sb.from('reservas').select('*').eq('id', folio).maybeSingle();
    if (error) throw error;
    if (!reserva) { res.status(404).json({ error: 'Reserva no encontrada.' }); return; }
    if (String(reserva.email || '').trim().toLowerCase() !== email) {
      res.status(403).json({ error: 'El correo no coincide con la reserva.' }); return;
    }

    const totalNeto = Number(reserva.monto) - Number(reserva.descuento_monto || 0);
    const pagado = Number(reserva.monto_pagado || 0);

    // Modo MANUAL (botón "Enviar Reserva" del panel): SIEMPRE envía (sin el
    // candado de envío único) e incluye el historial de abonos de la reserva.
    const esReenvio = body.reenvio === true;
    let historialPagos;
    if (esReenvio) {
      const { data: cobrosRes, error: cobrosErr } = await sb.from('cobros')
        .select('fecha, concepto, forma_pago, monto, estado').eq('folio', String(reserva.id));
      if (cobrosErr) console.error('No se pudo leer el historial de cobros (el correo va sin historial):', cobrosErr);
      historialPagos = (cobrosRes || [])
        .filter(c => String(c.estado || '').toLowerCase() !== 'cancelado')
        .map(c => ({ fecha: c.fecha, concepto: c.concepto, forma: c.forma_pago, monto: c.monto }));
    }

    const resultado = await enviarReciboPorCorreo(sb, reserva, {
      montoRecibido: pagado,
      nuevoMontoPagado: pagado,
      totalNeto,
      paymentIntent: reserva.stripe_payment_intent || reserva.stripe_checkout_id || '',
      esReenvio,
      historialPagos,
    }, esReenvio ? {} : { claveUnica: reserva.stripe_checkout_id || ('folio-' + reserva.id) });

    res.status(200).json({ enviado: !!resultado.enviado, motivo: resultado.motivo || null });
  } catch (e) {
    // La reserva NUNCA se revierte por un fallo de correo. El detalle SMTP
    // (code/command/response) ya quedó en los logs vía _logErrorSMTP; aquí se
    // agrega el contexto del endpoint y se devuelve el mensaje legible (la
    // landing lo ignora — dispara en segundo plano — pero sirve al depurar).
    console.error('Error detallado de SMTP Hostinger (send-reservation-email):', {
      message: e && e.message, code: e && e.code,
      command: e && e.command, response: e && e.response,
    });
    res.status(500).json({ error: (e && e.message) || 'No se pudo enviar el correo.' });
  }
};
