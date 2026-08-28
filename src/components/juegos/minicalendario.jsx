// ═══════════════════════════════════════════════════════════════════
// minicalendario.jsx — calendario mensual del panel desplegable.
// espejo 1:1 de v1: renderCal(), calPrev() y calNext() (lineas 2712-2739).
//
// reglas conservadas:
//   · huecos vacios antes del dia 1 para alinear con el dia de la semana
//   · .cal-past a los dias ya pasados, .cal-hoy al de hoy (hora de Hermosillo)
//   · .has-game a los dias con partido, con title "vs Rival" y clic
//   · .cal-sel al dia del juego mostrado en el panel
// ═══════════════════════════════════════════════════════════════════

import usereserva from '../../hooks/usereserva'
import { meses_cal, hoy_hermosillo } from '../../lib/fechas'

export default function minicalendario({ anio, mes, onmes, onseldia }) {
  const { juegosporfecha, caljuegoactual } = usereserva()

  const hoy = hoy_hermosillo()
  const primer_dow = new Date(anio, mes, 1).getDay()
  const total_dias = new Date(anio, mes + 1, 0).getDate()

  const huecos = []
  for (let i = 0; i < primer_dow; i++) huecos.push(i)

  const dias = []
  for (let d = 1; d <= total_dias; d++) dias.push(d)

  function prev() {
    let m = mes - 1
    let a = anio
    if (m < 0) { m = 11; a-- }
    onmes(a, m)
  }
  function next() {
    let m = mes + 1
    let a = anio
    if (m > 11) { m = 0; a++ }
    onmes(a, m)
  }

  return (
    <div className="mini-cal">
      <div className="mini-cal-nav">
        <button onClick={prev}>&#8249;</button>
        <span className="mini-cal-mes" id="cal-mes-titulo">{meses_cal[mes] + ' ' + anio}</span>
        <button onClick={next}>&#8250;</button>
      </div>
      <div className="mini-cal-dow">
        <span>Do</span><span>Lu</span><span>Ma</span><span>Mi</span>
        <span>Ju</span><span>Vi</span><span>Sá</span>
      </div>
      <div id="mini-cal-grid" className="mini-cal-grid">
        {huecos.map((i) => (
          <div className="cal-day" key={'h' + i} />
        ))}
        {dias.map((d) => {
          const fecha =
            anio + '-' + String(mes + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0')
          const juego = juegosporfecha[fecha]
          let clase = 'cal-day cur-m'
          if (fecha < hoy) clase += ' cal-past'
          if (fecha === hoy) clase += ' cal-hoy'
          if (juego) clase += ' has-game'
          if (caljuegoactual && caljuegoactual.fecha === fecha) clase += ' cal-sel'

          return (
            <div
              className={clase}
              key={fecha}
              title={juego ? 'vs ' + juego.rival : undefined}
              onClick={juego ? () => onseldia(fecha) : undefined}
            >
              {d}
            </div>
          )
        })}
      </div>
    </div>
  )
}
