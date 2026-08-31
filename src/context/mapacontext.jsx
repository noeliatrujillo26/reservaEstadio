// ═══════════════════════════════════════════════════════════════════
// mapacontext.jsx — estado del mapa del estadio.
// espejo de v1: loadMapFromStorage(), _aplicarSeccionesMapa(),
// _cargarEstadosZona(), _aplicarDisponibilidadZonas() y filtrarZonasPorCap()
// de panel-inicio.html.
//
// las secciones vienen de mapa_secciones por /api/sitio?r=mapa (service_role:
// la llave anon no puede leer esa tabla). se conserva el patron de dos fases:
// primero el cache local, luego la fuente de verdad.
// ═══════════════════════════════════════════════════════════════════

import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import usereserva from '../hooks/usereserva'
import { zonas_fallback, zona_posiciones_fallback } from '../lib/zonasfallback'

export const mapacontext = createContext(null)

// imagen del mapa. un solo sitio donde cambiarla, igual que MAPA_ESTADIO_SRC
// de la v1: agosto 2026 se paso de mapa-estadio.png a NuevoMapa.png.
export const mapa_estadio_src = '/NuevoMapa.png'

// espejo de _aplicarSeccionesMapa(): convierte las secciones de la base al
// objeto `zonas` que consumen el overlay y el panel de detalle.
function armar_zonas(sections) {
  if (!Array.isArray(sections) || sections.length === 0) return null

  let mins_guardados = {}
  try {
    mins_guardados = JSON.parse(localStorage.getItem('nrj_precios_min') || '{}')
  } catch (e) {}

  const zonas = {}
  const posiciones = {}

  sections.forEach((s) => {
    const id = s.id || 'sec-' + s.num
    const min_key = (s.name || '').toUpperCase().trim()
    zonas[id] = {
      _id: id, // id unico del pin: las busquedas de precio/minimo lo usan primero
      nombre: s.name || 'Sección ' + s.num,
      seccion: s.name || 'Sección ' + s.num,
      cap: s.cap || 50,
      min: mins_guardados['ID:' + id] || mins_guardados[min_key] || s.min || 1,
      // minimo JUE-SAB (min_personas2). sin override en localStorage: ese
      // respaldo es legado y solo existe para el minimo DOM-MIE.
      min2: s.min2 != null ? Number(s.min2) : null,
      precioPP: s.precio || 0,
      // tarifas completas de supabase: antes solo se mapeaba `precio` y el
      // resto dependia del localStorage del admin — en el navegador de un
      // cliente esas tarifas no existian y el calculo caia a fallbacks
      // inventados (el origen del famoso $8,007).
      precio2: s.precio2 != null ? Number(s.precio2) : null,
      precioExtra: s.precioExtra != null ? Number(s.precioExtra) : null,
      precioNino: s.precioNino != null ? Number(s.precioNino) : null,
      precioExtra2: s.precioExtra2 != null ? Number(s.precioExtra2) : null,
      precioNino2: s.precioNino2 != null ? Number(s.precioNino2) : null,
      precio: s.precio ? String(s.precio) : '—',
      disponible: true,
      desc: '',
      shortDesc: s.shortDescription || '',
      descripcion: s.descripcion || '',
      _color: s.color || '#E05C1A',
      img: s.img || null,
      img2: s.img2 || null,
      _num: s.num ?? '',
      _r: s.r,
      _x: s.x,
      _y: s.y,
    }
    posiciones[id] = [s.x, s.y]
  })

  return { zonas, posiciones }
}

