// ═══════════════════════════════════════════════════════════════════
// misreservas.jsx — portal "Mis reservas".
// espejo 1:1 de v1: panel-reserva.html (pantalla de acceso + layout con
// barra lateral y vista de reserva).
//
// el css original vive en styles/panel-reserva.css, acotado bajo
// .pagina-portal por el mismo motivo que legales: en la spa todo el css
// comparte bundle y las reglas de :root/body chocarian con la landing.
//
// SOLO LECTURA: la unica peticion es GET /api/mis-reservas. La vista de
// perfil y las acciones de edicion de la v1 escriben en produccion y quedan
// fuera de esta fase.
// ═══════════════════════════════════════════════════════════════════

import { useEffect } from 'react'
import PortalProvider from '../context/portalcontext'
import useportal from '../hooks/useportal'
import AccesoPortal from '../components/portal/accesoportal'
import VistaReserva from '../components/portal/vistareserva'
import '../styles/panel-reserva.css'

function contenido() {
  const { sesion, reservas, actual, actualid, setactualid, salir } = useportal()

  useEffect(() => {
    document.title = 'Mis Reservas'
  }, [])

  const dentro = !!sesion && reservas.length > 0

  return (
    <div className="pagina-portal">
      {!dentro && <AccesoPortal />}

      {dentro && (
        <div className="layout">
          <aside>
            <div className="logo">
              <a href="/" title="Ir a la página principal">
                <img src="/logo-naranjeros.png" alt="Naranjeros" />
              </a>
            </div>

            <div className="selector" id="selector">
              <span className="selector-label">Reserva seleccionada</span>
              {/* con una sola reserva el desplegable sobra; con varias, se
                  elige aqui. la v1 usaba un dropdown propio. */}
              <button className="sel-btn" style={{ cursor: 'default' }}>
                <div className="sel-top">
                  <span
                    className={'badge ' + (actual.estado === 'activa' ? 'active' : 'past')}
                    id="selBadge"
                  >
                    {actual.badge}
                  </span>
                </div>
                <div className="match" id="selMatch">{actual.partido}</div>
                <div className="meta" id="selFolio" style={{ fontWeight: 700, color: 'var(--orange)' }}>
                  #{actual.id}
                </div>
                <div className="meta" id="selMeta">{actual.seccion}</div>
              </button>

              {reservas.length > 1 && (
                <div className="dropdown" id="dropdown" style={{ display: 'block' }}>
                  {reservas.map((r) => (
                    <button
                      key={r.id}
                      className={'drop-item' + (r.id === actualid ? ' sel' : '')}
                      onClick={() => setactualid(r.id)}
                    >
                      <span className={'badge ' + (r.estado === 'activa' ? 'active' : 'past')}>
                        {r.badge}
                      </span>
                      <div className="match">{r.partido}</div>
                      <div className="meta">#{r.id} · {r.seccion}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <nav>
              <a href="#" id="navReserva" onClick={(e) => e.preventDefault()}>Reserva</a>
              <a
                href="#" className="dim"
                onClick={(e) => { e.preventDefault(); salir() }}
                style={{ marginTop: '18px', fontSize: '14px' }}
              >
                Salir ⏻
              </a>
            </nav>
          </aside>

          <main>
            <VistaReserva />
          </main>
        </div>
      )}
    </div>
  )
}

const Contenido = contenido

export default function misreservas() {
  return (
    <PortalProvider>
      <Contenido />
    </PortalProvider>
  )
}
