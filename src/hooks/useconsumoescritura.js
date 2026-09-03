// ═══════════════════════════════════════════════════════════════════
// useconsumoescritura.js — eliminar el registro de consumo de una reserva.
// espejo 1:1 de v1: eliminarConsumoReserva() (js/01-nucleo.js).
//
// LA UNICA ESCRITURA que tiene esta vista: pone `reservas.saldo_consumo` en
// $0. NO borra la fila de `reservas` — el registro de esta vista ES la
// reserva, y borrarla se llevaria tambien su historial y su lugar en
// secciones. La reserva sigue existiendo, solo deja de traer consumo
// incluido.
//
// SIN RIESGO DE SALDO NEGATIVO: la unica operacion posible es fijarlo en 0,
// nunca restar una cantidad. La validacion de "nunca negativo" que si hace
// falta —abonar/aplicar saldo A FAVOR del cliente sin que quede bajo cero—
// ya vive en mover_saldo_favor() (lib/cascadas.js) y se ejerce desde Cobros
// y desde el registro de pagos del Pipeline.
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useState } from 'react'
import { sb } from '../supabaseclient'
import useadmin from './useadmin'
import useadmindatos from './useadmindatos'
import { usetoast } from '../context/toastcontext'
import { actualizar_verificado, mensajes_bloqueo, motivo_bloqueo, registrar_movimiento } from '../lib/escritura'
import { mxn2 } from '../lib/dinero'

const money = (n) => '$' + (Number(n) || 0).toLocaleString('es-MX', mxn2)

export function useconsumoescritura() {
  const { usuario } = useadmin()
  const { recargar } = useadmindatos()
  const { mostrartoast } = usetoast()
  const [borrando, setborrando] = useState(null)

  // El consumo cuelga de una reserva, asi que su escritura la gobierna la
  // MISMA guardia de la tabla `reservas` (seccionesreservadas / pipeline /
  // cobros / palcos) -- espejo exacto de la v1: su guardia por tabla nunca
  // incluyo 'consumos' entre los dueños de `reservas`, aunque 'consumos' sea
  // una llave de permiso propia que controla el MENU y el boton visible. En
  // la practica, quien administra Saldo de Consumo ya trae uno de esos
  // cuatro (la Vendedora, por ejemplo, tiene seccionesreservadas:'editar').
  // No se le agrega 'consumos' a esa lista a proposito: haria mas ancho el
  // permiso equivocado -- concederia tambien crear/editar/eliminar
  // reservas enteras y bloquear secciones, no solo vaciar un consumo.
  const puede = motivo_bloqueo(usuario, 'reservas') === null

  const eliminar = useCallback(
    async (r) => {
      const bloqueo = motivo_bloqueo(usuario, 'reservas')
      if (bloqueo) {
        mostrartoast(mensajes_bloqueo[bloqueo])
        return { ok: false }
      }

      const montotxt = money(r.saldoconsumo)
      setborrando(r.id)
      try {
        const res = await actualizar_verificado(
          sb, usuario, 'reservas', { saldo_consumo: 0 }, r.id, ['saldo_consumo']
        )
        if (!res.ok) {
          mostrartoast(
            res.motivo === 'sin_filas'
              ? '⚠️ La base no aceptó el cambio (0 filas). Revisa las políticas RLS de `reservas`.'
              : '⚠️ No se pudo eliminar en Supabase' +
                ((res.error && res.error.message) ? ': ' + res.error.message : '.')
          )
          return { ok: false }
        }

        mostrartoast('🗑 Registro de consumo eliminado · ' + r.cliente)
        registrar_movimiento(sb, {
          tipo: 'Admin',
          desc: 'Consumo incluido eliminado (' + montotxt + ') · ' + r.cliente,
          ref: 'Reserva #' + r.id,
          usuario: usuario ? usuario.nombre : '—',
        })
        await recargar()
        return { ok: true }
      } finally {
        setborrando(null)
      }
    },
    [usuario, mostrartoast, recargar]
  )

  return { puede, eliminar, borrando }
}

export default useconsumoescritura
