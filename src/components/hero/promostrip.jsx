// ═══════════════════════════════════════════════════════════════════
// promostrip.jsx — franja "Banner de Promociones" dentro del hero.
// espejo 1:1 de v1: panel-inicio.html lineas 590-603 (markup) + la funcion
// _cargarPromoStrip() (linea 3294) y el handler api/sitio.js → promoStrip().
//
// 100% dinamico, sin textos de respaldo en el markup. reglas de la v1:
//   · activo === false            → franja oculta
//   · sin titulo y sin cards      → franja oculta
//   · error de consulta           → franja oculta (fail-open)
//   · sin btnTexto                → se oculta el cta, no un boton huerfano
//   · solo se pintan las cards ACTIVAS y con algo de texto
//   · mientras no hay datos, la clase .promo-strip--cargando pinta el skeleton
//
// el _psEsc() de la v1 (escape manual de html) aqui no hace falta: react
// escapa el texto por si mismo al no usar innerHTML.
// ═══════════════════════════════════════════════════════════════════

import uselandingconfig from '../../hooks/uselandingconfig'
import ps_iconos from './psiconos'

// icono de la cabecera de la franja: 34x34, distinto de los 26x26 de las
// tarjetas. es el mismo svg en el skeleton y en el estado con datos.
const icono_cabecera = (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
    <path
      d="M3 9V7a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 000 6v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 000-6z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path
      d="M14 5v2M14 11v2M14 17v2"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeDasharray="0.5 3.2"
    />
  </svg>
)

export default function promostrip() {
  const { promostrip: cfg, cargandopromostrip } = uselandingconfig()

  // skeleton: mismo estado inicial que el html de la v1, que nace con la clase.
  if (cargandopromostrip) {
    return (
      <div className="promo-strip promo-strip--cargando">
        <div className="promo-strip-head">
          {icono_cabecera}
          <div>
            <div className="promo-strip-title" id="ps-titulo"></div>
            <div className="promo-strip-sub" id="ps-subtitulo"></div>
          </div>
        </div>
        <div className="promo-strip-items" id="ps-items"></div>
        <div className="promo-strip-cta">
          <a href="#juegos" id="ps-btn"><span id="ps-btn-texto"></span></a>
          <div className="promo-strip-legal">Aplican términos y condiciones.</div>
        </div>
      </div>
    )
  }

  if (!cfg || cfg.activo === false) return null

  // mismo criterio de "hayContenido" que la v1.
  const hay_contenido =
    String(cfg.titulo || '').trim() || (Array.isArray(cfg.cards) && cfg.cards.length)
  if (!hay_contenido) return null

  // solo tarjetas activas y con contenido: una promo vacia o desactivada no
  // renderiza su cuadro ni su icono — la franja se reajusta sola.
  const activas = Array.isArray(cfg.cards)
    ? cfg.cards.filter(
        (c) =>
          c &&
          c.activa !== false &&
          (String(c.titulo || '').trim() || String(c.descripcion || '').trim())
      )
    : []

  return (
    <div className="promo-strip">
      <div className="promo-strip-head">
        {icono_cabecera}
        <div>
          <div className="promo-strip-title" id="ps-titulo">{cfg.titulo || ''}</div>
          <div className="promo-strip-sub" id="ps-subtitulo">{cfg.subtitulo || ''}</div>
        </div>
      </div>

      <div
        className="promo-strip-items"
        id="ps-items"
        style={activas.length ? undefined : { display: 'none' }}
      >
        {activas.map((c, i) => (
          <div className="promo-strip-item" key={i}>
            {ps_iconos[c.icono] || ps_iconos.estrella}
            <div>
              <b>{c.titulo}</b>
              <span>{c.descripcion}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="promo-strip-cta" style={cfg.btntexto ? undefined : { display: 'none' }}>
        <a href={cfg.btnurl || '#juegos'} id="ps-btn">
          <span id="ps-btn-texto">{cfg.btntexto || ''}</span>{' '}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 8h10M9 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
        <div className="promo-strip-legal">Aplican términos y condiciones.</div>
      </div>
    </div>
  )
}
