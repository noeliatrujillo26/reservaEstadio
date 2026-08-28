const Stripe = require('stripe');
const { getSupabaseAdmin } = require('./_lib/supabaseAdmin');
const { esCobroCredito } = require('./_lib/dinero');
const { enviarReciboPorCorreo } = require('./_lib/reciboEmail');
const { promoverPipelineSiLiquidada, avanzarPipelineAReservado } = require('./_lib/pipelineSync');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Necesitamos el cuerpo crudo (sin parsear) para verificar la firma de Stripe.
module.exports.config = { api: { bodyParser: false } };

function leerRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// POST /api/stripe-webhook — configúralo en el Dashboard de Stripe apuntando a
// https://reservaestadio.com/api/stripe-webhook (actualizar también el
// endpoint en el dashboard de Stripe tras cualquier cambio de dominio), escuchando:
//   checkout.session.completed, checkout.session.async_payment_succeeded,
//   checkout.session.expired
module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    const rawBody = await leerRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Firma de webhook inválida:', err.message);
    res.status(400).send('Webhook Error: ' + err.message);
    return;
  }

  const sb = getSupabaseAdmin();

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object;
      const reservaId = session.metadata && session.metadata.reserva_id;
      if (!reservaId) { res.status(200).json({ received: true }); return; }

      // Métodos ASÍNCRONOS (OXXO/SPEI): checkout.session.completed llega con
      // payment_status='unpaid' cuando apenas se generó el voucher — acreditar
      // ahí regalaba la reserva sin dinero. Solo se abona con 'paid'; el pago
      // real llega después como async_payment_succeeded.
      if (event.type === 'checkout.session.completed'
          && session.payment_status && session.payment_status !== 'paid') {
        res.status(200).json({ received: true, esperando_pago_asincrono: true });
        return;
      }

      const { data: reserva, error: fetchError } = await sb
        .from('reservas').select('*').eq('id', reservaId).maybeSingle();
      if (fetchError) throw fetchError;
      if (!reserva) { res.status(200).json({ received: true }); return; }

      // ── BLINDAJE: pago sobre una reserva CANCELADA ────────────────────
      // Un webhook tardío (o un pago asíncrono de OXXO que entra días
      // después de cancelar) NO puede resucitar la reserva: la sección ya
      // pudo revenderse a otro cliente. El dinero SÍ se registra —existe y
      // debe ser auditable/reembolsable— pero el estado 'Cancelada' se
      // respeta y la incidencia queda marcada para revisión del admin.
      const reservaCancelada = String(reserva.estado || '').trim().toLowerCase() === 'cancelada';
      if (reservaCancelada) {
        console.error('⚠️ PAGO SOBRE RESERVA CANCELADA · folio ' + reservaId
          + ' · PI ' + (session.payment_intent || session.id || '—')
          + ' · $' + ((session.amount_total || 0) / 100).toFixed(2)
          + ' — la reserva NO se reactiva ni se re-aparta la sección. Revisar para reembolso o reactivación manual.');
      }

      // Idempotencia rápida: reintento inmediato del ÚLTIMO payment intent.
      if (reserva.stripe_payment_id && reserva.stripe_payment_id === session.payment_intent) {
        res.status(200).json({ received: true, ya_procesado: true });
        return;
      }
      // Idempotencia REAL por PI (cubre reintentos tardíos cuando ya se
      // procesó OTRO pago después — el chequeo de arriba solo ve el último):
      // si este payment intent ya dejó su fila en cobros, todo el bloque de
      // acreditación se omite — antes un reintento alternado DUPLICABA el
      // abono en monto_pagado.
      const piEvento = session.payment_intent || session.id || '';
      if (piEvento) {
        const rDupPi = await sb.from('cobros').select('id')
          .eq('folio', String(reserva.id)).ilike('notas', '%' + piEvento + '%').limit(1);
        if (!rDupPi.error && rDupPi.data && rDupPi.data.length) {
          res.status(200).json({ received: true, ya_procesado: true });
          return;
        }
      }

      const montoRecibido = (session.amount_total || 0) / 100;
      // Se acredita la BASE sin comisión (metadata.base_aplicada, puesta por
      // crearSesion en ambos modos): amount_total incluye el 7% de comisión y
      // abonarlo completo descontaba la comisión del principal — el cliente
      // "liquidaba" pagando $350 menos de cada $5,000 y el saldo mostrado
      // nunca cuadraba con lo anunciado. Fallback: sesiones viejas sin
      // metadata acreditan lo cobrado (comportamiento anterior).
      const baseMeta = Number(session.metadata && session.metadata.base_aplicada);
      const montoAcreditado = baseMeta > 0 ? baseMeta : montoRecibido;
      // PAGADO REAL antes de acreditar (regla de la casa): la columna
      // monto_pagado puede ir atrasada respecto a los abonos registrados en
      // `cobros` — partir solo de ella dejaba en 'parcial' reservas que ya
      // estaban cubiertas. Los cobros cancelados y los de CRÉDITO no cuentan.
      let pagadoPrevio = Number(reserva.monto_pagado || 0);
      try {
        const rPrevios = await sb.from('cobros').select('monto, estado, concepto, forma_pago').eq('folio', reservaId);
        if (!rPrevios.error && rPrevios.data) {
          const sumaPrevia = rPrevios.data
            .filter((c) => String(c.estado || '').toLowerCase() !== 'cancelado' && !esCobroCredito(c))
            .reduce((s, c) => s + (Number(c.monto) || 0), 0);
          pagadoPrevio = Math.max(pagadoPrevio, sumaPrevia);
        }
      } catch (ePrev) { console.warn('Suma de cobros previos no disponible:', ePrev && ePrev.message); }
      const nuevoMontoPagado = pagadoPrevio + montoAcreditado;

      // DESCUENTO: manda la fila, pero si nació sin él (o alguien lo pisó
      // después), la metadata de la sesión lo reconstruye y la fila se REPARA
      // aquí mismo. Sin esto una reserva liquidada con cupón quedaba 'parcial'
      // PARA SIEMPRE y el recibo anunciaba un saldo que el cliente ya pagó.
      const descFila = Number(reserva.descuento_monto) || 0;
      const descMeta = Number(session.metadata && session.metadata.descuento_monto) || 0;
      const brutoFila = Number(reserva.monto) || 0;
      const descuentoReal = descFila > 0 ? descFila : Math.min(descMeta, brutoFila);
      const reparaDescuento = descuentoReal > descFila;
      if (reparaDescuento) console.warn('Reserva ' + reservaId + ' sin descuento_monto: se repara con la metadata de Stripe ($' + descuentoReal + ').');
      // El umbral de "pagado" es el precio NETO (monto − descuento del cupón),
      // con tolerancia de centavos (misma regla que mis-reservas y el portal —
      // la comparación estricta de floats dejaba 9999.9999999998 < 10000).
      // `monto` con guarda: una fila legacy con monto NULL daba NaN, que nunca
      // supera el umbral (reserva eternamente 'parcial' y correos con "$NaN").
      const totalNeto = Math.max(0, brutoFila - descuentoReal);
      const nuevoEstadoPago = nuevoMontoPagado >= totalNeto - 0.01 ? 'pagado' : 'parcial';

      const filaActualizada = {
        monto_pagado: nuevoMontoPagado,
        estado_pago: nuevoEstadoPago,
        stripe_payment_id: session.payment_intent || null,
      };
      // `estado` solo avanza a Confirmada si la reserva sigue viva. Antes se
      // escribía incondicionalmente y un pago tardío revivía una cancelación.
      if (!reservaCancelada) filaActualizada.estado = 'Confirmada';
      if (reparaDescuento) filaActualizada.descuento_monto = descuentoReal;
      const { error: updateError } = await sb.from('reservas').update(filaActualizada).eq('id', reservaId);
      if (updateError) throw updateError;
      reserva.descuento_monto = descuentoReal;   // recibo y correo salen ya con el neto correcto

      // El uso del cupón se incrementa SOLO en el pago que lo aplicó (las
      // sesiones de reserva nueva viajan con promo_codigo en metadata; las de
      // "pagar saldo" lo mandan vacío) — antes CADA pago de la misma reserva
      // volvía a incrementar usos y un cupón de 2 usos se agotaba con 1 cliente.
      if (!reservaCancelada && reserva.descuento_codigo && session.metadata && session.metadata.promo_codigo) {
        const { error: rpcError } = await sb.rpc('increment_descuento_uso', { p_codigo: reserva.descuento_codigo });
        if (rpcError) console.error('No se pudo incrementar el uso del cupón:', rpcError);
      }

      // Confirmar la sección como 'reservada' en zona_juego_estado: el panel
      // de Reservas y el mapa público leen de ahí. ESTE es el ÚNICO punto del
      // flujo en línea que aparta la sección — el checkout ya NO pone hold al
      // crear la sesión, así que la zona se bloquea exclusivamente cuando el
      // pago está confirmado. Los IDs salen de la fila de la reserva con el
      // metadata de la sesión como respaldo (viaja juego_id/zona_id desde
      // create-session precisamente para este upsert).
      const juegoIdZona = reserva.juego_id || (session.metadata && session.metadata.juego_id) || null;
      const zonaIdZona = reserva.zona_id || (session.metadata && session.metadata.zona_id) || null;
      // Con la reserva cancelada la sección ya se liberó y puede estar
      // vendida a otro cliente: re-apartarla aquí pisaría esa reserva viva.
      if (!reservaCancelada && juegoIdZona && zonaIdZona) {
        // Sin hold prematuro, dos clientes pueden abrir Stripe para la misma
        // sección a la vez; si ambos pagan, el segundo genera doble reserva.
        // Se detecta y se deja un rastro RUIDOSO para que el admin resuelva
        // (reubicar o reembolsar) — el pago de este cliente ya ocurrió y debe
        // quedar registrado igual.
        try {
          const { data: conflicto } = await sb.from('reservas').select('id')
            .eq('juego_id', juegoIdZona).eq('zona_id', zonaIdZona)
            .neq('id', reservaId).neq('estado', 'Cancelada')
            .gt('monto_pagado', 0).limit(1);
          if (conflicto && conflicto.length) {
            console.error('⚠️ POSIBLE DOBLE RESERVA: la sección ' + zonaIdZona + ' del juego '
              + juegoIdZona + ' ya tiene pago de la reserva ' + conflicto[0].id
              + ' y ahora también pagó ' + reservaId + '. Revisar y reubicar/reembolsar.');
          }
        } catch (eConf) { console.error('Chequeo de doble reserva falló (no-fatal):', eConf); }
        const { error: zErr } = await sb.from('zona_juego_estado')
          .upsert({ juego_id: juegoIdZona, zona_id: zonaIdZona, estado: 'reservada' });
        if (zErr) console.error('No se pudo marcar la sección como reservada:', zErr);
      }

      // ── Pipeline Comercial (NO-fatal): el pago confirmado avanza la
      // tarjeta ligada a "Reservas" (aunque sea un anticipo parcial); si la
      // reserva quedó 100% liquidada, sigue hasta "RESERVA COMPLETADA".
      // Una reserva cancelada no avanza etapas: su tarjeta ya bajó a
      // Cotizado y devolverla al tablero contradiría la cancelación.
      if (!reservaCancelada) {
        try {
          await avanzarPipelineAReservado(sb, reservaId);
          if (nuevoEstadoPago === 'pagado') await promoverPipelineSiLiquidada(sb, reservaId);
        } catch (ePipe) {
          console.error('Sincronización del pipeline falló (no-fatal):', ePipe);
        }
      }

      // ── Historial de pagos: UNA fila en `cobros` por CADA cobro real de
      // Stripe (no-fatal). El portal Mis Reservas y la sección Cobros listan
      // estas filas como abonos individuales; sin esto, el historial mostraba
      // un solo renglón con el total acumulado en lugar de cada pago.
      try {
        const pi = session.payment_intent || session.id || '';
        // Idempotencia propia: si el webhook re-entra con el mismo payment
        // intent, la fila no se duplica (la marca de arriba ya corta la
        // mayoría de los reintentos; esto cubre las repeticiones tempranas).
        let yaRegistrado = false;
        if (pi) {
          const rDup = await sb.from('cobros').select('folio')
            .eq('folio', String(reserva.id)).ilike('notas', '%' + pi + '%').limit(1);
          yaRegistrado = !rDup.error && rDup.data && rDup.data.length > 0;
        }
        if (!yaRegistrado) {
          // Fecha del NEGOCIO (America/Hermosillo), no la UTC del servidor:
          // un pago de las 6 pm caía con fecha de mañana en cobros/reportes.
          const fechaHmo = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Hermosillo' });
          const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
          const habiaPagoPrevio = Number(reserva.monto_pagado || 0) > 0;
          const pago = {
            fecha: fechaHmo,
            mes: MESES[parseInt(fechaHmo.slice(5, 7), 10) - 1],
            cliente: String(reserva.cliente || '').toUpperCase(),
            email: reserva.email || '',
            area: 'ASADOR',
            zona: reserva.zona || '',
            zona_id: reserva.zona_id || '',
            concepto: nuevoEstadoPago === 'pagado'
              ? (habiaPagoPrevio ? 'LIQUIDACIÓN DE SALDO EN LÍNEA' : 'PAGO COMPLETO EN LÍNEA')
              : 'ANTICIPO EN LÍNEA',
            // La fila del historial acredita la BASE (lo que abona al saldo);
            // el total cobrado con comisión queda en las notas para auditoría.
            monto: montoAcreditado,
            forma_pago: 'TARJETA_STRIPE',
            recibio: 'Stripe (checkout en línea)',
            folio: String(reserva.id),
            // Fecha/hora exacta + id de transacción de Stripe, sin requerir
            // columnas nuevas en la tabla. (El bug que dejaba reservas SIN
            // pago registrado vivía justo aquí: `ahora` no existía — el
            // ReferenceError moría en el catch no-fatal y la fila de cobros
            // jamás se insertaba.)
            notas: (reservaCancelada ? '⚠️ PAGO EN RESERVA CANCELADA · revisar reembolso · ' : '') +
              'Stripe PI: ' + pi + ' · cobrado $' + montoRecibido.toFixed(2) +
              (montoAcreditado !== montoRecibido ? ' (comisión $' + (montoRecibido - montoAcreditado).toFixed(2) + ')' : '') +
              ' · ' + new Date().toISOString(),
          };
          // INSERT VERIFICADO: .select() regresa las filas realmente
          // escritas — 0 filas o error se reporta RUIDOSAMENTE en los logs.
          let rIns = await sb.from('cobros').insert(pago).select();
          if (rIns.error && (rIns.error.code === 'PGRST204' || /column/i.test(rIns.error.message || ''))) {
            // Columnas opcionales (email/zona_id) ausentes: reintento núcleo.
            const nucleo = Object.assign({}, pago);
            delete nucleo.email; delete nucleo.zona_id;
            rIns = await sb.from('cobros').insert(nucleo).select();
          }
          if (rIns.error) console.error('⛔ No se pudo registrar el pago individual en cobros:', rIns.error);
          else if (!rIns.data || !rIns.data.length) console.error('⛔ INSERT en cobros regresó 0 filas — pago de ' + reserva.id + ' NO registrado (revisar políticas).');
          else console.log('Pago individual registrado en cobros: ' + reserva.id + ' · $' + montoRecibido + ' · ' + pi);
        }
      } catch (eCobro) {
        console.error('Registro del pago individual falló (no-fatal, el pago ya quedó en la reserva):', eCobro);
      }

      // Alerta en el registro de movimientos: es donde el admin revisa las
      // incidencias del sistema. Sin esto la única huella sería el log del
      // servidor, que nadie mira. NO-fatal: el pago ya quedó asentado.
      if (reservaCancelada) {
        try {
          await sb.from('movimientos').insert({
            tipo: 'ALERTA_PAGO_CANCELADA',
            descripcion: 'Pago recibido en una reserva CANCELADA (' + reservaId + '): $'
              + montoRecibido.toFixed(2) + ' vía Stripe. La reserva NO se reactivó y la sección '
              + 'no se volvió a apartar. Revisar para reembolso o reactivación manual.',
            ref: String(reservaId),
            usuario: 'Stripe (webhook)',
            monto: montoAcreditado,
          });
        } catch (eMov) { console.error('No se pudo registrar la alerta en movimientos (no-fatal):', eMov); }
      }

      // ── Recibo por correo (NO-fatal): publica el recibo HTML en Storage y
      // manda el enlace al email del cliente. Un fallo aquí jamás tumba el
      // webhook — el pago ya quedó registrado y Stripe no debe reintentar
      // (reintentaría con la marca de idempotencia puesta y no haría nada).
      // Con la reserva CANCELADA no se manda: el recibo anuncia una reserva
      // vigente ("Liquidado ✓") y confirmaría al cliente algo que no existe.
      // El caso lo resuelve una persona (reembolso o reactivación).
      if (reservaCancelada) {
        console.error('Recibo NO enviado: la reserva ' + reservaId + ' está cancelada. Resolver manualmente con el cliente.');
      } else {
        try {
          await enviarReciboPorCorreo(sb, reserva, {
            montoRecibido,
            nuevoMontoPagado,
            totalNeto,
            paymentIntent: session.payment_intent || '',
          }, { claveUnica: session.id || ('folio-' + reserva.id) });
        } catch (e) {
          console.error('No se pudo enviar el recibo por correo:', e);
        }
      }

      // Bandera visible en el panel de webhooks de Stripe.
      if (reservaCancelada) {
        res.status(200).json({ received: true, pago_en_reserva_cancelada: true, reserva: String(reservaId) });
        return;
      }
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data.object;
      const reservaId = session.metadata && session.metadata.reserva_id;
      if (reservaId) {
        // Solo cancela si sigue sin pago — nunca pises una reserva que sí se alcanzó a pagar.
        const { data: canceladas } = await sb.from('reservas').update({ estado: 'Cancelada' })
          .eq('id', reservaId).eq('estado_pago', 'pendiente').select();

        // Liberar el hold de la sección SI existía (solo reservas creadas con
        // el flujo viejo, que apartaban antes de pagar — el flujo actual ya no
        // pone hold, así que normalmente esto es un no-op). Salvaguardas: solo
        // si esta expiración SÍ canceló la reserva, y solo si no existe otra
        // reserva activa para la misma sección/juego. El update filtra por
        // estado 'reservada' para no pisar un bloqueo manual del admin.
        const rc = canceladas && canceladas[0];
        if (rc && rc.juego_id && rc.zona_id) {
          const { data: otras } = await sb.from('reservas').select('id')
            .eq('juego_id', rc.juego_id).eq('zona_id', rc.zona_id)
            .neq('estado', 'Cancelada').limit(1);
          if (!otras || otras.length === 0) {
            await sb.from('zona_juego_estado').update({ estado: 'libre' })
              .eq('juego_id', rc.juego_id).eq('zona_id', rc.zona_id).eq('estado', 'reservada');
          }
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('stripe-webhook error:', err);
    res.status(500).json({ error: 'Error procesando el webhook' }); // 500 => Stripe reintenta
  }
};
