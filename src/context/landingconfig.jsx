// ═══════════════════════════════════════════════════════════════════
// landingconfig.jsx — carga inicial unificada de la landing.
//
// espejo de v1: panel-inicio.html hacia TODAS las peticiones iniciales juntas
// bajo un Promise.allSettled (loadLandingConfig + _cargarBannerPromo +
// cargarPoliticaPagos + _cargarCarruselHero). aqui se hace lo mismo UNA sola
// vez en un provider y los componentes consumen del contexto — asi el navbar,
// el hero y la barra de estadisticas no repiten la misma consulta.
//
// tres tablas, igual que los tres endpoints de la v1:
//   configuracion_landing → banner, promo strip, faq, mensajes
//   politica_pagos        → enganche minimo y dias para liquidar
//   carousel_slides       → fondo del hero
//
// cada una es fail-open por separado (allSettled, no all): si una falla, las
// otras siguen y la pagina nunca se rompe — exactamente como la v1.
// ═══════════════════════════════════════════════════════════════════

import { createContext, useEffect, useState } from 'react'
import { sb } from '../supabaseclient'

export const landingcontext = createContext(null)

const color_por_defecto = '#e63946'

// valores por defecto: los MISMOS textos quemados en el html de la v1, que se
// ven mientras carga y si no hay nada configurado.
const hero_por_defecto = {
  eyebrow: 'Temporada 2026-2027 — Hermosillo, Sonora',
  h1: '¡Vive el juego con',
  em: 'tus amigos!',
  sub: 'Reserva tu sección en el estadio de los Naranjeros. Elige el juego, selecciona tu zona y paga en línea en menos de 5 minutos.',
  cta: 'Ver juegos disponibles',
  bg: null,
}

const stats_por_defecto = [
  { num: '21', lbl: 'Zonas disponibles' },
  { num: null, lbl: 'Enganche mínimo' }, // null = "…%" pendiente, lo llena politica_pagos
  { num: '100%', lbl: 'Pago seguro en línea' },
  { num: '24/7', lbl: 'Reservas disponibles' },
]

// mismos valores de respaldo que api/sitio.js → politicaPagos() y que las
// variables POLITICA_ENGANCHE_MIN / POLITICA_DIAS_LIQUIDAR de panel-inicio.html.
const politica_por_defecto = { enganche_minimo: 30, dias_limite_liquidar: 5 }

const banner_vacio = { activo: false, texto: '', color: color_por_defecto, enlace: '', cotizamsg: '' }

// ── fase 1: cache local ────────────────────────────────────────────
// hero y stats NO tienen columnas en la base: la tabla configuracion_landing
// no las guarda. en la v1 solo viven en localStorage 'nrj_landing', que
// escribe el panel de admin (js/22-usuarios-clientes.js:2206) — o sea que solo
// los ve el navegador donde se editaron. se conserva ese comportamiento tal
// cual; cambiarlo seria alterar funcionalidad.
function leer_cache_landing() {
  try {
    return JSON.parse(localStorage.getItem('nrj_landing') || 'null')
  } catch (e) {
    return null
  }
}

function hero_desde_cache(cfg) {
  if (!cfg) return hero_por_defecto
  return {
    eyebrow: cfg.heroEyebrow || hero_por_defecto.eyebrow,
    h1: cfg.heroH1 || hero_por_defecto.h1,
    em: cfg.heroEm || hero_por_defecto.em,
    sub: cfg.heroSub || hero_por_defecto.sub,
    cta: cfg.heroCta || hero_por_defecto.cta,
    bg: cfg.heroBg || null,
  }
}

function stats_desde_cache(cfg) {
  const guardadas = (cfg && cfg.stats) || []
  return stats_por_defecto.map((s, i) => ({
    num: guardadas[i] && guardadas[i].num != null ? guardadas[i].num : s.num,
    lbl: guardadas[i] && guardadas[i].lbl != null ? guardadas[i].lbl : s.lbl,
  }))
}

function banner_desde_cache(cfg) {
  if (!cfg) return banner_vacio
  return {
    activo: !!cfg.promoActiva,
    texto: cfg.promoTexto || '',
    color: cfg.promoColor || color_por_defecto,
    enlace: cfg.promoEnlace || '',
    cotizamsg: '',
  }
}

