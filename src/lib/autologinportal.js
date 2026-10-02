// ═══════════════════════════════════════════════════════════════════
// autologinportal.js — lee ?folio=&email= de la URL para el autologin de
// /mis-reservas (04 oct 2026). Función PURA aparte (no inline en
// accesoportal.jsx) a propósito: así se puede probar sin useEffect ni
// DOM — un componente React no ejecuta sus efectos en un render de
// servidor (renderToString), así que una prueba contra el componente
// jamás vería esta lógica correr.
// ═══════════════════════════════════════════════════════════════════

// `search` es el string crudo de window.location.search (incluye el '?').
// Regresa { folio, email } (ambos '' si falta cualquiera de los dos — un
// autologin a medias, con solo uno de los dos parámetros, no intenta nada:
// ver api/_lib/reciboEmail.js para dónde se arma el enlace con ambos).
export function leer_autologin_de_url(search) {
  try {
    const params = new URLSearchParams(search || '')
    const folio = (params.get('folio') || '').trim()
    const email = (params.get('email') || '').trim()
    if (!folio || !email) return { folio: '', email: '' }
    return { folio, email }
  } catch (e) {
    return { folio: '', email: '' }
  }
}