export function mapaprovider({ children }) {
  const { juegoactivoid, capmin } = usereserva()

  // sin secciones cargadas se usan las quemadas, igual que la v1 antes de que
  // _aplicarSeccionesMapa las reemplace.
  const [zonas, setzonas] = useState(zonas_fallback)
  const [posiciones, setposiciones] = useState(zona_posiciones_fallback)
  // true en cuanto llegan secciones reales: recien ahi se muestra la imagen y
  // se oculta el cartel "Mapa no configurado".
  const [configurado, setconfigurado] = useState(false)
  const [imagenmapa, setimagenmapa] = useState(mapa_estadio_src)
  // estados de bloqueo/reserva del juego activo (_zonaEstadosActual).
  const [estados, setestados] = useState({})
  // ocupacion de palcos compartidos que el servidor adjunta como _palcos.
  const [palcosocupacion, setpalcosocupacion] = useState({})
  const [zonaactiva, setzonaactiva] = useState(null)
  // steppers del panel de detalle (_detallePersonas / _detalleNinos de la v1).
  // viven aqui porque selectZone() los reinicia al cambiar de zona.
  const [personas, setpersonas] = useState(0)
  const [ninos, setninos] = useState(0)

  // ── carga del mapa: cache local y luego la fuente de verdad ──────
  useEffect(() => {
    let vivo = true

    async function cargar() {
      // 1) cache local: estado del editor (navegador del admin) o copia de una
      //    visita anterior. da primer pintado sin esperar la red.
      try {
        const raw_editor = localStorage.getItem('editorSecciones_v1')
        const raw_cache = localStorage.getItem('naranjeros-secciones')
        const d = raw_editor ? JSON.parse(raw_editor) : raw_cache ? JSON.parse(raw_cache) : null
        if (d) {
          const armado = armar_zonas(d.sections)
          if (armado && vivo) {
            setzonas(armado.zonas)
            setposiciones(armado.posiciones)
            setconfigurado(true)
            if (d.bg && d.bg.startsWith('data:')) setimagenmapa(d.bg)
          }
        }
      } catch (e) {}

      // 2) fuente de verdad: supabase via /api/sitio?r=mapa.
      try {
        // cache-bust total (v=timestamp + no-store): ni el cdn de vercel ni el
        // navegador pueden servir una copia vieja — una imagen recien subida
        // por el admin aparece al primer refresh de cualquier visitante.
        const resp = await fetch('/api/sitio?r=mapa&v=' + Date.now(), { cache: 'no-store' })
        const data = await resp.json()
        if (!vivo) return
        if (resp.ok && Array.isArray(data.secciones) && data.secciones.length) {
          const armado = armar_zonas(data.secciones)
          if (armado) {
            setzonas(armado.zonas)
            setposiciones(armado.posiciones)
            setconfigurado(true)
          }
          // Imagenes de zonas: la fuente de verdad viaja en ESTA respuesta
          // (mapa_secciones.img/img2). Se exponen en window (ganan sobre el
          // localStorage, igual que en la v1) y se siembran al cache local
          // para el primer pintado de la proxima visita.
          try {
            const imgs_srv = {}
            const imgs2_srv = {}
            data.secciones.forEach((s2) => {
              const k = String(s2.name || '').toUpperCase().trim()
              if (!k) return
              // antes las dos fotos se colapsaban en una (`img || img2`) y la
              // segunda se perdia antes de llegar al navegador: la galeria
              // necesita las DOS por separado.
              if (s2.img || s2.img2) imgs_srv[k] = s2.img || s2.img2
              if (s2.img && s2.img2) imgs2_srv[k] = s2.img2
            })
            window._imgsZonasServidor = imgs_srv
            window._imgs2ZonasServidor = imgs2_srv
            if (Object.keys(imgs_srv).length) {
              const loc_imgs = JSON.parse(localStorage.getItem('nrj_imagenes_precio') || '{}')
              localStorage.setItem(
                'nrj_imagenes_precio',
                JSON.stringify(Object.assign(loc_imgs, imgs_srv))
              )
            }
          } catch (e_imgs) {
            console.warn('Imágenes de zonas no disponibles en la respuesta del mapa:', e_imgs)
          }

          // se siembra el cache local para el primer pintado de la proxima visita.
          try {
            const max_num = data.secciones.reduce(
              (m, s) => Math.max(m, parseInt(s.num, 10) || 0),
              0
            )
            localStorage.setItem(
              'naranjeros-secciones',
              JSON.stringify({ sections: data.secciones, nextNum: max_num + 1 })
            )
          } catch (e) {}
        }
      } catch (e) {
        console.warn('No se pudo cargar el mapa desde la base; se usa el caché local si existe.', e)
      }
    }

    cargar()
    return () => { vivo = false }
  }, [])

  // ── estados de zona del juego activo ────────────────────────────
  // espejo de _cargarEstadosZona(): sin juego se limpian; con juego se piden
  // y se descarta la respuesta si el usuario ya cambio de juego.
  useEffect(() => {
    let vigente = true

    if (!juegoactivoid) {
      setestados({})
      setpalcosocupacion({})
      return
    }

    async function cargar_estados() {
      try {
        const resp = await fetch(
          '/api/sitio?r=zona-estados&juegoId=' + encodeURIComponent(juegoactivoid)
        )
        const datos = await resp.json()
        if (!vigente) return // el usuario ya cambio de juego; descartar
        // el endpoint puede adjuntar `_palcos` con la ocupacion de los palcos
        // compartidos. se separa antes de guardar: si se colara como una zona
        // mas, el calculo de disponibilidad la trataria como tal.
        const palcos = (datos && datos._palcos) || {}
        const limpios = { ...(datos || {}) }
        delete limpios._palcos
        setpalcosocupacion(palcos)
        setestados(limpios)
      } catch (e) {
        console.warn('No se pudieron cargar los estados de zona para este juego.', e)
      }
    }

    cargar_estados()
    return () => { vigente = false }
  }, [juegoactivoid])

  // al cambiar de juego se deselecciona la zona, igual que _selJuegoEnMapa().
  useEffect(() => { setzonaactiva(null) }, [juegoactivoid])

  // ── disponibilidad por zona ─────────────────────────────────────
  // espejo de _aplicarDisponibilidadZonas(): bloqueada o reservada = no
  // disponible. se calcula en memoria en vez de mutar el objeto zonas.
  const zonascondisponibilidad = useMemo(() => {
    const out = {}
    Object.keys(zonas).forEach((id) => {
      const est = estados[id]
      out[id] = { ...zonas[id], disponible: est !== 'bloqueada' && est !== 'reservada' }
    })
    return out
  }, [zonas, estados])

  // ── filtro de capacidad ─────────────────────────────────────────
  // espejo de filtrarZonasPorCap(): evalua la CAPACIDAD MAXIMA de la zona
  // (z.cap, la misma que el detalle muestra como "Cap. máx."), NO el minimo de
  // personas incluidas: "20+" = zonas donde caben 20 personas o mas.
  const visible_por_cap = useCallback(
    (z) => {
      // z.cap puede venir como numero (mapa de supabase) o como texto ("50
      // personas", zonas viejas): String() antes de limpiar digitos — un
      // .replace directo sobre un numero tronaba y dejaba el filtro a medias.
      const cap_max = parseInt(String(z.cap || '0').replace(/\D/g, '')) || 0
      return !capmin || cap_max >= capmin
    },
    [capmin]
  )

  // texto de "N de M zonas disponibles · máx. X personas" del panel del
  // calendario. mismo formato exacto que la v1.
  const zonasdisp = useMemo(() => {
    const ids = Object.keys(posiciones).filter((id) => zonascondisponibilidad[id])
    if (!ids.length) return null
    let total = 0
    let mostradas = 0
    ids.forEach((id) => {
      const z = zonascondisponibilidad[id]
      total++
      if (visible_por_cap(z) && z.disponible) mostradas++
    })
    return (
      mostradas + ' de ' + total + ' zonas disponibles' +
      (capmin ? ' · máx. ' + capmin + ' personas' : '')
    )
  }, [posiciones, zonascondisponibilidad, visible_por_cap, capmin])

  const valor = {
    zonas: zonascondisponibilidad,
    posiciones,
    configurado,
    imagenmapa,
    estados,
    palcosocupacion,
    zonaactiva,
    setzonaactiva,
    personas,
    setpersonas,
    ninos,
    setninos,
    visible_por_cap,
    zonasdisp,
  }

  return <mapacontext.Provider value={valor}>{children}</mapacontext.Provider>
}

export default mapaprovider
