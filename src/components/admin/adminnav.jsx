// ═══════════════════════════════════════════════════════════════════
// adminnav.jsx — menu lateral del panel.
// extraido del <aside class="sidebar"> de index.html (v1): las 6 secciones y
// sus 19 entradas, con sus iconos svg tal cual.
//
// `id` es el mismo que recibia showPage() en la v1, asi cada modulo que se
// migre se cuelga aqui sin renombrar nada. `badge` marca las entradas que en
// la v1 llevan un contador (hoy oculto: lo llenara su modulo).
// ═══════════════════════════════════════════════════════════════════

export const secciones_nav = [
  {
    label: "Principal",
    items: [
      {
        id: "dashboard",
        texto: "Dashboard",
        badge: null,
        icono: (<svg className="nav-icon" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" /></svg>),
      },
    ],
  },
  {
    label: "Comercial",
    items: [
      {
        id: "clientes",
        texto: "Clientes",
        badge: null,
        icono: (<svg className="nav-icon" viewBox="0 0 16 16" fill="none"><circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4" /><path d="M1.5 13.5c0-2.485 2.015-4.5 4.5-4.5s4.5 2.015 4.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M11 7.5c1.38 0 2.5 1.12 2.5 2.5 0 .92-.5 1.73-1.25 2.16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>),
      },
      {
        id: "cotizaciones",
        texto: "Cotizaciones",
        badge: null,
        icono: (<svg className="nav-icon" viewBox="0 0 16 16" fill="none"><path d="M9 1H3a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V6l-5-5z" stroke="currentColor" strokeWidth="1.4" /><path d="M9 1v5h5M5 9h6M5 12h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>),
      },
      {
        id: "palcos",
        texto: "Pipeline de Palcos",
        badge: null,
        icono: (<svg className="nav-icon" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" /><path d="M2 9h12" stroke="currentColor" strokeWidth="1.5" /></svg>),
      },
      {
        id: "pipeline",
        texto: "Pipeline Comercial",
        badge: "pipeline-nav-badge",
        icono: (<svg className="nav-icon" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>),
      },
      {
        id: "completados",
        texto: "Completados",
        badge: null,
        icono: (<svg className="nav-icon" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" /><path d="M5 8.2l2.2 2.2L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>),
      },
      {
        id: "seccionesreservadas",
        texto: "Reservas",
        badge: null,
        icono: (<svg className="nav-icon" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M1.5 6.5h13M5 1v3M11 1v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>),
      },
      {
        id: "consumos",
        texto: "Saldo de Consumo",
        badge: null,
        icono: (<svg className="nav-icon" viewBox="0 0 16 16" fill="none"><path d="M4 2h8a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4" /><path d="M6 6h4M6 9h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><circle cx="11" cy="11" r="3" fill="var(--naranja)" opacity="0.8" /><path d="M10 11h2M11 10v2" stroke="white" strokeWidth="1.2" strokeLinecap="round" /></svg>),
      },
    ],
  },
  {
    label: "Estadio",
    items: [
      {
        id: "crear",
        texto: "Crear",
        badge: null,
        icono: (<svg className="nav-icon" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" /><path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>),
      },
      {
        id: "temporadas",
        texto: "Temporadas",
        badge: null,
        icono: (<svg className="nav-icon" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M1.5 6.5h13M5 1v3M11 1v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><circle cx="5" cy="10" r="1" fill="currentColor" /><circle cx="8" cy="10" r="1" fill="currentColor" /><circle cx="11" cy="10" r="1" fill="currentColor" /></svg>),
      },
      {
        id: "precios",
        texto: "Precios",
        badge: null,
        icono: (<svg className="nav-icon" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" /><path d="M8 4.5v7M6 6.5h3a1 1 0 110 2H7a1 1 0 110 2h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>),
      },
      {
        id: "landing",
        texto: "Landing",
        badge: null,
        icono: (<svg className="nav-icon" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M1.5 6.5h13" stroke="currentColor" strokeWidth="1.4" /><path d="M5 10h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>),
      },
    ],
  },
  {
    label: "Finanzas",
    items: [
      {
        id: "cobros",
        texto: "Cobros",
        badge: null,
        icono: (<svg className="nav-icon" viewBox="0 0 16 16" fill="none"><path d="M2 5h12v8a1 1 0 01-1 1H3a1 1 0 01-1-1V5zM2 5V3a1 1 0 011-1h10a1 1 0 011 1v2" stroke="currentColor" strokeWidth="1.4" /><path d="M6 9h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>),
      },
      {
        id: "descuentos",
        texto: "Descuentos",
        badge: null,
        icono: (<svg className="nav-icon" viewBox="0 0 16 16" fill="none"><path d="M4 12L12 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><circle cx="5" cy="5" r="1.6" stroke="currentColor" strokeWidth="1.3" /><circle cx="11" cy="11" r="1.6" stroke="currentColor" strokeWidth="1.3" /></svg>),
      },
      {
        id: "metodos",
        texto: "Método de Pago",
        badge: null,
        icono: (<svg className="nav-icon" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M1.5 6.5h13" stroke="currentColor" strokeWidth="1.4" /><path d="M4 9.5h2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>),
      },
      {
        id: "reportes",
        texto: "Reportes",
        badge: null,
        icono: (<svg className="nav-icon" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M4 7h2v4H4zM7 5h2v6H7zM10 9h2v2h-2z" fill="currentColor" opacity="0.7" /></svg>),
      },
    ],
  },
  {
    label: "Comunicación",
    items: [
      {
        id: "mensajes",
        texto: "Mensajes",
        badge: null,
        icono: (<svg className="nav-icon" viewBox="0 0 16 16" fill="none"><path d="M2 3h12a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 2V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M5 7h6M5 9.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>),
      },
    ],
  },
  {
    label: "Sistema",
    items: [
      {
        id: "usuarios",
        texto: "Usuarios",
        badge: null,
        icono: (<svg className="nav-icon" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4" /><path d="M3 13.5c0-2.5 2.2-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>),
      },
      {
        id: "movimientos",
        texto: "Movimientos",
        badge: null,
        icono: (<svg className="nav-icon" viewBox="0 0 16 16" fill="none"><path d="M2 8h12M10 4l4 4-4 4M6 12l-4-4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>),
      },
      // 'ajustes' es entrada NUEVA, sin equivalente en la v1 (no tiene pagina
      // de Ajustes) — ver lib/config.js.
      {
        id: "ajustes",
        texto: "Ajustes",
        badge: null,
        icono: (<svg className="nav-icon" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.4" /><path d="M8 2.5v1.6M8 11.9v1.6M13.5 8h-1.6M4.1 8H2.5M11.7 4.3l-1.1 1.1M5.4 10.6l-1.1 1.1M11.7 11.7l-1.1-1.1M5.4 5.4L4.3 4.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>),
      },
    ],
  },
]

export default secciones_nav
