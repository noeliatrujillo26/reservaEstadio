// ═══════════════════════════════════════════════════════════════════
// iconos.jsx — set de SVG inline compartido por los 3 módulos de
// /reserva-express (formulario, cobro y reservas), 02 oct 2026.
//
// Reemplaza los emojis que traían los encabezados y botones ("👤 Cliente",
// "🏟️ Evento", "🔎 Buscar reserva", "💰 Resumen/Financiero", "🧾 Registrar
// cobro", "📤/📎" del comprobante) por trazo vectorial — mismo criterio de
// "currentColor" que ya usaban los íconos de la tarjeta de reserva: heredan
// el color del contenedor, así que un mismo SVG sirve tanto en un título
// gris como en un botón naranja sin duplicarlo por color.
//
// IconCarneAsada/IconDiscada son EL MISMO trazo que ya usa la landing
// pública (panel-inicio.html, botones del selector de comida del detalle de
// zona) — se copian tal cual para que ambas apps muestren el mismo ícono,
// solo recoloreado a currentColor en vez de su gris fijo original.
// ═══════════════════════════════════════════════════════════════════

export function IconUsuario() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="5" r="2.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.8 14c.6-3 2.8-4.6 5.2-4.6s4.6 1.6 5.2 4.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function IconEvento() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 1.5v3M11 1.5v3M2 6.5h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function IconLupa() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.3 10.3L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function IconResumen() {
  // Tarjeta/saldo: rectángulo con banda superior (chip) y una línea de
  // saldo abajo — mismo lenguaje visual que una tarjeta de pago.
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.5 6.5h13" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 10h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function IconRecibo() {
  // Recibo/pago: hoja con borde inferior dentado (clásico ticket de papel)
  // y líneas de detalle adentro.
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 1.5h9v12.3l-1.6-1-1.4 1-1.5-1-1.5 1-1.4-1-1.6 1V1.5z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"
      />
      <path d="M5.5 4.5h5M5.5 7h5M5.5 9.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export function IconSubir() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 11V2.5M4.8 5.7L8 2.5l3.2 3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 11.5V13a1 1 0 001 1h9a1 1 0 001-1v-1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function IconArchivo() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M9.5 1.5H4a1 1 0 00-1 1v11a1 1 0 001 1h8a1 1 0 001-1V5l-3.5-3.5z"
        stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"
      />
      <path d="M9.3 1.6V5h3.4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

export function IconEditar() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M11.4 2.6a1.6 1.6 0 012.3 0l1.7 1.7a1.6 1.6 0 010 2.3L6.6 15.4l-4 .9.9-4 7.9-7.9z"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconEmail() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 5l5.6 4.3a1.5 1.5 0 001.8 0L15.5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconWhatsapp() {
  // Insignia circular verde con el glifo blanco, en vez de un emoji 📲 —
  // mismo verde de marca (#25D366) en toda la app.
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill="#25D366" />
      <path
        d="M13.85 11.35c-.22-.11-1.3-.64-1.5-.71-.2-.08-.35-.11-.5.11-.14.22-.56.71-.69.85-.13.15-.26.16-.48.06-1.29-.64-2.13-1.15-2.98-2.6-.22-.39.22-.36.64-1.2.07-.15.04-.27-.03-.38s-.5-1.19-.68-1.63c-.18-.42-.37-.37-.5-.38h-.42c-.15 0-.39.06-.59.28-.2.22-.77.75-.77 1.83 0 1.08.79 2.12.9 2.27.11.15 1.52 2.32 3.68 3.15 2.16.84 2.16.56 2.56.52.41-.04 1.3-.53 1.49-1.05.18-.52.18-.96.13-1.05-.06-.09-.2-.15-.42-.26z"
        fill="#fff"
      />
    </svg>
  )
}

export function IconJuego() {
  return <IconEvento />
}

export function IconZona() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 14.5s5-4.2 5-8.3A5 5 0 003 6.2c0 4.1 5 8.3 5 8.3z"
        stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"
      />
      <circle cx="8" cy="6.2" r="1.7" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

export function IconEstado() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 8.3l1.8 1.8 3.2-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Mismo trazo EXACTO que panel-inicio.html (la landing pública) usa en el
// selector de comida del detalle de zona — solo currentColor en vez de su
// gris fijo (#5A6478), para heredar el color del botón (gris en reposo,
// naranja cuando está seleccionado).
export function IconCarneAsada() {
  return (
    <svg width="20" height="20" viewBox="0 0 118 122" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M68 13 C63 18 68 21 68 25 C68 29 64 31 65 35" />
      <path d="M49 39 V35 C49 32 51 30 54 30 H64 C67 30 69 32 69 35 V39" />
      <path d="M26 61 C29 44 42 36 59 36 C76 36 89 44 92 61" />
      <path d="M21 62 H97" />
      <path d="M29 62 V57 H88 V62" />
      <path d="M38 57 V62" />
      <path d="M49 57 V62" />
      <path d="M60 57 V62" />
      <path d="M71 57 V62" />
      <path d="M82 57 V62" />
      <path d="M29 65 C31 80 43 89 59 89 C75 89 87 80 89 65" />
      <path d="M45 87 L36 112" />
      <path d="M59 89 V112" />
      <path d="M74 87 L84 112" />
    </svg>
  )
}

// Iconos de las 3 pestañas superiores (05 oct 2026) — mismo trazo base de
// calendario que IconEvento, con un acento propio por pestaña para que se
// distingan de un vistazo incluso en su estado inactivo (tenue).
export function IconNuevaReserva() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 1.5v3M11 1.5v3M2 6.5h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 8.3v4M6 10.3h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function IconRegistrarCobro() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6.1" cy="9.6" r="4.1" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="9.9" cy="6.4" r="4.1" stroke="currentColor" strokeWidth="1.4" fill="var(--tarjeta, #fff)" />
      <text x="9.9" y="8.3" textAnchor="middle" fontSize="5.3" fontWeight="700" fill="currentColor" stroke="none">$</text>
    </svg>
  )
}

export function IconReservasLista() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 1.5v3M11 1.5v3M2 6.5h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4.5 9h7M4.5 11.3h4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

// Candado biométrico (02 oct 2026) — huella digital simplificada, trazo
// delgado consistente con el resto del set.
export function IconBiometria() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3a9 9 0 00-9 9v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 3a9 9 0 019 9v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7 21v-5a5 5 0 0110 0v1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 21v-4a2 2 0 10-4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 21v-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function IconDiscada() {
  return (
    <svg width="20" height="20" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 78 C7 74 7 69 10 65 C12 62 15 60 18 58 C17 54 19 50 23 48 C26 46 30 46 33 43 C35 39 39 37 44 38 C48 38 51 41 54 42 C57 41 61 38 65 38 C70 38 74 41 76 45 C80 46 84 46 87 49 C91 52 92 56 91 60 C95 63 97 67 96 71 C95 76 92 79 89 82" />
        <path d="M14 80 C17 64 28 54 50 54 C72 54 83 64 86 80" />
        <path d="M14 80H86" />
      </g>
    </svg>
  )
}
