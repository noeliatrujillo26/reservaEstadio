// ═══════════════════════════════════════════════════════════════════
// minimapaexpress.jsx — mini mapa interactivo del estadio para la pestaña
// "Nueva Reserva" de /reserva-express (27 sep 2026).
//
// Sin equivalente en la v1. Vive DEBAJO del selector "Zona / Asador" y es la
// misma informacion que el <select>, dibujada: cada pin de mapa_secciones
// (x/y/r en % de la imagen, igual que zonasoverlay.jsx del sitio publico)
// pintado verde si esta libre y gris si esta ocupada para el juego elegido.
// Responde al mismo filtro que el select (solo disponibles / todas): con el
// filtro puesto, las ocupadas ni se dibujan.
//
// Bidireccional: tocar un pin verde elige esa zona en el select (onelegir);
// elegir en el select resalta el pin (anillo naranja). Un pin gris no
// responde al toque — no se puede vender lo ocupado.
//
// El SVG usa el ancho/alto NATURAL de la imagen como viewBox y va con
// inset:0 sobre un frame con el mismo aspect-ratio: asi cx/cy/r salen del
// % guardado sin deformar los circulos en ningun ancho de pantalla.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'

// EL MISMO mapa ilustrado que la vista publica de zonas (panel-inicio.html
// de asadores-panel-master, MAPA_ESTADIO_SRC): mapa_estadio.webp 1737x1877.
// Los x/y/r de mapa_secciones estan medidos sobre ESE encuadre; NuevoMapa.png
// (1311x1199, encuadre viejo) dejaba los pines corridos. La copia vive en
// public/ y se sirve DENTRO de la ruta de la app (vite base
// '/reserva-express/', ver la regla de vercel.json): mismo criterio que el
// logo del topbar — un path desde la raiz solo resuelve en el alias de
// Vercel y en reservaestadio.com (proxied por /reserva-express/*) da 404.
const MAPA_SRC = import.meta.env.BASE_URL + 'mapa_estadio.webp?v=1737x1877'

const VERDE = '#16A34A'
const GRIS = '#9AA3B4'
const NARANJA = '#E05C1A'

// dimensiones reales de public/mapa_estadio.webp (1737x1877); solo sirven
// para que el frame tenga la proporcion correcta ANTES de que cargue la
// imagen — al cargar se leen las naturales, por si el archivo cambia.
const RESPALDO = { w: 1737, h: 1877 }

