// ═══════════════════════════════════════════════════════════════════
// ReservaExpress.jsx — /reserva-express, alta ULTRA RAPIDA de una
// "Reserva Momentánea" desde el celular (pensada para una llamada).
//
// Sin equivalente en la v1: pantalla nueva. Reutiliza la MISMA sesión de
// administrador que /admin (AdminProvider/useadmin — correo+contraseña
// verificados contra Supabase Auth y el perfil en `usuarios`) pero SIN el
// resto del shell del panel (sin sidebar, sin topbar de escritorio): es una
// sola pantalla vertical, mobile-first, con su propio CSS acotado
// (reserva-express.css) — mismo patrón que /legales y /mis-reservas.
//
// Los tres estados de sesión son los MISMOS que admin.jsx:
//   verificando → resolviendo la sesión guardada
//   fuera       → login (propio, no el de escritorio — ver adminlogin.jsx)
//   dentro      → el formulario, ya con AdminDatosProvider montado
//
// AUTORIZACION (14 sep 2026): sesión de administrador activa Y el permiso
// `reserva_express` en su perfil (tabla `usuarios`, columna `permisos` —
// mismo objeto {modulo: 'ver'|'editar'} del panel v1, otorgado desde
// Usuarios → Editar usuario → Herramientas → Reserva Express). El rol
// Administrador siempre pasa: es quien reparte los demás permisos, y las
// cuentas Administrador creadas antes de que existiera esta bandera no
// deben quedar fuera solo porque su `permisos` guardado nunca la incluyó.
// Sin ninguno de los dos: mensaje explícito y CIERRE de sesión — a
// diferencia de /admin, aquí SÍ hay un candado de permiso porque el acceso
// a esta app móvil ahora es explícitamente opt-in por cuenta.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import AdminProvider from '../context/admincontext'
import useadmin from '../hooks/useadmin'
import AdminDatosProvider from '../context/admindatoscontext'
import ToastProvider from '../context/toastcontext'
import Toast from '../components/ui/toast'
import FormularioExpress from '../components/reservaexpress/formularioexpress'
import '../styles/reserva-express.css'

function tiene_acceso_reserva_express(usuario) {
  if (!usuario) return false
  if (usuario.rol === 'Administrador') return true
  return !!(usuario.permisos && usuario.permisos.reserva_express)
}

function PantallaAcceso() {
  const { iniciar_sesion, error } = useadmin()
  const [email, setemail] = useState('')
  const [password, setpassword] = useState('')
  const [entrando, setentrando] = useState(false)

  async function entrar() {
    setentrando(true)
    await iniciar_sesion(email.trim(), password)
    setentrando(false)
  }

  return (
    <div className="re-acceso">
      <div className="re-acceso-card">
        <a href="/" className="re-logo-link" aria-label="Ir a la página principal" title="Ir a la página principal">
          <img src={import.meta.env.BASE_URL + 'logo-naranjeros.png'} alt="Naranjeros" className="re-logo" />
        </a>
        <h1>Reserva Express</h1>
        <p className="re-sub">Inicia sesión con tu cuenta de administrador para crear una reserva momentánea.</p>

        <div className="re-campo">
          <label>Correo</label>
          <input
            className="re-input" type="email" inputMode="email" autoComplete="username"
            placeholder="tu@naranjeros.mx" value={email} onChange={(e) => setemail(e.target.value)}
          />
        </div>
        <div className="re-campo">
          <label>Contraseña</label>
          <input
            className="re-input" type="password" autoComplete="current-password" placeholder="••••••••"
            value={password} onChange={(e) => setpassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') entrar() }}
          />
        </div>

        {error && <div className="re-error">{error}</div>}

        <button className="re-btn re-btn-primario" onClick={entrar} disabled={entrando}>
          {entrando ? 'Entrando…' : 'Iniciar sesión'}
        </button>
      </div>
    </div>
  )
}

// Se muestra cuando una sesión válida NO trae el permiso `reserva_express`
// (ni es Administrador). La sesión de Supabase ya se cerró para cuando esto
// se pinta (ver el useEffect de abajo) — "Volver a intentar" recarga la
// página entera, así que un cambio de cuenta arranca con React limpio.
function PantallaSinPermiso() {
  return (
    <div className="re-acceso">
      <div className="re-acceso-card">
        <a href="/" className="re-logo-link" aria-label="Ir a la página principal" title="Ir a la página principal">
          <img src={import.meta.env.BASE_URL + 'logo-naranjeros.png'} alt="Naranjeros" className="re-logo" />
        </a>
        <h1>Reserva Express</h1>
        <div className="re-error">
          No tienes permisos para acceder a Reserva Express. Pídele a un administrador que te lo otorgue desde
          Usuarios → Editar usuario → Herramientas.
        </div>
        <button className="re-btn re-btn-primario" style={{ marginTop: '16px' }} onClick={() => window.location.reload()}>
          Volver a intentar
        </button>
      </div>
    </div>
  )
}

function pantalla() {
  const { estado, usuario, cerrar_sesion } = useadmin()
  // Sticky a propósito: cerrar_sesion() abajo hace que `estado` vuelva a
  // 'fuera', y sin esta bandera aparte el render caería al `if (estado ===
  // 'fuera')` de más abajo y mostraría el login de nuevo en vez del mensaje.
  const [sinpermiso, setsinpermiso] = useState(false)

  useEffect(() => {
    document.title = 'Reserva Express — Naranjeros Admin'
  }, [])

  useEffect(() => {
    if (estado === 'dentro' && !tiene_acceso_reserva_express(usuario)) {
      setsinpermiso(true)
      cerrar_sesion()
    }
  }, [estado, usuario, cerrar_sesion])

  if (sinpermiso) {
    return <PantallaSinPermiso />
  }

  if (estado === 'verificando') {
    return <div className="re-cargando">Verificando sesión…</div>
  }

  if (estado === 'fuera') {
    return <PantallaAcceso />
  }

  return (
    <AdminDatosProvider>
      <FormularioExpress />
      <Toast />
    </AdminDatosProvider>
  )
}

const Pantalla = pantalla

export default function reservaexpress() {
  return (
    <div className="pagina-reserva-express">
      <AdminProvider>
        <ToastProvider>
          <Pantalla />
        </ToastProvider>
      </AdminProvider>
    </div>
  )
}
