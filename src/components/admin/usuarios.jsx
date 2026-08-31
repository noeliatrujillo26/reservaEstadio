// ═══════════════════════════════════════════════════════════════════
// usuarios.jsx — cuentas y permisos del sistema.
// espejo 1:1 de v1: #page-usuarios de index.html (lineas 2153-2181) y
// renderUsuarios() de js/22-usuarios-clientes.js.
//
// SOLO LECTURA: se omiten "Nuevo usuario", editar, activar/desactivar y
// eliminar — todos escriben en la tabla `usuarios` de produccion. En su lugar,
// la fila abre el detalle de permisos, que en la v1 vive dentro del cajon de
// edicion y aqui se muestra en modo consulta.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import useadmin from '../../hooks/useadmin'
import {
  badge_estado_usuario, filtrar_usuarios, permisos_efectivos, perms_groups, role_badge,
} from '../../lib/usuarios'

export default function usuarios() {
  const { usuarios: todos, cargando, errores } = useadmindatos()
  const { usuario: yo } = useadmin()

  const [busqueda, setbusqueda] = useState('')
  const [rol, setrol] = useState('')
  const [estado, setestado] = useState('')
  const [detalle, setdetalle] = useState(null)

  const lista = useMemo(
    () => filtrar_usuarios(todos, { busqueda, rol, estado }),
    [todos, busqueda, rol, estado]
  )

  // roles presentes de verdad + los tres fijos del select de la v1.
  const roles = useMemo(() => {
    const fijos = ['Administrador', 'Vendedora', 'Cajero']
    return [...new Set(fijos.concat(todos.map((u) => u.rol).filter(Boolean)))]
  }, [todos])

  return (
    <div className="page active" id="page-usuarios">
      <div style={{ padding: '28px', flex: 1, minHeight: 0 }}>
        <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2>Usuarios</h2>
            <p>Gestión de cuentas y permisos del sistema</p>
          </div>
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
                  <th style={{ width: '22%' }}>Permisos</th>
                </tr>
              </thead>
              <tbody id="usuarios-tbody">
                {lista.map((u) => {
                  const perms = permisos_efectivos(u)
                  const n = Object.keys(perms).length
                  const es_admin = String(u.rol || '').toLowerCase() === 'administrador'
                  return (
                    <tr key={u.id}>
                      <td className="td-name">
                        {u.nombre}
                        {yo && String(yo.id) === String(u.id) && (
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
    </div>
  )
}
