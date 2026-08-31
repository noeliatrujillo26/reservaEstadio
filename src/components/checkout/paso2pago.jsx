// ═══════════════════════════════════════════════════════════════════
// paso2pago.jsx — Paso 2: cuanto pagar hoy.
// espejo 1:1 de v1: #co-step2 del html (lineas 1060-1108), el tramo de
// coIrPaso2() que arma los botones de %, coSeleccionarPct() y
// coActualizarMonto().
//
// los botones van del enganche minimo vigente a 100%, de 10 en 10, igual que
// el bucle `for (let p = POLITICA_ENGANCHE_MIN; p <= 100; p += 10)`.
// ═══════════════════════════════════════════════════════════════════

import usecheckout from '../../hooks/usecheckout'
import { mxn2 } from '../../lib/dinero'

const fmt = (n) => Number(n).toLocaleString('es-MX', mxn2)

export default function paso2pago() {
  const { co, actualizar, setpaso, totales, politica, txtliquidar } = usecheckout()

  const pcts = []
  for (let p = politica.enganche_minimo; p <= 100; p += 10) pcts.push(p)

  const resto = co.precionum - totales.base

  return (
    <div id="co-step2" style={{ padding: '20px 24px' }}>
      {/* Resumen */}
      <div style={{ background: '#F7F5F0', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#9AA3B4', marginBottom: '8px' }}>
          Resumen de reserva
        </div>
        <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '2px' }} id="co-zona2">
          {co.zona} · {co.personas || 1} personas
        </div>
        <div style={{ fontSize: '12px', color: '#5A6478', marginBottom: '8px' }} id="co-juego2">{co.juego}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#E05C1A' }}>
            $<span id="co-precio-total">{co.preciostr}</span>
          </div>
          <div style={{ fontSize: '12px', color: '#9AA3B4' }}>precio total por juego</div>
        </div>
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #E4E7EC', display: 'grid', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#5A6478' }}>
            <span>Subtotal (<span id="co-pct-label">{co.pct}</span>%)</span>
            <span id="co-subtotal-label">${fmt(totales.base)}</span>
          </div>
          <div id="co-vol-row" style={{ display: totales.voldesc > 0 ? 'flex' : 'none', justifyContent: 'space-between', fontSize: '12px', color: '#15803D', fontWeight: 600 }}>
            <span id="co-vol-label">
              Descuento por Grupo ({totales.volpct}%){totales.vol && totales.vol.nombre ? ' · ' + totales.vol.nombre : ''}
            </span>
            <span id="co-vol-monto">-${fmt(totales.voldesc)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#5A6478' }}>
            <span>Comisión por servicio (7%)</span>
            <span id="co-comision-label">${fmt(totales.com)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, color: '#111', marginTop: '2px' }}>
            <span>Total a pagar hoy</span>
            <span id="co-total-label">${fmt(totales.total)}</span>
          </div>
        </div>
      </div>

      {/* Selector de % */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#5A6478', marginBottom: '10px' }}>
          ¿Cuánto deseas pagar hoy?
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }} id="co-pct-btns">
          {pcts.map((p) => {
            const activo = p === co.pct
            return (
              <button
                key={p} data-pct={p} onClick={() => actualizar({ pct: p })}
                style={{
                  border: '2px solid ' + (activo ? '#E05C1A' : '#E4E7EC'),
                  borderRadius: '8px', padding: '9px 4px', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', background: activo ? '#FFF8F5' : '#fff',
                  color: activo ? '#E05C1A' : '#5A6478',
                  transition: 'all 0.15s', fontFamily: 'inherit',
                }}
              >
                {p}%
              </button>
            )
          })}
        </div>
        <div style={{ marginTop: '14px', background: '#FFF8F5', border: '1.5px solid #F5C6A0', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#E05C1A', marginBottom: '4px' }}>
            Monto a pagar hoy
          </div>
          <div style={{ fontSize: '30px', fontWeight: 700, color: '#E05C1A', lineHeight: 1 }}>
            $<span id="co-monto-hoy">{fmt(totales.total)}</span>
          </div>
          <div style={{ fontSize: '11px', color: '#9AA3B4', marginTop: '5px' }} id="co-resto-label">
            {co.pct === 100
              ? '✓ Pago completo · Sin saldo pendiente'
              : 'Saldo restante: $' + fmt(resto) + ' · liquidar ' + txtliquidar}
          </div>
        </div>
      </div>

      <div style={{ background: '#FEF9C3', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#92400E', marginBottom: '16px' }}>
        ⚡ El <span id="txt-pct-warning">{politica.enganche_minimo}</span>% mínimo confirma tu zona.
        Liquida el saldo <span id="txt-dias-liquidar">{txtliquidar}</span>.
      </div>

      <button
        onClick={() => setpaso(3)}
        style={{ width: '100%', background: '#E05C1A', color: '#fff', border: 'none', borderRadius: '8px', padding: '13px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: 'inherit' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="5" width="20" height="14" rx="2" stroke="white" strokeWidth="1.8" />
          <path d="M2 10h20" stroke="white" strokeWidth="1.8" />
          <path d="M6 15h4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        Continuar al pago seguro →
      </button>
      <button
        onClick={() => setpaso(1)}
        style={{ width: '100%', background: 'none', border: 'none', color: '#9AA3B4', fontSize: '13px', cursor: 'pointer', padding: '10px 0 2px', fontFamily: 'inherit' }}
      >
        ← Editar datos de contacto
      </button>
    </div>
  )
}
