// ═══════════════════════════════════════════════════════════════════
// admin.jsx — contenedor del panel de administracion.
// espejo de v1: index.html (login + <aside class="sidebar"> + <main>).
//
// MODULO 1: layout y autenticacion. Las 19 secciones del menu ya estan y
// responden al clic, pero su contenido llega en los modulos siguientes.
//
// tres estados, como la v1 con sus clases en <body>:
//   verificando → resolviendo la sesion guardada (equivale a .auth-waiting)
//   fuera       → pantalla de login
//   dentro      → panel completo (.authed)
//
// en la v1 la ruta del panel era index.html; aqui es /admin, porque
// index.html ya lo ocupa el shell de la spa.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import AdminProvider from '../context/admincontext'
import useadmin from '../hooks/useadmin'
import AdminLogin from '../components/admin/adminlogin'
import AdminSidebar from '../components/admin/adminsidebar'
import AdminDatosProvider from '../context/admindatoscontext'
import Dashboard from '../components/admin/dashboard'
import Cobros from '../components/admin/cobros'
import Reservas from '../components/admin/reservas'
import Clientes from '../components/admin/clientes'
import Usuarios from '../components/admin/usuarios'
import Movimientos from '../components/admin/movimientos'
import Consumos from '../components/admin/consumos'
import Temporadas from '../components/admin/temporadas'
import Descuentos from '../components/admin/descuentos'
import Metodos from '../components/admin/metodos'
import Reportes from '../components/admin/reportes'
import Mensajes from '../components/admin/mensajes'
import Landing from '../components/admin/landing'
import Precios from '../components/admin/precios'
import Cotizaciones from '../components/admin/cotizaciones'
import Pipeline from '../components/admin/pipeline'
import Palcos from '../components/admin/palcos'
import secciones_nav from '../components/admin/adminnav'
import '../styles/admin.css'
import '../styles/admin-responsive.css'

// modulos ya migrados: id de la v1 -> su vista. Los que faltan caen al aviso
// de "pendiente de migrar".
const MIGRADOS = {
  dashboard: <Dashboard />,
  cobros: <Cobros />,
  seccionesreservadas: <Reservas />,
  clientes: <Clientes />,
  usuarios: <Usuarios />,
  movimientos: <Movimientos />,
  consumos: <Consumos />,
  temporadas: <Temporadas />,
  descuentos: <Descuentos />,
  metodos: <Metodos />,
  reportes: <Reportes />,
  mensajes: <Mensajes />,
  landing: <Landing />,
  precios: <Precios />,
  cotizaciones: <Cotizaciones />,
  pipeline: <Pipeline />,
  palcos: <Palcos />,
}

// titulo legible de la seccion, para la barra superior movil.
function titulo_de(id) {
  for (const sec of secciones_nav) {
    const it = sec.items.find((x) => x.id === id)
    if (it) return it.texto
  }
  return 'Panel Admin'
}

function panel() {
  const { estado, escritura_admin } = useadmin()

  // la v1 recuerda la ultima seccion visitada en localStorage.
  const [vista, setvista] = useState(() => {
    try {
      return localStorage.getItem('admin_last_view') || 'dashboard'
    } catch (e) {
      return 'dashboard'
    }
  })
  const [drawer, setdrawer] = useState(false)

  useEffect(() => {
    document.title = 'Admin — Naranjeros Zonas de Asadores'
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('admin_last_view', vista)
    } catch (e) {}
  }, [vista])

  // el cajon se cierra con Escape, como cualquier panel deslizante.
  useEffect(() => {
    function al_teclear(e) {
      if (e.key === 'Escape') setdrawer(false)
    }
    window.addEventListener('keydown', al_teclear)
    return () => window.removeEventListener('keydown', al_teclear)
  }, [])

  if (estado === 'verificando') {
    return (
      <div className="pagina-admin" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-3)' }}>Verificando sesión…</div>
      </div>
    )
  }

  if (estado === 'fuera') {
    return (
      <div className="pagina-admin">
        <AdminLogin />
      </div>
    )
  }

  return (
    <AdminDatosProvider>
      <div className={'pagina-admin authed' + (drawer ? ' drawer-abierto' : '')}>
      <div className="admin-velo" onClick={() => setdrawer(false)} />

      <AdminSidebar vista={vista} onvista={setvista} oncerrardrawer={() => setdrawer(false)} />

      <main className="main">
        <div className="admin-topbar">
          <button
            className="admin-topbar-btn" onClick={() => setdrawer((v) => !v)}
            aria-label="Abrir menú" aria-expanded={drawer}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <span className="admin-topbar-titulo">{titulo_de(vista)}</span>
        </div>

        {MIGRADOS[vista] ? (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {MIGRADOS[vista]}
          </div>
        ) : (
          <div className="page active" style={{ padding: '28px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <div className="page-header">
              <h2>{titulo_de(vista)}</h2>
              <p>Módulo pendiente de migrar.</p>
            </div>

            <div className="card" style={{ padding: '20px', marginTop: '18px', maxWidth: '640px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
                El acceso al panel y la navegación ya están migrados. El contenido de
                <b> {titulo_de(vista)} </b> llega en un módulo posterior.
              </p>
              {!escritura_admin && (
                <p style={{ fontSize: '12.5px', color: 'var(--text-3)', lineHeight: 1.6, marginTop: '10px', marginBottom: 0 }}>
                  🔒 El panel opera en modo de solo lectura: ningún módulo escribirá en producción
                  hasta habilitarlo explícitamente.
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
    </AdminDatosProvider>
  )
}

const Panel = panel

export default function admin() {
  return (
    <AdminProvider>
      <Panel />
    </AdminProvider>
  )
}
