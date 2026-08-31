// ═══════════════════════════════════════════════════════════════════
// paso1datos.jsx — Paso 1: datos de contacto.
// espejo 1:1 de v1: #co-step1 del html (lineas 998-1058), el tramo de
// iniciarReserva() que lo rellena, _coValidarEmailVivo(), _coAvisarTypo() y
// coIrPaso2().
//
// reglas conservadas:
//   · el boton nace inhabilitado y solo se activa con un correo valido
//   · borde rojo + mensaje bajo el campo cuando el correo es invalido
//   · aviso "¿quisiste decir…?" ante typos de dominio; tocarlo corrige
//   · el telefono solo acepta digitos, maximo 10
//   · hay que aceptar terminos en CADA reserva
//   · con descuento por grupo se muestra el desglose, nunca una cifra seca
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react'
import usecheckout from '../../hooks/usecheckout'
import usereserva from '../../hooks/usereserva'
import { usetoast } from '../../context/toastcontext'
import { email_valido, solo_digitos_tel, typo_sugerido } from '../../lib/checkout'
import { mxn2 } from '../../lib/dinero'

const fmt = (n) => Number(n).toLocaleString('es-MX', mxn2)

const est_input = {
  width: '100%', border: '1.5px solid #E4E7EC', borderRadius: '8px',
  padding: '10px 12px', fontSize: '14px', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
}
const est_label = {
  fontSize: '12px', fontWeight: 600, color: '#5A6478', display: 'block', marginBottom: '5px',
}
const est_mini = {
  fontSize: '10px', color: '#9AA3B4', fontWeight: 600,
  textTransform: 'uppercase', marginBottom: '2px',
}

