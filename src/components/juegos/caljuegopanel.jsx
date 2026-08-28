// ═══════════════════════════════════════════════════════════════════
// caljuegopanel.jsx — panel derecho del calendario: juego seleccionado.
// espejo 1:1 de v1: los bloques #cal-no-game y #cal-game-detail del html
// (lineas 650-676) y la parte de selDia() que los rellena (linea 2740).
//
// sin dia elegido se ve el placeholder; al elegir uno con juego aparece el
// detalle (display:flex, no block — asi lo pone la v1).
// ═══════════════════════════════════════════════════════════════════

import usereserva from '../../hooks/usereserva'
import CapFilter from './capfilter'
import { fecha_con_dia, hora12 } from '../../lib/fechas'

export default function caljuegopanel() {
  const { caljuegoactual: j } = usereserva()

  function ver_mapa() {
    const mapa = document.getElementById('mapa-section')
    if (mapa) mapa.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="cal-game-panel">
      <div className="cal-no-game" id="cal-no-game" style={j ? { display: 'none' } : undefined}>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="20" r="18" stroke="#E8E4DC" strokeWidth="1.5" />
          <text x="20" y="27" textAnchor="middle" fontSize="18">⚾</text>
        </svg>
        <span style={{ fontSize: '14px', fontWeight: 600 }}>Selecciona un día con juego</span>
        <span style={{ fontSize: '12px' }}>Los días naranja tienen partido</span>
      </div>

      <div
        className="cal-game-detail"
        id="cal-game-detail"
        style={j ? { display: 'flex' } : { display: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className="cal-game-tag" id="cal-juego-num">
            {j ? 'Juego ' + j.num + ' · ' + (j.estado || 'Programado') : 'Juego 1'}
          </span>
          <span style={{ fontSize: '11px', color: '#9AA3B4' }} id="cal-fecha-hora">
            {j ? fecha_con_dia(j.fecha, true) + ' · ' + hora12(j.hora) : '—'}
          </span>
        </div>
        <div className="cal-game-rival" id="cal-rival">
          {j ? 'Naranjeros vs ' + j.rival : '—'}
        </div>
        <div className="cal-game-meta">
          Naranjeros de Hermosillo · Estadio Fernando Valenzuela
        </div>

        <CapFilter />

        <button className="btn-ver-mapa" onClick={ver_mapa}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 2v12M8 14l-4-4M8 14l4-4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Ver mapa de secciones
        </button>
      </div>
    </div>
  )
}
