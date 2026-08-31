// ═══════════════════════════════════════════════════════════════════
// holdexpirado.jsx — aviso de que el plazo para reservar se acabo.
// espejo 1:1 de v1: #hold-expirado-modal del html (lineas 969-977) y
// _holdVolverAlMapa() (linea 2278).
//
// antes de devolver al cliente al mapa se relee la disponibilidad: en diez
// minutos su zona pudo ocuparse, y mandarlo a un mapa viejo lo haria chocar
// contra el anti-oversell del servidor sin entender por que.
// ═══════════════════════════════════════════════════════════════════

import usecheckout from '../../hooks/usecheckout'
import usemapa from '../../hooks/usemapa'

export default function holdexpirado() {
  const { expirado, setexpirado } = usecheckout()
  const { recargar_estados } = usemapa()

  if (!expirado) return null

  async function volver_al_mapa() {
    setexpirado(false)
    try {
      await recargar_estados()
    } catch (e) {
      console.warn('No se pudo refrescar la disponibilidad:', e)
    }
    const mapa = document.getElementById('mapa-section')
    if (mapa && mapa.scrollIntoView) mapa.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div id="hold-expirado-modal" style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 600, alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '400px', padding: '28px 26px', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.28)' }}>
        <div style={{ fontSize: '40px', lineHeight: 1, marginBottom: '12px' }}>⏱️</div>
        <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
          Tu tiempo para reservar ha expirado
        </div>
        <p style={{ fontSize: '14px', color: '#5A6478', lineHeight: 1.6, margin: '0 0 20px' }}>
          La zona ha sido liberada y vuelve a estar disponible para otros clientes. Puedes elegirla
          de nuevo si sigue libre.
        </p>
        <button
          onClick={volver_al_mapa}
          style={{ width: '100%', background: '#E05C1A', color: '#fff', border: 'none', borderRadius: '8px', padding: '13px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Volver al mapa
        </button>
      </div>
    </div>
  )
}
