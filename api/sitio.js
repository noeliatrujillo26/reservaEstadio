const { getSupabaseAdmin } = require('./_lib/supabaseAdmin');

// GET /api/sitio?r=<recurso> — datos públicos de solo lectura para la landing.
//
// Consolida en una sola función serverless (límite de 12 del plan Hobby de
// Vercel) los endpoints que antes vivían por separado:
//   ?r=mapa                  ← api/mapa.js
//   ?r=juegos                ← api/juegos.js
//   ?r=politica-pagos        ← api/politica-pagos.js
//   ?r=banner-promo          ← api/banner-promo.js
//   ?r=zona-estados&juegoId= ← api/zona-estados.js
//   ?r=disponibilidad-juegos ← api/disponibilidad-juegos.js
//
// La lógica, validaciones, cachés y comportamientos fail-open de cada uno se
// conservan idénticos. El CDN de Vercel cachea por URL completa (query
// incluido), así que cada recurso mantiene su propia caché.

// Entrega el mapa del estadio (pines, nombres, precios y mínimos) desde la
// tabla `mapa_secciones` para la página pública de reservas.
async function mapa(_sb, req, res) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('mapa_secciones').select('*').order('orden');
  if (error) throw error;

  // Misma forma que usan el editor y panel-inicio (name/min en camel corto).
  const secciones = (data || []).map(s => ({
    id: s.id,
    name: s.nombre || '',
    num: s.num || '',
    x: Number(s.x) || 0,
    y: Number(s.y) || 0,
    r: Number(s.r) || 4.5,
    color: s.color || '#2563eb',
    cap: s.cap != null ? Number(s.cap) : null,
    min: s.min_personas != null ? Number(s.min_personas) : null,
    // Personas incluidas en el bloque JUE-SÁB (min_personas2). Sin este campo
    // la landing no tenía forma de saberlo y aplicaba el mínimo DOM-MIÉ todos
    // los días, dejando sin efecto lo capturado en Administrar Precios.
    min2: s.min_personas2 != null ? Number(s.min_personas2) : null,
    precio: s.precio != null ? Number(s.precio) : null,
    precio2: s.precio2 != null ? Number(s.precio2) : null,
    precioExtra: s.precio_extra != null ? Number(s.precio_extra) : null,
    precioExtra2: s.precio_extra2 != null ? Number(s.precio_extra2) : null,
    precioNino: s.precio_nino != null ? Number(s.precio_nino) : null,
    precioNino2: s.precio_nino2 != null ? Number(s.precio_nino2) : null,
    descripcion: s.descripcion || '',
    // Resumen corto para la tarjeta de zona de la Landing (columna
    // short_description; null hasta que corra migracion-descripcion-corta.sql).
    shortDescription: s.short_description || '',
    // Imágenes de la zona (mapa_secciones.img/img2, Storage público): la
    // página pública las toma de AQUÍ — el localStorage del navegador del
    // admin dejó de ser el único canal (otros visitantes no lo tienen).
    img: s.img || null,
    img2: s.img2 || null,
  }));

  // El mapa cambia poco: 60s de caché en el CDN de Vercel alivia el tráfico.
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  res.status(200).json({ secciones });
}

// Calendario real de juegos para el sitio público (tabla `juegos`).
async function juegos(_sb, req, res) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('juegos').select('*').order('fecha');
  if (error) throw error;
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  res.status(200).json({ juegos: data || [] });
}

// Política de enganche vigente (tabla `politica_pagos`, fila única id=1).
// Fail-open: si la tabla no existe o falla la consulta, el checkout sigue
// funcionando con el mínimo histórico de 30%.
async function politicaPagos(_sb, req, res) {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from('politica_pagos').select('*').eq('id', 1).maybeSingle();
    if (error) throw error;
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json({
      enganche_minimo: data?.enganche_minimo != null ? Number(data.enganche_minimo) : 30,
      dias_limite_liquidar: data?.dias_limite_liquidar != null ? Number(data.dias_limite_liquidar) : 1,
    });
  } catch (err) {
    console.error('sitio/politica-pagos error:', err);
    res.status(200).json({ enganche_minimo: 30, dias_limite_liquidar: 1 });
  }
}

