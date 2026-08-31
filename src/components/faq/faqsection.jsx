// ═══════════════════════════════════════════════════════════════════
// faqsection.jsx — seccion "Preguntas frecuentes".
// espejo 1:1 de v1: <section class="faq-section" id="faq"> del html
// (lineas 822-882) y _cargarFaq() (linea 3422).
//
// las preguntas de la base (Admin -> Landing) reemplazan a las estaticas;
// si no hay, si vienen vacias o si la consulta falla, se conservan las del
// html — la seccion nunca queda vacia por un error tecnico.
//
// solo una respuesta abierta a la vez, igual que toggleFaq().
// ═══════════════════════════════════════════════════════════════════

import { Fragment, useState } from 'react'
import uselandingconfig from '../../hooks/uselandingconfig'
import faq_estatica from './faqestatica'
import FaqItem from './faqitem'

// las respuestas de la base son texto plano: los saltos de linea se vuelven
// <br>, igual que hacia _cargarFaq(). react ya escapa el resto por si mismo,
// asi que el esc() manual de la v1 sobra.
function con_saltos(texto) {
  const lineas = String(texto == null ? '' : texto).split('\n')
  return lineas.map((linea, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {linea}
    </Fragment>
  ))
}

export default function faqsection() {
  const { faq } = uselandingconfig()
  const [abierta, setabierta] = useState(null)

  const items = faq
    ? faq.map((f) => ({ pregunta: f.pregunta, respuesta: con_saltos(f.respuesta) }))
    : faq_estatica

  return (
    <section className="faq-section" id="faq">
      <div className="section-title" style={{ textAlign: 'center' }}>
        Preguntas frecuentes
      </div>
      <p className="section-sub" style={{ textAlign: 'center', marginBottom: '36px' }}>
        Todo lo que necesitas saber antes de reservar tu zona.
      </p>
      <div className="faq-grid">
        {items.map((f, i) => (
          <FaqItem
            key={f.pregunta + i}
            pregunta={f.pregunta}
            respuesta={f.respuesta}
            abierta={abierta === i}
            ontoggle={() => setabierta(abierta === i ? null : i)}
          />
        ))}
      </div>
    </section>
  )
}