// mapa_secciones.r es el DIAMETRO del pin en % del ancho de la imagen — asi
// lo pinta zonasoverlay.jsx del sitio publico (width = r% del ancho). Tomarlo
// como radio duplicaba cada bolita y las encimaba. El texto va al 42% del
// diametro como en el publico, con un piso para que en un celular (~360px)
// el numero siga leyendose, y un tope para que nunca se salga del circulo.
function Pines({ dims, pines, zonaid, onelegir }) {
  return (
    <svg
      className="re-minimapa-svg"
      viewBox={'0 0 ' + dims.w + ' ' + dims.h}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="false"
      role="img"
    >
      {pines.map((p) => {
        const cx = (p.x / 100) * dims.w
        const cy = (p.y / 100) * dims.h
        const diam = Math.max(dims.w * 0.03, (p.r / 100) * dims.w)
        const r = diam / 2
        const sel = zonaid && String(zonaid) === String(p.id)
        const fsbase = Math.min(diam * 0.62, Math.max(diam * 0.42, dims.w * 0.026))
        // "IZQ"/"DER" (3 letras) no caben al mismo cuerpo que "A" o "12".
        const fs = String(p.num).length > 2 ? fsbase * 0.72 : fsbase
        const borde = Math.max(1.5, diam * 0.05)
        return (
          <g
            key={p.id}
            className={'re-minimapa-pin' + (p.libre ? ' libre' : ' ocupada') + (sel ? ' sel' : '')}
            onClick={p.libre ? () => onelegir(p.id) : undefined}
            style={{ cursor: p.libre ? 'pointer' : 'default' }}
          >
            <title>{p.nombre + (p.libre ? '' : ' (Ocupada)')}</title>
            {sel && <circle cx={cx} cy={cy} r={r + borde * 2.2} fill="none" stroke={NARANJA} strokeWidth={borde * 1.6} />}
            <circle cx={cx} cy={cy} r={r} fill={p.libre ? VERDE : GRIS} stroke="#fff" strokeWidth={borde} opacity={p.libre ? 1 : 0.8} />
            {p.num ? (
              <text
                x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
                fontSize={fs} fontWeight="800" fill="#fff" style={{ pointerEvents: 'none' }}
              >
                {p.num}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

export default function minimapaexpress({ secciones, zonas, mostrarsololibres, zonaid, onelegir }) {
  const [dims, setdims] = useState(RESPALDO)
  const [abierto, setabierto] = useState(false)

  // pines = geometria de mapa_secciones + libre/ocupada del juego elegido.
  // Sin geometria (fila sin x/y) no hay nada que dibujar para esa zona.
  const porid = {}
  ;(secciones || []).forEach((s) => { porid[String(s.id)] = s })
  const pines = (zonas || [])
    .map((z) => {
      const s = porid[String(z.area.id)]
      if (!s || s.x == null || s.y == null) return null
      return {
        id: z.area.id, nombre: z.area.nombre, num: s.num || '',
        x: Number(s.x) || 0, y: Number(s.y) || 0, r: Number(s.r) || 4.5,
        libre: z.libre,
      }
    })
    .filter(Boolean)
    .filter((p) => !mostrarsololibres || p.libre)

  function al_cargar(e) {
    const el = e.currentTarget
    if (el.naturalWidth && el.naturalHeight) setdims({ w: el.naturalWidth, h: el.naturalHeight })
  }

  useEffect(() => {
    if (!abierto) return undefined
    const alteclado = (ev) => { if (ev.key === 'Escape') setabierto(false) }
    document.addEventListener('keydown', alteclado)
    // sin scroll de fondo mientras el lightbox esta abierto.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alteclado)
      document.body.style.overflow = prev
    }
  }, [abierto])

  function elegir(id) {
    onelegir(id)
    setabierto(false)
  }

  const proporcion = dims.w + ' / ' + dims.h
  const libres = pines.filter((p) => p.libre).length

  return (
    <>
      <div className="re-minimapa">
        <div className="re-minimapa-frame" style={{ aspectRatio: proporcion }}>
          <img src={MAPA_SRC} alt="Mapa del estadio" onLoad={al_cargar} draggable={false} />
          <Pines dims={dims} pines={pines} zonaid={zonaid} onelegir={onelegir} />
        </div>
        <div className="re-minimapa-pie">
          <span className="re-minimapa-leyenda">
            <i style={{ background: VERDE }} /> Disponible
            <i style={{ background: GRIS, marginLeft: '10px' }} /> Ocupada
            {pines.length ? <span className="re-minimapa-conteo">· {libres} de {pines.length}</span> : null}
          </span>
          <button type="button" className="re-minimapa-btn" onClick={() => setabierto(true)}>
            🗺️ Ver Mapa Completo
          </button>
        </div>
      </div>

      {abierto && (
        <div className="re-lightbox" onMouseDown={(e) => { if (e.target === e.currentTarget) setabierto(false) }}>
          <div className="re-lightbox-caja">
            <div className="re-lightbox-cabecera">
              <span>Mapa del estadio</span>
              <button type="button" className="re-lightbox-cerrar" onClick={() => setabierto(false)} aria-label="Cerrar">×</button>
            </div>
            <div className="re-minimapa-frame grande" style={{ aspectRatio: proporcion }}>
              <img src={MAPA_SRC} alt="Mapa del estadio" onLoad={al_cargar} draggable={false} />
              <Pines dims={dims} pines={pines} zonaid={zonaid} onelegir={elegir} />
            </div>
            <div className="re-ayuda" style={{ padding: '0 12px 12px' }}>
              Toca una zona verde para elegirla. Las grises están ocupadas para este juego.
            </div>
          </div>
        </div>
      )}
    </>
  )
}
