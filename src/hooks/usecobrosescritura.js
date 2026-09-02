// ═══════════════════════════════════════════════════════════════════
// usecobrosescritura.js — REGISTRAR y CANCELAR cobros, con su cascada.
// espejo 1:1 de v1: guardarNuevoCobro() y cancelarCobro()
// (js/modules/cobros.js 1798-1868 y 809-861).
//
// Las dos van JUNTAS y con toda su cascada a proposito. Migrar solo una parte
// dejaria la base inconsistente: un cobro cancelado con el saldo de su reserva
// sin corregir, o un abono registrado que no mueve el saldo a favor del
// cliente. La cascada vive en lib/cascadas.js; aqui solo se ordena y se avisa.
//
// EL ORDEN NO ES NEGOCIABLE. La cascada va SIEMPRE despues de que el cobro
// quedo guardado:
//   · si el insert o la cancelacion fallan, el dinero NO debe moverse
//   · si un paso de la cascada falla, el cobro YA quedo registrado — se avisa
//     para corregirlo a mano, en vez de perder el rastro del dinero
// Por eso ningun paso posterior aborta la operacion: solo informa.
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useState } from 'react'
import { sb } from '../supabaseclient'
import useadmin from './useadmin'
import useadmindatos from './useadmindatos'
import { usetoast } from '../context/toastcontext'
import {
  actualizar_verificado, es_error_columna, insertar_verificado,
  mensajes_bloqueo, motivo_bloqueo, registrar_movimiento,
} from '../lib/escritura'
import {
  afecta_saldo_reserva, es_abono_a_saldo_favor, mover_saldo_favor,
  restar_pago_reserva, revertir_saldo_favor_de_cobro, sincronizar_etapa,
  sincronizar_pago_reserva, tarjeta_de_folio, texto_reversion_saldo,
} from '../lib/cascadas'
import { area_por_nombre_zona, cobro_cancelado } from '../lib/cobros'
import { es_pago_credito } from '../lib/dashboard'
import { mxn2, redondear_dinero } from '../lib/dinero'
import { fecha_local } from '../lib/fechas'
import { subir_comprobante } from '../lib/storage'

const money = (n) => '$' + (Number(n) || 0).toLocaleString('es-MX', mxn2)

// claves originales de `cobros`, para el reintento si la base va una migracion
// atras. Mismas que agregarPagoPD en la v1.
const claves_legacy_cobro = [
  'fecha', 'mes', 'cliente', 'area', 'zona', 'concepto', 'monto', 'forma_pago',
  'fecha_reserva', 'recibio', 'factura', 'folio', 'notas', 'evidencia',
]

// La lista de reservas con el saldo ya actualizado, para la vista "despues"
// que necesita la clasificacion de etapa. Fuera del componente porque es pura:
// no depende de nada mas que sus argumentos.
// Un CREDITO no toca monto_pagado, asi que devuelve la lista intacta.
function reservas_con(reservas, reservaid, sync) {
  if (!reservaid || !sync || !sync.ok || sync.credito) return reservas || []
  return (reservas || []).map((r) =>
    String(r.id) === String(reservaid)
      ? { ...r, montopagado: sync.pagado, estadopago: sync.estadopago, pago: sync.pagolabel }
      : r
  )
}

