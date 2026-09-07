// ═══════════════════════════════════════════════════════════════════
// clienteform.jsx — modal "Nuevo cliente" / "Editar cliente".
// Mismo patron abierto/editando que cotizform.jsx y reservaform.jsx:
// editando = null → alta; editando = la ficha → edicion.
//
// Nombre completo, email, teléfono, empresa y — con el toggle activado —
// sus datos de facturación (RFC, régimen fiscal, razón social, uso de CFDI,
// código postal), el mismo objeto `facturacion` (jsonb) que ya lee
// buscar_facturacion_cliente() en lib/facturacion.js para el detalle de un
// cobro. La constancia (si el cliente ya la subió desde el portal) no se
// toca aquí: solo se conserva tal cual venía.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { regimen_fiscal_label } from '../../lib/facturacion'

const vacio = { nombre: '', email: '', tel: '', empresa: '', factura: false, rfc: '', regimen: '', razonSocial: '', usoCfdi: '', cp: '' }

function datos_de(cliente) {
  if (!cliente) return vacio
  const f = cliente.facturacion || null
  return {
    nombre: cliente.nombre !== '—' ? cliente.nombre || '' : '',
    email: cliente.email !== '—' ? cliente.email || '' : '',
    tel: cliente.tel !== '—' ? cliente.tel || '' : '',
    empresa: cliente.empresa || '',
    factura: !!f,
    rfc: (f && f.rfc) || '',
    regimen: (f && f.regimen) || '',
    razonSocial: (f && f.razonSocial) || '',
    usoCfdi: (f && f.usoCfdi) || '',
    cp: (f && f.cp) || '',
  }
}

function cliente_form({ abierto, editando, oncerrar, oneditar, guardando }) {
  const [d, setd] = useState(vacio)
  const [campos, setcampos] = useState([])

  useEffect(() => {
    if (abierto) { setd(datos_de(editando)); setcampos([]) }
  }, [abierto, editando])

  useEffect(() => {
    const alteclado = (e) => { if (e.key === 'Escape') oncerrar() }
    if (abierto) document.addEventListener('keydown', alteclado)
    return () => document.removeEventListener('keydown', alteclado)
  }, [abierto, oncerrar])

  if (!abierto) return null

  const set = (k, v) => setd((x) => ({ ...x, [k]: v }))
  const err = (k) => (campos.includes(k) ? ' input-error' : '')

  async function guardar() {
    setcampos([])
    const faltan = []
    if (!d.nombre.trim()) faltan.push('nombre')
    if (!d.email.trim()) faltan.push('email')
    if (faltan.length) { setcampos(faltan); return }

    const facturacion = d.factura
      ? {
          ...((editando && editando.facturacion) || {}),
          rfc: d.rfc.trim().toUpperCase(),
          regimen: d.regimen,
          razonSocial: d.razonSocial.trim(),
          usoCfdi: d.usoCfdi.trim().toUpperCase(),
          cp: d.cp.trim(),
        }
      : null
    const r = await oneditar(editando || { id: null }, {
      nombre: d.nombre, email: d.email, tel: d.tel, empresa: d.empresa, facturacion,
    })
    if (r && r.ok) oncerrar()
    else if (r && r.campos) setcampos(r.campos)
  }

  return (
    <div
      className="modal-overlay open"
      style={{ alignItems: 'flex-start', padding: '24px', overflowY: 'auto' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) oncerrar() }}
    >
      <div className="modal" style={{ margin: 'auto', maxWidth: '520px' }}>
        <div className="modal-header">
          <div className="modal-title">{editando ? 'Editar cliente' : 'Nuevo cliente'}</div>
          <button className="modal-close" onClick={oncerrar} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Nombre completo *</label>
            <input className={'input' + err('nombre')} value={d.nombre} onChange={(e) => set('nombre', e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Email *</label>
              <input className={'input' + err('email')} type="email" value={d.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Teléfono</label>
              <input
                className="input" maxLength={10} inputMode="numeric"
                value={d.tel} onChange={(e) => set('tel', e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Empresa (Opcional)</label>
            <input className="input" value={d.empresa} onChange={(e) => set('empresa', e.target.value)} />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />

          <label style={{ display: 'flex', gap: '9px', alignItems: 'center', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            <input
              type="checkbox" checked={d.factura}
              onChange={(e) => set('factura', e.target.checked)}
              style={{ width: '15px', height: '15px', accentColor: 'var(--naranja)' }}
            />
            Datos de facturación
          </label>

          {d.factura && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">RFC</label>
                  <input className="input" value={d.rfc} onChange={(e) => set('rfc', e.target.value.toUpperCase())} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Régimen fiscal</label>
                  <select className="input select" value={d.regimen} onChange={(e) => set('regimen', e.target.value)}>
                    <option value="">— Selecciona —</option>
                    {Object.entries(regimen_fiscal_label).map(([cod, label]) => (
                      <option key={cod} value={cod}>{cod} · {label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Razón social</label>
                <input className="input" value={d.razonSocial} onChange={(e) => set('razonSocial', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Uso de CFDI</label>
                  <input className="input" value={d.usoCfdi} onChange={(e) => set('usoCfdi', e.target.value.toUpperCase())} placeholder="G03" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Código postal</label>
                  <input className="input" maxLength={5} inputMode="numeric" value={d.cp} onChange={(e) => set('cp', e.target.value.replace(/\D/g, ''))} />
                </div>
              </div>
              {editando && editando.facturacion && editando.facturacion.constanciaUrl && (
                <div style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>
                  📄 Constancia ya cargada: {editando.facturacion.constanciaArchivo || 'ver archivo'} (se conserva sin cambios)
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={oncerrar}>Cancelar</button>
          <button
            className="btn btn-primary" onClick={guardar} disabled={guardando}
            style={guardando ? { opacity: 0.6 } : undefined}
          >
            {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear cliente'}
          </button>
        </div>
      </div>
    </div>
  )
}

const ClienteForm = cliente_form
export default ClienteForm
