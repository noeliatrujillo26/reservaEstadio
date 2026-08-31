// ═══════════════════════════════════════════════════════════════════
// App.jsx — rutas de la spa. cada ruta corresponde a un .html de la v1:
//   /              → panel-inicio.html
//   /mis-reservas  → panel-reserva.html
//   /legales       → legales.html
//   /admin         → index.html de la v1 (panel de administracion)
// ═══════════════════════════════════════════════════════════════════

import { Routes, Route } from 'react-router-dom'
import Inicio from './pages/inicio'
import Legales from './pages/legales'
import MisReservas from './pages/misreservas'
import Admin from './pages/admin'

export default function app() {
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/legales" element={<Legales />} />
      <Route path="/mis-reservas" element={<MisReservas />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  )
}
