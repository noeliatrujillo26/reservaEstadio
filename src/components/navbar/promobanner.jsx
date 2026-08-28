// ═══════════════════════════════════════════════════════════════════
// promobanner.jsx — banner de promocion controlado desde el admin (Landing).
// espejo 1:1 de v1: panel-inicio.html lineas 559-563 (markup con estilos
// en linea) + _aplicarBannerPromo() lineas 3242-3257.
//
// reglas conservadas tal cual de la v1:
//   · se muestra solo si (activo && texto) — cualquier otro caso: oculto
//   · color de fondo = color de la base, o '#e63946' de respaldo
//   · si hay enlace: cursor pointer y click navega a esa url
//   · la ✕ oculta el banner y detiene la propagacion (no dispara el enlace)
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react'
import usebannerpromo from '../../hooks/usebannerpromo'

export default function promobanner() {
  const banner = usebannerpromo()
  const [cerrado, setcerrado] = useState(false)

  // misma condicion que _aplicarBannerPromo: sin activo o sin texto, no se pinta.
  if (!banner.activo || !banner.texto || cerrado) return null

  const hay_enlace = !!banner.enlace

  function alcerrar(e) {
    e.stopPropagation()
    setcerrado(true)
  }

  function alclic() {
    if (hay_enlace) window.location.href = banner.enlace
  }

  return (
    <div
      id="promo-banner"
      onClick={alclic}
      style={{
        padding: '10px 48px 10px 16px',
        textAlign: 'center',
        fontSize: '14px',
        fontWeight: 600,
        color: '#fff',
        position: 'relative',
        backgroundColor: banner.color,
        cursor: hay_enlace ? 'pointer' : 'default',
      }}
    >
      <span aria-hidden="true">🔥</span> <span id="promo-banner-texto">{banner.texto}</span>
      <button
        onClick={alcerrar}
        style={{
          position: 'absolute',
          right: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          color: '#fff',
          fontSize: '20px',
          lineHeight: 1,
          cursor: 'pointer',
        }}
        aria-label="Cerrar"
      >
        ×
      </button>
    </div>
  )
}
