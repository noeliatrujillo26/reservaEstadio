// ═══════════════════════════════════════════════════════════════════
// inicio.jsx — pagina publica de reservas (espejo de panel-inicio.html).
// EN CONSTRUCCION: faltan promo-strip, juegos, mapa, detalle de zona, faq y
// checkout. el orden de montaje respeta el del html original.
// ═══════════════════════════════════════════════════════════════════

import Navbar from '../components/navbar/navbar'
import Hero from '../components/hero/hero'
import StatsBar from '../components/hero/statsbar'
import Footer from '../components/footer/footer'

export default function inicio() {
  return (
    <>
      <Navbar />
      <Hero />
      <StatsBar />
      <Footer />
    </>
  )
}
