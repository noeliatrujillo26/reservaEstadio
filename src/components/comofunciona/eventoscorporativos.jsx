// ═══════════════════════════════════════════════════════════════════
// eventoscorporativos.jsx — franja negra "Eventos corporativos" con el
// boton de WhatsApp.
// espejo 1:1 de v1: el bloque del html (lineas 805-818) y la parte de
// _cargarBannerPromo() que reescribe el href de #btn-cotiza-wa (linea 3270).
//
// el mensaje del boton es editable en Admin -> Mensajes
// (configuracion_landing.whatsapp_quote_message). Si esta vacio o la consulta
// falla se usa el texto de respaldo, igual que _COTIZA_MSG_FALLBACK.
// SIEMPRE va por encodeURIComponent: la url de wa.me se rompia con los
// caracteres especiales del mensaje.
// ═══════════════════════════════════════════════════════════════════

import uselandingconfig from '../../hooks/uselandingconfig'

const cotiza_msg_fallback =
  '¡Hola! Me interesa solicitar una cotización para un evento corporativo.'

const naranja = '#E05C1A'
const naranja_dark = '#B84A12'

export default function eventoscorporativos() {
  const { banner } = uselandingconfig()

  const msg = (banner.cotizamsg || '').trim() || cotiza_msg_fallback
  const href = 'https://wa.me/526621195169?text=' + encodeURIComponent(msg)

  return (
    <div style={{ background: 'var(--negro)', padding: '28px 2rem' }}>
      <div
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: 'var(--naranja)',
              marginBottom: '6px',
            }}
          >
            Eventos corporativos
          </div>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.3,
              marginBottom: '4px',
            }}
          >
            ¿Quieres celebrar tu posada de empresa
            <br />o evento con tu equipo en el estadio?
          </div>
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)' }}>
            Paquetes personalizados con catering, zona exclusiva y más.
          </div>
        </div>
        <a
          id="btn-cotiza-wa"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onMouseOver={(e) => { e.currentTarget.style.background = naranja_dark }}
          onMouseOut={(e) => { e.currentTarget.style.background = naranja }}
          style={{
            background: naranja,
            color: '#fff',
            padding: '13px 28px',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: 600,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            transition: 'background 0.2s',
          }}
        >
          Cotiza aquí
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 8h10M9 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </div>
    </div>
  )
}
