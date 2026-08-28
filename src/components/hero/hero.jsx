// ═══════════════════════════════════════════════════════════════════
// hero.jsx — seccion principal del sitio publico.
// espejo 1:1 de v1: panel-inicio.html lineas 579-587 (<section class="hero">)
// mas el fondo dinamico que montaba _montarCarruselHero().
//
// los textos (eyebrow, h1, em, sub, cta) y la imagen de fondo salen de
// loadLandingConfig() de la v1, que los lee del localStorage 'nrj_landing'.
// OJO: esos campos no tienen columnas en supabase — solo los ve el navegador
// donde el admin los edito. es una limitacion de la v1 que se conserva tal cual.
//
// la franja de promociones (.promo-strip) vive dentro de este <section> en el
// html original; se migra aparte en promostrip.jsx. hoy no cambia nada visible
// porque configuracion_landing.promo_strip_enabled esta en false.
// ═══════════════════════════════════════════════════════════════════

import uselandingconfig from '../../hooks/uselandingconfig'
import HeroCarrusel from './herocarrusel'

export default function hero() {
  const { hero: textos, slides } = uselandingconfig()

  const con_carrusel = slides.length > 0

  return (
    <section
      className={'hero' + (con_carrusel ? ' con-carrusel' : '')}
      id="hero-section"
      style={textos.bg ? { backgroundImage: 'url(' + textos.bg + ')' } : undefined}
    >
      <HeroCarrusel slides={slides} />

      <div className="hero-eyebrow" id="hero-eyebrow">
        <span>⚾</span> <span id="hero-eyebrow-txt">{textos.eyebrow}</span>
      </div>
      <h1 id="hero-h1">
        {textos.h1}
        <br />
        <em id="hero-h1-em">{textos.em}</em>
      </h1>
      <p className="hero-sub" id="hero-sub-p">{textos.sub}</p>
      <div className="hero-ctas">
        <a href="#juegos" className="btn-primary" id="hero-cta-btn">
          {textos.cta}{' '}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 8h10M9 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
        <a href="#como-funciona" className="btn-secondary">¿Cómo funciona?</a>
      </div>
    </section>
  )
}
