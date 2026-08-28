// ═══════════════════════════════════════════════════════════════════
// navbar.jsx — cabecera del sitio publico.
// espejo 1:1 de v1: panel-inicio.html lineas 565-576 (<header> + <nav>).
// las clases (.logo, .logo-text, .nav-mis-compras, .mc-ico, .btn-nav) y el
// <header> sin clase se estilan con el css original ya migrado en
// src/styles/panel-inicio.css — no se altero ni una regla.
//
// unico cambio de la migracion a spa: "Mis compras" apuntaba al archivo
// panel-reserva.html; ahora es una ruta del router (/mis-reservas) para que
// no recargue la pagina. el resto son anclas internas (#juegos, #faq...)
// que siguen siendo <a href> como en la v1.
// ═══════════════════════════════════════════════════════════════════

import { Link } from 'react-router-dom'
import PromoBanner from './promobanner'

export default function navbar() {
  return (
    <>
      {/* banner de promocion — va ANTES del <header>, igual que en la v1 */}
      <PromoBanner />

      <header>
        <a href="#" className="logo">
          <img
            src="/logo-naranjeros.png"
            alt="Naranjeros"
            style={{ height: '32px', width: 'auto', objectFit: 'contain' }}
          />
          <div className="logo-text" style={{ display: 'none' }}>
            Naranjeros<span>Zonas de Asadores</span>
          </div>
        </a>
        <nav>
          <a href="#juegos">Juegos</a>
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#faq">FAQ</a>
          <Link to="/mis-reservas" id="btnMisCompras" className="nav-mis-compras">
            <span className="mc-ico" aria-hidden="true">🎫</span>Mis compras
          </Link>
          <a href="#juegos" className="btn-nav">Reservar ahora</a>
        </nav>
      </header>
    </>
  )
}
