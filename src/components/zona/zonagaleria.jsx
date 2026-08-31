// ═══════════════════════════════════════════════════════════════════
// zonagaleria.jsx — galeria de fotos de la zona seleccionada.
// espejo 1:1 de v1: _galZonaPintar(), _galZonaIr(), _galZonaMover() y el
// bloque de swipe tactil (panel-inicio.html lineas 1682-1737).
//
// reglas conservadas:
//   · sin fotos, la galeria no se muestra
//   · con una sola foto se ve estatica: los controles solo existen con 2+
//     (clase .multiple)
//   · el recorrido es circular: desde la ultima, "siguiente" vuelve a la primera
//   · swipe en movil con umbral de 40px
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import { imagenes_de_zona } from '../../lib/imagenes'

export default function zonagaleria({ zona }) {
  const [fotos, setfotos] = useState([])
  const [idx, setidx] = useState(0)
  const x0 = useRef(null)

  // al cambiar de zona se recalculan las fotos y se vuelve a la primera.
  useEffect(() => {
    setfotos(imagenes_de_zona(zona))
    setidx(0)
  }, [zona])

  function ir(i) {
    if (!fotos.length) return
    setidx(((i % fotos.length) + fotos.length) % fotos.length)
  }
  function mover(delta) {
    ir(idx + delta)
  }

  function tocar_inicio(e) {
    if (fotos.length < 2) { x0.current = null; return }
    x0.current = e.touches[0].clientX
  }
  function tocar_fin(e) {
    if (x0.current == null) return
    const dx = e.changedTouches[0].clientX - x0.current
    if (Math.abs(dx) > 40) mover(dx < 0 ? 1 : -1)
    x0.current = null
  }

  if (!fotos.length) return null

  const multiple = fotos.length > 1

  return (
    <div
      className={'zona-galeria' + (multiple ? ' multiple' : '')}
      id="detalle-galeria"
      style={{ display: 'block' }}
      onTouchStart={tocar_inicio}
      onTouchEnd={tocar_fin}
    >
      <img
        id="detalle-img"
        src={fotos[idx]}
        alt={'Foto ' + (idx + 1) + ' de ' + fotos.length}
      />
      <button
        type="button"
        className="zona-gal-flecha"
        id="detalle-img-ant"
        onClick={() => mover(-1)}
        aria-label="Imagen anterior"
      >
        &#8249;
      </button>
      <button
        type="button"
        className="zona-gal-flecha der"
        id="detalle-img-sig"
        onClick={() => mover(1)}
        aria-label="Imagen siguiente"
      >
        &#8250;
      </button>
      <div className="zona-gal-puntos" id="detalle-img-puntos">
        {multiple &&
          fotos.map((f, i) => (
            <button
              type="button"
              key={f}
              className={'zona-gal-punto' + (i === idx ? ' activo' : '')}
              onClick={() => ir(i)}
              aria-label={'Ver imagen ' + (i + 1)}
            />
          ))}
      </div>
    </div>
  )
}
