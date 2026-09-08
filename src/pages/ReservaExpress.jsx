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
// AUTORIZACION: solo `estado === 'dentro'` (sesión de administrador activa)
// — a proposito NO se repite aqui ningun candado de permiso por rol o de la
// bandera VITE_ESCRITURA_ADMIN. Cualquier cuenta que pueda iniciar sesión en
// el panel queda habilitada para este módulo móvil; ver la cabecera de
// usereservaexpress.js para el detalle de por qué sus escrituras tampoco
// repiten ese candado.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import AdminProvider from '../context/admincontext'
import useadmin from '../hooks/useadmin'
import AdminDatosProvider from '../context/admindatoscontext'
import ToastProvider from '../context/toastcontext'
import Toast from '../components/ui/toast'
import FormularioExpress from '../components/reservaexpress/formularioexpress'
import '../styles/reserva-express.css'

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
          <img src="/logo-naranjeros.png" alt="Naranjeros" className="re-logo" />
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

function pantalla() {
  const { estado } = useadmin()

  useEffect(() => {
    document.title = 'Reserva Express — Naranjeros Admin'
  }, [])

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
