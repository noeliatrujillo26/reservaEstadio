// ═══════════════════════════════════════════════════════════════════
// paso4exito.jsx — Paso 4: confirmacion y recibo.
// espejo 1:1 de v1: #co-step4 del html (lineas 1168-1236) y
// mostrarConfirmacionStripe() (linea 2473).
//
// se alcanza SOLO al volver de Stripe con ?session_id=. El desglose se
// recalcula desde lo guardado en supabase con la misma formula que _coTotal():
//   base = monto * porcentaje_pagado / 100
//   com  = 7% del subtotal YA con descuento (siempre positiva y sumada)
// la v1 dejo anotado que derivar la comision restando
// (monto_pagado - subtotal) la volvia NEGATIVA cuando el webhook aun no
// habia escrito monto_pagado.
// ═══════════════════════════════════════════════════════════════════

import usecheckout from '../../hooks/usecheckout'
import { mxn2 } from '../../lib/dinero'

const fmt = (n) => Number(n || 0).toLocaleString('es-MX', mxn2)

const redes = [
  { nombre: 'Facebook', url: 'https://www.facebook.com/ClubNaranjeros', d: 'M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z' },
  { nombre: 'X (Twitter)', url: 'https://x.com/ClubNaranjeros', d: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' },
  { nombre: 'TikTok', url: 'https://tiktok.com/@ClubNaranjeros', d: 'M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z' },
  { nombre: 'YouTube', url: 'https://youtube.com/@ClubNaranjeros', d: 'M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58 2.78 2.78 0 001.95 1.95C5.12 20 12 20 12 20s6.88 0 8.59-.47a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58z' },
]

const est_fila = {
  display: 'flex', justifyContent: 'space-between', padding: '6px 0',
  fontSize: '13px', borderBottom: '1px solid #EEE',
}
const est_boton = {
  width: '100%', color: '#fff', border: 'none', borderRadius: '8px', padding: '13px',
  fontSize: '15px', fontWeight: 700, cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center', gap: '8px',
  fontFamily: 'inherit', marginBottom: '10px',
}

export default function paso4exito() {
  const { recibo, cerrar } = usecheckout()
  const cargando = !recibo

  return (
    <div id="co-step4" style={{ padding: '32px 24px', textAlign: 'center' }}>
      <div style={{ width: '64px', height: '64px', background: '#DCFCE7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>¡Reserva confirmada!</div>
      <div style={{ fontSize: '13px', color: '#5A6478', marginBottom: '4px' }} id="co-success-zona">
        {cargando ? '' : recibo.zona + ' · ' + recibo.juego}
      </div>
      <div style={{ fontSize: '12px', color: '#9AA3B4', marginBottom: '24px' }} id="co-success-folio">
        {cargando ? 'Confirmando tu pago…' : 'Folio: ' + recibo.folio}
      </div>

      <div style={{ background: '#F7F5F0', borderRadius: '10px', padding: '16px', textAlign: 'left', marginBottom: '24px' }}>
        <div style={est_fila}>
          <span style={{ color: '#5A6478' }}>Zona</span>
          <span style={{ fontWeight: 600 }} id="co-rec-zona">{cargando ? '—' : recibo.zona}</span>
        </div>
        <div style={est_fila}>
          <span style={{ color: '#5A6478' }}>Juego</span>
          <span style={{ fontWeight: 600, textAlign: 'right', maxWidth: '55%' }} id="co-rec-juego">
            {cargando ? '—' : recibo.juego}
          </span>
        </div>
        <div id="co-rec-promo-row" style={{ ...est_fila, display: !cargando && recibo.promocodigo ? 'flex' : 'none' }}>
          <span style={{ color: '#16A34A', fontWeight: 600 }}>Descuento promo</span>
          <span style={{ fontWeight: 700, color: '#16A34A' }} id="co-rec-promo">
            {cargando ? '—' : '-$' + fmt(recibo.desc) + ' MXN'}
          </span>
        </div>
        <div style={est_fila}>
          <span style={{ color: '#5A6478' }}>Comisión servicio (7%)</span>
          <span style={{ fontWeight: 600 }} id="co-rec-comision">
            {cargando ? '—' : '$' + fmt(recibo.com) + ' MXN'}
          </span>
        </div>
        <div style={est_fila}>
          <span style={{ color: '#5A6478' }}>Pagado hoy</span>
          <span style={{ fontWeight: 700, color: '#E05C1A' }} id="co-rec-monto">
            {cargando ? '—' : '$' + fmt(recibo.monto) + ' MXN'}
          </span>
        </div>
        <div style={{ ...est_fila, borderBottom: 'none' }}>
          <span style={{ color: '#5A6478' }}>Tarjeta</span>
          <span style={{ fontWeight: 600 }} id="co-rec-card">
            {cargando ? '****' : recibo.cardlast4 ? '****' + recibo.cardlast4 : 'Stripe'}
          </span>
        </div>
      </div>

      <div style={{ background: '#FFF4EC', border: '1.5px dashed #E05C1A', borderRadius: '10px', padding: '14px 16px', textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', color: '#111318', marginBottom: '6px' }}>
          🎉 Comparte este código con tus amigos y obtengan <strong>10% de descuento</strong> en
          tienda física o en línea
        </div>
        <div style={{ fontSize: '16px', fontWeight: 800, color: '#E05C1A', letterSpacing: '1px' }}>
          HMO-NARANJERO2026
        </div>
      </div>

      <div id="co-social" style={{ marginBottom: '22px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#9AA3B4', marginBottom: '8px' }}>
          Síguenos en nuestras redes
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <a href="https://www.facebook.com/ClubNaranjeros" target="_blank" rel="noopener noreferrer" aria-label="Facebook" style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#F1F0EC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5A6478', textDecoration: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d={redes[0].d} /></svg>
          </a>
          <a href="https://www.instagram.com/ClubNaranjeros/" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer-when-downgrade" aria-label="Instagram" style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#F1F0EC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5A6478', textDecoration: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
          </a>
          {redes.slice(1).map((r) => (
            <a key={r.nombre} href={r.url} target="_blank" rel="noopener noreferrer" aria-label={r.nombre} style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#F1F0EC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5A6478', textDecoration: 'none' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d={r.d} /></svg>
            </a>
          ))}
        </div>
      </div>

      <button style={{ ...est_boton, background: '#E05C1A' }}>
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
          <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="white" strokeWidth="1.5" />
          <circle cx="8" cy="8" r="2" fill="white" />
        </svg>
        Ver reserva
      </button>
      <button style={{ ...est_boton, background: '#111318' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 16l-5-5h3V4h4v7h3l-5 5z" fill="white" />
          <path d="M5 20h14" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        Descargar recibo
      </button>
      <button id="co-btn-reenviar" style={{ width: '100%', background: 'none', border: '1.5px solid #E8E4DC', borderRadius: '8px', padding: '11px 6px', fontSize: '13px', fontWeight: 600, color: '#5A6478', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '10px' }}>
        📧 Reenviar correo
      </button>
      <button onClick={cerrar} style={{ width: '100%', background: 'none', border: '1.5px solid #E8E4DC', borderRadius: '8px', padding: '11px', fontSize: '14px', fontWeight: 600, color: '#5A6478', cursor: 'pointer', fontFamily: 'inherit' }}>
        Cerrar
      </button>
    </div>
  )
}
