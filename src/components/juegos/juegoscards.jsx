// ═══════════════════════════════════════════════════════════════════
// juegoscards.jsx — las 3 tarjetas grandes de "Próximos juegos".
// espejo 1:1 de v1: el bloque de cargarJuegos() que armaba #juegos-main-grid
// (panel-inicio.html linea 3190) y seleccionarCard() (linea 2758).
//
// reglas conservadas:
//   · la primera tarjeta nace .selected, salvo que este agotada
//   · una tarjeta agotada lleva .juego-card-agotado y NO acepta clic
//   · al elegir juego: se marca la tarjeta, se pinta el mapa y despues se
//     baja a el (nunca antes, o se veria el juego anterior en el trayecto)
// ═══════════════════════════════════════════════════════════════════

import usereserva from '../../hooks/usereserva'
import { usetoast } from '../../context/toastcontext'
import { meses_cal, dia_semana_corto, hora12 } from '../../lib/fechas'

// espejo de _scrollAlMapa(): respeta prefers-reduced-motion — a quien pidio
// menos animacion se le lleva al mapa de un salto.
function scroll_al_mapa() {
  const mapa = document.getElementById('mapa-section')
  if (!mapa || typeof mapa.scrollIntoView !== 'function') return false
  const menos_movimiento =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  mapa.scrollIntoView({ behavior: menos_movimiento ? 'auto' : 'smooth', block: 'start' })
  return true
}

export default function juegoscards() {
  const { proximos, estado_disponibilidad, juegoactivofecha, setjuegoactivofecha } = usereserva()
  const { mostrartoast } = usetoast()

  function seleccionar(fecha) {
    setjuegoactivofecha(fecha)
    scroll_al_mapa()
    mostrartoast('Juego seleccionado')
  }

  return (
    <div className="juegos-grid" id="juegos-main-grid">
      {proximos.map((j, i) => {
        const [, mm, dd] = j.fecha.split('-')
        const mes_idx = parseInt(mm) - 1
        const dispo = estado_disponibilidad(j.id)
        const agotado = dispo.estado === 'agotado'
        // sin juego elegido todavia, la primera tarjeta va marcada (salvo agotada).
        const marcada =
          juegoactivofecha === null ? i === 0 && !agotado : juegoactivofecha === j.fecha
        const clase =
          'juego-card' + (marcada ? ' selected' : '') + (agotado ? ' juego-card-agotado' : '')

        return (
          <div
            className={clase}
            data-fecha={j.fecha}
            key={j.id || j.fecha}
            onClick={agotado ? undefined : () => seleccionar(j.fecha)}
          >
            <div className="juego-fecha">
              <span className="juego-mes">{meses_cal[mes_idx].slice(0, 3)}</span>
              <span className="juego-dia">{dd}</span>
              <span className="juego-sem">{dia_semana_corto(j.fecha)}</span>
              <span className="juego-hora">{hora12(j.hora)}</span>
            </div>
            <div className="juego-rival">
              Naranjeros <span>vs</span> {j.rival}
            </div>
            <div className={'juego-estado ' + dispo.clase}>{dispo.texto}</div>
          </div>
        )
      })}
    </div>
  )
}
