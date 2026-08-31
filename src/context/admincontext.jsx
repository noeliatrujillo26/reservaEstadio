// ═══════════════════════════════════════════════════════════════════
// admincontext.jsx — sesion del panel de administracion.
// espejo de v1: iniciarSesion(), verificarYEntrar() y cerrarSesion() de
// js/30-init.js.
//
// dos candados, igual que la v1:
//   1. supabase auth valida correo y contrasena
//   2. el perfil de la tabla `usuarios` debe existir y estar en estado
//      'Activo' o 'Invitado'; si no, se cierra la sesion de inmediato
//
// SOLO LECTURA en esta fase: la v1 ademas PROMUEVE al usuario 'Invitado' a
// 'Activo' con un update en su primer acceso. Ese update se deja pendiente
// hasta validar el modulo — ver la nota en cargar_perfil().
// ═══════════════════════════════════════════════════════════════════

import { createContext, useCallback, useEffect, useState } from 'react'
import { sb } from '../supabaseclient'
import { perms_default } from '../lib/permisos'

export const admincontext = createContext(null)

// mientras no sea 'true', el panel no escribe nada en produccion.
export const escritura_admin = import.meta.env.VITE_ESCRITURA_ADMIN === 'true'

// tope de espera para que una consulta colgada no deje la pantalla de carga
// eterna — espejo de _conTimeout() de la v1.
function con_tiempo(promesa, ms, etiqueta) {
  return Promise.race([
    promesa,
    new Promise((_, rechazar) =>
      setTimeout(() => rechazar(new Error('Tiempo agotado: ' + etiqueta)), ms)
    ),
  ])
}

function iniciales_de(nombre) {
  return String(nombre || '')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function adminprovider({ children }) {
  const [usuario, setusuario] = useState(null)
  // 'verificando' mientras se resuelve la sesion guardada; luego 'fuera' o 'dentro'.
  const [estado, setestado] = useState('verificando')
  const [error, seterror] = useState('')

  // ── perfil y permisos ───────────────────────────────────────────
  // espejo de verificarYEntrar(): sin perfil valido NO se entra.
  const cargar_perfil = useCallback(async () => {
    const { data: { user } } = await con_tiempo(sb.auth.getUser(), 5000, 'auth.getUser')
    if (!user) return null

    // tope de 3.5 s: si la tabla usuarios no responde, mejor un error visible
    // que una pantalla de carga eterna.
    const { data: perfil, error: err } = await con_tiempo(
      sb.from('usuarios').select('*').eq('email', user.email).maybeSingle(),
      3500,
      'perfil de usuario'
    )

    // "Invitado" tambien puede entrar: es quien acaba de crear su contrasena
    // desde el correo de invitacion.
    if (err || !perfil || (perfil.estado !== 'Activo' && perfil.estado !== 'Invitado')) return null

    // PENDIENTE (escritura): la v1 aqui promueve el perfil 'Invitado' a
    // 'Activo' con un update. Esta fase es de solo lectura, asi que no se
    // ejecuta — el usuario entra igual, solo que su estado no cambia todavia.
    // Se habilita junto con VITE_ESCRITURA_ADMIN.

    let permisos = Array.isArray(perfil.permisos)
      ? perfil.permisos.reduce((acc, p) => { acc[p] = 'editar'; return acc }, {})
      : perfil.permisos || {}
    // perfiles no-admin creados antes del sistema de permisos (mapa vacio):
    // reciben los de su rol para no quedar sin acceso.
    if (!Object.keys(permisos).length && perms_default[perfil.rol]) {
      permisos = { ...perms_default[perfil.rol] }
    }

    return {
      id: perfil.id,
      nombre: perfil.nombre,
      email: perfil.email,
      rol: perfil.rol,
      permisos,
      iniciales: iniciales_de(perfil.nombre),
    }
  }, [])

  // sesion ya guardada por supabase: se entra sin volver a teclear.
  useEffect(() => {
    let vivo = true
    cargar_perfil()
      .then((u) => {
        if (!vivo) return
        if (u) { setusuario(u); setestado('dentro') }
        else { setestado('fuera') }
      })
      .catch(() => { if (vivo) setestado('fuera') })
    return () => { vivo = false }
  }, [cargar_perfil])

  const iniciar_sesion = useCallback(
    async (email, password) => {
      seterror('')
      const { error: err } = await sb.auth.signInWithPassword({ email, password })
      if (err) {
        seterror('Correo o contraseña incorrectos.')
        return false
      }
      const u = await cargar_perfil().catch(() => null)
      if (!u) {
        seterror('Tu cuenta no tiene acceso al panel. Contacta a un administrador.')
        await sb.auth.signOut()
        return false
      }
      setusuario(u)
      setestado('dentro')
      return true
    },
    [cargar_perfil]
  )

  const cerrar_sesion = useCallback(async () => {
    // limpiar la vista recordada: el proximo inicio entra al Dashboard.
    try { localStorage.removeItem('admin_last_view') } catch (e) {}
    await sb.auth.signOut()
    setusuario(null)
    setestado('fuera')
  }, [])

  const valor = { usuario, estado, error, seterror, iniciar_sesion, cerrar_sesion, escritura_admin }

  return <admincontext.Provider value={valor}>{children}</admincontext.Provider>
}

export default adminprovider
