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
import { mapa_estadio_src } from '../../context/mapacontext'

const VERDE = '#16A34A'
const GRIS = '#9AA3B4'
const NARANJA = '#E05C1A'

// dimensiones de NuevoMapa.png; se sustituyen por las reales al cargar.
const RESPALDO = { w: 1382, h: 1350 }

function Pines({ dims, pines, zonaid, onelegir, escala = 1 }) {
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
        const r = Math.max(8, (p.r / 100) * dims.w) * escala
        const sel = zonaid && String(zonaid) === String(p.id)
        const fs = Math.max(10, r * 0.85)
        return (
          <g
            key={p.id}
            className={'re-minimapa-pin' + (p.libre ? ' libre' : ' ocupada') + (sel ? ' sel' : '')}
            onClick={p.libre ? () => onelegir(p.id) : undefined}
            style={{ cursor: p.libre ? 'pointer' : 'default' }}
          >
            <title>{p.nombre + (p.libre ? '' : ' (Ocupada)')}</title>
            {sel && <circle cx={cx} cy={cy} r={r * 1.45} fill="none" stroke={NARANJA} strokeWidth={Math.max(3, r * 0.22)} />}
            <circle cx={cx} cy={cy} r={r} fill={p.libre ? VERDE : GRIS} stroke="#fff" strokeWidth={Math.max(1.5, r * 0.1)} opacity={p.libre ? 1 : 0.85} />
            {p.num ? (
              <text
                x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
                fontSize={fs} fontWeight="700" fill="#fff" style={{ pointerEvents: 'none' }}
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
          <img src={mapa_estadio_src} alt="Mapa del estadio" onLoad={al_cargar} draggable={false} />
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
              <img src={mapa_estadio_src} alt="Mapa del estadio" onLoad={al_cargar} draggable={false} />
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
