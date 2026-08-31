// ═══════════════════════════════════════════════════════════════════
// adminsidebar.jsx — menu lateral del panel.
// espejo 1:1 de v1: <aside class="sidebar"> de index.html (lineas 1758-1883).
//
// las entradas se filtran con puedo_acceder(), igual que aplicarPermisosUI():
// el Administrador ve todo; los demas roles solo sus secciones.
//
// Los modulos aun no migrados quedan visibles pero inertes y marcados: es mas
// honesto que esconderlos, porque asi se ve el avance real de la migracion.
// ═══════════════════════════════════════════════════════════════════

import useadmin from '../../hooks/useadmin'
import { puedo_acceder } from '../../lib/permisos'
import secciones_nav from './adminnav'

// modulos ya migrados. conforme avance la migracion se agregan aqui.
const migrados = []

export default function adminsidebar({ vista, onvista, oncerrardrawer }) {
  const { usuario, cerrar_sesion } = useadmin()

  return (
    <aside className="sidebar">
      <div className="sidebar-logo" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
        <img src="/logo-naranjeros.png" alt="Naranjeros" style={{ height: '30px', width: 'auto', objectFit: 'contain' }} />
        <span id="sidebar-subtitulo" style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-3)', opacity: 0.9, lineHeight: 1.35, margin: '2px 0' }}>
          Sistema Integral de Reservas en Estadios
        </span>
        <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#555' }}>
          Panel Admin
        </span>
      </div>

      {secciones_nav.map((sec) => {
        const visibles = sec.items.filter((it) => puedo_acceder(usuario, it.id))
        if (!visibles.length) return null
        return (
          <div className="sidebar-section" key={sec.label}>
            <div className="sidebar-section-label">{sec.label}</div>
            {visibles.map((it) => {
              const listo = migrados.indexOf(it.id) >= 0
              return (
                <button
                  key={it.id}
                  className={'nav-item' + (vista === it.id ? ' active' : '')}
                  onClick={() => { onvista(it.id); if (oncerrardrawer) oncerrardrawer() }}
                  title={listo ? it.texto : it.texto + ' — módulo aún no migrado'}
                  style={listo ? undefined : { opacity: 0.55 }}
                >
                  {it.icono}
                  {it.texto}
                </button>
              )
            })}
          </div>
        )
      })}

      <div className="sidebar-footer">
        <a href="/" className="btn-back">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M7.5 2L3.5 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Volver al sitio
        </a>
        <div className="sidebar-user">
          <div className="sidebar-avatar" id="sidebar-avatar">{usuario ? usuario.iniciales : '—'}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name" id="sidebar-user-name">{usuario ? usuario.nombre : '—'}</div>
            <div className="sidebar-user-role" id="sidebar-user-role">{usuario ? usuario.rol : '—'}</div>
          </div>
          <button
            className="btn btn-ghost btn-xs" onClick={cerrar_sesion}
            title="Cerrar sesión" style={{ marginLeft: 'auto' }}
          >
            ⏻
          </button>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-3)', textAlign: 'center', padding: '8px 0 4px', letterSpacing: '0.3px' }}>
          v1.0.0 · Naranjeros Admin
        </div>
      </div>
    </aside>
  )
}
