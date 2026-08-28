const { getSupabaseAdmin } = require('./_lib/supabaseAdmin');
const { enviarCotizacionPorCorreo } = require('./_lib/cotizacionEmail');
const { SITE_URL } = require('./_lib/reciboEmail');

// Correo de cotización, disparado desde el panel admin (tabla Cotizaciones y
// ficha del prospecto en Pipeline). Función 7 de 12 del plan Hobby.
//
// POST /api/send-quotation-email  { cotizId, ligaPdf? }
//
// Seguridad y comportamiento:
//  - El destinatario SIEMPRE es el correo guardado en la cotización (nunca
//    uno arbitrario del request): el endpoint no sirve para spamear.
//  - ligaPdf solo se incluye si apunta a nuestro propio proxy de recibos
//    (/api/recibo?f=cotizaciones/...): nadie puede inyectar enlaces ajenos.
//  - Sin candado de envío único: reenviar cotizaciones es parte del flujo.
//  - Errores → 500 con mensaje legible; el detalle SMTP queda en los logs.

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido' }); return; }
  try {
    const body = req.body || {};
    const cotizId = String(body.cotizId || '').trim();
    if (!cotizId) { res.status(400).json({ error: 'Falta el id de la cotización.' }); return; }

    const sb = getSupabaseAdmin();
    const { data: cotiz, error } = await sb.from('cotizaciones').select('*').eq('id', cotizId).maybeSingle();
    if (error) throw error;
    if (!cotiz) { res.status(404).json({ error: 'Cotización no encontrada.' }); return; }
    if (!String(cotiz.email || '').trim()) {
      res.status(400).json({ error: 'La cotización no tiene correo registrado. Edítala y agrega el correo del cliente.' });
      return;
    }

    const ligaPdf = (typeof body.ligaPdf === 'string' && body.ligaPdf.indexOf(SITE_URL + '/api/recibo?f=cotizaciones') === 0)
      ? body.ligaPdf : null;

    const resultado = await enviarCotizacionPorCorreo(cotiz, ligaPdf);
    if (!resultado.enviado) {
      res.status(500).json({ error: resultado.motivo === 'sin-api-key' ? 'El servicio de correo no está configurado.' : 'No se pudo enviar la cotización.' });
      return;
    }
    res.status(200).json({ enviado: true, email: resultado.email });
  } catch (e) {
    console.error('Error detallado al enviar cotización por correo:', {
      message: e && e.message, code: e && e.code,
      command: e && e.command, response: e && e.response,
    });
    res.status(500).json({ error: (e && e.message) || 'No se pudo enviar la cotización.' });
  }
};
