// Sincronización Pipeline ↔ pagos (lado servidor, usado por el webhook de
// Stripe): cuando una reserva queda 100% liquidada, la tarjeta ligada del
// Pipeline Comercial pasa automáticamente de "Reservas" (etapa 'reservado')
// a "Reserva Completada" (etapa 'cerrado').
//
// Reglas (las mismas que _pdSincronizarEtapa en el panel):
//  - Solo se promueve desde 'reservado' — nunca desde etapas tempranas
//    (prospecto/contactado/cotizado se mueven a mano o por sus propios flujos).
//  - Se exige que TODAS las reservas activas ligadas a la tarjeta estén
//    liquidadas (una tarjeta puede tener varias reservas).
//  - Todo es no-fatal: un fallo aquí jamás afecta el registro del pago.

const { esCobroCredito } = require('./dinero');

function _reservaLiquidada(r) {
  const estadoPago = String(r.estado_pago || '').toLowerCase();
  if (['pagado', 'completado', 'liquidado'].indexOf(estadoPago) >= 0) return true;
  const neto = (Number(r.monto) || 0) - (Number(r.descuento_monto) || 0);
  return neto > 0 && Number(r.monto_pagado || 0) >= neto;
}

async function promoverPipelineSiLiquidada(sb, reservaId) {
  const resultado = { promovidas: [] };
  const { data: cards, error } = await sb.from('pipeline_prospectos')
    .select('id, etapa, reserva_ids, folio').eq('etapa', 'reservado');
  if (error) {
    console.error('Pipeline no consultable (¿existe la columna reserva_ids?):', error.message);
    return resultado;
  }
  for (const card of cards || []) {
    let ids = card.reserva_ids;
    if (typeof ids === 'string') { try { ids = JSON.parse(ids); } catch (e) { ids = null; } }
    if (!Array.isArray(ids) || !ids.some((x) => String(x) === String(reservaId))) continue;

    const { data: ligadas, error: eR } = await sb.from('reservas')
      .select('id, estado, estado_pago, monto, monto_pagado, descuento_monto')
      .in('id', ids.map(String));
    if (eR) { console.error('No se pudieron leer las reservas ligadas de ' + card.id + ':', eR.message); continue; }

    const activas = (ligadas || []).filter((r) => String(r.estado || '').toLowerCase() !== 'cancelada');
    if (!activas.length) continue;
    // Cobertura contando el CRÉDITO activo (regla del panel): el crédito no
    // es ingreso ni vive en monto_pagado, pero SÍ asegura el lugar — una
    // tarjeta cubierta con dinero + crédito sube a Reserva Completada.
    let cubiertas = activas.every(_reservaLiquidada);
    if (!cubiertas) {
      try {
        const folios = ids.map(String);
        if (card.folio) folios.push(String(card.folio));
        const rC = await sb.from('cobros').select('monto, estado, concepto, forma_pago').in('folio', folios);
        const credito = ((rC && rC.data) || [])
          .filter((c) => String(c.estado || '').toLowerCase() !== 'cancelado' && esCobroCredito(c))
          .reduce((s, c) => s + (Number(c.monto) || 0), 0);
        if (credito > 0) {
          const netoTotal = activas.reduce((s, r) => s + Math.max(0, (Number(r.monto) || 0) - (Number(r.descuento_monto) || 0)), 0);
          const pagado = activas.reduce((s, r) => s + (Number(r.monto_pagado) || 0), 0);
          cubiertas = pagado + credito >= netoTotal - 0.01;
        }
      } catch (e) { console.error('Suma de crédito no disponible para ' + card.id + ':', e && e.message); }
    }
    if (!cubiertas) continue;

    const { error: eU } = await sb.from('pipeline_prospectos')
      .update({ etapa: 'cerrado' }).eq('id', card.id);
    if (eU) { console.error('No se pudo promover la tarjeta ' + card.id + ':', eU.message); continue; }
    resultado.promovidas.push(card.id);
    console.log('Pipeline: tarjeta ' + card.id + ' → RESERVA COMPLETADA (todas sus reservas liquidadas).');
  }
  return resultado;
}

// Un pago EN LÍNEA confirmado sobre una reserva ligada avanza su tarjeta a
// "Reservas" ('reservado') si estaba en una etapa ANTERIOR (prospecto /
// cotizado / reserva_momentanea). Jamás toca cerradas ni archivadas; con la
// tarjeta ya en 'reservado', promoverPipelineSiLiquidada decide si sigue a
// 'cerrado'. No-fatal, como todo lo de este módulo.
async function avanzarPipelineAReservado(sb, reservaId) {
  const resultado = { avanzadas: [] };
  const { data: cards, error } = await sb.from('pipeline_prospectos').select('id, etapa, reserva_ids');
  if (error) {
    console.error('Pipeline no consultable (¿existe la columna reserva_ids?):', error.message);
    return resultado;
  }
  const previas = { prospecto: true, cotizado: true, reserva_momentanea: true };
  for (const card of cards || []) {
    let ids = card.reserva_ids;
    if (typeof ids === 'string') { try { ids = JSON.parse(ids); } catch (e) { ids = null; } }
    if (!Array.isArray(ids) || !ids.some((x) => String(x) === String(reservaId))) continue;
    if (!previas[String(card.etapa || '')]) continue;
    let r = await sb.from('pipeline_prospectos')
      .update({ etapa: 'reservado', etapa_cambiada_en: new Date().toISOString() }).eq('id', card.id);
    if (r.error && (r.error.code === 'PGRST204' || /column/i.test(r.error.message || ''))) {
      r = await sb.from('pipeline_prospectos').update({ etapa: 'reservado' }).eq('id', card.id);
    }
    if (r.error) { console.error('No se pudo avanzar la tarjeta ' + card.id + ' a Reservas:', r.error.message); continue; }
    resultado.avanzadas.push(card.id);
    console.log('Pipeline: tarjeta ' + card.id + ' → RESERVAS (pago en línea confirmado).');
  }
  return resultado;
}

module.exports = { promoverPipelineSiLiquidada, avanzarPipelineAReservado, _reservaLiquidada };
