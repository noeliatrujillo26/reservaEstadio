// ═══════════════════════════════════════════════════════════════════
// mensajes.jsx — plantillas de mensajes automaticos.
// espejo 1:1 de v1: #page-mensajes de index.html y cargarMensajes()
// (js/21-mensajes.js).
//
// SOLO LECTURA: se omite "Guardar cambios" y los botones de editar por campo.
// Los textos se muestran en campos deshabilitados, para poder consultarlos y
// copiarlos sin riesgo de modificarlos.
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import { grupos_mensajes, leer_mensajes } from '../../lib/mensajes'

const est_campo = {
  width: '100%', border: '1.5px solid var(--border)', borderRadius: '8px',
  padding: '10px 12px', fontSize: '13px', fontFamily: 'inherit',
  background: 'var(--surface-2)', color: 'var(--text-1)',
  boxSizing: 'border-box', resize: 'vertical',
}

export default function mensajes() {
  const { configlanding } = useadmindatos()
  const valores = useMemo(() => leer_mensajes(), [])

  // estas dos SI viven en la base (configuracion_landing), no en localStorage.
  const de_la_base = [
    { label: 'Botón "Cotiza aquí" de la landing', valor: (configlanding && configlanding.whatsapp_quote_message) || '' },
    { label: 'Mensaje del programa de referidos', valor: (configlanding && configlanding.referral_whatsapp_message) || '' },
  ]

  return (
    <div className="page active" id="page-mensajes">
      <div style={{ padding: '28px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div className="page-header" style={{ marginBottom: '24px' }}>
          <div>
            <h2>Mensajes y Plantillas</h2>
            <p>Mensajes automáticos que se envían a los clientes por WhatsApp y email</p>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', marginBottom: '20px', fontSize: '12.5px', color: 'var(--text-2)', lineHeight: 1.6 }}>
          ℹ️ Estas plantillas se guardan en <b>este navegador</b>, no en la base de datos: es como
          funciona la v1 y se conserva igual. Un equipo distinto verá las plantillas por omisión.
          Las dos de abajo son la excepción — esas sí viven en la base y las ve todo el mundo.
        </div>

        {grupos_mensajes.map((g) => (
          <div className="card" style={{ marginBottom: '20px' }} key={g.label}>
            <div className="card-header">
              <div>
                <div className="card-title">{g.label}</div>
                <div className="card-sub">{g.sub}</div>
              </div>
            </div>
            <div className="card-body" style={{ display: 'grid', gap: '18px' }}>
              {g.campos.map((c) => (
                <div className="form-group" style={{ margin: 0 }} key={c.id}>
                  <label className="form-label">{c.label}</label>
                  {c.corto ? (
                    <input className="input" value={valores[c.id] || ''} readOnly style={est_campo} />
                  ) : (
                    <textarea
                      value={valores[c.id] || ''} readOnly rows={4}
                      style={est_campo}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Mensajes guardados en la base</div>
              <div className="card-sub">
                Estos viajan en configuracion_landing y los ve cualquier navegador
              </div>
            </div>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: '18px' }}>
            {de_la_base.map((c) => (
              <div className="form-group" style={{ margin: 0 }} key={c.label}>
                <label className="form-label">{c.label}</label>
                <textarea value={c.valor} readOnly rows={3} style={est_campo} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
