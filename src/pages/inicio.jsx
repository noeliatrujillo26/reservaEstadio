// ═══════════════════════════════════════════════════════════════════
// inicio.jsx — pagina publica de reservas (espejo de panel-inicio.html).
// el orden de montaje respeta el del html original.
// El checkout de 4 pasos se monta al final, como en el html original.
// ═══════════════════════════════════════════════════════════════════

import Navbar from '../components/navbar/navbar'
import Hero from '../components/hero/hero'
import StatsBar from '../components/hero/statsbar'
import Juegos from '../components/juegos/juegos'
import MapaEstadio from '../components/mapa/mapaestadio'
import ComoFunciona from '../components/comofunciona/comofunciona'
import EventosCorporativos from '../components/comofunciona/eventoscorporativos'
import FaqSection from '../components/faq/faqsection'
import Footer from '../components/footer/footer'
import CheckoutModal from '../components/checkout/checkoutmodal'
import HoldExpirado from '../components/checkout/holdexpirado'
import Toast from '../components/ui/toast'

export default function inicio() {
  return (
    <>
      <Navbar />
      <Hero />
      <StatsBar />
      <Juegos />
      <MapaEstadio />
      <ComoFunciona />
      <EventosCorporativos />
      <FaqSection />
      <Footer />
      <CheckoutModal />
      <HoldExpirado />
      <Toast />
    </>
  )
}
