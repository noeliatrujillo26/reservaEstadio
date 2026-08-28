// ═══════════════════════════════════════════════════════════════════
// psiconos.jsx — catalogo de iconos de las tarjetas del promo strip.
// espejo 1:1 de v1: const _PS_ICONOS de panel-inicio.html.
// el admin elige por nombre y aqui se resuelve al svg; el respaldo cuando el
// nombre no existe es 'estrella', igual que en la v1.
// ═══════════════════════════════════════════════════════════════════

export const ps_iconos = {
  personas: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 5.5a2.8 2.8 0 010 5.4M18.5 19c0-2.6-1.3-4.6-3.5-5.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  tarjeta: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 10h19" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 15h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  calendario: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 12.2l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3 1-2z" fill="currentColor" />
    </svg>
  ),
  ticket: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M3 9V7a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 000 6v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 000-6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 5v2M14 11v2M14 17v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="0.5 3.2" />
    </svg>
  ),
  estrella: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.4l-5.3 2.7 1-5.8L3.5 9.2l5.9-.9L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
}

export default ps_iconos
