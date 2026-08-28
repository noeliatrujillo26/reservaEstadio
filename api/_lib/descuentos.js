const { getSupabaseAdmin } = require('./supabaseAdmin');
const { redondearDinero } = require('./dinero');

// Misma fórmula que usa panel-inicio.html en _coTotal(): hay que mantenerlas
// idénticas o el monto que el cliente ve dejará de coincidir con lo que Stripe cobra.
// Todos los importes se redondean al CENTAVO, no al peso: con Math.round un
// enganche del 30% sobre $9,750.50 daba $2,925 en vez de $2,925.15.
function calcularTotales(precioNum, pct, descuento, volumenPct) {
  const base = redondearDinero(precioNum * pct / 100);
  let desc = 0;
  if (descuento) {
    desc = descuento.tipo === 'fijo'
      ? Math.min(redondearDinero(descuento.valor), base)
      : redondearDinero(base * descuento.valor / 100);
  }
  // Descuento por VOLUMEN (cantidad de personas): % adicional sobre la base,
  // evaluado por el SERVIDOR con las reglas de descuentos_volumen.
  // CLAMP: cupón + volumen JAMÁS pueden superar la base — sin esto, cupón
  // 100% (o fijo = base) + volumen producía bd/comisión/total NEGATIVOS y
  // Stripe rechazaba la sesión con la reserva Pendiente ya creada.
  const volDesc = Math.min(
    redondearDinero(base * ((Number(volumenPct) || 0) / 100)),
    Math.max(0, redondearDinero(base - desc)));
  const bd  = Math.max(0, redondearDinero(base - desc - volDesc));
  const com = redondearDinero(bd * require('./config').COMISION_PCT);
  return { base, desc, volDesc, bd, com, total: redondearDinero(bd + com) };
}

// Mejor regla de descuento por volumen activa para (personas totales, juego,
// zona). juegos/zonas NULL o vacío en la regla = aplica a todos. Tolerante:
// tabla inexistente o error → null (sin descuento).
async function descuentoVolumen(sb, opts) {
  try {
    const personas = (Number(opts.personas) || 0) + (Number(opts.ninos) || 0);
    if (personas <= 0) return null;
    const { data, error } = await sb.from('descuentos_volumen').select('*').eq('activo', true);
    // Doble cerrojo: además del filtro de la consulta se descarta en memoria
    // cualquier fila que no esté AFIRMATIVAMENTE activa (una columna `estado`
    // textual o un booleano guardado como string no debe colarse jamás).
    const activa = (rg) => {
      const crudo = (rg && rg.activo != null) ? rg.activo : (rg || {}).estado;
      if (crudo == null) return false;
      if (typeof crudo === 'boolean') return crudo;
      const n = String(crudo).trim().toLowerCase();
      return n === 'true' || n === 'activo' || n === 'active' || n === '1';
    };
    if (error || !data) { if (error) console.warn('descuentos_volumen:', error.message); return null; }
    let mejor = null;
    for (const rg of data) {
      if (!activa(rg)) continue;
      if (personas < (Number(rg.min_personas) || 0)) continue;
      const js = Array.isArray(rg.juegos) && rg.juegos.length ? rg.juegos.map(String) : null;
      if (js && (!opts.juegoId || js.indexOf(String(opts.juegoId)) < 0)) continue;
      const zs = Array.isArray(rg.zonas) && rg.zonas.length ? rg.zonas.map(String) : null;
      if (zs && (!opts.zonaId || zs.indexOf(String(opts.zonaId)) < 0)) continue;
      if (!mejor || (Number(rg.porcentaje) || 0) > (Number(mejor.porcentaje) || 0)) mejor = rg;
    }
    return mejor ? { nombre: mejor.nombre, porcentaje: Number(mejor.porcentaje) || 0 } : null;
  } catch (e) {
    console.warn('descuentoVolumen falló (se omite):', e && e.message);
    return null;
  }
}

// Valida un código contra public.descuentos. Nunca confíes en un % de descuento
// que venga del cliente: esto es lo único que debe decidir si un código aplica.
async function validarCupon(codigoRaw, juegoId) {
  const codigo = (codigoRaw || '').trim().toUpperCase();
  if (!codigo) return { valido: false, mensaje: 'Ingresa un código.' };

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('descuentos').select('*').eq('codigo', codigo).maybeSingle();
  if (error || !data) return { valido: false, mensaje: 'Código no válido o ya expirado.' };

  if (data.estado !== 'Activo') {
    return { valido: false, mensaje: 'Este código ya no está activo.' };
  }
  // Vigencia por DÍA DE NEGOCIO (America/Hermosillo), no por el reloj UTC del
  // servidor: con new Date(vigencia+'T23:59:59') el cupón moría ~5-7 horas
  // antes del fin del día local (a las 17:00 de Hermosillo ya era mañana en UTC).
  if (data.vigencia) {
    const hoyHmo = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Hermosillo' });
    if (hoyHmo > String(data.vigencia)) {
      return { valido: false, mensaje: 'Este código ya venció.' };
    }
  }
  if (data.usos_max > 0 && data.usos >= data.usos_max) {
    return { valido: false, mensaje: 'Este código agotó sus usos disponibles.' };
  }
  // Sin restricción de juegos ⇒ aplica a todos (array vacío, null o cualquier
  // valor no-array como el string "todos"). Con restricción, el match es por el
  // identificador único del juego, normalizado a string en ambos lados para que
  // un id numérico vs texto ('17' vs 17) no invalide un cupón bien configurado.
  const juegos = Array.isArray(data.juegos_aplicables) ? data.juegos_aplicables : [];
  if (juegos.length > 0 && juegoId && !juegos.map(String).includes(String(juegoId))) {
    return { valido: false, mensaje: 'Este código no aplica para el juego seleccionado.' };
  }

  return { valido: true, codigo: data.codigo, tipo: data.tipo, valor: Number(data.valor) };
}

module.exports = { calcularTotales, validarCupon, descuentoVolumen };
