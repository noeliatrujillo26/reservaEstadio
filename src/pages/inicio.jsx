// ═══════════════════════════════════════════════════════════════════
// inicio.jsx — pagina publica de reservas (espejo de panel-inicio.html).
// EN CONSTRUCCION: por ahora solo monta el navbar. las secciones hero,
// promo-strip, stats, juegos, mapa, detalle de zona, faq, footer y checkout
// se van agregando conforme avanza la migracion.
// ═══════════════════════════════════════════════════════════════════

import Navbar from '../components/navbar/navbar'

export default function inicio() {
  return (
    <>
      <Navbar />
    </>
  )
}
