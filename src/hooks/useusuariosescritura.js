// ═══════════════════════════════════════════════════════════════════
// useusuariosescritura.js — CREAR, EDITAR, ACTIVAR/DESACTIVAR y ELIMINAR
// cuentas del panel.
// espejo 1:1 de v1: guardarUsuario(), toggleUsuario() y eliminarUsuario()
// (js/22-usuarios-clientes.js).
//
// LO QUE ARRASTRA CADA UNA
//   guardar          → alta: crea la cuenta de ACCESO en /api/usuarios
//                       (service key, la anon key no puede tocar auth.users)
//                       y LUEGO el perfil en `usuarios`. Edicion: si viene
//                       contraseña nueva, la cambia via el mismo endpoint
//                       ANTES de tocar el perfil — igual que la v1, las dos
//                       operaciones deben quedar bien o el modal no cierra.
//   alternar_estado  → Activo ⇄ Inactivo, directo sobre el perfil.
//   eliminar         → borra el PERFIL (no la cuenta de auth.users, que
//                       requiere service key y no hace falta: sin fila en
//                       `usuarios` el login queda bloqueado igual). Trae el
//                       candado anti-lockout de la v1: nadie borra la cuenta
//                       con la que tiene la sesion abierta.
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
import { permisos_desde_estado, validar_usuario } from '../lib/usuarios'

const claves_legacy_usuario = ['nombre', 'email', 'rol', 'permisos', 'estado', 'acceso']

async function token_sesion() {
  const { data } = await sb.auth.getSession()
  return (data && data.session && data.session.access_token) || ''
}

