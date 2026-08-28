const { getSupabaseAdmin } = require('./_lib/supabaseAdmin');

// GET /api/recibo?f=recibos/1784...._recibo-PROS-030-1.html → página del recibo
// GET /api/recibo?f=cotizaciones/1784...._cotizacion-COT-004.html → cotización
//
// Los recibos y cotizaciones se publican como HTML en el bucket
// comprobantes_pagos, pero Supabase Storage sirve los .html con Content-Type
// text/plain (medida anti-phishing de su dominio), así que el cliente veía el
// código fuente en vez del documento. Este endpoint los sirve desde NUESTRO
// dominio con el tipo correcto: el enlace de WhatsApp abre el documento
// renderizado, sin login.
module.exports = async (req, res) => {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Método no permitido' }); return; }

  const f = String(req.query.f || '');
  // Solo archivos de las carpetas recibos/ y cotizaciones/ del bucket: nunca
  // servir otro contenido arbitrario del storage a través de este proxy.
  if (!/^(recibos|cotizaciones)\/[A-Za-z0-9._-]+\.html$/.test(f)) {
    res.status(400).send('Recibo no válido.');
    return;
  }

  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.storage.from('comprobantes_pagos').download(f);
    if (error || !data) { res.status(404).send('Recibo no encontrado.'); return; }
    const html = await data.text();

    // Los recibos son inmutables (cada reenvío reutiliza el mismo archivo):
    // caché larga en el CDN para no golpear Storage en cada apertura.
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    res.status(200).send(html);
  } catch (err) {
    console.error('recibo error:', err);
    res.status(500).send('No se pudo cargar el recibo. Intenta de nuevo.');
  }
};