export default function paso1datos() {
  const { co, actualizar, setpaso } = usecheckout()
  const { dv_mejor_regla } = usereserva()
  const { mostrartoast } = usetoast()

  const [tocado_email, settocadoemail] = useState(false)
  const [ver_typo, setvertypo] = useState(false)

  const valido = email_valido(co.email)
  const mostrar_error = co.email !== '' && !valido
  const sugerido = typo_sugerido(co.email)

  // desglose del descuento por grupo en el paso 1, con el TOTAL de la reserva
  // completa (el paso 2 muestra lo que se paga HOY con la misma regla).
  const vol1 = dv_mejor_regla(
    (Number(co.personas) || 0) + (Number(co.ninos) || 0), co.zonaid, co.juegoid
  )
  const pct1 = vol1 ? Number(vol1.porcentaje) || 0 : 0
  const desc1 = pct1 > 0 ? Math.round((co.precionum * pct1) / 100) : 0
  const total1 = Math.max(0, co.precionum - desc1)

  function continuar() {
    const nombre = co.nombre.trim()
    const email = co.email.trim()
    const tel = co.tel.trim()
    if (!nombre || !email || !tel) { mostrartoast('⚠ Completa nombre, email y teléfono'); return }
    if (!email_valido(email)) {
      settocadoemail(true)
      mostrartoast('⚠ Por favor ingresa un correo electrónico válido (ej. usuario@gmail.com)')
      return
    }
    if (!/^\d{10}$/.test(tel)) { mostrartoast('⚠ El teléfono debe tener exactamente 10 dígitos'); return }
    if (!co.acepto) { mostrartoast('⚠ Debes aceptar los Términos y Condiciones para continuar'); return }
    setpaso(2)
  }

  return (
    <div id="co-step1" style={{ padding: '20px 24px' }}>
      {/* Mini resumen */}
      <div style={{ background: '#F7F5F0', borderRadius: '10px', padding: '12px 14px', marginBottom: '20px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '100px' }}>
          <div style={est_mini}>Zona</div>
          <div style={{ fontSize: '13px', fontWeight: 700 }} id="co-zona1">{co.zona}</div>
        </div>
        <div style={{ flex: 1, minWidth: '100px' }}>
          <div style={est_mini}>Juego</div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#5A6478' }} id="co-juego1">{co.juego}</div>
        </div>
        <div style={{ flex: 1, minWidth: '80px' }}>
          <div style={est_mini}>Personas</div>
          <div style={{ fontSize: '13px', fontWeight: 700 }} id="co-personas1">
            {co.personas} adultos{co.ninos ? ' + ' + co.ninos + ' niños' : ''}
          </div>
        </div>
        <div>
          <div style={est_mini}>Total</div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#E05C1A' }} id="co-precio1">
            ${fmt(total1)} MXN
          </div>
        </div>
      </div>

      {/* Desglose del descuento por grupo: nunca una cifra final seca */}
      <div id="co-desglose1" style={{ display: desc1 > 0 ? 'block' : 'none', background: '#F8F9FB', border: '1px solid #E4E7EC', borderRadius: '10px', padding: '11px 13px', marginBottom: '14px', fontSize: '13px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', color: '#5A6478' }}>
          <span>Tarifa base</span><span id="co-d1-subtotal">${fmt(co.precionum)} MXN</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#166534', fontWeight: 600 }}>
          <span id="co-d1-desc-label">−{pct1}% Descuento Grupo{vol1 && vol1.nombre ? ' · ' + vol1.nombre : ''}</span>
          <span id="co-d1-desc">−${fmt(desc1)} MXN</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E4E7EC', paddingTop: '6px', fontWeight: 700, fontSize: '14px' }}>
          <span>TOTAL</span><span style={{ color: '#E05C1A' }} id="co-d1-total">${fmt(total1)} MXN</span>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '14px' }}>
        <div>
          <label style={est_label}>Nombre completo *</label>
          <input
            id="co-nombre" type="text" placeholder="Juan García López"
            value={co.nombre} onChange={(e) => actualizar({ nombre: e.target.value })}
            style={est_input}
            onFocus={(e) => { e.target.style.borderColor = '#E05C1A' }}
            onBlur={(e) => { e.target.style.borderColor = '#E4E7EC' }}
          />
        </div>
        <div>
          <label style={est_label}>Correo electrónico *</label>
          <input
            id="co-email" type="email" placeholder="juan@correo.com"
            value={co.email}
            onChange={(e) => { actualizar({ email: e.target.value }); setvertypo(false) }}
            onFocus={() => settocadoemail(false)}
            onBlur={() => { settocadoemail(true); setvertypo(true) }}
            style={{ ...est_input, borderColor: mostrar_error && tocado_email ? '#DC2626' : '#E4E7EC' }}
          />
          <div id="co-email-error" style={{ display: mostrar_error && tocado_email ? 'block' : 'none', marginTop: '6px', fontSize: '12px', color: '#DC2626', fontWeight: 600 }}>
            Por favor ingresa un correo electrónico válido (ej. usuario@gmail.com)
          </div>
          <div
            id="co-email-typo"
            onClick={() => { actualizar({ email: sugerido }); setvertypo(false) }}
            style={{ display: ver_typo && sugerido ? 'block' : 'none', marginTop: '6px', fontSize: '12px', background: '#FFF8E1', border: '1px solid #FDE68A', color: '#92400E', borderRadius: '6px', padding: '7px 10px', cursor: 'pointer' }}
          >
            ✏️ ¿Quisiste decir <strong>{sugerido}</strong>? Toca para corregir.
          </div>
        </div>
        <div>
          <label style={est_label}>
            Teléfono * <span style={{ fontWeight: 400, color: '#9AA3B4' }}>(10 dígitos)</span>
          </label>
          <input
            id="co-tel" type="tel" placeholder="6621234567" maxLength={10} inputMode="numeric"
            value={co.tel}
            onChange={(e) => actualizar({ tel: solo_digitos_tel(e.target.value) })}
            style={est_input}
            onFocus={(e) => { e.target.style.borderColor = '#E05C1A' }}
            onBlur={(e) => { e.target.style.borderColor = '#E4E7EC' }}
          />
        </div>
      </div>

      {/* Aceptacion legal obligatoria */}
      <label style={{ display: 'flex', gap: '9px', alignItems: 'flex-start', fontSize: '12px', color: '#5A6478', marginTop: '16px', cursor: 'pointer', lineHeight: 1.55 }}>
        <input
          type="checkbox" id="co-acepto" checked={co.acepto}
          onChange={(e) => actualizar({ acepto: e.target.checked })}
          style={{ marginTop: '2px', accentColor: '#E05C1A', width: '15px', height: '15px', flexShrink: 0 }}
        />
        <span>
          Acepto los <a href="/legales#terminos" target="_blank" style={{ color: '#E05C1A', fontWeight: 600 }}>Términos y Condiciones</a> y las Políticas de{' '}
          <a href="/legales#privacidad" target="_blank" style={{ color: '#E05C1A', fontWeight: 600 }}>Privacidad</a> y{' '}
          <a href="/legales#cancelaciones" target="_blank" style={{ color: '#E05C1A', fontWeight: 600 }}>Cancelación</a>
        </span>
      </label>

      <button
        id="co-btn-continuar" onClick={continuar} disabled={!valido}
        style={{ width: '100%', background: '#E05C1A', color: '#fff', border: 'none', borderRadius: '8px', padding: '13px', fontSize: '15px', fontWeight: 700, cursor: valido ? 'pointer' : 'not-allowed', marginTop: '16px', fontFamily: 'inherit', opacity: valido ? 1 : 0.55 }}
      >
        Continuar · Seleccionar pago →
      </button>
    </div>
  )
}
