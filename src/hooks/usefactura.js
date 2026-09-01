// ═══════════════════════════════════════════════════════════════════
// usefactura.js — interruptor "Requiere factura" de un cobro.
// espejo 1:1 de v1: toggleRequiereFactura() (js/modules/cobros.js).
//
// Es la PRIMERA escritura del panel, y se eligio a proposito: toca una sola
// columna, no mueve dinero, no cascadea a otras tablas y se deshace pulsando
// de nuevo. Ejerce toda la cadena — permiso, RLS, escritura verificada,
// bitacora y refresco — sin poner en riesgo ningun saldo.
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useState } from 'react'
import { sb } from '../supabaseclient'
import useadmin from './useadmin'
import useadmindatos from './useadmindatos'
import { usetoast } from '../context/toastcontext'
import {
  actualizar_verificado, mensajes_bloqueo, motivo_bloqueo, registrar_movimiento,
} from '../lib/escritura'
import { cobro_cancelado, requiere_factura } from '../lib/cobros'

export function usefactura() {
  const { usuario } = useadmin()
  const { recargar } = useadmindatos()
  const { mostrartoast } = usetoast()
  // id del cobro en vuelo, para deshabilitar solo ese boton.
  const [guardando, setguardando] = useState(null)

  const puede = motivo_bloqueo(usuario, 'cobros') === null

  const alternar = useCallback(
    async (c) => {
      const bloqueo = motivo_bloqueo(usuario, 'cobros')
      if (bloqueo) {
        mostrartoast(mensajes_bloqueo[bloqueo])
        return
      }
      // un cobro cancelado se conserva tal cual: su estado de factura ya no
      // se toca, igual que en la v1.
      if (cobro_cancelado(c)) {
        mostrartoast('⚠️ Este cobro está cancelado: su estado de factura no se puede cambiar.')
        return
      }

      const nuevo = requiere_factura(c) ? '' : 'REQUERIDA'
      setguardando(c.id)
      const r = await actualizar_verificado(sb, usuario, 'cobros', { factura: nuevo }, c.id, ['factura'])
      setguardando(null)

      if (!r.ok) {
        mostrartoast(
          r.motivo === 'sin_filas'
            ? '⚠️ No se pudo actualizar: la base no aceptó el cambio (0 filas).'
            : '⚠️ No se pudo actualizar el estado de factura' +
              (r.error && r.error.message ? ': ' + r.error.message : '.')
        )
        return
      }

      mostrartoast(
        '🧾 Estado de factura actualizado · ' +
          (nuevo === 'REQUERIDA' ? '✓ Requiere factura' : 'No requiere factura')
      )
      registrar_movimiento(sb, {
        tipo: 'Admin',
        desc: 'Requiere factura → ' + (nuevo === 'REQUERIDA' ? 'SÍ' : 'NO') + ' · ' + (c.cliente || '—'),
        ref: c.folio || '—',
        usuario: usuario ? usuario.nombre : '—',
      })
      // se relee de la base en vez de parchear en memoria: lo que se ve queda
      // siendo lo que la base tiene, sin lugar a que diverjan.
      recargar()
    },
    [usuario, mostrartoast, recargar]
  )

  return { alternar, guardando, puede }
}

export default usefactura
