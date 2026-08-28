// ═══════════════════════════════════════════════════════════════════
// capfilter.jsx — filtro "Filtrar por número de personas".
// espejo 1:1 de v1: el bloque .cap-filter del html (lineas 662-672) y
// setCapFilter() (linea 2875).
//
// el filtro evalua la CAPACIDAD MAXIMA de la zona, no el minimo de personas
// incluidas: "20+" = zonas donde caben 20 o mas. quien aplica el filtro sobre
// los pines es el mapa (filtrarZonasPorCap); aqui solo se guarda el valor
// elegido en el contexto, que el mapa leera cuando se migre.
// ═══════════════════════════════════════════════════════════════════

import usereserva from '../../hooks/usereserva'
import usemapa from '../../hooks/usemapa'

const opciones = [
  { min: 0, texto: 'Todas' },
  { min: 20, texto: '20+' },
  { min: 30, texto: '30+' },
  { min: 50, texto: '50+' },
]

export default function capfilter() {
  const { capmin, setcapmin } = usereserva()
  const { zonasdisp } = usemapa()

  return (
    <div className="cap-filter">
      <div className="cap-filter-label">Filtrar por número de personas</div>
      <div className="cap-btns">
        {opciones.map((o) => (
          <button
            className={'cap-btn' + (capmin === o.min ? ' active' : '')}
            data-min={o.min}
            key={o.min}
            onClick={() => setcapmin(o.min)}
          >
            {o.texto}
          </button>
        ))}
      </div>
      {/* mismo texto que arma filtrarZonasPorCap(): "3 de 21 zonas
          disponibles · máx. 20 personas". sin zonas cargadas se queda el
          texto inicial del html de la v1. */}
      <div className="zonas-disp" id="zonas-disp">
        {zonasdisp || '— zonas disponibles'}
      </div>
    </div>
  )
}
