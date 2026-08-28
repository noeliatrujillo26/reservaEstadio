const Stripe = require('stripe');
const { getSupabaseAdmin } = require('./_lib/supabaseAdmin');
const { calcularTotales, validarCupon, descuentoVolumen } = require('./_lib/descuentos');
const { ligaRecibo, enviarReciboPorCorreo } = require('./_lib/reciboEmail');
const { verificarTurnstile } = require('./_lib/turnstile');
const { esCobroCredito, redondearDinero, aCentavos } = require('./_lib/dinero');

// Stripe se instancia al primer uso, no al cargar el módulo: si la llave
// faltara, validar-cupon (que no usa Stripe) seguiría funcionando.
let _stripe;
function getStripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}

// Flujo de cobro con Stripe, consolidado en una sola función serverless
// (límite de 12 del plan Hobby de Vercel). Antes eran tres archivos:
//   POST /api/checkout                                  ← api/create-checkout-session.js
//   GET  /api/checkout?action=confirmar-sesion&session_id= ← api/confirmar-sesion.js
//   GET  /api/checkout?action=validar-cupon&codigo=&juegoId= ← api/validar-cupon.js
// El webhook de Stripe (stripe-webhook.js) NO se toca: su URL está registrada
// en el dashboard de Stripe.

// Folio con distintivo de ORIGEN: 'web' (default, checkout en línea) →
// NRJ-WEB-XXXXX · 'admin' → NRJ-ADM-XXXXX (misma regla que el panel en
// utils.js). Alfanumérico sin 0/O/1/I/L para dictarse por teléfono. Los
// folios históricos NRJ-XXXXXXXX siguen siendo válidos tal cual.
function generarFolio(origen) {
  const pref = 'NRJ-' + (origen === 'admin' ? 'ADM' : 'WEB') + '-';
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let cod = '';
  for (let i = 0; i < 5; i++) cod += abc[Math.floor(Math.random() * abc.length)];
  return pref + cod;
}

