const { getSupabaseAdmin } = require('../_lib/supabaseAdmin');
const { esCobroCredito } = require('../_lib/dinero');

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/reports/dashboard — API EXTERNA de solo lectura para socios.
// Expone en JSON las métricas de la sección Reportes del panel: KPIs,
// ingresos por mes / sección / forma de pago, rendimiento por vendedora y
// top de clientes.
//
// Autenticación: header `Authorization: Bearer <EXTERNAL_API_KEY>` contra la
// variable de entorno EXTERNAL_API_KEY (Vercel). Sin llave configurada, el
// endpoint queda DESHABILITADO (503) — jamás abierto por accidente.
//
// Filtros: ?temporada=YYYY-YYYY (opcional; default = temporada comercial
// activa, 1 jul → 30 jun, hora de America/Hermosillo).
//
// Documentación completa para el consumidor: docs/API_DASHBOARD_EXTERNA.md
// ═══════════════════════════════════════════════════════════════════════════

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const _cancelado = (x) => String((x && x.estado) || '').toLowerCase() === 'cancelado';
const _norm = (v) => String(v || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const _redondear = (n, dec) => Math.round(n * Math.pow(10, dec || 0)) / Math.pow(10, dec || 0);

// Etiqueta amigable de forma de pago (mismos cubos que el panel).
function _formaLegible(v) {
  const n = _norm(v);
  if (/STRIPE/.test(n)) return 'Stripe (en línea)';
  if (n === 'TRANSFERENCIA') return 'Transferencia';
  if (n === 'EFECTIVO') return 'Efectivo';
  if (/^TARJETA/.test(n)) return 'Tarjeta';
  if (!n) return 'Sin especificar';
  return n.charAt(0) + n.slice(1).toLowerCase();
}

// Temporada comercial activa (1 jul → 30 jun) en hora del NEGOCIO.
function _temporadaActiva() {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Hermosillo' });
  const y = parseInt(hoy.slice(0, 4), 10);
  const y1 = parseInt(hoy.slice(5, 7), 10) >= 7 ? y : y - 1;
  return y1 + '-' + (y1 + 1);
}

async function _todas(sb, tabla, orden) {
  const LOTE = 1000;
  let filas = [];
  for (let desde = 0; ; desde += LOTE) {
    let q = sb.from(tabla).select('*');
    if (orden) q = q.order(orden);
    const { data, error } = await q.range(desde, desde + LOTE - 1);
    if (error) throw new Error(tabla + ': ' + error.message);
    filas = filas.concat(data || []);
    if (!data || data.length < LOTE) break;
  }
  return filas;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');           // datos privados: sin CDN
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // ── Autenticación por API key ──
  const llaveEsperada = String(process.env.EXTERNAL_API_KEY || '').trim();
  if (!llaveEsperada) { res.status(503).json({ error: 'API disabled: EXTERNAL_API_KEY not configured' }); return; }
  const auth = String(req.headers.authorization || '');
  const llave = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!llave || llave !== llaveEsperada) {
    res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
    return;
  }

  try {
    // ── Temporada (filtro opcional, default la activa) ──
    const temporada = String((req.query && req.query.temporada) || _temporadaActiva());
    const mTemp = temporada.match(/^(\d{4})-(\d{4})$/);
    if (!mTemp) { res.status(400).json({ error: 'Invalid temporada format, expected YYYY-YYYY' }); return; }
    const y1 = parseInt(mTemp[1], 10);
    const desde = y1 + '-07-01', hasta = (y1 + 1) + '-07-01';   // [desde, hasta)
    const enRango = (f) => f && f >= desde && f < hasta;

    const sb = getSupabaseAdmin();
    const [cobrosTodos, facturas, zonas, juegos, estados, reservas, cards] = await Promise.all([
      _todas(sb, 'cobros', 'id'),
      _todas(sb, 'facturas'),
      _todas(sb, 'mapa_secciones'),
      _todas(sb, 'juegos'),
      _todas(sb, 'zona_juego_estado'),
      // Reservas y tarjetas: hacen falta para saber si un crédito sigue
      // siendo cobrable o quedó huérfano al borrarse su reservación.
      _todas(sb, 'reservas'),
      _todas(sb, 'pipeline_prospectos'),
    ]);

    // ¿El folio de un cobro apunta a algo VIVO? Reserva no cancelada o
    // tarjeta no descartada. Un crédito cuyo folio ya no existe (reserva
    // borrada, oportunidad eliminada) no tiene a quién cobrarse: queda fuera
    // de las cuentas por cobrar. Espejo de _folioVigente del panel.
    const foliosVivos = new Set();
    (reservas || []).forEach((r) => {
      if (String(r.estado || '').toLowerCase() !== 'cancelada') foliosVivos.add(String(r.id));
    });
    (cards || []).forEach((c) => {
      if (String(c.etapa || '') === 'descartado') return;
      if (c.folio) foliosVivos.add(String(c.folio));
      if (c.id) foliosVivos.add(String(c.id));
    });
    const creditoVigente = (c) => esCobroCredito(c) && foliosVivos.has(String(c.folio || ''));

    // Cobros ACTIVOS de la temporada (cancelados jamás suman — regla de casa).
    const cs = cobrosTodos.filter((c) => !_cancelado(c) && enRango(String(c.fecha || '')));
    // INGRESOS = dinero real cobrado. Los cobros a CRÉDITO (compromiso de
    // pago) se reportan aparte como cuenta por cobrar, jamás como ingreso.
    const csDinero = cs.filter((c) => !esCobroCredito(c));
    const creditoPorCobrar = cs.reduce((s, c) => s + (creditoVigente(c) ? (Number(c.monto) || 0) : 0), 0);
    const ingresos = csDinero.reduce((s, c) => s + (Number(c.monto) || 0), 0);

    // ── Ocupación: slots = zonas × juegos de la temporada ──
    const juegosTemp = juegos.filter((j) => enRango(String(j.fecha || '')));
    const idsJuegosTemp = new Set(juegosTemp.map((j) => String(j.id)));
    const slots = zonas.length * juegosTemp.length;
    const estadosTemp = estados.filter((e) => idsJuegosTemp.has(String(e.juego_id)));
    const vendidas = estadosTemp.filter((e) => String(e.estado) === 'reservada').length;
    const bloqueadas = estadosTemp.filter((e) => String(e.estado) === 'bloqueada').length;

    // ── Facturas de la temporada ──
    const facTemp = facturas.filter((f) => !_cancelado(f) && enRango(String(f.fecha || '')));
    const totalFacturado = facTemp.reduce((s, f) => s + (Number(f.monto) || 0), 0);

    // ── Agrupadores ──
    const agrupar = (lista, claveDe) => {
      const mapa = new Map();
      lista.forEach((c) => {
        const k = claveDe(c);
        const g = mapa.get(k) || { cobros: 0, total: 0, filas: [] };
        g.cobros++; g.total += Number(c.monto) || 0; g.filas.push(c);
        mapa.set(k, g);
      });
      return mapa;
    };

    const porMes = agrupar(csDinero, (c) => String(c.fecha).slice(0, 7));           // YYYY-MM
    const porSeccion = agrupar(csDinero.filter((c) => c.zona), (c) => String(c.zona).trim());
    const porVendedora = agrupar(csDinero, (c) => String(c.recibio || 'Sin registrar').trim());
    const porForma = agrupar(csDinero, (c) => _formaLegible(c.forma_pago));
    const porCliente = agrupar(csDinero.filter((c) => c.cliente), (c) => String(c.cliente).trim().toUpperCase());

    const masFrecuente = (filas, campo) => {
      const cuenta = {};
      filas.forEach((f) => { const v = String(f[campo] || '').trim(); if (v) cuenta[v] = (cuenta[v] || 0) + 1; });
      return Object.entries(cuenta).sort((a, b) => b[1] - a[1]).map((e) => e[0])[0] || null;
    };

    res.status(200).json({
      temporada,
      generado_en: new Date().toISOString(),
      kpis: {
        ingresos_totales: _redondear(ingresos, 2),
        credito_por_cobrar: _redondear(creditoPorCobrar, 2),
        total_cobros: cs.length,
        zonas_vendidas: vendidas,
        zonas_disponibles: Math.max(0, slots - vendidas - bloqueadas),
        ocupacion_promedio_porcentaje: slots ? _redondear((vendidas / slots) * 100, 1) : 0,
        ticket_promedio: vendidas ? _redondear(ingresos / vendidas, 0) : 0,
        facturas_emitidas: facTemp.length,
        total_facturado: _redondear(totalFacturado, 2),
      },
      ingresos_por_mes: [...porMes.entries()].sort((a, b) => a[0].localeCompare(b[0]))
        .map(([ym, g]) => ({
          mes: MESES[parseInt(ym.slice(5, 7), 10) - 1] + ' ' + ym.slice(0, 4),
          monto: _redondear(g.total, 2),
        })),
      ingresos_por_seccion: [...porSeccion.entries()].sort((a, b) => b[1].total - a[1].total)
        .map(([seccion, g]) => ({ seccion, monto: _redondear(g.total, 2) })),
      rendimiento_vendedora: [...porVendedora.entries()].sort((a, b) => b[1].total - a[1].total)
        .map(([vendedora, g]) => ({
          vendedora,
          cobros: g.cobros,
          total: _redondear(g.total, 2),
          porcentaje: ingresos ? _redondear((g.total / ingresos) * 100, 0) : 0,
        })),
      por_forma_pago: [...porForma.entries()].sort((a, b) => b[1].total - a[1].total)
        .map(([forma, g]) => ({ forma_pago: forma, monto: _redondear(g.total, 2) })),
      top_clientes_facturacion: [...porCliente.entries()].sort((a, b) => b[1].total - a[1].total)
        .slice(0, 10)
        .map(([cliente, g], i) => {
          const facCliente = facTemp.filter((f) => _norm(f.cliente) === _norm(cliente))
            .reduce((s, f) => s + (Number(f.monto) || 0), 0);
          return {
            posicion: i + 1,
            cliente,
            zona: masFrecuente(g.filas, 'zona'),
            concepto: masFrecuente(g.filas, 'concepto'),
            total_pagado: _redondear(g.total, 2),
            facturado: facCliente > 0 ? _redondear(facCliente, 2) : null,
          };
        }),
    });
  } catch (err) {
    console.error('reports/dashboard error:', err);
    res.status(500).json({ error: 'Internal error building the report' });
  }
};