// Banner de promoción del checkout (tabla `configuracion_landing`, fila id=1).
// Fail-open: si falla, el banner simplemente no se muestra.
async function bannerPromo(_sb, req, res) {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from('configuracion_landing').select('*').eq('id', 1).maybeSingle();
    if (error) throw error;
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    res.status(200).json({
      activo: !!(data && data.banner_activo),
      texto: (data && data.banner_texto) || '',
      color: (data && data.banner_color) || '#e63946',
      enlace: (data && data.banner_enlace) || '',
      // Mensaje del botón "Cotiza aquí" (editable en Admin → Mensajes);
      // vacío → la landing usa su texto de respaldo.
      cotizaMsg: (data && data.whatsapp_quote_message) || '',
    });
  } catch (err) {
    console.error('sitio/banner-promo error:', err);
    res.status(200).json({ activo: false, texto: '', color: '#e63946', enlace: '', cotizaMsg: '' });
  }
}

// Banner de Promociones del hero ("¡Ahorra en grande!"), editable desde
// Admin → Landing (columnas promo_strip_* de configuracion_landing).
// Fail-open con activo:true y campos null: la landing conserva sus textos
// por defecto (los del HTML estático) si la migración no ha corrido o falla
// la consulta — el banner nunca desaparece por un error técnico.
async function promoStrip(_sb, req, res) {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from('configuracion_landing').select('*').eq('id', 1).maybeSingle();
    if (error) throw error;
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    res.status(200).json({
      activo: data && data.promo_strip_enabled != null ? !!data.promo_strip_enabled : true,
      titulo: (data && data.promo_strip_titulo) || '',
      subtitulo: (data && data.promo_strip_subtitulo) || '',
      btnTexto: (data && data.promo_strip_btn_texto) || '',
      btnUrl: (data && data.promo_strip_btn_url) || '',
      cards: (data && Array.isArray(data.promo_strip_cards)) ? data.promo_strip_cards : null,
    });
  } catch (err) {
    console.error('sitio/promo-strip error:', err);
    res.status(200).json({ activo: true, titulo: '', subtitulo: '', btnTexto: '', btnUrl: '', cards: null });
  }
}

// Preguntas Frecuentes de la landing (columna `faq` de configuracion_landing,
// editable desde Admin → Landing). Fail-open con faq:null: la landing conserva
// las preguntas del HTML estático si la migración no ha corrido o falla la
// consulta — la sección nunca queda vacía por un error técnico.
async function faq(_sb, req, res) {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from('configuracion_landing').select('faq').eq('id', 1).maybeSingle();
    if (error) throw error;
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json({
      faq: (data && Array.isArray(data.faq) && data.faq.length) ? data.faq : null,
    });
  } catch (err) {
    console.error('sitio/faq error:', err);
    res.status(200).json({ faq: null });
  }
}

// Carrusel de fotos del hero (tabla `carousel_slides`, gestionada desde
// Admin → Landing). Fail-open con slides:null: la landing conserva el hero
// estático si la migración no ha corrido o la consulta falla.
async function carrusel(_sb, req, res) {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from('carousel_slides')
      .select('id, image_url, title, order_index')
      .eq('is_active', true)
      .order('order_index');
    if (error) throw error;
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json({ slides: (data && data.length) ? data : null });
  } catch (err) {
    console.error('sitio/carrusel error:', err);
    res.status(200).json({ slides: null });
  }
}

