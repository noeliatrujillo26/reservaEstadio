// ═══════════════════════════════════════════════════════════════════
// usuarios.jsx — cuentas y permisos del sistema.
// espejo 1:1 de v1: #page-usuarios de index.html (lineas 2153-2181) y
// renderUsuarios() de js/22-usuarios-clientes.js.
//
// ESCRITURA (Fase 2): crear, editar perfil/rol/permisos/contraseña,
// activar/desactivar y eliminar — ver useusuariosescritura.js y
// usuarioform.jsx. Eliminar pasa por useconfirmarseguro() (contraseña real
// de quien tiene la sesion, no el confirm() plano de la v1) — mismo criterio
// que el borrado de reservas y prospectos en el resto del panel.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import useadmin from '../../hooks/useadmin'
import useusuariosescritura from '../../hooks/useusuariosescritura'
import { useconfirmarseguro } from './confirmarseguro'
import UsuarioForm from './usuarioform'
import {
  badge_estado_usuario, filtrar_usuarios, permisos_efectivos, perms_groups, role_badge,
  roles_disponibles,
} from '../../lib/usuarios'
import { perms_default } from '../../lib/permisos'

export default function usuarios() {
  const { usuarios: todos, cargando, errores } = useadmindatos()
  const { usuario: yo } = useadmin()
  const { puede, guardar, guardando, alternar_estado, eliminar, borrando } = useusuariosescritura()
  const { confirmarseguro, dialogo } = useconfirmarseguro()

  const [busqueda, setbusqueda] = useState('')
  const [rol, setrol] = useState('')
  const [estado, setestado] = useState('')
  const [detalle, setdetalle] = useState(null)
  const [form, setform] = useState(null) // { editando } | null

  useEffect(() => {
    const alteclado = (e) => { if (e.key === 'Escape') setdetalle(null) }
    if (detalle) document.addEventListener('keydown', alteclado)
    return () => document.removeEventListener('keydown', alteclado)
  }, [detalle])

  const lista = useMemo(
    () => filtrar_usuarios(todos, { busqueda, rol, estado }),
    [todos, busqueda, rol, estado]
  )

  // roles presentes de verdad + los 4 fijos del select de la v1.
  const roles = useMemo(
    () => [...new Set(roles_disponibles.concat(todos.map((u) => u.rol).filter(Boolean)))],
    [todos]
  )

  async function pedir_eliminar(u) {
    const confirmacion = await confirmarseguro({
      titulo: '🗑 Eliminar usuario',
      descripcion: 'Se elimina el perfil de ' + u.nombre + ' (' + u.email + '). Dejará de poder iniciar sesión.',
      textoconfirmar: 'Sí, eliminar',
      pedirmotivo: false,
    })
    if (confirmacion) eliminar(u, confirmacion)
  }

  return (
    <div className="page active" id="page-usuarios">
      <div style={{ padding: '28px', flex: 1, minHeight: 0 }}>
        <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2>Usuarios</h2>
            <p>Gestión de cuentas y permisos del sistema</p>
          </div>
          {puede && (
            <button className="btn btn-primary btn-sm" onClick={() => setform({ editando: null })}>
              + Nuevo usuario
            </button>
          )}
        </div>

        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-body" style={{ padding: '14px 20px' }}>
            <div className="flex gap-2 flex-center">
              <div className="search-wrap" style={{ flex: 1 }}>
                <svg className="search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="6" cy="6" r="4.5" stroke="#9AA3B4" strokeWidth="1.4" />
                  <path d="M10 10l2.5 2.5" stroke="#9AA3B4" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                <input
                  className="input" id="usuarios-search"
                  placeholder="Buscar usuario por nombre o correo..."
                  value={busqueda} onChange={(e) => setbusqueda(e.target.value)}
                />
              </div>
              <select
                className="input select" id="usuarios-filtro-rol" style={{ width: '160px' }}
                value={rol} onChange={(e) => setrol(e.target.value)}
              >
                <option value="">Todos los roles</option>
                {roles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select
                className="input select" id="usuarios-filtro-estado" style={{ width: '140px' }}
                value={estado} onChange={(e) => setestado(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="Activo">Activos</option>
                <option value="Inactivo">Inactivos</option>
                <option value="Invitado">Invitados</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '24%' }}>Usuario</th>
                  <th style={{ width: '28%' }}>Correo</th>
                  <th style={{ width: '14%' }}>Rol</th>
                  <th style={{ width: '12%' }}>Estado</th>
                  <th style={{ width: '18%' }}>Permisos</th>
                  {puede && <th style={{ width: '16%' }}></th>}
                </tr>
              </thead>
              <tbody id="usuarios-tbody">
                {lista.map((u) => {
                  const perms = permisos_efectivos(u)
                  const n = Object.keys(perms).length
                  const es_admin = String(u.rol || '').toLowerCase() === 'administrador'
                  const es_yo = yo && String(yo.id) === String(u.id)
                  return (
                    <tr key={u.id}>
                      <td className="td-name">
                        {u.nombre}
                        {es_yo && (
                          <span className="badge badge-gray" style={{ fontSize: '9px', marginLeft: '6px' }}>tú</span>
                        )}
                      </td>
                      <td className="td-muted">{u.email}</td>
                      <td><span className={'badge ' + (role_badge[u.rol] || 'badge-gray')}>{u.rol}</span></td>
                      <td><span className={'badge ' + badge_estado_usuario(u.estado)}>{u.estado}</span></td>
                      <td>
                        <button className="btn btn-ghost btn-xs" onClick={() => setdetalle(u)}>
                          {es_admin ? 'Acceso total' : n + ' módulo' + (n === 1 ? '' : 's')} ›
                        </button>
                      </td>
                      {puede && (
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button className="btn btn-ghost btn-xs" onClick={() => setform({ editando: u })} title="Editar">
                              ✏️
                            </button>
                            <button
                              className="btn btn-ghost btn-xs" onClick={() => alternar_estado(u)}
                              title={u.estado === 'Activo' ? 'Desactivar' : 'Activar'}
                            >
                              {u.estado === 'Activo' ? '🚫' : '✅'}
                            </button>
                            <button
                              className="btn btn-ghost btn-xs" style={{ color: 'var(--rojo)' }}
                              onClick={() => pedir_eliminar(u)} disabled={es_yo || borrando === u.id}
                              title={es_yo ? 'No puedes eliminar tu propia cuenta' : 'Eliminar'}
                            >
                              🗑
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {cargando && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)', fontSize: '13px' }}>
              Cargando usuarios…
            </div>
          )}
          {!cargando && lista.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>👥</div>
              <div style={{ fontSize: '14px' }}>
                {errores.includes('usuarios')
                  ? 'No se pudo leer la tabla de usuarios'
                  : 'Sin usuarios que coincidan'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── permisos del usuario (consulta) ── */}
      {detalle && (
        <div
          className="modal-overlay open"
          style={{ alignItems: 'flex-start', padding: '24px', overflowY: 'auto' }}
          onClick={(e) => { if (e.target === e.currentTarget) setdetalle(null) }}
        >
          <div className="modal" style={{ width: '560px', margin: 'auto' }}>
            <div className="card-header" style={{ padding: '18px 22px' }}>
              <div>
                <div className="card-title">{detalle.nombre}</div>
                <div className="card-sub">{detalle.email} · {detalle.rol}</div>
              </div>
              <button className="btn btn-ghost btn-xs" onClick={() => setdetalle(null)}>✕</button>
            </div>

            <div style={{ padding: '18px 22px' }}>
              {String(detalle.rol || '').toLowerCase() === 'administrador' ? (
                <div className="card" style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6 }}>
                  🔑 <b>Acceso total e irrestricto.</b> El rol Administrador ignora por completo
                  el mapa de permisos individuales: siempre puede ver y editar todos los módulos.
                </div>
              ) : (
                <>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-3)', marginBottom: '14px', lineHeight: 1.5 }}>
                    Un módulo sin nivel asignado queda fuera del menú de este usuario.
                    <b> Ver</b> permite consultar; <b>Editar</b> además permite modificar.
                  </p>
                  {perms_groups.map((g) => {
                    const perms = permisos_efectivos(detalle)
                    return (
                      <div key={g.label} style={{ marginBottom: '14px' }}>
                        <div className="card-title" style={{ fontSize: '12px', marginBottom: '6px' }}>
                          {g.label}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {g.items.map((it) => {
                            const nivel = perms[it.key]
                            return (
                              <span
                                key={it.key}
                                className={'badge ' + (nivel === 'editar' ? 'badge-green' : nivel === 'ver' ? 'badge-blue' : 'badge-gray')}
                                style={{ opacity: nivel ? 1 : 0.45 }}
                              >
                                {it.label}
                                {nivel ? ' · ' + (nivel === 'editar' ? 'Editar' : 'Ver') : ' · —'}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <UsuarioForm
        abierto={!!form}
        editando={form ? form.editando : null}
        permisosdefault={perms_default.Vendedora}
        oncerrar={() => setform(null)}
        onguardar={guardar}
        guardando={guardando}
      />
      {dialogo}
    </div>
  )
}