function origenDesdeRequest(req) {
  return req.headers.origin || 'https://' + req.headers.host;
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Candado anti-sobreventa ────────────────────────────────────────────
// Una sección está disponible para un juego solo si (a) su estado en
// zona_juego_estado no es 'reservada'/'bloqueada' y (b) no existe ya una
// reserva activa (no cancelada) para esa llave compuesta — el cinturón (b)
// cubre reservas cuyo registro de estado no se haya escrito.
// Configuracion de la zona: si es palco compartido y con cuantos lugares.
// Tolerante a propósito: si la tabla o las columnas no estan (migracion
// pendiente), devuelve null y TODO sigue funcionando como zona exclusiva. Asi
// este codigo se puede desplegar antes de correr migracion-palcos-compartidos.sql
// sin cambiar el comportamiento de nada.
async function _configZona(sb, zonaId) {
  try {
    const { data, error } = await sb.from('mapa_secciones')
      .select('id, cap, es_compartida, capacidad_maxima').eq('id', zonaId).maybeSingle();
    if (error || !data) return null;
    if (!data.es_compartida) return null;
    return {
      compartida: true,
      capacidad: Number(data.capacidad_maxima) || Number(data.cap) || 0,
    };
  } catch (e) {
    console.warn('No se pudo leer la configuracion de la zona ' + zonaId + ':', e && e.message);
    return null;
  }
}

// Lugares ya tomados en un palco para un juego. Se SUMAN de las reservas
// activas en vez de leerse de un contador: un contador hay que decrementarlo
// en cada cancelacion, borrado y edicion, y olvidar uno solo deja lugares
// fantasma que nadie puede vender. Sumando no hay nada que recordar.
//
// Una reserva de palco sin `lugares` cuenta 1, que es lo prudente: contarla 0
// la volveria invisible y abriria la puerta a la sobreventa.
async function _lugaresOcupados(sb, juegoId, zonaId) {
  const { data, error } = await sb.from('reservas').select('lugares')
    .eq('juego_id', juegoId).eq('zona_id', zonaId).neq('estado', 'Cancelada');
  if (error) throw error;
  return (data || []).reduce(function (t, r) { return t + (Number(r.lugares) || 1); }, 0);
}

async function zonaDisponible(sb, juegoId, zonaId, lugaresPedidos) {
  if (!juegoId || !zonaId) return { disponible: true }; // sin llave no hay candado (compat)
  const { data: estadoRow, error: e1 } = await sb.from('zona_juego_estado')
    .select('estado').eq('juego_id', juegoId).eq('zona_id', zonaId).maybeSingle();
  if (e1) throw e1;
  const estado = String((estadoRow && estadoRow.estado) || 'libre').toLowerCase();

  const cfg = await _configZona(sb, zonaId);

  // ── PALCO COMPARTIDO: manda la capacidad, no la existencia de reservas ──
  if (cfg && cfg.compartida) {
    // Un bloqueo MANUAL del admin sigue mandando sobre todo lo demas: es la
    // forma de sacar un palco de la venta (mantenimiento, evento privado).
    // 'reservada', en cambio, se ignora a proposito: en un palco ese estado
    // es solo el reflejo de estar lleno, y lo que decide si esta lleno es la
    // suma de lugares. Confiar en el estado guardado seria volver a depender
    // de un dato que puede quedar desfasado.
    if (estado === 'bloqueada') return { disponible: false, motivo: 'bloqueada' };

    const ocupados = await _lugaresOcupados(sb, juegoId, zonaId);
    const piden = Math.max(1, Number(lugaresPedidos) || 1);
    const libres = Math.max(0, cfg.capacidad - ocupados);
    if (ocupados + piden > cfg.capacidad) {
      return {
        disponible: false,
        motivo: libres === 0 ? 'palco-agotado' : 'sin-lugares',
        compartida: true, capacidad: cfg.capacidad, ocupados: ocupados, libres: libres,
      };
    }
    return {
      disponible: true, compartida: true,
      capacidad: cfg.capacidad, ocupados: ocupados, libres: libres,
    };
  }

  // ── ZONA EXCLUSIVA: como siempre, una reserva la ocupa entera ──
  if (estado === 'reservada' || estado === 'bloqueada') {
    return { disponible: false, motivo: estado };
  }
  const { data: activas, error: e2 } = await sb.from('reservas').select('id')
    .eq('juego_id', juegoId).eq('zona_id', zonaId).neq('estado', 'Cancelada').limit(1);
  if (e2) throw e2;
  if (activas && activas.length) return { disponible: false, motivo: 'reserva-activa' };
  return { disponible: true };
}

// Un checkout ABANDONADO (cerró la pestaña de Stripe sin pagar) deja una
// reserva Pendiente que bloquea nuevos intentos hasta que la sesión expira
// (30 min, el mínimo de Stripe). Esta rutina elimina esa espera SIN abrir la
// puerta al doble pago: la reserva Pendiente sin un centavo pagado se cancela
// y su sesión de Stripe se EXPIRA vía API (nadie puede pagarla después) si:
//   · es del MISMO cliente que reintenta (email igual) → inmediato, o
//   · su sesión lleva más de 10 min creada (gracia de sobra para terminar
//     de teclear una tarjeta) → cualquier cliente puede tomar la zona.
// Con la sesión vieja aún "fresca" y de otra persona, se respeta: está pagando.
// ── ALTA DEL CLIENTE AL INICIAR EL CHECKOUT ──────────────────────────
// Upsert por IDENTIDAD: nombre + teléfono, la misma regla del panel desde
// 43c025f. El correo NO identifica —varios titulares comparten el corporativo
// contratacionesnaranjeros@gmail.com—, así que buscar por él fusionaría a
// personas distintas en una sola ficha.
//
// A un cliente que ya existe solo se le COMPLETAN los huecos: si el panel
// tiene su nombre bien escrito o su empresa, un checkout posterior no debe
// pisarlos con lo que se tecleó de prisa en el formulario público.
function _telNormSrv(t) { return String(t || '').replace(/\D/g, '').slice(-10); }

async function _registrarClienteContacto(sb, datos) {
  try {
    const tel = _telNormSrv(datos && datos.tel);
    const nombre = String((datos && datos.nombre) || '').trim();
    const email = String((datos && datos.email) || '').trim();
    if (!nombre && !tel) return { ok: false, motivo: 'sin-identidad' };

    // Se comparan los últimos 10 dígitos en memoria: en la base los teléfonos
    // conviven con lada, espacios y guiones, así que un .eq('tel', …) fallaría
    // contra el mismo número escrito de otra forma.
    const { data: existentes, error: eSel } = await sb
      .from('clientes').select('id, nombre, email, tel, empresa');
    if (eSel) throw eSel;

    const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toUpperCase().replace(/\s+/g, ' ').trim();
    const yo = (existentes || []).find((c) => {
      const tc = _telNormSrv(c.tel);
      if (!tc || !tel || tc !== tel) return false;
      const nc = norm(c.nombre), nn = norm(nombre);
      return !nc || !nn || nc === nn;
    });

    if (yo) {
      // Solo lo que falte: nunca se pisa un dato ya capturado en el panel.
      const parche = {};
      if (!String(yo.email || '').trim() && email) parche.email = email;
      if (!String(yo.nombre || '').trim() && nombre) parche.nombre = nombre;
      if (!_telNormSrv(yo.tel) && tel) parche.tel = tel;
      if (!Object.keys(parche).length) return { ok: true, accion: 'sin-cambios', id: yo.id };
      const { error } = await sb.from('clientes').update(parche).eq('id', yo.id);
      if (error) throw error;
      return { ok: true, accion: 'completado', id: yo.id };
    }

    const fila = { nombre: nombre || '—', email, tel: datos.tel || '' };
    let { error } = await sb.from('clientes').insert(fila);
    // Compat con columnas opcionales que puedan no existir todavía.
    if (error && /column/i.test(error.message || '')) {
      ({ error } = await sb.from('clientes').insert({ nombre: fila.nombre, email: fila.email, tel: fila.tel }));
    }
    if (error) throw error;
    return { ok: true, accion: 'creado' };
  } catch (e) {
    // Un contacto no registrado no puede tumbar un cobro.
    console.error('Alta de cliente en checkout falló (el pago sigue):', e.message || e);
    return { ok: false, motivo: 'error' };
  }
}

const _GRACIA_PAGO_SEG = 10 * 60;
async function _liberarPendienteAbandonada(sb, juegoId, zonaId, emailCliente) {
  const { data: activas, error } = await sb.from('reservas')
    .select('id, email, estado, estado_pago, monto_pagado, stripe_checkout_id')
    .eq('juego_id', juegoId).eq('zona_id', zonaId).neq('estado', 'Cancelada');
  if (error || !activas || !activas.length) return { ok: false };
  // Cualquier pago registrado (total o parcial) manda: la zona está tomada.
  if (activas.some(r => Number(r.monto_pagado || 0) > 0
      || String(r.estado_pago || '') !== 'pendiente' || String(r.estado || '') !== 'Pendiente')) {
    return { ok: false };
  }
  const emailNuevo = String(emailCliente || '').trim().toLowerCase();
  for (const r of activas) {
    const mismoCliente = String(r.email || '').trim().toLowerCase() === emailNuevo && emailNuevo !== '';
    let sesion = null;
    if (r.stripe_checkout_id) {
      try { sesion = await getStripe().checkout.sessions.retrieve(r.stripe_checkout_id); } catch (e) {}
    }
    // Si Stripe dice que YA se pagó (webhook en camino), la zona no se toca.
    if (sesion && sesion.payment_status === 'paid') return { ok: false };
    let elegible = mismoCliente;
    if (!elegible && sesion) elegible = (Date.now() / 1000 - Number(sesion.created || 0)) > _GRACIA_PAGO_SEG;
    if (!elegible && !sesion) elegible = true; // sin sesión de pago: fila huérfana
    if (!elegible) return { ok: false, enPago: true };
    if (sesion && sesion.status === 'open') {
      // Expirar la sesión ANTES de cancelar: si Stripe no la deja matar
      // (p. ej. se completó en este instante), no se arriesga la zona.
      try { await getStripe().checkout.sessions.expire(r.stripe_checkout_id); }
      catch (e) { return { ok: false, enPago: true }; }
    }
    const { error: eCancel } = await sb.from('reservas')
      .update({ estado: 'Cancelada' }).eq('id', r.id).eq('estado_pago', 'pendiente');
    if (eCancel) return { ok: false };
    console.log('Checkout abandonado liberado: reserva ' + r.id + ' cancelada ('
      + (mismoCliente ? 'reintento del mismo cliente' : 'gracia de pago vencida') + ')');
  }
  return { ok: true };
}

// GET ?action=cancelar-pendiente&session_id=cs_... — botón "←" de Stripe: el
// cliente regresó SIN pagar, así que su reserva Pendiente se cancela y la
// sesión se expira al instante — la zona queda libre para reintentar de
// inmediato (sin esto había que esperar los 30 min de expiración de Stripe).
// Seguridad: solo quien tiene el session_id (viaja en SU URL de regreso)
// puede cancelarla, y una sesión ya pagada JAMÁS se toca.
async function accionCancelarPendiente(req, res) {
  try {
    const sessionId = String(req.query.session_id || '').trim();
    if (!sessionId) { res.status(400).json({ error: 'Falta session_id.' }); return; }
    let sesion;
    try { sesion = await getStripe().checkout.sessions.retrieve(sessionId); }
    catch (e) { res.status(404).json({ error: 'Sesión no encontrada.' }); return; }
    if (sesion.payment_status === 'paid') { res.status(200).json({ cancelada: false, motivo: 'pagada' }); return; }
    if (sesion.status === 'open') {
      try { await getStripe().checkout.sessions.expire(sessionId); }
      catch (e) { res.status(200).json({ cancelada: false, motivo: 'no-expirable' }); return; }
    }
    const reservaId = sesion.metadata && sesion.metadata.reserva_id;
    if (reservaId) {
      const sb = getSupabaseAdmin();
      await sb.from('reservas').update({ estado: 'Cancelada' })
        .eq('id', reservaId).eq('estado_pago', 'pendiente');
      console.log('Checkout cancelado por el cliente: reserva ' + reservaId + ' liberada al instante.');
    }
    res.status(200).json({ cancelada: true });
  } catch (err) {
    console.error('checkout/cancelar-pendiente error:', err);
    res.status(500).json({ error: 'No se pudo cancelar.' });
  }
}

// GET ?action=validar-cupon — validación "en vivo" mientras el cliente escribe
// el código en el paso 2. La validación definitiva vuelve a correr al crear la
// sesión de pago; esto es solo feedback inmediato del formulario.
async function accionValidarCupon(req, res) {
  try {
    const { codigo, juegoId } = req.query;
    const resultado = await validarCupon(codigo, juegoId);
    res.status(200).json(resultado);
  } catch (err) {
    console.error('checkout/validar-cupon error:', err);
    res.status(500).json({ valido: false, mensaje: 'Error validando el código.' });
  }
}

// GET ?action=confirmar-sesion — la pantalla de éxito llama esto al volver de
// Stripe. La fuente de verdad para estado_pago/monto_pagado sigue siendo el
// webhook; aquí solo leemos lo que ya haya en Supabase, con un pequeño
// reintento por si el webhook todavía no ha llegado.
async function accionConfirmarSesion(req, res) {
  const sessionId = req.query.session_id;
  if (!sessionId) { res.status(400).json({ error: 'Falta session_id' }); return; }

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const sb = getSupabaseAdmin();

    let reserva = null;
    for (let intento = 0; intento < 4; intento++) {
      const { data } = await sb.from('reservas').select('*').eq('stripe_checkout_id', sessionId).maybeSingle();
      reserva = data;
      if (reserva && (reserva.estado_pago === 'pagado' || reserva.estado_pago === 'parcial')) break;
      if (session.payment_status !== 'paid') break; // Stripe no confirma pago; no tiene caso esperar
      await esperar(1000); // dale tiempo al webhook de aplicarse
    }

    if (!reserva) { res.status(404).json({ error: 'No encontramos tu reserva.' }); return; }

    // Enlace estable al recibo publicado por el webhook (misma ruta
    // determinista): la pantalla de éxito lo usa para el botón de WhatsApp.
    res.status(200).json({ reserva, ligaRecibo: ligaRecibo(reserva.id, session.payment_intent) });
  } catch (err) {
    console.error('checkout/confirmar-sesion error:', err);
    res.status(500).json({ error: 'No se pudo confirmar el pago.' });
  }
}