export function usecobrosescritura() {
  const { usuario } = useadmin()
  const {
    cobros, reservas, areas, pipeline, cotizaciones, clientes, politica, recargar,
  } = useadmindatos()
  const { mostrartoast } = usetoast()
  // id del cobro en vuelo (cancelacion) y bandera del alta, para que un doble
  // clic no registre dos veces el mismo pago.
  const [cancelando, setcancelando] = useState(null)
  const [guardando, setguardando] = useState(false)

  const puede = motivo_bloqueo(usuario, 'cobros') === null

  // ── cascada comun a los dos flujos: la etapa de la tarjeta ──
  //
  // Recibe los datos COMO QUEDAN DESPUES de la operacion, no como estaban.
  // No es un detalle: la columna se decide sumando los cobros activos de la
  // tarjeta y leyendo el pagado de sus reservas. Con las listas de antes, el
  // abono que acaba de entrar no contaria y la tarjeta se quedaria donde
  // estaba; el cobro que acaba de cancelarse seguiria contando.
  //
  // La v1 llega al mismo sitio mutando sus arreglos en memoria
  // (_reconstruirPagosPipeline sobre `cobros` ya modificado). Aqui no se muta
  // nada: se pasan copias con el cambio aplicado, y el refresco real lo hace
  // recargar() releyendo la base.
  const sincronizar_tarjeta = useCallback(
    async (folio, despues) => {
      try {
        const card = tarjeta_de_folio(folio, pipeline)
        if (!card) return
        const r = await sincronizar_etapa(sb, usuario, card, {
          reservas: despues.reservas,
          cobros: despues.cobros,
          cotizaciones,
          enganchemin: politica ? politica.enganche_minimo : 0,
        })
        if (r) mostrartoast(r.texto)
      } catch (e) {
        console.error('Sincronización de etapa falló:', e)
      }
    },
    [pipeline, cotizaciones, politica, usuario, mostrartoast]
  )

  // ── CANCELAR (borrado suave) ─────────────────────────────────
  // En vez de DELETE, estado='cancelado'. El registro se conserva para
  // auditoria con su etiqueta, deja de sumar en todas las metricas y el saldo
  // de la reserva ligada se recalcula.
  const cancelar = useCallback(
    async (c) => {
      const bloqueo = motivo_bloqueo(usuario, 'cobros')
      if (bloqueo) {
        mostrartoast(mensajes_bloqueo[bloqueo])
        return { ok: false }
      }
      if (cobro_cancelado(c)) {
        mostrartoast('ℹ️ Este cobro ya está cancelado')
        return { ok: false }
      }

      const montotxt = money(c.monto)
      setcancelando(c.id)
      try {
        const res = await actualizar_verificado(
          sb, usuario, 'cobros', { estado: 'cancelado' }, c.id, null
        )
        if (!res.ok) {
          mostrartoast(
            es_error_columna(res.error)
              ? '⚠️ Falta la columna `estado` en cobros: corre migracion-cobros-cancelado.sql en Supabase'
              : res.motivo === 'sin_filas'
                ? '⚠️ La base no aceptó la cancelación (0 filas). Revisa las políticas RLS de `cobros`.'
                : '⚠️ No se pudo cancelar en Supabase: ' + ((res.error && res.error.message) || '')
          )
          return { ok: false }
        }

        // 1. Deshacer lo que este cobro hizo con el saldo del cliente: un abono
        //    cancelado deja de dar credito, y un pago hecho con saldo lo
        //    devuelve. Va DESPUES de que la cancelacion quedo guardada: si el
        //    update falla, el saldo no debe moverse.
        try {
          const aviso = texto_reversion_saldo(
            await revertir_saldo_favor_de_cobro(sb, usuario, c, { clientes, reservas })
          )
          if (aviso) mostrartoast(aviso, 9000)
        } catch (e) {
          console.error('Reversión de saldo a favor falló:', e)
        }

        // 2. El pago cancelado deja de contar en el saldo de su reserva.
        //    Los creditos jamas suman a monto_pagado, asi que cancelarlos
        //    tampoco resta (simetria del dinero real).
        let sync = null
        try {
          if (afecta_saldo_reserva(c, reservas)) {
            sync = await restar_pago_reserva(sb, usuario, String(c.folio), Number(c.monto) || 0)
            if (!sync.ok) {
              mostrartoast(
                '⚠️ El cobro se canceló, pero el saldo de la reserva ' + c.folio +
                ' no se pudo recalcular. Revísalo antes de cobrar de nuevo.', 9000
              )
            }
          }
        } catch (e) {
          console.error('Recálculo del saldo tras cancelar falló:', e)
        }

        // 3. Cancelar cambia lo abonado, asi que la etapa de su tarjeta se
        //    reevalua igual que al registrarlo — ya SIN este cobro. La regla
        //    solo asciende: una cancelacion no devuelve sola una tarjeta a su
        //    columna anterior, eso sigue siendo de quien la arrastra.
        await sincronizar_tarjeta(c.folio, {
          cobros: (cobros || []).map((x) =>
            String(x.id) === String(c.id) ? { ...x, estado: 'cancelado' } : x
          ),
          reservas: reservas_con(reservas, sync ? c.folio : null, sync),
        })

        mostrartoast('⛔ Cobro cancelado · ' + (c.cliente || '—') + ' (' + montotxt + ')')
        registrar_movimiento(sb, {
          tipo: 'CANCELACIÓN_COBRO',
          desc: 'Cobro cancelado (' + montotxt + ') · ' + (c.cliente || '—'),
          ref: c.zona || '—',
          usuario: usuario ? usuario.nombre : '—',
        })
        recargar()
        return { ok: true }
      } finally {
        setcancelando(null)
      }
    },
    [usuario, clientes, cobros, reservas, mostrartoast, recargar, sincronizar_tarjeta]
  )

  // ── REGISTRAR ────────────────────────────────────────────────
  // datos = { cliente, reservaid, concepto, monto, forma, fecha,
  //           requierefactura, archivo, comprobanteobligatorio }
  // Devuelve { ok } o { ok:false, campo } para que el formulario enfoque el
  // campo que falta, igual que la v1.
  const registrar = useCallback(
    async (datos) => {
      const bloqueo = motivo_bloqueo(usuario, 'cobros')
      if (bloqueo) {
        mostrartoast(mensajes_bloqueo[bloqueo])
        return { ok: false }
      }
      if (guardando) return { ok: false } // doble clic → un solo cobro

      const cliente = datos.cliente
      if (!cliente || !cliente.nombre) {
        mostrartoast('⚠️ Selecciona un cliente')
        return { ok: false, campo: 'cliente' }
      }
      const monto = parseFloat(datos.monto) || 0
      if (!(monto > 0)) {
        mostrartoast('⚠️ Captura un monto mayor a $0.00')
        return { ok: false, campo: 'monto' }
      }
      const forma = datos.forma || ''
      if (!forma) {
        mostrartoast('⚠️ Elige la forma de pago')
        return { ok: false, campo: 'forma' }
      }
      // Comprobante: obligatorio salvo en los movimientos de saldo a favor.
      if (datos.comprobanteobligatorio && !datos.archivo) {
        mostrartoast('⚠️ Debes adjuntar un comprobante de pago para este registro.', 8000)
        return { ok: false, campo: 'comprobante' }
      }

      const concepto = String(datos.concepto || 'ABONO').toUpperCase()
      const escredito = es_pago_credito(concepto, forma)

      // ── Abono a SALDO A FAVOR ──────────────────────────────────
      // Es dinero que entra a la casa pero que todavia no pertenece a ninguna
      // reserva: se guarda en el saldo del cliente y se aplicara despues. Por
      // eso se IGNORA la reserva que hubiera elegida — asociarlo a una la
      // daria por abonada sin estarlo.
      const esabonosaldo = es_abono_a_saldo_favor(concepto)
      if (esabonosaldo && cliente.id == null) {
        mostrartoast(
          '⚠️ Para abonar a saldo a favor, el cliente debe estar dado de alta en el catálogo.', 8000
        )
        return { ok: false, campo: 'cliente' }
      }
      const reserva =
        esabonosaldo || !datos.reservaid
          ? null
          : (reservas || []).find((x) => String(x.id) === String(datos.reservaid)) || null

      setguardando(true)
      try {
        // Comprobante: si la subida falla NO se aborta el cobro — el dinero ya
        // se recibio, y perder el registro por un archivo seria peor. Se avisa.
        let evidencia = ''
        if (datos.archivo) {
          try {
            const subida = await subir_comprobante(sb, datos.archivo, 'cobros')
            if (subida && subida.url) evidencia = subida.url
            else mostrartoast('⚠️ El comprobante no se pudo subir; el cobro se registra igual', 6000)
          } catch (e) {
            console.error('Comprobante no subido:', e)
            mostrartoast('⚠️ El comprobante no se pudo subir; el cobro se registra igual', 6000)
          }
        }

        // MISMA forma de payload y MISMAS claves legacy que agregarPagoPD.
        const d = fecha_local(datos.fecha)
        const messtr = d.toLocaleDateString('es-MX', {
          month: 'long', timeZone: 'America/Hermosillo',
        })
        const zonanombre = reserva ? reserva.zona || '' : ''
        const areamatch = area_por_nombre_zona(zonanombre, areas)
        const payload = {
          fecha: datos.fecha,
          mes: messtr.charAt(0).toUpperCase() + messtr.slice(1),
          cliente: String(cliente.nombre).toUpperCase(),
          email: cliente.email || (reserva ? reserva.email : '') || '',
          area: 'ASADOR',
          zona: zonanombre,
          zona_id: areamatch ? areamatch.id : '',
          concepto,
          monto: redondear_dinero(monto),
          forma_pago: forma,
          fecha_reserva: '',
          recibio: usuario ? usuario.nombre : '',
          factura: datos.requierefactura ? 'REQUERIDA' : '',
          // El folio es el ID de la RESERVA: asi el portal Mis Reservas lo suma
          // a su historial y el expediente del cliente lo atribuye por folio.
          folio: reserva ? String(reserva.id) : '',
          notas: esabonosaldo
            ? 'Abono a Saldo a Favor · Registro de Cobros'
            : 'Registro de Cobros · captura manual',
          evidencia,
        }

        const res = await insertar_verificado(sb, usuario, 'cobros', payload, claves_legacy_cobro)
        if (!res.ok) {
          console.error('Error exacto de Supabase al guardar el cobro:', res.error)
          mostrartoast(
            res.motivo === 'sin_filas'
              ? '⚠️ La base no aceptó el cobro (0 filas). Revisa las políticas RLS de `cobros`.'
              : '⚠️ No se pudo guardar el cobro: ' +
                ((res.error && res.error.message) || 'error desconocido'),
            8000
          )
          return { ok: false }
        }
        const guardado = (res.datos && res.datos[0]) || null

        // ── El saldo del cliente ─────────────────────────────────
        // Va DESPUES del insert: si el cobro no se guardo, el saldo no debe
        // moverse. Y si el saldo falla, el cobro ya quedo registrado — se
        // avisa para corregirlo a mano, en vez de perder el rastro del dinero.
        let saldonuevo = null
        if (esabonosaldo) {
          const mov = await mover_saldo_favor(sb, usuario, cliente.id, redondear_dinero(monto))
          if (mov.ok) saldonuevo = mov.saldo
          else {
            mostrartoast(
              '⚠️ El cobro se registró, pero el saldo a favor del cliente NO se actualizó' +
              (mov.motivo === 'sin-columna' ? ' (falta correr migracion-saldo-favor.sql).' : '.') +
              ' Revísalo antes de aplicarlo.', 9000
            )
          }
        }

        // Saldo de la reserva. NO fatal: el cobro ya esta guardado, y si esto
        // fallara se veria como saldo desactualizado, no como dinero perdido.
        let sync = null
        if (reserva) {
          try {
            sync = await sincronizar_pago_reserva(
              sb, usuario, reserva.id, redondear_dinero(monto), escredito
            )
            if (!sync.ok) {
              mostrartoast(
                '⚠️ El cobro se registró, pero el saldo de la reserva ' + reserva.id +
                ' no se actualizó. Revísalo.', 9000
              )
            }
          } catch (e) {
            console.error('Saldo de la reserva no actualizado:', e)
          }
        }

        // La etapa se reevalua con el cobro RECIEN insertado ya dentro del
        // conjunto. Se usa la fila que devolvio la base (id y monto reales),
        // mapeada al mismo vocabulario que map_cobro.
        const nuevo = guardado
          ? {
              id: guardado.id,
              folio: guardado.folio || '',
              monto: Number(guardado.monto) || 0,
              concepto: guardado.concepto || '',
              formapago: guardado.forma_pago || '',
              estado: guardado.estado || '',
            }
          : null
        await sincronizar_tarjeta(reserva ? String(reserva.id) : '', {
          cobros: nuevo ? (cobros || []).concat([nuevo]) : cobros || [],
          reservas: reservas_con(reservas, reserva ? reserva.id : null, sync),
        })

        const liquidada = !!(sync && sync.liquidada)
        mostrartoast(
          esabonosaldo
            ? '✅ Abono a Saldo a Favor · ' + money(redondear_dinero(monto)) +
              (saldonuevo != null ? ' · Nuevo saldo disponible: ' + money(saldonuevo) : '')
            : '✅ Cobro registrado · ' + concepto + ' ' + money(redondear_dinero(monto)) +
              (reserva ? ' · ' + reserva.id : '') + (liquidada ? ' · 💚 Reserva LIQUIDADA' : ''),
          esabonosaldo ? 8000 : undefined
        )
        registrar_movimiento(sb, {
          tipo: 'Cobro',
          desc: esabonosaldo
            ? 'Abono a Saldo a Favor · ' + cliente.nombre +
              (saldonuevo != null ? ' · Nuevo saldo disponible: ' + money(saldonuevo) : '')
            : 'Cobro manual registrado · ' + cliente.nombre + ' (' + concepto + ')',
          ref: reserva ? String(reserva.id) : cliente.nombre || '—',
          monto: redondear_dinero(monto),
          usuario: usuario ? usuario.nombre : '—',
        })
        recargar()
        return { ok: true }
      } catch (err) {
        console.error('registrar cobro:', err)
        mostrartoast('⚠️ No se pudo registrar el cobro. Intenta de nuevo.')
        return { ok: false }
      } finally {
        setguardando(false)
      }
    },
    [usuario, guardando, cobros, reservas, areas, mostrartoast, recargar, sincronizar_tarjeta]
  )

  return { puede, cancelar, cancelando, registrar, guardando }
}

export default usecobrosescritura
