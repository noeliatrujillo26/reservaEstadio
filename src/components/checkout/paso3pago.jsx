// ═══════════════════════════════════════════════════════════════════
// paso3pago.jsx — Paso 3: cupon y salida a Stripe.
// espejo 1:1 de v1: #co-step3 del html (lineas 1110-1166), coIrPaso3(),
// aplicarPromo() e irAPagarConStripe().
//
// el cupon se valida contra /api/checkout?action=validar-cupon, que es un GET
// de SOLO LECTURA: comprueba vigencia, usos y juegos aplicables sin consumir
// nada. La validacion definitiva vuelve a correr en el servidor al crear la
// sesion de pago.
//
// PASARELA CERRADA: mientras VITE_PAGOS_HABILITADOS no sea 'true', el boton
// de pagar no envia el POST que crearia la reserva. Nada se escribe.
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react'
import usecheckout from '../../hooks/usecheckout'
import { mxn2 } from '../../lib/dinero'

const fmt = (n) => Number(n).toLocaleString('es-MX', mxn2)

export default function paso3pago() {
  const { co, totales, setpaso, aplicar_promo, pagar, pagos_habilitados } = usecheckout()

  const [codigo, setcodigo] = useState(co.promo ? co.promo.codigo : '')
  const [msg, setmsg] = useState(
    co.promo ? { ok: true, texto: '✓ Código "' + co.promo.codigo + '" aplicado' } : null
  )
  const [validando, setvalidando] = useState(false)
  const [pagando, setpagando] = useState(false)

  async function al_aplicar() {
    if (!codigo.trim()) return
    setvalidando(true)
    const r = await aplicar_promo(codigo)
    setvalidando(false)
    if (!r) return
    setmsg(
      r.ok
        ? { ok: true, texto: '✓ Código "' + r.promo.codigo + '" aplicado' }
        : { ok: false, texto: '✗ ' + r.mensaje }
    )
  }

  async function al_pagar() {
    setpagando(true)
    await pagar(null)
    setpagando(false)
  }

  return (
    <div id="co-step3" style={{ padding: '20px 24px' }}>
      {/* Resumen compacto */}
      <div style={{ background: '#F7F5F0', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700 }} id="co-resumen-zona3">{co.zona}</div>
          <div style={{ fontSize: '11px', color: '#5A6478' }} id="co-resumen-juego3">{co.juego}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: '#9AA3B4' }}>Monto a pagar</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#E05C1A' }}>
            $<span id="co-resumen-monto3">{fmt(totales.total)}</span>
          </div>
        </div>
      </div>

      {/* Codigo promocional */}
      <div style={{ border: '1.5px solid #E4E7EC', borderRadius: '12px', padding: '14px 16px', marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#9AA3B4', marginBottom: '10px' }}>
          Código promocional
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            id="co-promo-input" type="text" placeholder="ej. NARANJEROS10"
            value={codigo}
            onChange={(e) => setcodigo(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') al_aplicar() }}
            style={{ flex: 1, border: '1.5px solid #E4E7EC', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', outline: 'none', fontFamily: 'inherit', textTransform: 'uppercase', boxSizing: 'border-box' }}
            onFocus={(e) => { e.target.style.borderColor = '#E05C1A' }}
            onBlur={(e) => { e.target.style.borderColor = '#E4E7EC' }}
          />
          <button
            id="co-promo-btn" onClick={al_aplicar} disabled={validando}
            style={{ background: '#111318', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
          >
            {validando ? '…' : 'Aplicar'}
          </button>
        </div>
        <div
          id="co-promo-msg"
          style={{
            display: msg ? 'block' : 'none', marginTop: '8px', fontSize: '12px',
            padding: '7px 10px', borderRadius: '6px',
            background: msg && msg.ok ? '#DCFCE7' : '#FEE2E2',
            color: msg && msg.ok ? '#166534' : '#991B1B',
          }}
        >
          {msg ? msg.texto : ''}
          {msg && msg.ok && totales.desc > 0 ? ' (-$' + fmt(totales.desc) + ')' : ''}
        </div>
      </div>

      {/* Pago seguro con Stripe (checkout hospedado) */}
      <div style={{ background: '#F7F5F0', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#5A6478', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Pago seguro
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <svg width="32" height="20" viewBox="0 0 32 20">
              <rect width="32" height="20" rx="3" fill="#1A1F71" />
              <rect x="0" y="13" width="32" height="7" rx="3" fill="#F7B600" opacity="0.7" />
              <circle cx="13" cy="10" r="6" fill="#EB001B" opacity="0.9" />
              <circle cx="19" cy="10" r="6" fill="#F79E1B" opacity="0.9" />
            </svg>
            <svg width="32" height="20" viewBox="0 0 32 20">
              <rect width="32" height="20" rx="3" fill="#252525" />
              <text x="16" y="14" textAnchor="middle" fontSize="8" fill="white" fontFamily="Arial" fontWeight="bold">VISA</text>
            </svg>
            <svg width="32" height="20" viewBox="0 0 32 20">
              <rect width="32" height="20" rx="3" fill="#006FCF" />
              <text x="16" y="14" textAnchor="middle" fontSize="7" fill="white" fontFamily="Arial" fontWeight="bold">AMEX</text>
            </svg>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: '1px' }}>
            <rect x="4" y="10" width="16" height="10" rx="2" stroke="#635BFF" strokeWidth="1.8" />
            <path d="M8 10V7a4 4 0 118 0v3" stroke="#635BFF" strokeWidth="1.8" />
          </svg>
          <div style={{ fontSize: '12.5px', color: '#5A6478', lineHeight: 1.5 }}>
            Al continuar te llevaremos a la página de pago cifrada de{' '}
            <strong style={{ color: '#635BFF' }}>Stripe</strong> para capturar tu tarjeta. Acepta
            Visa, Mastercard y American Express. Al terminar regresas aquí con tu folio y recibo.
          </div>
        </div>
      </div>

      {/* Casilla "Soy humano" (Cloudflare Turnstile). Se monta cuando la
          pasarela este habilitada: su token viaja en el POST y el servidor lo
          confirma con siteverify antes de crear la sesion de Stripe. */}
      <div id="co-turnstile" style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}></div>

      {!pagos_habilitados && (
        <div style={{ background: '#FEF3C7', border: '1.5px solid #FDE68A', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px', fontSize: '12.5px', color: '#92400E', lineHeight: 1.5 }}>
          🔒 <strong>Pasarela de pagos pendiente de habilitar.</strong> Puedes recorrer todo el
          flujo y verificar los montos: nada se guarda ni se cobra todavía.
        </div>
      )}

      <button
        id="co-btn-pagar" onClick={al_pagar} disabled={pagando}
        style={{ width: '100%', background: '#E05C1A', color: '#fff', border: 'none', borderRadius: '8px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: 'inherit', transition: 'opacity 0.2s', opacity: pagando ? 0.6 : 1 }}
      >
        {pagando ? (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>{' '}
            Redirigiendo a pago seguro…
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1 14.5v-5l-2-1 1-1.7 2.5 1.4 2.5-1.4 1 1.7-2 1v5H11z" fill="white" />
            </svg>{' '}
            Pagar $<span id="co-btn-monto">{fmt(totales.total)}</span> de forma segura
          </>
        )}
      </button>
      <button
        onClick={() => setpaso(2)}
        style={{ width: '100%', background: 'none', border: 'none', color: '#9AA3B4', fontSize: '13px', cursor: 'pointer', padding: '8px 0 2px', fontFamily: 'inherit' }}
      >
        ← Cambiar monto
      </button>
      <div style={{ fontSize: '11px', color: '#9AA3B4', textAlign: 'center', marginTop: '4px' }}>
        🔒 Se procesa con Stripe · nunca vemos ni guardamos tu tarjeta
      </div>
    </div>
  )
}
