// ═══════════════════════════════════════════════════════════════════
// faqitem.jsx — una pregunta del acordeon.
// espejo 1:1 de v1: el bloque .faq-item del html y toggleFaq() (linea 2623),
// que cierra TODAS las abiertas antes de abrir la nueva: solo una a la vez.
// ═══════════════════════════════════════════════════════════════════

export default function faqitem({ pregunta, respuesta, abierta, ontoggle }) {
  return (
    <div className={'faq-item' + (abierta ? ' open' : '')}>
      <button className="faq-q" onClick={ontoggle}>
        {pregunta}
        <svg className="faq-chevron" width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M4 6.5l5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div className="faq-a">{respuesta}</div>
    </div>
  )
}