// GET ?action=reenviar-recibo — botón "Reenviar correo" de la pantalla de
// éxito: vuelve a publicar el recibo (upsert, mismo archivo) y reenvía el
// email. Acepta `&email=` para mandarlo a OTRA dirección (el caso "escribí
// mal mi correo"); en ese caso también corrige el email de la reserva para
// que las comunicaciones futuras lleguen bien. Solo el comprador conoce el
// session_id (viene en su URL de retorno de Stripe), y solo funciona para
// sesiones ya pagadas.
async function accionReenviarRecibo(req, res) {
  const sessionId = req.query.session_id;
  if (!sessionId) { res.status(400).json({ error: 'Falta session_id' }); return; }
  const emailOverride = String(req.query.email || '').trim().toLowerCase();
  if (emailOverride && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailOverride)) {
    res.status(400).json({ error: 'El correo no es válido.' });
    return;
  }
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      res.status(400).json({ error: 'El pago de esta sesión no está confirmado.' });
      return;
    }
    const sb = getSupabaseAdmin();
    const { data: reserva } = await sb.from('reservas').select('*')
      .eq('stripe_checkout_id', sessionId).maybeSingle();
    if (!reserva) { res.status(404).json({ error: 'No encontramos tu reserva.' }); return; }

    const destinatario = emailOverride || reserva.email;
    const totalNeto = Number(reserva.monto) - Number(reserva.descuento_monto || 0);
    const resultado = await enviarReciboPorCorreo(sb, { ...reserva, email: destinatario }, {
      montoRecibido: (session.amount_total || 0) / 100,
      nuevoMontoPagado: Number(reserva.monto_pagado || 0),
      totalNeto,
      paymentIntent: session.payment_intent || '',
    });
    if (resultado.enviado && emailOverride && emailOverride !== (reserva.email || '').toLowerCase()) {
      const { error: emailErr } = await sb.from('reservas').update({ email: emailOverride }).eq('id', reserva.id);
      if (emailErr) console.error('No se pudo actualizar el email de la reserva:', emailErr);
    }
    if (!resultado.enviado) {
      res.status(200).json({ enviado: false, liga: resultado.liga,
        error: resultado.motivo === 'sin-email' ? 'La reserva no tiene correo registrado.'
          : 'El servicio de correo aún no está configurado.' });
      return;
    }
    res.status(200).json({ enviado: true, email: destinatario });
  } catch (err) {
    // El detalle SMTP (código 550/553/421, comando, respuesta de Hostinger) ya
    // quedó logueado por _logErrorSMTP; aquí se agrega el contexto del reenvío
    // y se devuelve el motivo legible para que la UI lo muestre.
    console.error('checkout/reenviar-recibo error:', {
      message: err && err.message, code: err && err.code,
      command: err && err.command, response: err && err.response,
    });
    res.status(500).json({ error: 'No se pudo reenviar el correo. ' + ((err && err.message) || '') });
  }
}