// Estado de bloqueo/reserva por zona para un juego (tabla `zona_juego_estado`).
// Fail-open: sin datos, el mapa no pinta el gris pero sigue funcionando.
async function zonaEstados(_sb, req, res) {
  const juegoId = String(req.query.juegoId || '').trim();
  if (!juegoId) { res.status(200).json({}); return; }
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from('zona_juego_estado').select('zona_id, estado').eq('juego_id', juegoId);
    if (error) throw error;
    const estados = {};
    (data || []).forEach(row => { estados[row.zona_id] = row.estado; });

    // EL HOLD DEL CHECKOUT NO SE PINTA. Mientras alguien está pagando, la
    // reserva 'Pendiente' bloquea la zona en el SERVIDOR (_zonaLibre y
    // _liberarPendienteAbandonada en api/checkout.js impiden que dos personas
    // paguen el mismo asador), pero el mapa la sigue mostrando libre: solo un
    // pago confirmado la ocupa de cara al público.
    //
    // Es una decisión de producto, no un olvido: se probó a pintarla ocupada y
    // se revirtió a propósito. La contrapartida conocida es que un segundo
    // cliente puede llegar hasta el checkout y encontrarse el rechazo de
    // disponibilidad — nunca un cobro duplicado, que es lo que se protege.

    // ── PALCOS COMPARTIDOS: manda la capacidad, no el estado guardado ──
    // Un palco no se ocupa con una reserva: se llena por lugares. El estado
    // 'reservada' de zona_juego_estado no sirve aquí —seria un dato aparte que
    // puede desfasarse—, asi que la ocupacion se SUMA de las reservas activas,
    // igual que hace el candado de api/checkout.js. Mismo criterio en los dos
    // sitios: si difirieran, el mapa ofreceria lugares que el checkout rechaza.
    //
    // Se manda ademas el desglose (capacidad/ocupados/libres) para que la
    // pagina pueda decir "quedan 12 lugares" en vez de solo pintar gris.
    let palcos = {};
    let motivoPalcos = null;
    try {
      // Se lee la VISTA palcos_ocupacion, no se recalcula aquí. La vista la
      // define la propia migración con la fórmula oficial (suma de reservas
      // activas por zona y juego), así que el mapa no puede discrepar de ella
      // por una diferencia de criterio. Antes esto repetía el cálculo a mano y
      // un fallo silencioso dejaba la respuesta sin `_palcos` sin decir por qué.
      const { data: ocup, error: eOcup } = await sb.from('palcos_ocupacion')
        .select('zona_id, capacidad_maxima, lugares_reservados, lugares_disponibles, agotado')
        .eq('juego_id', juegoId);
      // El error se MIRA. Ignorarlo fue lo que hizo invisible el problema.
      if (eOcup) throw eOcup;
      (ocup || []).forEach(o => {
        palcos[o.zona_id] = {
          capacidad: Number(o.capacidad_maxima) || 0,
          ocupados: Number(o.lugares_reservados) || 0,
          libres: Number(o.lugares_disponibles) || 0,
          agotado: !!o.agotado,
        };
        // Un bloqueo MANUAL del admin se respeta; el resto lo decide la
        // capacidad. Un palco con lugares libres NO debe salir gris solo
        // porque alguien ya reservó en él: ese es justamente el punto.
        if (String(estados[o.zona_id] || '').toLowerCase() !== 'bloqueada') {
          estados[o.zona_id] = palcos[o.zona_id].agotado ? 'reservada' : 'libre';
        }
      });
    } catch (ePalco) {
      // Sin la migración la vista no existe: se sigue como hasta ahora (zona
      // exclusiva). Fail-open, igual que el resto de este endpoint.
      //
      // El motivo viaja en la respuesta (_palcosError) además de a la consola:
      // desde fuera no hay forma de leer los logs de la función, y sin esto un
      // fallo aquí es indistinguible de "no hay palcos configurados".
      console.warn('Ocupacion de palcos no disponible (¿falta migracion-palcos-compartidos.sql?):', ePalco && (ePalco.message || ePalco));
      palcos = {};
      motivoPalcos = String((ePalco && (ePalco.message || ePalco.hint || ePalco.code)) || ePalco || 'desconocido');
    }

    // Disponibilidad cambia con cada reserva: caché corta.
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=10');
    const salida = Object.keys(palcos).length ? { ...estados, _palcos: palcos } : { ...estados };
    if (motivoPalcos) salida._palcosError = motivoPalcos;
    res.status(200).json(salida);
  } catch (err) {
    console.error('sitio/zona-estados error:', err);
    res.status(200).json({});
  }
}