async function llamar_api_usuarios(body) {
  const token = await token_sesion()
  const resp = await fetch('/api/usuarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  })
  const datos = await resp.json().catch(() => ({}))
  return { ok: resp.ok, datos }
}

export function useusuariosescritura() {
  const { usuario } = useadmin()
  const { recargar } = useadmindatos()
  const { mostrartoast } = usetoast()
  const [guardando, setguardando] = useState(false)
  const [borrando, setborrando] = useState(null)

  const puede = motivo_bloqueo(usuario, 'usuarios') === null

  // ── CREAR / EDITAR ───────────────────────────────────────────
  // datos = { editando, nombre, email, rol, estado, password, marcados,
  //           niveles } — marcados/niveles son los mapas {modulo: bool} y
  //           {modulo: 'ver'|'editar'} que arma el formulario de permisos.
  const guardar = useCallback(
    async (datos) => {
      const bloqueo = motivo_bloqueo(usuario, 'usuarios')
      if (bloqueo) { mostrartoast(mensajes_bloqueo[bloqueo]); return { ok: false } }
      if (guardando) return { ok: false }

      const editando = datos.editando || null
      const errores = validar_usuario(datos, !editando)
      if (errores.length) {
        mostrartoast('⚠️ ' + errores[0].mensaje)
        return { ok: false, campos: errores.map((e) => e.campo) }
      }

      const nombre = String(datos.nombre).trim()
      const email = String(datos.email).trim().toLowerCase()
      const permisos = permisos_desde_estado(datos.marcados, datos.niveles)

      setguardando(true)
      try {
        if (editando) {
          if (datos.password) {
            const { ok, datos: r } = await llamar_api_usuarios({
              action: 'cambiar-password',
              authId: editando.authid || null,
              email: editando.email,
              newPassword: datos.password,
            })
            if (!ok || r.success !== true) {
              mostrartoast('⛔ Error al cambiar la contraseña: ' + (r.error || 'error desconocido'))
              return { ok: false, campos: ['password'] }
            }
          }

          const payload = { nombre, email, rol: datos.rol, estado: datos.estado, permisos }
          const res = await actualizar_verificado(
            sb, usuario, 'usuarios', payload, editando.id, claves_legacy_usuario
          )
          if (!res.ok) {
            mostrartoast(
              res.motivo === 'sin_filas'
                ? '⚠️ La base no aceptó el cambio (0 filas). Revisa las políticas RLS de `usuarios`.' +
                  (datos.password ? ' La contraseña SÍ se cambió.' : '')
                : '⚠️ No se pudo guardar en Supabase' +
                  ((res.error && res.error.message) ? ': ' + res.error.message : '.')
            )
            return { ok: false }
          }

          mostrartoast(datos.password ? '✅ Usuario y contraseña actualizados' : '✅ Usuario actualizado')
          registrar_movimiento(sb, {
            tipo: 'Admin',
            desc: 'Usuario editado · ' + nombre + (datos.password ? ' (con cambio de contraseña)' : ''),
            ref: datos.rol,
            usuario: usuario ? usuario.nombre : '—',
          })
          await recargar()
          return { ok: true }
        }

        // ── ALTA ──
        const { ok, datos: alta } = await llamar_api_usuarios({
          action: 'crear', email, password: datos.password, nombre, rol: datos.rol,
        })
        if (!ok || !alta.success) {
          mostrartoast('⚠️ ' + (alta.error || 'No se pudo crear la cuenta.'))
          return { ok: false, campos: /contraseñ/i.test(alta.error || '') ? ['password'] : [] }
        }

        // sin `id`: a diferencia de cotizaciones/reservas/pipeline_prospectos,
        // `usuarios.id` lo genera la base sola (serial), igual que en la v1
        // (sbInsertCompat tampoco lo manda).
        const res = await insertar_verificado(sb, usuario, 'usuarios', {
          nombre, email, rol: datos.rol, permisos, estado: 'Activo', acceso: '—',
          auth_id: alta.authId || null,
        }, claves_legacy_usuario)
        if (!res.ok) {
          mostrartoast(
            '⚠️ La cuenta de acceso se creó, pero el perfil NO se guardó en `usuarios`: ' +
            ((res.error && res.error.message) || res.motivo || '') +
            ' — corrige y vuelve a guardar (no se duplicará la cuenta).'
          )
          return { ok: false }
        }

        mostrartoast('✅ ¡Usuario creado! Ya puede iniciar sesión con el correo y la contraseña definidos.')
        registrar_movimiento(sb, {
          tipo: 'Admin', desc: 'Usuario creado · ' + nombre, ref: datos.rol,
          usuario: usuario ? usuario.nombre : '—',
        })
        await recargar()
        return { ok: true }
      } catch (err) {
        console.error('guardar usuario:', err)
        mostrartoast('⚠️ No se pudo guardar el usuario. Intenta de nuevo.')
        return { ok: false }
      } finally {
        setguardando(false)
      }
    },
    [usuario, guardando, mostrartoast, recargar]
  )

  // ── ACTIVAR / DESACTIVAR ──────────────────────────────────────
  const alternar_estado = useCallback(
    async (u) => {
      const bloqueo = motivo_bloqueo(usuario, 'usuarios')
      if (bloqueo) { mostrartoast(mensajes_bloqueo[bloqueo]); return { ok: false } }

      const nuevo = u.estado === 'Activo' ? 'Inactivo' : 'Activo'
      const res = await actualizar_verificado(sb, usuario, 'usuarios', { estado: nuevo }, u.id, ['estado'])
      if (!res.ok) {
        mostrartoast(
          res.motivo === 'sin_filas'
            ? '⚠️ La base no aceptó el cambio (0 filas). Revisa las políticas RLS de `usuarios`.'
            : '⚠️ No se pudo actualizar en Supabase'
        )
        return { ok: false }
      }
      mostrartoast((nuevo === 'Activo' ? '✅ Usuario activado' : '🚫 Usuario desactivado') + ' · ' + u.nombre)
      registrar_movimiento(sb, {
        tipo: 'Admin', desc: 'Usuario ' + nuevo.toLowerCase() + ' · ' + u.nombre, ref: u.rol,
        usuario: usuario ? usuario.nombre : '—',
      })
      await recargar()
      return { ok: true }
    },
    [usuario, mostrartoast, recargar]
  )

  // ── ELIMINAR ─────────────────────────────────────────────────
  // `confirmacion` viene de useconfirmarseguro() ({ motivo: '' } sin
  // pedirmotivo, o null si se cancelo) — el llamador ya verifico la
  // contraseña real de quien tiene la sesion.
  const eliminar = useCallback(
    async (u, confirmacion) => {
      const bloqueo = motivo_bloqueo(usuario, 'usuarios')
      if (bloqueo) { mostrartoast(mensajes_bloqueo[bloqueo]); return { ok: false } }
      if (!confirmacion) return { ok: false }
      // candado anti-lockout: nadie elimina la cuenta con la que tiene la
      // sesion abierta.
      if (usuario && String(usuario.email || '').toLowerCase() === String(u.email || '').toLowerCase()) {
        mostrartoast('⚠️ No puedes eliminar la cuenta con la que tienes la sesión abierta')
        return { ok: false }
      }

      setborrando(u.id)
      try {
        const res = await borrar_verificado(sb, usuario, 'usuarios', u.id)
        if (!res.ok) {
          mostrartoast(
            res.motivo === 'sin_filas'
              ? '⚠️ La base no aceptó el borrado (0 filas). Revisa las políticas RLS de `usuarios`.'
              : '⚠️ No se pudo eliminar en Supabase'
          )
          return { ok: false }
        }
        mostrartoast('🗑 Usuario eliminado · ' + u.nombre)
        registrar_movimiento(sb, {
          tipo: 'Admin', desc: 'Usuario eliminado · ' + u.nombre, ref: u.rol,
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

  return { puede, guardar, guardando, alternar_estado, eliminar, borrando }
}

export default useusuariosescritura