// POST — crear la sesión de pago.
// Modo 1 (nueva reserva): body = { zona, zonaId, juego, juegoId, personas, ninos,
//   precioNum, pct, promoCodigo, nombre, email, tel, rfc }
// Modo 2 (liquidar saldo de una reserva ya creada): body = { folioExistente }
// ── PRECIO AUTORITATIVO DEL SERVIDOR ──────────────────────────────────────
// Espejo EXACTO de _desgloseTotalZona() de panel-inicio.html, pero con los
// datos del catálogo (mapa_secciones) en vez de los que manda el navegador:
//   base    = precio del bloque del día (JUE–SÁB usa precio2 si está puesto)
//   extras  = adultos por encima del mínimo incluido × tarifa de adulto extra
//   niños   = niños que NO caben en el hueco del mínimo × tarifa de niño
// Los respaldos son los mismos que en la landing para que el número mostrado
// y el cobrado coincidan al peso: sin tarifa de adulto extra se cobra el
// precio de la zona, y sin tarifa de niño se cobra 0.
function _esJueSabFecha(fecha) {
  if (!fecha) return false;
  // Mediodía fija el día de la semana sin importar la zona horaria del
  // servidor (Vercel corre en UTC; el negocio está en Hermosillo).
  const d = new Date(String(fecha) + 'T12:00:00');
  return !isNaN(d.getTime()) && d.getDay() >= 4;
}

function precioZonaServidor(sec, fechaJuego, adultosTotales, ninosTotales) {
  const jueSab = _esJueSabFecha(fechaJuego);
  const num = (v) => (v == null ? null : Number(v));
  const precio1 = num(sec.precio);
  const precio2 = num(sec.precio2);
  const base = (jueSab && precio2 != null && precio2 > 0) ? precio2 : (precio1 != null ? precio1 : 0);
  if (!(base > 0)) return null;                    // sin tarifa no se puede cobrar

  const extraDom = num(sec.precio_extra);
  const extraJS  = num(sec.precio_extra2);
  const ninoDom  = num(sec.precio_nino);
  const ninoJS   = num(sec.precio_nino2);
  const extra = (jueSab && extraJS != null && extraJS > 0) ? extraJS : (extraDom != null ? extraDom : base);
  const nino  = (jueSab && ninoJS  != null && ninoJS  > 0) ? ninoJS  : (ninoDom  != null ? ninoDom  : 0);

  // Personas incluidas del MISMO bloque que la tarifa: un juego JUE-SÁB usa
  // min_personas2 si está configurado. Antes se tomaba siempre el mínimo
  // DOM-MIÉ, así que el de JUE-SÁB no llegaba a aplicarse nunca.
  const minDom = num(sec.min_personas);
  const minJS  = num(sec.min_personas2);
  const min = ((jueSab && minJS != null && minJS > 0) ? minJS : minDom) || 1;
  const adultos = Math.max(0, Number(adultosTotales) || 0);
  const ninos = Math.max(0, Number(ninosTotales) || 0);
  const adultosExtra = Math.max(0, adultos - min);
  const ninosIncluidos = Math.max(0, min - adultos);
  const ninosExtra = Math.max(0, ninos - ninosIncluidos);
  // Al CENTAVO, no al peso: redondear aquí con Math.round tiraba los centavos
  // del catálogo y hacía que el total no coincidiera con el de la landing.
  const total = redondearDinero(base + adultosExtra * extra + ninosExtra * nino);
  return { base, extra, nino, min, adultosExtra, ninosExtra, total };
}

