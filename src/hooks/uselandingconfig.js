// ═══════════════════════════════════════════════════════════════════
// uselandingconfig.js — acceso a la configuracion de la landing.
//
// generaliza al antiguo usebannerpromo.js: en vez de que cada componente
// consulte supabase por su cuenta, todos leen del contexto que
// context/landingconfig.jsx llena con UNA sola carga inicial.
//
// devuelve:
//   banner      { activo, texto, color, enlace, cotizamsg }
//   hero        { eyebrow, h1, em, sub, cta, bg }
//   stats       [ { num, lbl } x4 ]
//   politica    { enganche_minimo, dias_limite_liquidar }
//   slides      [ { id, image_url, title, order_index } ]
//   txtliquidar texto ya armado del plazo para liquidar
// ═══════════════════════════════════════════════════════════════════

import { useContext } from 'react'
import { landingcontext } from '../context/landingconfig'

export function uselandingconfig() {
  const valor = useContext(landingcontext)
  if (!valor) {
    throw new Error('uselandingconfig debe usarse dentro de <landingconfigprovider>')
  }
  return valor
}

export default uselandingconfig
