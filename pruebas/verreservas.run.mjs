// ═══════════════════════════════════════════════════════════════════
// verreservas.run.mjs — pestaña "Reservas" de /reserva-express (01 oct 2026):
// buscar, editar y reenviar el comprobante de una reserva existente.
//
// Dos bloques:
//   1. Buscador (reserva_coincide/buscar_reservas, lib/cobrarreserva.js):
//      mismo método que calc-total-prospecto.run.mjs — compila el puente con
//      Vite y corre las cuentas contra el bundle real.
//   2. Endpoint de reenvío de comprobante (api/send-reservation-email.js):
//      se ejecuta el MÓDULO REAL del endpoint (no una reescritura propia),
//      con getSupabaseAdmin()/enviarReciboPorCorreo() sustituidos en
//      require.cache por dobles de prueba — así se valida el contrato real
//      (403 si el correo no coincide, 404 si no existe la reserva, 200 con
//      `enviado` y el historial de cobros adjunto en modo reenvío) sin tocar
//      Supabase ni SMTP de verdad.
//
// Se corre con:  node pruebas/verreservas.run.mjs
// ═══════════════════════════════════════════════════════════════════
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

let ok = 0, fail = 0
function check(nombre, cond, extra) {
  if (cond) { ok++; console.log('  ✅ ' + nombre) }
  else { fail++; console.log('  ❌ ' + nombre + (extra != null ? ' — ' + JSON.stringify(extra) : '')) }
}

// ══ 1. BUSCADOR: folio, cliente, teléfono y (desde el 01 oct 2026) email ══
console.log('─── Buscador de reservas (folio / cliente / teléfono / email) ───')
{
  const build = spawnSync(
    'npx',
    ['vite', 'build', '--ssr', 'pruebas/cascadas.js', '--outDir', 'pruebas/out-cascadas', '--logLevel', 'error'],
    { stdio: 'inherit', shell: true }
  )
  if (build.status !== 0) {
    console.log('FALLA la compilación del puente de pruebas')
    process.exit(1)
  }
  const { reserva_coincide, buscar_reservas } = await import('./out-cascadas/cascadas.js')

  const reservas = [
    { id: 'R1', cliente: 'Juan Pérez', email: 'juan@correo.com', tel: '6621234567', estado: 'Confirmada' },
    { id: 'R2', cliente: 'María López', email: 'maria@correo.com', tel: '6629876543', estado: 'Confirmada' },
    { id: 'R3', cliente: 'Cancelada Test', email: 'x@correo.com', tel: '6620000000', estado: 'Cancelada' },
  ]

  check('Coincide por FOLIO (id exacto)', reserva_coincide(reservas[0], 'R1'))
  check('Coincide por NOMBRE de cliente (parcial, insensible a mayúsculas)',
    reserva_coincide(reservas[0], 'juan pérez'))
  check('Coincide por TELÉFONO (dígitos sueltos)', reserva_coincide(reservas[0], '662123'))
  check('Coincide por EMAIL (nuevo, 01 oct 2026)', reserva_coincide(reservas[0], 'juan@correo.com'))
  check('Email parcial también matchea', reserva_coincide(reservas[0], 'juan@'))
  check('NO coincide con datos de otra reserva', !reserva_coincide(reservas[0], 'maria@correo.com'))

  const porEmail = buscar_reservas(reservas, 'maria@correo.com')
  check('buscar_reservas() encuentra por email', porEmail.length === 1 && porEmail[0].id === 'R2', porEmail)

  // Se busca por NOMBRE (no por folio): "R3" también matchearía por dígitos
  // de teléfono de otras reservas de este fixture — el nombre es inequívoco.
  const porNombreCancelada = buscar_reservas(reservas, 'Cancelada Test')
  check('Una reserva CANCELADA no aparece en los resultados (mismo criterio que "Registrar Cobro")',
    porNombreCancelada.length === 0, porNombreCancelada)

  const sinTexto = buscar_reservas(reservas, '')
  check('Sin texto: lista vacía, no "todas"', sinTexto.length === 0)
}

