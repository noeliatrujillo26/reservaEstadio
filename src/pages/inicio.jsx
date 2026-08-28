// ═══════════════════════════════════════════════════════════════════
// inicio.jsx — pagina publica de reservas (espejo de panel-inicio.html).
// EN CONSTRUCCION: faltan el mapa del estadio, el detalle de zona, la faq y
// el checkout. el orden de montaje respeta el del html original.
// ═══════════════════════════════════════════════════════════════════

import Navbar from '../components/navbar/navbar'
import Hero from '../components/hero/hero'
import StatsBar from '../components/hero/statsbar'
import Juegos from '../components/juegos/juegos'
import Footer from '../components/footer/footer'
import Toast from '../components/ui/toast'

export default function inicio() {
  return (
    <>
      <Navbar />
      <Hero />
      <StatsBar />
      <Juegos />
      <Footer />
      <Toast />
    </>
  )
}
