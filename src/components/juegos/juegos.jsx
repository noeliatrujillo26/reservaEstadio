// ═══════════════════════════════════════════════════════════════════
// juegos.jsx — seccion "Próximos juegos".
// espejo 1:1 de v1: <div id="juegos" class="section"> de panel-inicio.html
// (lineas 612-679).
// ═══════════════════════════════════════════════════════════════════

import JuegosCards from './juegoscards'
import CalendarioDesplegable from './calendariodesplegable'

export default function juegos() {
  return (
    <div id="juegos" className="section">
      <div className="section-title">Próximos juegos</div>
      <p className="section-sub">
        Selecciona un juego para ver disponibilidad de zonas en el mapa.
      </p>

      {/* Serie próxima: 3 cards grandes */}
      <JuegosCards />

      {/* Botón desplegable de calendario completo */}
      <CalendarioDesplegable />
    </div>
  )
}
