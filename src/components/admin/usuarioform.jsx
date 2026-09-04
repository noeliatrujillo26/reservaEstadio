// ═══════════════════════════════════════════════════════════════════
// usuarioform.jsx — modal "Nuevo usuario" / "Editar usuario".
// espejo 1:1 de v1: #usuario-drawer + abrirPanelUsuario()/guardarUsuario()
// (js/22-usuarios-clientes.js), salvo la presentacion: la v1 usa un cajon
// lateral (.desc-drawer) y aqui, como el resto de los formularios de
// escritura de este panel (reservaform, cotizform, nuevoprospecto…), un
// modal centrado — mismo patron ya establecido, no uno nuevo por modulo.
//
// La contraseña es OBLIGATORIA al crear y OPCIONAL al editar (vacía = no
// cambiarla) — misma regla de 8+ caracteres con letras y números en los dos
// casos, verificada aqui Y otra vez en el servidor (api/usuarios.js), que es
// quien de verdad toca la cuenta de auth.users.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { perms_groups, roles_disponibles } from '../../lib/usuarios'

const vacio = { nombre: '', email: '', rol: 'Vendedora', estado: 'Activo', password: '' }

function usuario_form({ abierto, editando, permisosdefault, oncerrar, onguardar, guardando }) {
  const [d, setd] = useState(vacio)
  const [verpassword, setverpassword] = useState(false)
  const [marcados, setmarcados] = useState({})
  const [niveles, setniveles] = useState({})
  const [campos, setcampos] = useState([])

  useEffect(() => {
    if (!abierto) return
    setcampos([])
    setverpassword(false)
    if (editando) {
      setd({
        nombre: editando.nombre || '', email: editando.email || '',
        rol: editando.rol || 'Vendedora', estado: editando.estado || 'Activo', password: '',
      })
      const base = editando.permisos || {}
      setmarcados(Object.keys(base).reduce((o, k) => { o[k] = true; return o }, {}))
      setniveles(base)
    } else {
      setd(vacio)
      const base = permisosdefault || {}
      setmarcados(Object.keys(base).reduce((o, k) => { o[k] = true; return o }, {}))
      setniveles(base)
    }
  }, [abierto, editando, permisosdefault])

  useEffect(() => {
    const alteclado = (e) => { if (e.key === 'Escape') oncerrar() }
    if (abierto) document.addEventListener('keydown', alteclado)
    return () => document.removeEventListener('keydown', alteclado)
  }, [abierto, oncerrar])

  const set = (k, v) => setd((x) => ({ ...x, [k]: v }))

  function alternar_modulo(clave) {
    setmarcados((x) => {
      const marcado = !x[clave]
      if (marcado && !niveles[clave]) setniveles((n) => ({ ...n, [clave]: 'ver' }))
      return { ...x, [clave]: marcado }
    })
  }
  function alternar_nivel(clave) {
    setniveles((x) => ({ ...x, [clave]: x[clave] === 'editar' ? 'ver' : 'editar' }))
  }

  if (!abierto) return null

  async function guardar() {
    setcampos([])
    const r = await onguardar({ ...d, editando, marcados, niveles })
    if (r && r.ok) oncerrar()
    else if (r && r.campos) setcampos(r.campos)
  }

  const err = (k) => (campos.includes(k) ? ' input-error' : '')

  return (
    <div
      className="modal-overlay open"
      style={{ alignItems: 'flex-start', padding: '24px', overflowY: 'auto' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) oncerrar() }}
    >
      <div className="modal" style={{ margin: 'auto', maxWidth: '560px' }}>
        <div className="modal-header">
          <div className="modal-title">{editando ? 'Editar usuario' : 'Nuevo usuario'}</div>
          <button className="modal-close" onClick={oncerrar} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Nombre completo *</label>
            <input
              className={'input' + err('nombre')} placeholder="Ej. Juan García"
              value={d.nombre} onChange={(e) => set('nombre', e.target.value)}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Correo electrónico *</label>
            <input
              className={'input' + err('email')} type="email" placeholder="correo@naranjeros.mx"
              value={d.email} onChange={(e) => set('email', e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Rol *</label>
              <select className="input select" value={d.rol} onChange={(e) => set('rol', e.target.value)}>
                {roles_disponibles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Estado</label>
              <select className="input select" value={d.estado} onChange={(e) => set('estado', e.target.value)}>
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">
              Contraseña{editando ? '' : ' *'}
              {editando && (
                <span style={{ color: 'var(--text-3)', fontSize: '11px', fontWeight: 400 }}>
                  {' '}(dejar vacío para no cambiar)
                </span>
              )}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className={'input' + err('password')} type={verpassword ? 'text' : 'password'}
                placeholder="Nueva contraseña" style={{ paddingRight: '36px' }}
                value={d.password} onChange={(e) => set('password', e.target.value)}
              />
              <button
                type="button" onClick={() => setverpassword((v) => !v)}
                title={verpassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                style={{
                  position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                  color: verpassword ? 'var(--naranja)' : 'var(--text-3)', display: 'flex',
                }}
              >
                <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
                  <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                  <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </button>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '13px' }}>Permisos de acceso</div>
            <p style={{ fontSize: '11px', color: 'var(--text-3)', margin: '2px 0 10px' }}>
              Activa la sección y usa el switch para definir si el usuario solo puede <b>ver</b> o también <b>editar</b>.
            </p>
            {perms_groups.map((g) => (
              <div key={g.label} style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)', margin: '10px 0 4px' }}>
                  {g.label}
                </div>
                {g.items.map((it) => {
                  const marcado = !!marcados[it.key]
                  const nivel = niveles[it.key] === 'editar' ? 'editar' : 'ver'
                  return (
                    <div key={it.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '5px 0' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={marcado} onChange={() => alternar_modulo(it.key)} />
                        {it.label}
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', visibility: marcado ? 'visible' : 'hidden' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-3)', width: '34px' }}>
                          {nivel === 'editar' ? 'Editar' : 'Ver'}
                        </span>
                        <label className="switch">
                          <input type="checkbox" checked={nivel === 'editar'} onChange={() => alternar_nivel(it.key)} />
                          <span className="switch-track" />
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={oncerrar}>Cancelar</button>
          <button
            className="btn btn-primary" onClick={guardar} disabled={guardando}
            style={guardando ? { opacity: 0.6 } : undefined}
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

const UsuarioForm = usuario_form
export default UsuarioForm