export function landingconfigprovider({ children }) {
  const cache = leer_cache_landing()

  const [banner, setbanner] = useState(() => banner_desde_cache(cache))
  const [hero] = useState(() => hero_desde_cache(cache))
  const [stats] = useState(() => stats_desde_cache(cache))
  const [politica, setpolitica] = useState(politica_por_defecto)
  // mientras esto sea true, el stat del enganche muestra "…%" atenuado —
  // mismo estado inicial .pct-pending del html de la v1.
  const [cargandopolitica, setcargandopolitica] = useState(true)
  const [slides, setslides] = useState([])
  // promo strip: mientras esto sea true se pinta el skeleton
  // (.promo-strip--cargando), igual que el html inicial de la v1.
  const [promostrip, setpromostrip] = useState(null)
  const [cargandopromostrip, setcargandopromostrip] = useState(true)

  useEffect(() => {
    let vivo = true

    async function cargar() {
      // las tres consultas en paralelo, cada una fail-open por separado.
      const [rlanding, rpolitica, rcarrusel] = await Promise.allSettled([
        sb.from('configuracion_landing').select('*').eq('id', 1).maybeSingle(),
        sb.from('politica_pagos').select('*').eq('id', 1).maybeSingle(),
        sb
          .from('carousel_slides')
          .select('id, image_url, title, order_index')
          .eq('is_active', true)
          .order('order_index'),
      ])
      if (!vivo) return

      // ── configuracion_landing → banner (misma normalizacion que api/sitio.js)
      if (rlanding.status === 'fulfilled' && !rlanding.value.error) {
        const d = rlanding.value.data
        setbanner({
          activo: !!(d && d.banner_activo),
          texto: (d && d.banner_texto) || '',
          color: (d && d.banner_color) || color_por_defecto,
          enlace: (d && d.banner_enlace) || '',
          cotizamsg: (d && d.whatsapp_quote_message) || '',
        })
        // misma normalizacion que api/sitio.js -> promoStrip()
        setpromostrip({
          activo: d && d.promo_strip_enabled != null ? !!d.promo_strip_enabled : true,
          titulo: (d && d.promo_strip_titulo) || '',
          subtitulo: (d && d.promo_strip_subtitulo) || '',
          btntexto: (d && d.promo_strip_btn_texto) || '',
          btnurl: (d && d.promo_strip_btn_url) || '',
          cards: d && Array.isArray(d.promo_strip_cards) ? d.promo_strip_cards : null,
        })
      } else {
        console.error('landing/banner-promo error:', rlanding.reason || rlanding.value?.error)
        setbanner(banner_vacio) // fail-open
        // la v1 oculta la franja entera ante cualquier error de consulta.
        setpromostrip(null)
      }
      setcargandopromostrip(false)

      // ── politica_pagos → enganche minimo del stat 2 y textos del checkout
      if (rpolitica.status === 'fulfilled' && !rpolitica.value.error) {
        const d = rpolitica.value.data
        setpolitica({
          enganche_minimo: d && d.enganche_minimo != null ? Number(d.enganche_minimo) : 30,
          dias_limite_liquidar:
            d && d.dias_limite_liquidar != null
              ? Number(d.dias_limite_liquidar) || politica_por_defecto.dias_limite_liquidar
              : politica_por_defecto.dias_limite_liquidar,
        })
      } else {
        // igual que la v1: revela el minimo por defecto en vez de dejar el
        // "…%" colgado en pantalla para siempre.
        console.warn('No se pudo cargar la política de enganche; se usa el mínimo por defecto (30%).')
        setpolitica(politica_por_defecto)
      }
      // en ambos casos se revela el valor: la v1 nunca deja el "…%" colgado.
      setcargandopolitica(false)

      // ── carousel_slides → fondo del hero (sin slides, queda el estatico)
      if (rcarrusel.status === 'fulfilled' && !rcarrusel.value.error) {
        setslides(rcarrusel.value.data || [])
      } else {
        console.warn('Carrusel del hero no disponible; se conserva el fondo estático.')
        setslides([])
      }
    }

    cargar()
    return () => { vivo = false }
  }, [])

  // texto de plazo para liquidar — espejo de _txtLiquidar() de la v1.
  const txtliquidar =
    politica.dias_limite_liquidar === 1
      ? '1 día antes del juego'
      : politica.dias_limite_liquidar + ' días antes del juego'

  const valor = {
    banner,
    hero,
    stats,
    politica,
    cargandopolitica,
    slides,
    promostrip,
    cargandopromostrip,
    txtliquidar,
  }

  return <landingcontext.Provider value={valor}>{children}</landingcontext.Provider>
}

export default landingconfigprovider
