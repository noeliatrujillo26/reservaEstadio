// ═══════════════════════════════════════════════════════════════════
// App.jsx — rutas de la spa. cada ruta corresponde a un .html de la v1:
//   /              → panel-inicio.html
//   /mis-reservas  → panel-reserva.html
//   /legales       → legales.html
//   /admin         → index.html de la v1 (panel de administracion)
//
// CARGA DIFERIDA: la landing es lo unico que viaja en el bundle inicial. El
// panel de administracion, el portal y las paginas legales se descargan solo
// cuando alguien entra a su ruta — cada uno arrastra su propio css y sus
// providers, asi que un cliente que solo viene a reservar no baja el panel.
// ═══════════════════════════════════════════════════════════════════

import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Inicio from './pages/inicio'

const Legales = lazy(() => import('./pages/legales'))
const MisReservas = lazy(() => import('./pages/misreservas'))
const Admin = lazy(() => import('./pages/admin'))

// mientras baja el trozo de la ruta. discreto a proposito: en una conexion
// normal apenas se alcanza a ver.
function cargando() {
  return (
    <div style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: '#9AA3B4' }}>
      Cargando…
    </div>
  )
}

const Cargando = cargando

export default function app() {
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route
        path="/legales"
        element={<Suspense fallback={<Cargando />}><Legales /></Suspense>}
      />
      <Route
        path="/mis-reservas"
        element={<Suspense fallback={<Cargando />}><MisReservas /></Suspense>}
      />
      <Route
        path="/admin"
        element={<Suspense fallback={<Cargando />}><Admin /></Suspense>}
      />
    </Routes>
  )
}
