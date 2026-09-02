// ═══════════════════════════════════════════════════════════════════
// usereservasescritura.js — CREAR, EDITAR y ELIMINAR reservas.
// espejo 1:1 de v1: _guardarReservaManualInterno() y eliminarReservaSec()
// (js/20-editor-mapa.js 2402-2645 y 1227-1305).
//
// LO QUE ARRASTRA CADA UNA
//   crear    → inserta la reserva y marca su seccion 'reservada'
//   editar   → reescribe la fila; si cambia de seccion, libera la anterior y
//              ocupa la nueva
//   eliminar → borra la fila, CANCELA sus cobros (con reversion de saldo a
//              favor), LIBERA la seccion y DESVINCULA la tarjeta del Pipeline
//
// Ninguna de las tres partes del borrado es opcional. Dejar la seccion
// ocupada crea una "zona huerfana" —bloqueada sin dueño—; dejar los cobros
// vivos infla los ingresos con dinero sin reservacion detras; dejar el
// vinculo, una tarjeta que apunta a algo que ya no existe. La v1 aprendio las
// tres a base de errores y aqui se conservan verificadas.
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useState } from 'react'
import { sb } from '../supabaseclient'
import useadmin from './useadmin'
import useadmindatos from './useadmindatos'
import { usetoast } from '../context/toastcontext'
import {
  actualizar_verificado, borrar_verificado, insertar_verificado, mensajes_bloqueo,
  motivo_bloqueo, registrar_movimiento,
} from '../lib/escritura'
import { revertir_saldo_favor_de_cobro, texto_reversion_saldo } from '../lib/cascadas'
import { cobro_cancelado } from '../lib/cobros'
import { set_estado_zona } from '../lib/mapaocupacion'
import {
  cobro_inicial, economia_reserva, email_valido, estado_pago_reserva, etiqueta_juego,
  folio_visible, folios_de_reserva_borrada, generar_folio_reserva, tel_valido,
} from '../lib/reservasadmin'

// claves originales de `reservas`, para el reintento si la base va una
// migracion atras. Mismas que la v1.
const claves_legacy_reserva = [
  'id', 'cliente', 'email', 'tel', 'zona', 'juego', 'juego_id', 'monto',
  'descuento_monto', 'monto_pagado', 'pago', 'metodo', 'personas', 'estado', 'estado_pago',
]

function es_duplicado(error) {
  return !!error && (error.code === '23505' || /duplicate key/i.test(error.message || ''))
}

