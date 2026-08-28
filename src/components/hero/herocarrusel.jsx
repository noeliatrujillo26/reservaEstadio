// ═══════════════════════════════════════════════════════════════════
// herocarrusel.jsx — carrusel de imagenes de fondo del hero.
// espejo 1:1 de v1: panel-inicio.html _cargarCarruselHero() / _montarCarruselHero()
// / _carrIr() / _carrAutoplay() (lineas 3340-3418), que inyectaban el markup
// con document.createElement. aqui es markup declarativo, mismo resultado.
//
// reglas conservadas de la v1:
//   · sin slides activos no se monta nada y queda el fondo estatico (.hero::after)
//   · con slides, el <section> recibe la clase .con-carrusel (apaga el ::after)
//   · flechas, puntos y swipe SOLO con 2+ fotos: con una no hay que navegar
//   · autoplay cada 5s; cualquier interaccion manual reinicia el temporizador
//   · el apostrofe de la url se escapa a %27, igual que la v1
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'

export default function herocarrusel({ slides }) {
  const [idx, setidx] = useState(0)
  const temporizador = useRef(null)
  const x0 = useRef(null)
  const total = slides.length
  const hay_controles = total > 1

  // autoplay cada 5s — espejo de _carrAutoplay(). el efecto se re-lanza cuando
  // cambia `idx`, asi que un clic manual reinicia el conteo igual que la v1.
  useEffect(() => {
    if (!hay_controles) return
    temporizador.current = setInterval(() => setidx((n) => (n + 1) % total), 5000)
    return () => clearInterval(temporizador.current)
  }, [idx, total, hay_controles])

  // espejo de _carrIr(): normaliza el indice en ambos sentidos.
  function ir(n) {
    if (!total) return
    setidx(((n % total) + total) % total)
  }

  function tocar_inicio(e) {
    x0.current = e.touches[0].clientX
  }
  function tocar_fin(e) {
    if (x0.current === null) return
    const dx = e.changedTouches[0].clientX - x0.current
    if (Math.abs(dx) > 45) ir(idx + (dx < 0 ? 1 : -1))
    x0.current = null
  }

  if (!total) return null

  return (
    <>
      <div
        className="hero-carrusel"
        id="hero-carrusel"
        onTouchStart={hay_controles ? tocar_inicio : undefined}
        onTouchEnd={hay_controles ? tocar_fin : undefined}
      >
        {slides.map((s, i) => (
          <div
            key={s.id}
            className={'hero-carr-slide' + (i === idx ? ' activa' : '')}
            style={{ backgroundImage: "url('" + String(s.image_url).replace(/'/g, '%27') + "')" }}
          />
        ))}
      </div>

      {hay_controles && (
        <>
          <button
            className="hero-carr-btn hero-carr-prev"
            aria-label="Foto anterior"
            onClick={() => ir(idx - 1)}
          >
            ‹
          </button>
          <button
            className="hero-carr-btn hero-carr-next"
            aria-label="Siguiente foto"
            onClick={() => ir(idx + 1)}
          >
            ›
          </button>
          <div className="hero-carr-dots" id="hero-carr-dots">
            {slides.map((s, i) => (
              <button
                key={s.id}
                className={'hero-carr-dot' + (i === idx ? ' activa' : '')}
                aria-label={'Foto ' + (i + 1)}
                onClick={() => ir(i)}
              />
            ))}
          </div>
        </>
      )}
    </>
  )
}
