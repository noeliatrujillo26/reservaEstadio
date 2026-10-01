// ═══════════════════════════════════════════════════════════════════
// tarjetareserva.jsx — puente SSR para renderizar TarjetaReserva (pestaña
// "Reservas" de /reserva-express) con datos fijos, sin sesión ni buscador.
// Se compila con vite --ssr porque el componente es JSX.
// ═══════════════════════════════════════════════════════════════════
import { renderToString } from 'react-dom/server'
import { TarjetaReserva } from '../src/components/reservaexpress/verreservas'

export function render(props) {
  return renderToString(<TarjetaReserva {...props} />)
}
