// ═══════════════════════════════════════════════════════════════════
// inicio.jsx — pagina publica de reservas (espejo de panel-inicio.html).
// el orden de montaje respeta el del html original.
// esta pagina monta sus propios providers para que el resto de las rutas no
// arrastre su codigo (ver el code splitting de App.jsx).
// El checkout de 4 pasos se monta al final, como en el html original.
// ═══════════════════════════════════════════════════════════════════

import ToastProvider from '../context/toastcontext'
import LandingConfigProvider from '../context/landingconfig'
import ReservaProvider from '../context/reservacontext'
import MapaProvider from '../context/mapacontext'
import CheckoutProvider from '../context/checkoutcontext'
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

// los providers viven aqui, no en main.jsx: asi el code splitting puede
// dejarlos fuera del bundle de las demas rutas.
function contenido() {
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

const Contenido = contenido

export default function inicio() {
  return (
    <ToastProvider>
      <LandingConfigProvider>
        <ReservaProvider>
          <MapaProvider>
            <CheckoutProvider>
              <Contenido />
            </CheckoutProvider>
          </MapaProvider>
        </ReservaProvider>
      </LandingConfigProvider>
    </ToastProvider>
  )
}
