// ═══════════════════════════════════════════════════════════════════
// useconfigescritura.js — escritura de los parametros globales (app_config).
// Sin equivalente en la v1 — ver la cabecera de lib/config.js y
// migracion-app-config.sql.
//
// La fila es UNICA (id=1, sembrada por la migracion): guardar es siempre un
// UPDATE, nunca un INSERT — no hay alta que hacer.
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useState } from 'react'
import { sb } from '../supabaseclient'
import useadmin from './useadmin'
import useadmindatos from './useadmindatos'
import { usetoast } from '../context/toastcontext'
import {
  actualizar_verificado, mensajes_bloqueo, motivo_bloqueo, registrar_movimiento,
} from '../lib/escritura'
import { validar_config } from '../lib/ajustes'

const claves_legacy_config = ['fiscal', 'cuenta_bancaria_default_id', 'plantilla_recibos']

export function useconfigescritura() {
  const { usuario } = useadmin()
  const { recargar } = useadmindatos()
  const { mostrartoast } = usetoast()
  const [guardando, setguardando] = useState(false)

  const puede = motivo_bloqueo(usuario, 'app_config') === null

  // datos = { fiscal: {razonsocial, nombrecomercial, rfc, domicilio,
  //           telefonos}, cuentabancariadefaultid, plantillarecibos:
  //           {nombre, color, logourl} }
  const guardar = useCallback(
    async (datos) => {
      const bloqueo = motivo_bloqueo(usuario, 'app_config')
      if (bloqueo) { mostrartoast(mensajes_bloqueo[bloqueo]); return { ok: false } }
      if (guardando) return { ok: false }

      const errores = validar_config(datos)
      if (errores.length) {
        mostrartoast('⚠️ ' + errores[0].mensaje)
        return { ok: false, campos: errores.map((e) => e.campo) }
      }

      setguardando(true)
      try {
        const payload = {
          fiscal: {
            razon_social: (datos.fiscal && datos.fiscal.razonsocial) || '',
            nombre_comercial: (datos.fiscal && datos.fiscal.nombrecomercial) || '',
            rfc: (datos.fiscal && datos.fiscal.rfc) || '',
            domicilio: (datos.fiscal && datos.fiscal.domicilio) || '',
            telefonos: (datos.fiscal && datos.fiscal.telefonos) || '',
          },
          cuenta_bancaria_default_id: datos.cuentabancariadefaultid
            ? Number(datos.cuentabancariadefaultid)
            : null,
          plantilla_recibos: {
            nombre: (datos.plantillarecibos && datos.plantillarecibos.nombre) || '',
            color: (datos.plantillarecibos && datos.plantillarecibos.color) || '',
            logo_url: (datos.plantillarecibos && datos.plantillarecibos.logourl) || '',
          },
          actualizado_en: new Date().toISOString(),
          actualizado_por: usuario ? usuario.nombre : '—',
        }

        const res = await actualizar_verificado(
          sb, usuario, 'app_config', payload, 1, claves_legacy_config
        )
        if (!res.ok) {
          mostrartoast(
            res.motivo === 'sin_filas'
              ? '⚠️ La base no aceptó el cambio (0 filas). Revisa las políticas RLS de `app_config` o si ya corriste migracion-app-config.sql.'
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
        console.error('guardar app_config:', err)
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
