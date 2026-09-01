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
// El temporizador se LIMPIA pase lo que pase: sin el finally quedaba vivo
// aunque la promesa ya hubiera respondido, y cada intento de acceso dejaba
// otro colgando.
function con_tiempo(promesa, ms, etiqueta) {
  let id = null
  const limite = new Promise((_, rechazar) => {
    id = setTimeout(() => rechazar(new Error('Tiempo agotado: ' + etiqueta)), ms)
  })
  return Promise.race([promesa, limite]).finally(() => {
    if (id) clearTimeout(id)
  })
}

// Motivos por los que cargar_perfil() puede no devolver un usuario. Importa
// distinguirlos: un fallo tecnico NO es lo mismo que "no tienes acceso", y
// tratarlos igual cerraba la sesion de alguien que si tenia permiso.
export const sin_sesion = 'sin_sesion'
export const sin_perfil = 'sin_perfil'
export const fallo_tecnico = 'fallo_tecnico'

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
  // devuelve { usuario } o { motivo }. Nunca lanza: quien la llama decide que
  // mensaje mostrar segun el motivo.
  const cargar_perfil = useCallback(async () => {
    let user = null
    try {
      const r = await con_tiempo(sb.auth.getUser(), 5000, 'auth.getUser')
      // lectura DEFENSIVA: sin sesion algunas versiones devuelven data en null
      // y el destructurado directo lanzaba un TypeError que se confundia con
      // "no tienes acceso".
      user = (r && r.data && r.data.user) || null
    } catch (e) {
      // sin sesion guardada supabase rechaza; eso no es un fallo tecnico.
      const msg = String((e && e.message) || '')
      if (/session|Auth session missing/i.test(msg)) return { motivo: sin_sesion }
      console.error('admin/getUser:', e)
      return { motivo: fallo_tecnico }
    }
    if (!user) return { motivo: sin_sesion }

    // tope de 3.5 s: si la tabla usuarios no responde, mejor un error visible
    // que una pantalla de carga eterna.
    let perfil = null
    try {
      const r = await con_tiempo(
        sb.from('usuarios').select('*').eq('email', user.email).maybeSingle(),
        3500,
        'perfil de usuario'
      )
      if (r && r.error) throw r.error
      perfil = r ? r.data : null
    } catch (e) {
      console.error('admin/perfil:', e)
      return { motivo: fallo_tecnico }
    }

    // "Invitado" tambien puede entrar: es quien acaba de crear su contrasena
    // desde el correo de invitacion.
    if (!perfil || (perfil.estado !== 'Activo' && perfil.estado !== 'Invitado')) {
      return { motivo: sin_perfil }
    }

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
      usuario: {
        id: perfil.id,
        nombre: perfil.nombre,
        email: perfil.email,
        rol: perfil.rol,
        permisos,
        iniciales: iniciales_de(perfil.nombre),
      },
    }
  }, [])

  // sesion ya guardada por supabase: se entra sin volver a teclear.
  useEffect(() => {
    let vivo = true
    cargar_perfil()
      .then((r) => {
        if (!vivo) return
        if (r.usuario) {
          setusuario(r.usuario)
          setestado('dentro')
          return
        }
        // Pase lo que pase se llega al LOGIN, nunca se queda en "Verificando".
        // Si fue un fallo tecnico se dice, para no dar a entender que las
        // credenciales o los permisos estan mal.
        if (r.motivo === fallo_tecnico) {
          seterror('No se pudo verificar tu sesión. Revisa tu conexión e inicia sesión de nuevo.')
        }
        setestado('fuera')
      })
      .catch((e) => {
        console.error('admin/verificacion inicial:', e)
        if (!vivo) return
        seterror('No se pudo verificar tu sesión. Inicia sesión de nuevo.')
        setestado('fuera')
      })
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
      const r = await cargar_perfil().catch(() => ({ motivo: fallo_tecnico }))
      if (!r.usuario) {
        // Un fallo tecnico NO cierra la sesion: las credenciales eran validas
        // y cerrarla obligaba a teclearlas de nuevo por un problema de red.
        if (r.motivo === fallo_tecnico) {
          seterror('Entraste, pero no pudimos leer tu perfil. Reintenta en unos segundos.')
          return false
        }
        seterror('Tu cuenta no tiene acceso al panel. Contacta a un administrador.')
        await sb.auth.signOut()
        return false
      }
      setusuario(r.usuario)
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
