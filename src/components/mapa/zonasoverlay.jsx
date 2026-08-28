// ═══════════════════════════════════════════════════════════════════
// zonasoverlay.jsx — los pines de zona sobre la imagen del estadio.
// espejo 1:1 de v1: buildOverlay() (panel-inicio.html linea 1389).
//
// dos ramas, igual que la v1:
//   · seccion del editor (tiene _color) → .zona-wrap con .zona-circle dentro.
//     el diametro sale de z._r como porcentaje del ancho de la imagen y el
//     tamano de letra es el 42% del diametro, con minimo de 9px.
//     el clic va en el CIRCULO, no en el contenedor: .zona-wrap tiene
//     pointer-events:none, ahi un listener ni se dispararia.
//   · zona quemada → <button class="zona-btn ...">
//
// las zonas no disponibles llevan .agotada; el filtro de capacidad las
// esconde con display:none, tal cual filtrarZonasPorCap().
// ═══════════════════════════════════════════════════════════════════

import usemapa from '../../hooks/usemapa'
import { zona_clases, zona_labels } from '../../lib/zonasfallback'

export default function zonasoverlay({ anchoimagen }) {
  const { zonas, posiciones, zonaactiva, setzonaactiva, visible_por_cap } = usemapa()

  return (
    <div className="zonas-overlay" id="zonas-overlay">
      {Object.keys(posiciones).map((id) => {
        const [xp, yp] = posiciones[id]
        const z = zonas[id]
        const oculta = z && !visible_por_cap(z)
        const estilo_base = {
          left: xp + '%',
          top: yp + '%',
          display: oculta ? 'none' : undefined,
        }

        if (z && z._color) {
          // el ancho real de la imagen manda; 700 es el mismo respaldo de la v1.
          const diam = z._r ? Math.round((z._r / 100) * (anchoimagen || 700)) : 36
          const fs = Math.max(9, Math.round(diam * 0.42))
          return (
            <div
              id={'zbtn-' + id}
              key={id}
              className={
                'zona-wrap' +
                (!z.disponible ? ' agotada' : '') +
                (zonaactiva === id ? ' selected' : '')
              }
              style={estilo_base}
              data-tooltip={z.nombre}
            >
              <div
                className="zona-circle"
                style={{ width: diam + 'px', height: diam + 'px', background: z._color, fontSize: fs + 'px' }}
                onClick={() => setzonaactiva(id)}
              >
                {z._num ?? ''}
              </div>
            </div>
          )
        }

        return (
          <button
            id={'zbtn-' + id}
            key={id}
            className={
              'zona-btn ' +
              (zona_clases[id] || 'btn-jardin') +
              (z && !z.disponible ? ' agotada' : '') +
              (zonaactiva === id ? ' selected' : '')
            }
            style={estilo_base}
            data-tooltip={z ? z.nombre : id}
            onClick={() => setzonaactiva(id)}
          >
            {zona_labels[id] || ''}
          </button>
        )
      })}
    </div>
  )
}
