// ═══════════════════════════════════════════════════════════════════
// footer.jsx — pie de pagina del sitio publico.
// espejo 1:1 de v1: panel-inicio.html lineas 886-968 (<footer class="site-footer">).
// todas las clases (.site-footer, .footer-top, .footer-col, .footer-logo,
// .footer-contact-line, .footer-col-title, .footer-divider, .footer-bottom,
// .footer-bottom-inner, .footer-pay-chip) ya viven en src/styles/panel-inicio.css
// copiadas textual — no se altero ninguna regla ni ningun svg.
//
// dos detalles de la migracion:
//   · los <span data-config="contacto.*"> de la v1 los llenaba el estampador
//     de js/00-config.js recorriendo el dom. aqui se leen directo de
//     lib/config.js — mismo valor, sin manipular el dom.
//   · el onmouseover/onmouseout en linea del boton "Administracion" pasa a
//     handlers de react con los MISMOS valores de color de la v1.
// ═══════════════════════════════════════════════════════════════════

import { Link } from 'react-router-dom'
import app_config from '../../lib/config'

// colores del boton "Administracion" — identicos a los del onmouseover de la v1.
const admin_reposo = {
  background: 'rgba(255,255,255,0.07)',
  color: '#888',
  borderColor: 'rgba(255,255,255,0.12)',
}
const admin_hover = { background: '#E05C1A', color: '#fff', borderColor: '#E05C1A' }

const redes = [
  {
    nombre: 'Facebook',
    url: 'https://www.facebook.com/ClubNaranjeros',
    svg: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
      </svg>
    ),
  },
  {
    nombre: 'Instagram',
    url: 'https://www.instagram.com/ClubNaranjeros/',
    referrerpolicy: 'no-referrer-when-downgrade',
    svg: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    nombre: 'X (Twitter)',
    url: 'https://x.com/ClubNaranjeros',
    svg: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    nombre: 'TikTok',
    url: 'https://tiktok.com/@ClubNaranjeros',
    svg: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    ),
  },
  {
    nombre: 'YouTube',
    url: 'https://youtube.com/@ClubNaranjeros',
    svg: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58 2.78 2.78 0 001.95 1.95C5.12 20 12 20 12 20s6.88 0 8.59-.47a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58z" />
      </svg>
    ),
  },
]

const metodos_pago = ['VISA', 'Mastercard', 'AMEX', 'Transferencia', 'OXXO Pay']

export default function footer() {
  function admin_entra(e) {
    Object.assign(e.currentTarget.style, admin_hover)
  }
  function admin_sale(e) {
    Object.assign(e.currentTarget.style, admin_reposo)
  }

  return (
    <footer className="site-footer">
      <div className="footer-top">
        {/* Col 1: Logo + contacto */}
        <div className="footer-col">
          <div className="footer-logo">
            <img
              src="/logo-naranjeros.png"
              alt="Naranjeros"
              style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
            />
          </div>
          <p
            style={{
              fontSize: '13px',
              color: '#888',
              lineHeight: 1.6,
              marginBottom: '16px',
              maxWidth: '260px',
            }}
          >
            Plataforma oficial de reservas de Zonas de Asadores del Estadio Fernando Valenzuela,
            Hermosillo, Sonora.
          </p>
          <div className="footer-contact-line">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 2h5l2 4-2.5 1.5A9 9 0 009.5 11L11 8.5l4 2v5C7 17 -1 9 2 2z"
                stroke="currentColor"
                strokeWidth="1.3"
                fill="none"
              />
            </svg>
            <span>{app_config.contacto.telasistenciabonito}</span>
          </div>
          <div className="footer-contact-line">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M1 5l7 5 7-5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <span>{app_config.contacto.email}</span>
          </div>
          <div className="footer-contact-line" style={{ alignItems: 'flex-start' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1a5 5 0 015 5c0 3.5-5 9-5 9S3 9.5 3 6a5 5 0 015-5z"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.3" />
            </svg>
            <span>Estadio Fernando Valenzuela, Hermosillo, Sonora</span>
          </div>
          {/* (Fila de iconos de redes eliminada: las redes viven unicamente en
              la columna "Siguenos", con icono + nombre — sin duplicidades.) */}
        </div>

        {/* Col 2: Informacion */}
        <div className="footer-col">
          <div className="footer-col-title">Información</div>
          <ul>
            <li><a href="#juegos">Próximos juegos</a></li>
            <li><a href="#como-funciona">Cómo funciona</a></li>
            <li><a href="#faq">Preguntas frecuentes</a></li>
          </ul>
        </div>

        {/* Col 3: Politicas */}
        <div className="footer-col">
          <div className="footer-col-title">Políticas</div>
          <ul>
            <li><Link to="/legales#terminos">Términos y Condiciones</Link></li>
            <li><Link to="/legales#privacidad">Aviso de Privacidad</Link></li>
            <li><Link to="/legales#cancelaciones">Política de Cancelaciones</Link></li>
            <li><Link to="/legales#pagos">Política de Pagos</Link></li>
          </ul>
        </div>

        {/* Col 4: Siguenos */}
        <div className="footer-col">
          <div className="footer-col-title">Síguenos</div>
          <ul style={{ gap: '10px' }}>
            {redes.map((r) => (
              <li key={r.nombre}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy={r.referrerpolicy}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {r.svg}
                  {r.nombre}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <hr className="footer-divider" />

      {/* Sub-footer en 3 zonas: copyright · metodos de pago · administracion.
          Los enlaces legales viven solo en la columna "Politicas" y las redes
          solo en "Siguenos" — sin duplicados en esta barra. */}
      <div className="footer-bottom">
        <div
          className="footer-bottom-inner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <span>© 2026 Naranjeros de Hermosillo. Todos los derechos reservados.</span>
          <span
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            {metodos_pago.map((m) => (
              <span key={m} className="footer-pay-chip">{m}</span>
            ))}
          </span>
          <Link
            to="/admin"
            onMouseOver={admin_entra}
            onMouseOut={admin_sale}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              background: admin_reposo.background,
              border: '1px solid ' + admin_reposo.borderColor,
              borderRadius: '6px',
              padding: '5px 10px',
              color: admin_reposo.color,
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.3px',
              transition: 'background 0.15s,color 0.15s',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            Administración
          </Link>
        </div>
      </div>
    </footer>
  )
}