async function crearSesion(req, res) {
  const sb = getSupabaseAdmin();
  const origin = origenDesdeRequest(req);

  try {
    const body = req.body || {};

    // ── Casilla "Soy humano" (Cloudflare Turnstile) ──────────────────────
    // El token del widget viaja en el payload y se confirma con siteverify
    // ANTES de tocar Stripe o Supabase. Sin secret en el entorno se omite.
    // "Pagar saldo" del portal (folioExistente) queda EXENTO del captcha: el
    // cliente ya tiene sesión del portal (entró con folio + correo) y esa
    // MISMA pareja se verifica abajo como prueba de propiedad — un bot no
    // puede adivinarla y el flujo no muestra widget que marcar.
    if (!body.folioExistente) {
      const ts = await verificarTurnstile(body.turnstileToken, req.headers['x-forwarded-for']);
      if (!ts.ok) {
        console.warn('Checkout bloqueado por Turnstile:', ts.codigos);
        res.status(403).json({ error: 'La verificación de seguridad falló. Actualiza la página, marca la casilla "Soy humano" e intenta de nuevo.' });
        return;
      }
    }

    // ── Modo: liquidar saldo pendiente de una reserva existente ──────────
    if (body.folioExistente) {
      const { data: reserva, error: fetchError } = await sb
        .from('reservas').select('*').eq('id', body.folioExistente).maybeSingle();
      if (fetchError) throw fetchError;
      if (!reserva) { res.status(404).json({ error: 'No encontramos esa reserva.' }); return; }
      // Prueba de propiedad (reemplaza al captcha en este flujo): el correo
      // de la sesión del portal debe coincidir con el de la reserva.
      const emailPortal = String(body.email || '').trim().toLowerCase();
      if (!emailPortal || String(reserva.email || '').trim().toLowerCase() !== emailPortal) {
        res.status(403).json({ error: 'Tu sesión del portal expiró o el correo no coincide con la reserva. Entra de nuevo a Mis Reservas con tu folio y correo.' });
        return;
      }

      // ── SALDO REAL: misma derivación EXACTA que el portal Mis Reservas ──
      // El bug: se cobraba `monto − monto_pagado` SIN restar descuento_monto
      // (y con 7% encima) — una reserva con descuento veía "Pagar saldo -
      // $4,875" y Stripe abría con $10,415. Ahora:
      //   totalNeto  = monto − descuento_monto
      //   pagadoReal = MAX(monto_pagado, SUMA de cobros activos del folio,
      //                incluidos los etiquetados con el folio del prospecto
      //                vinculado — los mismos que suma el portal)
      //   a cobrar   = totalNeto − pagadoReal  (sin comisión: el checkout
      //                abre con EXACTAMENTE el número del botón, al centavo)
      const totalNeto = Math.max(0, Number(reserva.monto) - Number(reserva.descuento_monto || 0));
      let pagadoReal = Number(reserva.monto_pagado) || 0;
      try {
        const folios = [String(reserva.id)];
        const rCards = await sb.from('pipeline_prospectos').select('folio, reserva_ids')
          .overlaps('reserva_ids', [String(reserva.id)]);
        ((rCards && rCards.data) || []).forEach(c => { if (c.folio) folios.push(String(c.folio)); });
        const rCobros = await sb.from('cobros').select('monto, estado, concepto, forma_pago').in('folio', folios);
        if (!rCobros.error && rCobros.data) {
          // CRÉDITO fuera: es el saldo que Stripe debe PODER cobrar, no un
          // pago que lo reduzca ("ya está liquidada" con deuda viva).
          const suma = rCobros.data
            .filter(c => String(c.estado || '').toLowerCase() !== 'cancelado' && !esCobroCredito(c))
            .reduce((s, c) => s + (Number(c.monto) || 0), 0);
          pagadoReal = Math.max(pagadoReal, suma);
        }
      } catch (eSuma) { console.warn('Suma de cobros no disponible (se usa monto_pagado):', eSuma && eSuma.message); }

      const saldoCentavos = aCentavos(totalNeto - pagadoReal);
      if (saldoCentavos <= 0) { res.status(400).json({ error: 'Esta reserva ya está liquidada.' }); return; }

      const session = await getStripe().checkout.sessions.create({
        mode: 'payment',
        customer_email: reserva.email,
        line_items: [{
          price_data: {
            currency: 'mxn',
            product_data: { name: 'Saldo · ' + reserva.zona + ' · ' + reserva.juego },
            unit_amount: saldoCentavos,
          },
          quantity: 1,
        }],
        success_url: origin + '/panel-inicio.html?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: origin + '/panel-inicio.html?pago=cancelado',
        metadata: { reserva_id: reserva.id, promo_codigo: '', base_aplicada: String(saldoCentavos / 100) },
      });

      await sb.from('reservas').update({ stripe_checkout_id: session.id }).eq('id', reserva.id);
      res.status(200).json({ url: session.url });
      return;
    }

    // ── Modo: nueva reserva ────────────────────────────────────────────────
    const {
      zona, zonaId, juego, juegoId, personas, ninos,
      precioNum, pct, promoCodigo, nombre, email, tel, rfc,
    } = body;

    // AUDITORÍA: payload crudo del frontend, ANTES de cualquier cálculo o
    // escritura a Supabase (visible en los logs de Vercel del deployment).
    console.log('PAYLOAD RECIBIDO EN API:', JSON.stringify({
      zona, zonaId, juego, juegoId, personas, ninos, precioNum, pct, promoCodigo, nombre, email, tel,
    }));

    if (!zona || !juego || !nombre || !email || !tel) {
      res.status(400).json({ error: 'Faltan datos obligatorios.' });
      return;
    }
    // El precio del cliente NO se usa para cobrar: solo para comparar.
    const precioCliente = Number(precioNum);
    const pctNumero = Number(pct);

    // ── Recálculo autoritativo contra el catálogo ─────────────────────────
    // Sin esto, `precioNum` viajaba en el body y se cobraba tal cual: bastaba
    // un curl con precioNum:1 para llevarse una zona de $9,750 por $1.
    if (!zonaId) {
      res.status(400).json({ error: 'Falta la zona de la reserva.' });
      return;
    }
    const rSeccion = await sb.from('mapa_secciones')
      .select('id, nombre, precio, precio2, precio_extra, precio_extra2, precio_nino, precio_nino2, min_personas, min_personas2')
      .eq('id', zonaId).maybeSingle();
    if (rSeccion.error || !rSeccion.data) {
      console.error('Checkout rechazado: la zona ' + zonaId + ' no está en el catálogo.', rSeccion.error || '');
      res.status(400).json({ error: 'La zona seleccionada ya no está disponible. Actualiza la página e intenta de nuevo.' });
      return;
    }
    const seccion = rSeccion.data;

    // La fecha del juego decide el bloque de tarifa (DOM–MIÉ vs JUE–SÁB).
    let fechaJuego = null;
    if (juegoId) {
      const rJuego = await sb.from('juegos').select('id, fecha').eq('id', juegoId).maybeSingle();
      if (rJuego.error || !rJuego.data) {
        console.error('Checkout rechazado: el juego ' + juegoId + ' no existe.', rJuego.error || '');
        res.status(400).json({ error: 'El juego seleccionado ya no está disponible. Actualiza la página e intenta de nuevo.' });
        return;
      }
      fechaJuego = rJuego.data.fecha;
    }

    const desglose = precioZonaServidor(seccion, fechaJuego, personas, ninos);
    if (!desglose) {
      console.error('Checkout rechazado: la zona ' + zonaId + ' no tiene tarifa configurada.');
      res.status(400).json({ error: 'Esta zona no tiene precio configurado. Contáctanos para ayudarte con tu reserva.' });
      return;
    }
    // ESTE es el precio que manda de aquí en adelante.
    const precioNumero = desglose.total;

    // Discrepancia con lo que mostró el navegador: se rechaza en vez de
    // cobrar un importe distinto al anunciado. Se tolera $1 por redondeos.
    if (precioCliente > 0 && Math.abs(precioCliente - precioNumero) > 1) {
      console.error('⚠️ PRECIO NO COINCIDE · zona ' + zonaId + ' (' + (seccion.nombre || '') + ') · juego ' + juegoId
        + ' · cliente $' + precioCliente + ' vs catálogo $' + precioNumero
        + ' · personas ' + personas + ' niños ' + ninos + ' — posible manipulación del payload.');
      res.status(400).json({ error: 'El precio de esta zona cambió. Actualiza la página para ver el importe correcto.' });
      return;
    }

    // Mínimo de enganche configurable desde el panel admin (tabla politica_pagos).
    // Se valida aquí, no solo en el navegador, porque el body del request es
    // manipulable por el cliente.
    const { data: politica } = await sb.from('politica_pagos').select('enganche_minimo').eq('id', 1).maybeSingle();
    const enganchemin = politica?.enganche_minimo != null ? Number(politica.enganche_minimo) : 30;

    // El precio ya viene del catálogo y es > 0; aquí solo queda el enganche.
    if (!(pctNumero >= enganchemin && pctNumero <= 100)) {
      res.status(400).json({ error: 'Monto o porcentaje inválido.' });
      return;
    }

    // Bloqueo de doble reserva: si la sección ya está apartada/bloqueada para
    // este juego, se rechaza ANTES de crear nada (409 = conflicto). Cuando el
    // bloqueo es solo una reserva Pendiente SIN pago (checkout abandonado),
    // se intenta liberar al instante — mismo cliente o gracia vencida.
    // Lugares que pide esta compra. En un palco compartido es lo que decide si
    // cabe; en una zona exclusiva no se usa. Se toma de personas + ninos, que
    // es lo que el cliente ya capturo, salvo que venga explicito.
    const lugaresPedidos = Math.max(1,
      Number(req.body && req.body.lugares) || ((Number(personas) || 0) + (Number(ninos) || 0)) || 1);

    let disp = await zonaDisponible(sb, juegoId, zonaId, lugaresPedidos);
    if (!disp.disponible && disp.motivo === 'reserva-activa') {
      const lib = await _liberarPendienteAbandonada(sb, juegoId, zonaId, email);
      if (lib.ok) disp = { disponible: true };
      else if (lib.enPago) {
        res.status(409).json({ error: 'Otro cliente está pagando esta zona en este momento. Intenta de nuevo en unos minutos o elige otra zona.' });
        return;
      }
    }
    // En un palco, "no cabe" no es lo mismo que "esta tomado": el mensaje dice
    // cuantos lugares quedan, para que el cliente ajuste en vez de rendirse.
    if (!disp.disponible && disp.compartida) {
      res.status(409).json({
        error: disp.libres === 0
          ? 'Este palco ya se agotó para este juego. Elige otro palco u otra fecha.'
          : 'Este palco solo tiene ' + disp.libres + ' lugar(es) disponible(s) y estás pidiendo '
            + lugaresPedidos + '. Ajusta la cantidad o elige otro palco.',
        lugaresDisponibles: disp.libres,
      });
      return;
    }
    if (!disp.disponible) {
      res.status(409).json({ error: 'Esta zona acaba de ser reservada para este juego. Elige otra zona u otra fecha.' });
      return;
    }

    let descuento = null;
    if (promoCodigo) {
      const v = await validarCupon(promoCodigo, juegoId);
      if (v.valido) descuento = { codigo: v.codigo, tipo: v.tipo, valor: v.valor };
      // Si ya no es válido (p.ej. se agotó justo ahora), simplemente seguimos sin
      // descuento en vez de bloquear la compra.
    }

    // Descuento por VOLUMEN evaluado por el servidor (nunca se confía en un
    // % que venga del cliente): personas totales + juego + zona vs reglas.
    const vol = await descuentoVolumen(getSupabaseAdmin(), { personas, ninos, juegoId, zonaId });
    const t = calcularTotales(precioNumero, pctNumero, descuento, vol ? vol.porcentaje : 0);

    // ── Cupón que cubre el 100% del tramo: Stripe no acepta cargos de $0 y
    // ANTES aquí se insertaba la reserva Pendiente y luego Stripe tronaba —
    // quedaba una reserva huérfana sin forma de pagarse. Se corta ANTES de
    // crear nada, con mensaje claro para el cliente. ──
    if (t.total <= 0) {
      res.status(400).json({ error: 'El descuento cubre el total de este pago: no se requiere cobro en línea. Contacta al club por WhatsApp para confirmar tu reserva sin costo.' });
      return;
    }

    // ── Descuento TOTAL de la reserva (para descuento_monto): el cupón y el
    // volumen se aplican al PRECIO COMPLETO, no solo al tramo del enganche.
    // t.desc/t.volDesc se calculan sobre base = precio × pct/100 (lo que se
    // cobra HOY) — correcto para el cargo, pero guardarlos como descuento del
    // total hacía que el cupón "valiera menos" al pagar enganche: con 20% de
    // cupón y enganche 50%, neto quedaba $9,000 en vez de $8,000 y el cliente
    // terminaba pagando el descuento completo en el saldo. ──
    const descTotalCupon = descuento
      ? (descuento.tipo === 'fijo'
        ? Math.min(redondearDinero(Number(descuento.valor) || 0), precioNumero)
        : redondearDinero(precioNumero * (Number(descuento.valor) || 0) / 100))
      : 0;
    const volTotal = Math.min(
      redondearDinero(precioNumero * ((vol ? Number(vol.porcentaje) : 0) || 0) / 100),
      Math.max(0, redondearDinero(precioNumero - descTotalCupon)));
    const descuentoTotal = Math.min(precioNumero, redondearDinero(descTotalCupon + volTotal));

    const folio = generarFolio();
    const pagoTipo = pctNumero === 100 ? 'Completo' : (pctNumero === enganchemin ? 'Enganche ' + enganchemin + '%' : 'Monto');

    // ── El CLIENTE queda registrado aunque no llegue a pagar ────────────
    // Quien deja su nombre, correo y teléfono ya es un contacto comercial:
    // antes se perdía si abandonaba la pasarela, porque el checkout no tocaba
    // la tabla `clientes` en ningún momento. Ahora se guarda aquí, ANTES de
    // Stripe, para que aparezca en el panel y se le pueda dar seguimiento.
    //
    // NO es fatal: si esto falla, el pago sigue su curso. Un contacto perdido
    // es un problema comercial; bloquear un cobro por él sería peor.
    await _registrarClienteContacto(sb, { nombre, email, tel });

    // ── Extras de adultos calculados por el SERVIDOR contra la capacidad base
    // real de la sección (mapa_secciones.min_personas) — nunca se confía en un
    // valor derivado del frontend ni se deja que un default los ponga en 0.
    //   extra_adults = max(0, adultos_totales − base_capacity)
    // La fila queda en el MISMO modelo canónico que usa el panel:
    //   adultos = SOLO extras · ninos = niños extra
    //   personas = total_persons = base + extras + niños
    // Si la zona no está en el catálogo (base desconocida), se conserva el
    // modelo antiguo (adultos NULL, personas = adultos totales) sin inventar 0.
    const adultosTotales = Number(personas) || 1;
    const ninosExtra = Number(ninos) || 0;
    // Se reusa el mínimo que YA resolvió precioZonaServidor para este juego,
    // en vez de releer min_personas: si se cobró con el mínimo JUE-SÁB, la
    // reserva debe guardar esa misma base o el desglose de adultos extra
    // quedaría en desacuerdo con el importe cobrado.
    const baseCap = Number(desglose.min) || 0;
    const extraAdults = Math.max(0, adultosTotales - baseCap);
    const filaPersonas = baseCap > 0
      ? { personas: baseCap + extraAdults + ninosExtra, adultos: extraAdults, ninos: ninosExtra, base_capacity: baseCap }
      : { personas: adultosTotales, adultos: null, ninos: ninosExtra, base_capacity: null };
    console.log('RESERVA A INSERTAR EN SUPABASE:', JSON.stringify({
      id: folio, base_capacity: baseCap, adultos_totales: adultosTotales, extra_adults: filaPersonas.adultos,
      ninos: ninosExtra, total_persons: filaPersonas.personas,
    }));

    const filaReserva = {
      id: folio,
      cliente: nombre, email, tel, rfc: rfc || null,
      juego_id: juegoId || null, juego,
      zona_id: zonaId || null, zona,
      ...filaPersonas,
      monto: precioNumero,
      monto_pagado: 0,
      porcentaje_pagado: pctNumero,
      pago: pagoTipo,
      metodo: 'Tarjeta',
      estado: 'Pendiente',
      estado_pago: 'pendiente',
      descuento_codigo: descuento ? descuento.codigo : null,
      // Descuento del PRECIO TOTAL (cupón + volumen sobre precioNumero):
      // TODO el sistema aguas abajo (webhook, portal, badges, pagar saldo)
      // calcula el neto con esta columna.
      descuento_monto: descuentoTotal,
    };
    // Hora a la que caduca este apartado. NO la lee el mapa —por decisión de
    // producto la zona se muestra libre hasta que hay pago confirmado—: sirve
    // para AUDITORÍA, que era el punto ciego. Un hold vencido y sin cancelar
    // significa que checkout.session.expired no está llegando, y sin este
    // sello no había forma de detectarlo (la tabla no guarda fecha de alta).
    // La consulta para revisarlo está en migracion-hold-expiracion.sql.
    filaReserva.hold_expira_en = new Date(Date.now() + _GRACIA_PAGO_SEG * 1000).toISOString();

    // Lugares SOLO en palcos compartidos. En una zona exclusiva se deja NULL:
    // ahi la reserva ocupa la zona entera y un numero de lugares no significa
    // nada — peor aun, la haria contar en un calculo de ocupacion que no le
    // corresponde si algun dia esa zona pasa a compartida.
    if (disp && disp.compartida) filaReserva.lugares = lugaresPedidos;

    let { error: insertError } = await sb.from('reservas').insert(filaReserva);
    // Compat: sin la columna `lugares` (migracion-palcos-compartidos.sql
    // pendiente) se reintenta sin ella. El palco se comporta como zona
    // exclusiva hasta que la migracion corra, que es el estado de hoy.
    if (insertError && /lugares/i.test(insertError.message || '')) {
      delete filaReserva.lugares;
      ({ error: insertError } = await sb.from('reservas').insert(filaReserva));
    }
    // Compat: si la columna base_capacity aún no existe en Postgres (migración
    // pendiente), se reintenta sin ella — adultos/personas/ninos van igual.
    if (insertError && /base_capacity/i.test(insertError.message || '')) {
      delete filaReserva.base_capacity;
      ({ error: insertError } = await sb.from('reservas').insert(filaReserva));
    }
    // Compat: idem con hold_expira_en (migracion-hold-expiracion.sql). Sin la
    // columna se pierde SOLO el pintado del mapa; el anti-oversell del
    // servidor no depende de ella y sigue igual de firme.
    if (insertError && /hold_expira_en/i.test(insertError.message || '')) {
      delete filaReserva.hold_expira_en;
      ({ error: insertError } = await sb.from('reservas').insert(filaReserva));
    }
    if (insertError) throw insertError;

    // SIN hold prematuro: la sección NO se marca 'reservada' aquí. La única
    // autoridad que escribe zona_juego_estado en este flujo es el webhook de
    // Stripe cuando llega checkout.session.completed (pago confirmado) — un
    // carrito abandonado o una pasarela cerrada jamás deja la sección
    // bloqueada. Los IDs viajan en el metadata de la sesión para que el
    // webhook pueda marcar la zona aunque la fila de la reserva no los traiga.
    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      line_items: [{
        price_data: {
          currency: 'mxn',
          product_data: { name: zona + ' · ' + juego },
          unit_amount: aCentavos(t.total),
        },
        quantity: 1,
      }],
      success_url: origin + '/panel-inicio.html?session_id={CHECKOUT_SESSION_ID}',
      // El regreso con "←" desde Stripe trae el id de sesión (parámetro `cs`,
      // distinto de session_id que es la ruta de éxito): la landing lo usa
      // para liberar la zona AL INSTANTE vía ?action=cancelar-pendiente.
      cancel_url: origin + '/panel-inicio.html?pago=cancelado&cs={CHECKOUT_SESSION_ID}',
      metadata: {
        reserva_id: folio,
        promo_codigo: descuento ? descuento.codigo : '',
        juego_id: String(juegoId || ''),
        zona_id: String(zonaId || ''),
        // Base SIN comisión que este cobro acredita al saldo: el webhook
        // abona esto a monto_pagado (no el amount_total, que trae el 7% —
        // acreditar la comisión regalaba ese 7% del principal al cliente).
        base_aplicada: String(t.bd),
        // El descuento viaja a Stripe para que el webhook pueda VERIFICAR (y
        // reparar) la fila: si descuento_monto se perdiera, la reserva
        // quedaria 'parcial' para siempre y el correo anunciaria un saldo
        // restante que el cliente ya pago.
        descuento_monto: String(descuentoTotal),
        monto_bruto: String(precioNumero),
      },
      // La sesión de pago caduca en 30 min (mínimo de Stripe): al expirar,
      // el webhook cancela la reserva Pendiente (la sección nunca se apartó).
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });

    await sb.from('reservas').update({ stripe_checkout_id: session.id }).eq('id', folio);

    // El folio viaja en la respuesta para poder verificar el registro insertado
    // (test-booking.js lo lee de vuelta desde Supabase vía /api/mis-reservas).
    res.status(200).json({ url: session.url, folio });
  } catch (err) {
    console.error('checkout error:', err);
    res.status(500).json({ error: 'No se pudo iniciar el pago. Intenta de nuevo.' });
  }
}

