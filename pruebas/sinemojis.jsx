// ═══════════════════════════════════════════════════════════════════
// sinemojis.jsx — puente SSR para pruebas/sinemojis.run.mjs: renderiza
// FormularioExpress y CobrarReserva (los otros dos módulos de
// /reserva-express, además de la tarjeta de verreservas.jsx ya cubierta
// por tarjetareserva.jsx) con datos fijos, para comprobar que sus
// encabezados y botones ya NO traen los emojis del rediseño del 02 oct
// 2026 ("👤 Cliente", "🏟️ Evento", "💰 Financiero/Resumen",
// "🔎 Buscar reserva", "🧾 Registrar cobro", "📎/📤" del comprobante,
// "🥩/🌮" del tipo de comida) sino los SVG de src/components/
// reservaexpress/iconos.jsx.
// ═══════════════════════════════════════════════════════════════════
import { renderToString } from 'react-dom/server'
import { admindatoscontext } from '../src/context/admindatoscontext'
import { admincontext } from '../src/context/admincontext'
import ToastProvider from '../src/context/toastcontext'
import FormularioExpress from '../src/components/reservaexpress/formularioexpress'
import CobrarReserva from '../src/components/reservaexpress/cobrarreserva'
import VerReservas from '../src/components/reservaexpress/verreservas'

const areas = [
  { id: 'sec-1', nombre: 'Terraza Derecha 1', cap: 64, escompartida: false, estado: 'libre' },
]
const juegos = [{ id: 'j1', mes: 'oct', fecha: '2026-10-14', hora: '19:30', rival: 'Mayos', num: 1, serie: 'S1', estado: 'Confirmado' }]
const reservas = [
  { id: 1, cliente: 'Ana', zona: 'Terraza Derecha 1', juego: 'vs Mayos', juegoid: 'j1', zonaid: 'sec-1',
    monto: 9750, montopagado: 5000, descuentomonto: 0, estadopago: 'parcial', pago: '', estado: 'activa',
    email: 'a@x.com', tel: '6621234567', personas: 20, adultos: null, ninos: 2, saldoconsumo: 500 },
]
const cobros = []
const pipeline = []

const valor = {
  secciones: areas, areas, juegos, reservas, cobros, pipeline, areasestados: {},
  movimientos: [], clientes: [], usuarios: [], descuentos: [], descuentosvolumen: [],
  metodos: [], configlanding: {}, slides: [], cotizaciones: [],
  politica: { enganche_minimo: 50, dias_limite_liquidar: 5 }, config: {},
  cargando: false, errores: [], recargar: async () => {},
}
const sesion = {
  usuario: { id: 1, nombre: 'Admin Uno', email: 'a@n.mx', rol: 'Administrador', permisos: {}, iniciales: 'AU' },
  estado: 'dentro', error: '', seterror() {}, iniciar_sesion() {}, cerrar_sesion() {}, escritura_admin: false,
}

// `ontab` presente (aunque sea un no-op) para que las 3 pestañas
// superiores se monten — con tab/ontab ausentes (el default de los 3
// componentes) el bloque `{ontab && (...)}` no renderiza nada.
function envolver(Comp, props) {
  return renderToString(
    <admincontext.Provider value={sesion}>
      <ToastProvider>
        <admindatoscontext.Provider value={valor}><Comp {...props} /></admindatoscontext.Provider>
      </ToastProvider>
    </admincontext.Provider>
  )
}

const props_tabs = { tab: 'nueva', ontab: () => {} }

export function renderFormulario() { return envolver(FormularioExpress, props_tabs) }
export function renderCobrar() { return envolver(CobrarReserva, { ...props_tabs, tab: 'cobrar' }) }
export function renderReservas() { return envolver(VerReservas, { ...props_tabs, tab: 'reservas' }) }
