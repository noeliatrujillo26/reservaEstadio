// ═══════════════════════════════════════════════════════════════════
// inicio.jsx — pagina publica de reservas (espejo de panel-inicio.html).
// EN CONSTRUCCION: las secciones hero, promo-strip, stats, juegos, mapa,
// detalle de zona, faq y checkout se van agregando conforme avanza la
// migracion. el orden de montaje respeta el del html original.
// ═══════════════════════════════════════════════════════════════════

import Navbar from '../components/navbar/navbar'
import Footer from '../components/footer/footer'

export default function inicio() {
  return (
    <>
      <Navbar />
      <Footer />
    </>
  )
}
