// ═══════════════════════════════════════════════════════════════════
// usebannerpromo.js — datos del banner de promocion de la landing.
//
// espejo de v1: panel-inicio.html → loadLandingConfig() + _cargarBannerPromo()
// y del handler api/sitio.js → bannerPromo().
//
// conserva el patron de DOS FASES de la v1:
//   1. pintado instantaneo desde localStorage 'nrj_landing' (cache del admin)
//   2. sobrescritura con la fuente de verdad
//
// diferencia de infraestructura (no de comportamiento): la v1 pedia
// /api/sitio?r=banner-promo (serverless con service role). la v2 lee la tabla
// `configuracion_landing` directo con la llave anon — la migracion
// migracion-banner-promo.sql ya expone un policy de select publico para anon.
//
// fail-open identico a la v1: cualquier error deja el banner oculto, nunca
// rompe la pagina.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { sb } from '../supabaseclient'

const color_por_defecto = '#e63946'

const banner_vacio = {
  activo: false,
  texto: '',
  color: color_por_defecto,
  enlace: '',
  cotizamsg: '',
}

// fase 1 — cache local del admin. mismas llaves que escribe el panel v1.
function leer_cache_landing() {
  try {
    const cfg = JSON.parse(localStorage.getItem('nrj_landing') || 'null')
    if (!cfg) return null
    return {
      activo: !!cfg.promoActiva,
      texto: cfg.promoTexto || '',
      color: cfg.promoColor || color_por_defecto,
      enlace: cfg.promoEnlace || '',
      cotizamsg: '',
    }
  } catch (e) {
    return null
  }
}

export function usebannerpromo() {
  const [banner, setbanner] = useState(() => leer_cache_landing() || banner_vacio)

  useEffect(() => {
    let vivo = true

    async function cargar() {
      try {
        const { data, error } = await sb
          .from('configuracion_landing')
          .select('*')
          .eq('id', 1)
          .maybeSingle()
        if (error) throw error
        if (!vivo) return
        // fase 2 — misma normalizacion campo por campo que api/sitio.js
        setbanner({
          activo: !!(data && data.banner_activo),
          texto: (data && data.banner_texto) || '',
          color: (data && data.banner_color) || color_por_defecto,
          enlace: (data && data.banner_enlace) || '',
          cotizamsg: (data && data.whatsapp_quote_message) || '',
        })
      } catch (e) {
        console.error('banner-promo error:', e)
        if (vivo) setbanner(banner_vacio) // fail-open
      }
    }

    cargar()
    return () => { vivo = false }
  }, [])

  return banner
}

export default usebannerpromo