// ══ 2. ENDPOINT /api/send-reservation-email (reenvío de comprobante) ══
console.log('\n─── Endpoint de reenvío de comprobante (api/send-reservation-email.js) ───')
{
  const require = createRequire(import.meta.url)
  const rutaSupabaseAdmin = require.resolve('../api/_lib/supabaseAdmin.js')
  const rutaReciboEmail = require.resolve('../api/_lib/reciboEmail.js')
  const rutaEndpoint = require.resolve('../api/send-reservation-email.js')

  function res_falso() {
    const r = { statusCode: 200, cuerpo: null }
    r.status = (c) => { r.statusCode = c; return r }
    r.json = (o) => { r.cuerpo = o; return r }
    return r
  }

  function instalar_dobles({ reserva, cobros, enviarReciboPorCorreo }) {
    const sbFalso = {
      from(tabla) {
        if (tabla === 'reservas') {
          return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: reserva, error: null }) }) }) }
        }
        if (tabla === 'cobros') {
          return { select: () => ({ eq: async () => ({ data: cobros || [], error: null }) }) }
        }
        throw new Error('Tabla inesperada en el fake: ' + tabla)
      },
    }
    require.cache[rutaSupabaseAdmin] = {
      id: rutaSupabaseAdmin, filename: rutaSupabaseAdmin, loaded: true,
      exports: { getSupabaseAdmin: () => sbFalso },
    }
    let llamadoCon = null
    require.cache[rutaReciboEmail] = {
      id: rutaReciboEmail, filename: rutaReciboEmail, loaded: true,
      exports: {
        enviarReciboPorCorreo: async (sb, reservaArg, montos, opts) => {
          llamadoCon = { reservaArg, montos, opts }
          return enviarReciboPorCorreo ? enviarReciboPorCorreo(montos) : { enviado: true }
        },
      },
    }
    delete require.cache[rutaEndpoint]
    return { handler: require(rutaEndpoint), obtenerLlamada: () => llamadoCon }
  }

  // ── a) Correo que NO coincide con la reserva → 403, nunca llega a enviar ──
  {
    const { handler } = instalar_dobles({ reserva: { id: 'R1', email: 'dueño@correo.com' } })
    const res = res_falso()
    await handler({ method: 'POST', body: { folio: 'R1', email: 'otro@correo.com' } }, res)
    check('Email que no coincide → 403 Forbidden', res.statusCode === 403, res.cuerpo)
  }

  // ── b) Reserva inexistente → 404 ──
  {
    const { handler } = instalar_dobles({ reserva: null })
    const res = res_falso()
    await handler({ method: 'POST', body: { folio: 'NO-EXISTE', email: 'a@b.com' } }, res)
    check('Folio inexistente → 404', res.statusCode === 404, res.cuerpo)
  }

  // ── c) Reenvío válido: 200, enviado:true, e incluye el HISTORIAL de cobros ──
  {
    const reserva = {
      id: 'R1', email: 'dueño@correo.com', monto: 10000, descuento_monto: 1000, monto_pagado: 5000,
      stripe_payment_intent: '', stripe_checkout_id: '',
    }
    const cobros = [
      { fecha: '2026-09-01', concepto: 'ABONO', forma_pago: 'Tarjeta', monto: 5000, estado: 'activo' },
      { fecha: '2026-09-02', concepto: 'ABONO', forma_pago: 'Efectivo', monto: 100, estado: 'Cancelado' },
    ]
    const { handler, obtenerLlamada } = instalar_dobles({ reserva, cobros, enviarReciboPorCorreo: () => ({ enviado: true }) })
    const res = res_falso()
    await handler({ method: 'POST', body: { folio: 'R1', email: 'dueño@correo.com', reenvio: true } }, res)
    check('Reenvío con el correo correcto → 200, enviado:true', res.statusCode === 200 && res.cuerpo.enviado === true, res.cuerpo)

    const llamada = obtenerLlamada()
    check('Se arma con esReenvio:true (salta el candado de un-solo-envío)', llamada.montos.esReenvio === true, llamada.montos)
    check('El historial de cobros llega SIN el cancelado',
      Array.isArray(llamada.montos.historialPagos) && llamada.montos.historialPagos.length === 1 &&
      llamada.montos.historialPagos[0].monto === 5000, llamada.montos.historialPagos)
    check('Un reenvío manual NO usa la clave única de dedup del webhook (opts = {})',
      JSON.stringify(llamada.opts) === '{}', llamada.opts)
    check('Total neto correcto (monto − descuento)', llamada.montos.totalNeto === 9000, llamada.montos)
  }

  // ── d) Faltan folio/email → 400 ──
  {
    const { handler } = instalar_dobles({ reserva: null })
    const res = res_falso()
    await handler({ method: 'POST', body: {} }, res)
    check('Sin folio ni email → 400', res.statusCode === 400, res.cuerpo)
  }

  // Limpieza: que el módulo real quede fresco para cualquier otra prueba del
  // proceso (aquí es el último uso, pero es la disciplina correcta).
  delete require.cache[rutaSupabaseAdmin]
  delete require.cache[rutaReciboEmail]
  delete require.cache[rutaEndpoint]
}

console.log('\nResultado: ' + ok + ' ✅ / ' + fail + ' ❌')
process.exit(fail ? 1 : 0)
