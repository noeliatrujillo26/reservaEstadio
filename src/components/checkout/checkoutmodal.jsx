// ═══════════════════════════════════════════════════════════════════
// checkoutmodal.jsx — contenedor del checkout: encabezado, cuenta regresiva
// y el paso activo.
// espejo 1:1 de v1: #checkout-modal del html (lineas 979-997 y el cierre),
// coMostrarPaso() y _holdPintar().
//
// la barra del reloj es sticky bajo el encabezado para seguir a la vista en
// los tres pasos, y en los ultimos 2 minutos pasa a rojo con parpadeo: el
// parpadeo entra SOLO en el tramo de alerta, encenderlo desde el principio
// lo vuelve ruido de fondo y deja de avisar nada.
// ═══════════════════════════════════════════════════════════════════

import usecheckout from '../../hooks/usecheckout'
import { hold_aviso_seg } from '../../context/checkoutcontext'
import Paso1Datos from './paso1datos'
import Paso2Pago from './paso2pago'
import Paso3Pago from './paso3pago'
import Paso4Exito from './paso4exito'

const titulos = ['', 'Tus datos de contacto', 'Elige cómo pagar', 'Pago seguro', '¡Listo!']

function mmss(seg) {
  const m = Math.floor(seg / 60)
  const s = seg % 60
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s
}

export default function checkoutmodal() {
  const { abierto, paso, co, cerrar, restante } = usecheckout()

  if (!abierto || !co) return null

  const urge = restante <= hold_aviso_seg

  return (
    <div id="checkout-modal" style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 500, alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
        {/* Encabezado sticky */}
        <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid #E4E7EC', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#9AA3B4', marginBottom: '2px' }} id="co-step-label">
              {paso === 4 ? '✓ Pago completado' : 'Paso ' + paso + ' de 3'}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700 }} id="co-step-titulo">
              {titulos[paso] || ''}
            </div>
          </div>
          <button onClick={cerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#9AA3B4', lineHeight: 1, padding: '2px 4px' }}>
            ✕
          </button>
        </div>

        {/* Cuenta regresiva del apartado */}
        {paso !== 4 && (
          <div
            id="co-hold-barra"
            style={{
              display: 'block', position: 'sticky', top: '62px', zIndex: 1,
              padding: '9px 24px',
              background: urge ? '#FEE2E2' : '#FFF7ED',
              borderBottom: '1px solid ' + (urge ? '#FCA5A5' : '#FED7AA'),
              color: urge ? '#B91C1C' : '#9A3412',
              fontSize: '12.5px', fontWeight: 700, textAlign: 'center',
              transition: 'background .3s,color .3s,border-color .3s',
              animation: urge ? 'holdPulso 1s ease-in-out infinite' : '',
            }}
          >
            Tiempo restante para completar tu reserva:{' '}
            <span id="co-hold-reloj" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {mmss(restante)}
            </span>
          </div>
        )}

        {paso === 1 && <Paso1Datos />}
        {paso === 2 && <Paso2Pago />}
        {paso === 3 && <Paso3Pago />}
        {paso === 4 && <Paso4Exito />}
      </div>
    </div>
  )
}
