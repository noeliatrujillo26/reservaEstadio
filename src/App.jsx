// ═══════════════════════════════════════════════════════════════════
// App.jsx — rutas de la spa. cada ruta corresponde a un .html de la v1:
//   /              → panel-inicio.html
//   /mis-reservas  → panel-reserva.html   (pendiente)
//   /legales       → legales.html         (pendiente)
// ═══════════════════════════════════════════════════════════════════

import { Routes, Route } from 'react-router-dom'
import Inicio from './pages/inicio'

export default function app() {
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
    </Routes>
  )
}