// POST ?action=verificar-humano — valida el token de Turnstile del LOGIN del
// panel admin (index.html) antes de intentar la sesión con Supabase Auth.
async function accionVerificarHumano(req, res) {
  const token = (req.body && req.body.turnstileToken) || '';
  const ts = await verificarTurnstile(token, req.headers['x-forwarded-for']);
  res.status(ts.ok ? 200 : 403).json({ ok: ts.ok, skipped: !!ts.skipped, codigos: ts.codigos || [] });
}

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    if (String((req.query && req.query.action) || '') === 'verificar-humano') { await accionVerificarHumano(req, res); return; }
    await crearSesion(req, res); return;
  }

  if (req.method === 'GET') {
    const action = String(req.query.action || '');
    if (action === 'validar-cupon') { await accionValidarCupon(req, res); return; }
    if (action === 'confirmar-sesion') { await accionConfirmarSesion(req, res); return; }
    if (action === 'reenviar-recibo') { await accionReenviarRecibo(req, res); return; }
    if (action === 'cancelar-pendiente') { await accionCancelarPendiente(req, res); return; }
    res.status(400).json({ error: 'Acción no válida' });
    return;
  }

  res.status(405).json({ error: 'Método no permitido' });
};

// Expuesto solo para pruebas locales (module.exports sigue siendo el handler;
// _test es una propiedad extra sobre la función).
module.exports._test = { zonaDisponible };