// Disponibilidad agregada por juego para las tarjetas de "Próximos juegos".
// Fail-open: sin datos, las tarjetas caen al badge por defecto.
async function disponibilidadJuegos(_sb, req, res) {
  try {
    const sb = getSupabaseAdmin();
    const [totalRes, estadosRes] = await Promise.all([
      sb.from('mapa_secciones').select('id', { count: 'exact', head: true }),
      sb.from('zona_juego_estado').select('juego_id, estado').in('estado', ['bloqueada', 'reservada']),
    ]);
    if (totalRes.error) throw totalRes.error;
    if (estadosRes.error) throw estadosRes.error;
    const ocupadasPorJuego = {};
    (estadosRes.data || []).forEach(row => {
      ocupadasPorJuego[row.juego_id] = (ocupadasPorJuego[row.juego_id] || 0) + 1;
    });
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    res.status(200).json({ totalZonas: totalRes.count || 0, ocupadasPorJuego });
  } catch (err) {
    console.error('sitio/disponibilidad-juegos error:', err);
    res.status(200).json({ totalZonas: 0, ocupadasPorJuego: {} });
  }
}

// Plantilla del mensaje de WhatsApp del programa de referidos (editable en
// Admin → Mensajes; columna referral_whatsapp_message). Fail-open con
// mensaje:null — el portal usa su plantilla por defecto.
async function msgReferidos(_sb, req, res) {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from('configuracion_landing')
      .select('referral_whatsapp_message').eq('id', 1).maybeSingle();
    if (error) throw error;
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json({ mensaje: (data && data.referral_whatsapp_message) || null });
  } catch (err) {
    console.error('sitio/msg-referidos error:', err);
    res.status(200).json({ mensaje: null });
  }
}

// Reglas ACTIVAS de descuento por volumen (cantidad de personas) para que el
// checkout de la landing muestre el mismo desglose que cobrará el servidor.
// Fail-open con reglas:[] — sin reglas simplemente no hay descuento visible.
async function descuentosVolumen(_sb, req, res) {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from('descuentos_volumen')
      .select('nombre, min_personas, porcentaje, juegos, zonas, activo').eq('activo', true);
    if (error) throw error;
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json({ reglas: data || [] });
  } catch (err) {
    console.error('sitio/descuentos-volumen error:', err.message);
    res.status(200).json({ reglas: [] });
  }
}

const RECURSOS = {
  'mapa': mapa,
  'msg-referidos': msgReferidos,
  'descuentos-volumen': descuentosVolumen,
  'juegos': juegos,
  'politica-pagos': politicaPagos,
  'banner-promo': bannerPromo,
  'promo-strip': promoStrip,
  'faq': faq,
  'carrusel': carrusel,
  'zona-estados': zonaEstados,
  'disponibilidad-juegos': disponibilidadJuegos,
};

module.exports = async (req, res) => {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Método no permitido' }); return; }

  const handler = RECURSOS[String(req.query.r || '')];
  if (!handler) { res.status(400).json({ error: 'Recurso no válido' }); return; }

  try {
    // Cada recurso crea su propio cliente DENTRO de su try: así los que son
    // fail-open (política, banner, estados, disponibilidad) conservan su
    // respuesta de respaldo aunque falle la conexión con Supabase.
    await handler(null, req, res);
  } catch (err) {
    // Solo llegan aquí los recursos SIN fail-open propio (mapa y juegos),
    // que ya respondían 500 ante errores — mismo comportamiento que antes.
    console.error('sitio error (' + req.query.r + '):', err);
    res.status(500).json({ error: 'No se pudo cargar la información.' });
  }
};