export function usereservasescritura() {
  const { usuario } = useadmin()
  const { reservas, cobros, clientes, juegos, areas, pipeline, recargar } = useadmindatos()
  const { mostrartoast } = usetoast()
  const [guardando, setguardando] = useState(false)
  const [borrando, setborrando] = useState(null)

  const puede = motivo_bloqueo(usuario, 'reservas') === null
  const puede_estados = motivo_bloqueo(usuario, 'zona_juego_estado') === null

  // ── CANCELAR LOS COBROS QUE SE CAEN CON LA RESERVA ──────────
  // espejo de _cancelarCobrosDeFolios(): borrado suave con nota, uno por uno,
  // y cada uno revierte lo que hubiera hecho con el saldo a favor del cliente.
  // Un fallo en uno no detiene a los demas: se cuenta lo que si se pudo.
  const cancelar_cobros_de_folios = useCallback(
    async (folios, motivo) => {
      const lista = (folios || []).map(String).filter(Boolean)
      if (!lista.length) return 0
      const objetivo = (cobros || []).filter(
        (c) => !cobro_cancelado(c) && lista.indexOf(String(c.folio || '')) >= 0
      )
      let cancelados = 0
      for (const c of objetivo) {
        const nota = (c.notas ? c.notas + ' · ' : '') +
          'Cobro cancelado: ' + (motivo || 'la reservación se eliminó')
        const res = await actualizar_verificado(
          sb, usuario, 'cobros', { estado: 'cancelado', notas: nota }, c.id, ['estado']
        )
        if (!res.ok) {
          console.error('No se pudo cancelar el cobro ' + c.id + ':', res.error || res.motivo)
          continue
        }
        // Si el cobro tocaba el saldo a favor hay que deshacerlo tambien aqui:
        // sin esto el saldo queda descuadrado igual que al cancelar a mano.
        try {
          const aviso = texto_reversion_saldo(
            await revertir_saldo_favor_de_cobro(sb, usuario, c, { clientes, reservas })
          )
          if (aviso) mostrartoast(aviso, 9000)
        } catch (e) {
          console.error('Reversión de saldo a favor en cascada falló:', e)
        }
        cancelados++
      }
      return cancelados
    },
    [cobros, clientes, reservas, usuario, mostrartoast]
  )

  // ── CREAR / EDITAR ───────────────────────────────────────────
  // datos = { juegoid, zonaid, nombre, email, tel, pago, metodo, montomanual,
  //           adultos, ninos, personas, bruto, descuentopct, saldoconsumo,
  //           cotizacionid, editando }
  const guardar = useCallback(
    async (datos) => {
      const bloqueo = motivo_bloqueo(usuario, 'reservas')
      if (bloqueo) {
        mostrartoast(mensajes_bloqueo[bloqueo])
        return { ok: false }
      }
      if (guardando) return { ok: false } // doble clic → una sola reserva

      // Validaciones, en el MISMO orden y con los mismos textos que la v1.
      if (!datos.juegoid) { mostrartoast('⚠️ Selecciona un juego'); return { ok: false, campo: 'juego' } }
      if (!datos.zonaid) { mostrartoast('⚠️ Selecciona una sección'); return { ok: false, campo: 'zona' } }
      const nombre = String(datos.nombre || '').trim()
      if (!nombre) { mostrartoast('⚠️ Selecciona o ingresa un cliente'); return { ok: false, campo: 'nombre' } }
      const email = String(datos.email || '').trim()
      if (!email) { mostrartoast('⚠️ Ingresa el email del cliente'); return { ok: false, campo: 'email' } }
      if (!email_valido(email)) { mostrartoast('⚠️ El email no es válido'); return { ok: false, campo: 'email' } }
      const tel = String(datos.tel || '').trim()
      if (!tel) { mostrartoast('⚠️ Ingresa el teléfono del cliente'); return { ok: false, campo: 'tel' } }
      if (!tel_valido(tel)) { mostrartoast('⚠️ El teléfono debe tener 10 dígitos'); return { ok: false, campo: 'tel' } }

      const j = (juegos || []).find((x) => String(x.id) === String(datos.juegoid))
      const a = (areas || []).find((x) => x.id === datos.zonaid)
      if (!j || !a) { mostrartoast('⚠️ Datos inválidos'); return { ok: false } }

      const eco = economia_reserva(datos.bruto, datos.descuentopct)
      const pago = datos.pago || 'Sin pago'
      const cobrar = cobro_inicial(pago, eco.neto, datos.montomanual, datos.engancheminpct)
      const estadopago = estado_pago_reserva(cobrar, eco.neto)
      const editando = datos.editando || null

      setguardando(true)
      try {
        const comun = {
          cliente: nombre,
          email,
          pago,
          metodo: datos.metodo || 'Tarjeta',
          personas: datos.personas,
          zona: a.nombre,
          zona_id: a.id,
          monto: eco.bruto,
          descuento_monto: eco.descuento,
          monto_pagado: cobrar,
          estado_pago: estadopago,
          adultos: datos.adultos,
          ninos: datos.ninos,
          saldo_consumo: datos.saldoconsumo || 0,
          cotizacion_id: datos.cotizacionid || null,
        }

        if (editando) {
          const res = await actualizar_verificado(
            sb, usuario, 'reservas', comun, editando.id, claves_legacy_reserva
          )
          if (!res.ok) {
            mostrartoast(
              res.motivo === 'sin_filas'
                ? '⚠️ La base no aceptó el cambio (0 filas). Revisa las políticas RLS de `reservas`.'
                : '⚠️ No se pudo guardar en Supabase' +
                  ((res.error && res.error.message) ? ': ' + res.error.message : '.')
            )
            return { ok: false }
          }

          // Cambio de seccion: la anterior se libera y la nueva se ocupa. La
          // v1 no lo hace —su formulario no deja cambiar de zona al editar—
          // pero aqui el campo existe, y sin esto la seccion vieja quedaria
          // reservada sin nadie dentro: una zona huerfana.
          if (String(editando.zonaid) !== String(a.id) ||
              String(editando.juegoid) !== String(j.id)) {
            const libera = await set_estado_zona(
              sb, usuario, editando.juegoid, editando.zonaid, 'libre'
            )
            const ocupa = await set_estado_zona(sb, usuario, j.id, a.id, 'reservada')
            if (!libera.ok || !ocupa.ok) {
              mostrartoast(
                '⚠️ La reserva se guardó, pero el estado de las secciones no se ' +
                'actualizó del todo. Revísalo en el mapa.', 9000
              )
            }
          }

          mostrartoast('✅ Reserva actualizada')
          registrar_movimiento(sb, {
            tipo: 'Reserva',
            desc: 'Reserva editada: ' + a.nombre + ' · vs ' + j.rival,
            ref: nombre,
            usuario: usuario ? usuario.nombre : '—',
          })
          recargar()
          return { ok: true, id: editando.id }
        }

        // ── ALTA ──
        // Folio del PANEL: complejo y unico con distintivo de origen
        // (NRJ-ADM-XXXXX). Si aun asi choca —otra sesion genero el mismo
        // codigo al mismo tiempo— se regenera y se reintenta.
        let nuevoid = generar_folio_reserva('admin', reservas)
        let res = null
        for (let intento = 0; intento < 5; intento++) {
          res = await insertar_verificado(sb, usuario, 'reservas', {
            id: nuevoid,
            tel,
            juego: etiqueta_juego(j),
            juego_id: j.id,
            estado: 'Confirmada',
            ...comun,
          }, claves_legacy_reserva)
          if (res.ok || !es_duplicado(res.error)) break
          nuevoid = generar_folio_reserva('admin', reservas)
        }
        if (!res.ok) {
          mostrartoast(
            res.motivo === 'sin_filas'
              ? '⚠️ La base no aceptó la reserva (0 filas). Revisa las políticas RLS de `reservas`.'
              : '⚠️ No se pudo guardar en Supabase' +
                ((res.error && res.error.message) ? ': ' + res.error.message : '.'),
            8000
          )
          return { ok: false }
        }

        // Ocupar la seccion es la SEGUNDA mitad del alta, no un efecto
        // secundario: si falla, la reserva existe pero el mapa la sigue
        // mostrando libre y alguien puede venderla otra vez.
        const ocupa = await set_estado_zona(sb, usuario, j.id, a.id, 'reservada')
        if (!ocupa.ok) {
          mostrartoast(
            '⚠️ La reserva se creó, pero la sección NO se marcó como reservada. ' +
            'Márcala a mano desde el mapa antes de que alguien la vuelva a vender.', 9000
          )
        }

        mostrartoast('✅ Reserva creada: ' + a.nombre)
        registrar_movimiento(sb, {
          tipo: 'Reserva',
          desc: 'Nueva reserva: ' + a.nombre + ' · vs ' + j.rival,
          ref: nombre,
          monto: cobrar || null,
          usuario: usuario ? usuario.nombre : '—',
        })
        recargar()
        return { ok: true, id: nuevoid }
      } catch (err) {
        console.error('guardar reserva:', err)
        mostrartoast('⚠️ No se pudo guardar la reserva. Intenta de nuevo.')
        return { ok: false }
      } finally {
        setguardando(false)
      }
    },
    [usuario, guardando, juegos, areas, reservas, mostrartoast, recargar]
  )

  // ── ELIMINAR ─────────────────────────────────────────────────
  // `confirmacion` viene de useconfirmarseguro(): { motivo }. El llamador ya
  // verifico la contraseña; aqui se exige que exista para no poder borrar sin
  // pasar por esa puerta.
  const eliminar = useCallback(
    async (reserva, confirmacion) => {
      const bloqueo = motivo_bloqueo(usuario, 'reservas')
      if (bloqueo) {
        mostrartoast(mensajes_bloqueo[bloqueo])
        return { ok: false }
      }
      if (!confirmacion || !confirmacion.motivo) return { ok: false }

      setborrando(reserva.id)
      try {
        const res = await borrar_verificado(sb, usuario, 'reservas', reserva.id)
        if (!res.ok) {
          mostrartoast(
            res.motivo === 'sin_filas'
              ? '⚠️ La base no aceptó el borrado (0 filas). Revisa las políticas RLS de `reservas`.'
              : '⚠️ No se pudo eliminar en Supabase' +
                ((res.error && res.error.message) ? ': ' + res.error.message : '.')
          )
          return { ok: false }
        }

        // 1. Los cobros de esta reserva dejan de ser cobrables. Borrado suave
        //    con nota: la fila se conserva para auditoria, pero si el pago
        //    existio ese dinero sigue en la caja aunque deje de aparecer.
        try {
          const n = await cancelar_cobros_de_folios(
            folios_de_reserva_borrada(reserva, pipeline),
            'se eliminó la reserva ' + reserva.id
          )
          if (n > 0) mostrartoast('🧾 ' + n + ' cobro(s) vinculado(s) cancelado(s)')
        } catch (e) {
          console.error('Cancelación de cobros al eliminar la reserva falló:', e)
        }

        // 2. Liberar la seccion. Si no se pudo, el admin tiene que saberlo AHORA:
        //    la reserva ya no existe y la zona quedaria bloqueada sin dueño.
        const libera = await set_estado_zona(sb, usuario, reserva.juegoid, reserva.zonaid, 'libre')
        if (!libera.ok) {
          mostrartoast(
            '⚠️ La reserva se eliminó, pero la sección NO se pudo liberar en la base. ' +
            'Libérala a mano desde el mapa o vuelve a intentarlo.', 9000
          )
        }

        // 3. Desvincular las tarjetas del Pipeline que la apuntaban. Verificado:
        //    un fallo silencioso dejaba la tarjeta señalando una reserva que ya
        //    no existe.
        for (const p of pipeline || []) {
          if (!(p.reservaids || []).map(String).includes(String(reserva.id))) continue
          const quedan = (p.reservaids || []).filter((x) => String(x) !== String(reserva.id))
          const desv = await actualizar_verificado(
            sb, usuario, 'pipeline_prospectos', { reserva_ids: quedan }, p.id, null
          )
          if (!desv.ok) {
            mostrartoast(
              '⚠️ La reserva se eliminó, pero el prospecto ' + (p.folio || p.id) +
              ' no se pudo desvincular' +
              (desv.motivo === 'sin_permiso' ? ' (no tienes permiso sobre Pipeline).' : '.') +
              ' Recarga e inténtalo de nuevo.', 8000
            )
          }
        }

        mostrartoast('🗑 Reserva eliminada · ' + reserva.cliente)
        // Auditoria obligatoria: folio, cliente, seccion y MOTIVO.
        registrar_movimiento(sb, {
          tipo: 'ELIMINACIÓN_RESERVA',
          desc: 'Reserva ' + folio_visible(reserva) + ' eliminada · ' + reserva.cliente +
            ' · ' + (reserva.zona || '—') + ' · Motivo: ' + confirmacion.motivo,
          ref: folio_visible(reserva),
          usuario: usuario ? usuario.nombre : '—',
        })
        recargar()
        return { ok: true }
      } finally {
        setborrando(null)
      }
    },
    [usuario, pipeline, mostrartoast, recargar, cancelar_cobros_de_folios]
  )

  return { puede, puede_estados, guardar, guardando, eliminar, borrando }
}

export default usereservasescritura
