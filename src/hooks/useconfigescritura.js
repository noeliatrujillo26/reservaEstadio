// ═══════════════════════════════════════════════════════════════════
// useconfigescritura.js — escritura de los parametros globales
// (configuracion_panel: 'fiscal', 'cuenta_bancaria_default_id',
// 'cotiz_plantilla'). Ver la cabecera de lib/ajustes.js y
// migracion-configuracion-panel.sql.
//
// Guardar es un UPSERT de las TRES filas de un golpe: cualquiera de ellas
// puede no existir todavia (nunca se habia tocado esa llave), a diferencia
// de la version anterior sobre app_config (fila unica sembrada por su propia
// migracion, donde guardar era siempre un UPDATE).
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useState } from 'react'
import { sb } from '../supabaseclient'
import useadmin from './useadmin'
import useadmindatos from './useadmindatos'
import { usetoast } from '../context/toastcontext'
import {
  mensajes_bloqueo, motivo_bloqueo, registrar_movimiento, upsertar_verificado,
} from '../lib/escritura'
import { validar_config } from '../lib/ajustes'

export function useconfigescritura() {
  const { usuario } = useadmin()
  const { recargar } = useadmindatos()
  const { mostrartoast } = usetoast()
  const [guardando, setguardando] = useState(false)

  const puede = motivo_bloqueo(usuario, 'configuracion_panel') === null

  // datos = { fiscal: {razonsocial, nombrecomercial, rfc, domicilio,
  //           telefonos}, cuentabancariadefaultid, plantillarecibos:
  //           {nombre, color, logourl} }
  const guardar = useCallback(
    async (datos) => {
      const bloqueo = motivo_bloqueo(usuario, 'configuracion_panel')
      if (bloqueo) { mostrartoast(mensajes_bloqueo[bloqueo]); return { ok: false } }
      if (guardando) return { ok: false }

      const errores = validar_config(datos)
      if (errores.length) {
        mostrartoast('⚠️ ' + errores[0].mensaje)
        return { ok: false, campos: errores.map((e) => e.campo) }
      }

      setguardando(true)
      try {
        const ahora = new Date().toISOString()
        const filas = [
          {
            clave: 'fiscal',
            valor: {
              razon_social: (datos.fiscal && datos.fiscal.razonsocial) || '',
              nombre_comercial: (datos.fiscal && datos.fiscal.nombrecomercial) || '',
              rfc: (datos.fiscal && datos.fiscal.rfc) || '',
              domicilio: (datos.fiscal && datos.fiscal.domicilio) || '',
              telefonos: (datos.fiscal && datos.fiscal.telefonos) || '',
            },
            actualizado_en: ahora,
          },
          {
            clave: 'cuenta_bancaria_default_id',
            valor: datos.cuentabancariadefaultid ? Number(datos.cuentabancariadefaultid) : null,
            actualizado_en: ahora,
          },
          {
            // MISMA llave que usa la v1 para su plantilla del PDF de
            // cotizacion — ver la cabecera de lib/ajustes.js.
            clave: 'cotiz_plantilla',
            valor: {
              nombre: (datos.plantillarecibos && datos.plantillarecibos.nombre) || '',
              color: (datos.plantillarecibos && datos.plantillarecibos.color) || '',
              logo_url: (datos.plantillarecibos && datos.plantillarecibos.logourl) || '',
            },
            actualizado_en: ahora,
          },
        ]

        const res = await upsertar_verificado(sb, usuario, 'configuracion_panel', filas, 'clave')
        if (!res.ok) {
          mostrartoast(
            res.motivo === 'sin_filas'
              ? '⚠️ La base no aceptó el cambio (0 filas). Revisa las políticas RLS de `configuracion_panel` o si ya corriste migracion-configuracion-panel.sql.'
              : '⚠️ No se pudo guardar en Supabase' +
                ((res.error && res.error.message) ? ': ' + res.error.message : '.')
          )
          return { ok: false }
        }

        mostrartoast('✅ Parámetros guardados')
        registrar_movimiento(sb, {
          tipo: 'Admin', desc: 'Parámetros globales actualizados', ref: 'Ajustes',
          usuario: usuario ? usuario.nombre : '—',
        })
        await recargar()
        return { ok: true }
      } catch (err) {
        console.error('guardar configuracion_panel:', err)
        mostrartoast('⚠️ No se pudo guardar. Intenta de nuevo.')
        return { ok: false }
      } finally {
        setguardando(false)
      }
    },
    [usuario, guardando, mostrartoast, recargar]
  )

  return { puede, guardar, guardando }
}

export default useconfigescritura
