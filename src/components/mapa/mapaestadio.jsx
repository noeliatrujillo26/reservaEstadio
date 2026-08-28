// ═══════════════════════════════════════════════════════════════════
// mapaestadio.jsx — seccion del mapa del estadio.
// espejo 1:1 de v1: <div id="mapa-section"> de panel-inicio.html
// (lineas 683-720) mas _mostrarImagenMapa() y syncOverlay().
//
// el encabezado sigue al juego activo: "Mapa del estadio — Naranjeros vs X ·
// Jueves 15 de Octubre", igual que _selJuegoEnMapa().
//
// EN CONSTRUCCION: el panel derecho (.seccion-detalle) se monta aqui con su
// placeholder; el contenido con galeria, steppers y precios es el siguiente
// componente (zona/zonadetalle.jsx).
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import usemapa from '../../hooks/usemapa'
import usereserva from '../../hooks/usereserva'
import { fecha_con_dia } from '../../lib/fechas'
import LeyendaMapa from './leyendamapa'
import ZonasOverlay from './zonasoverlay'

export default function mapaestadio() {
  const { configurado, imagenmapa, zonaactiva } = usemapa()
  const { juegoactivofecha, juegosporfecha } = usereserva()

  const img = useRef(null)
  // ancho real de la imagen: buildOverlay() lo usa para dimensionar los pines.
  const [ancho, setancho] = useState(0)
  const [proporcion, setproporcion] = useState(null)

  // espejo de img.onload en _mostrarImagenMapa(): fija la proporcion del frame
  // para que la caja del mapa (y el overlay con inset:0) conserve la forma
  // exacta de la imagen en cualquier viewport.
  function al_cargar_imagen() {
    const el = img.current
    if (!el) return
    if (el.naturalWidth && el.naturalHeight) {
      setproporcion(el.naturalWidth + ' / ' + el.naturalHeight)
    }
    setancho(el.clientWidth || el.naturalWidth || 700)
  }

  // los pines se redimensionan con la ventana: en la v1 esto lo rehacia
  // buildOverlay() en cada repintado.
  useEffect(() => {
    function al_cambiar_tamano() {
      const el = img.current
      if (el) setancho(el.clientWidth || el.naturalWidth || 700)
    }
    window.addEventListener('resize', al_cambiar_tamano)
    return () => window.removeEventListener('resize', al_cambiar_tamano)
  }, [])

  const juego = juegoactivofecha ? juegosporfecha[juegoactivofecha] : null
  const titulo_juego = juego
    ? 'Naranjeros vs ' + juego.rival + ' · ' + fecha_con_dia(juego.fecha)
    : 'Naranjeros vs Tomateros · 28 Nov'

  return (
    <div id="mapa-section">
      <div className="mapa-header">
        <div>
          <div className="mapa-titulo">
            Mapa del estadio — <span id="mapa-juego-nombre">{titulo_juego}</span>
          </div>
          <div className="mapa-sub">
            Haz clic en cualquier zona del mapa para ver detalles y precio
          </div>
        </div>
        <LeyendaMapa />
      </div>

      <div className="mapa-body">
        {/* MAPA CON OVERLAY */}
        <div className="mapa-img-wrap" id="mapa-img-wrap">
          <div className="mapa-img-frame" style={proporcion ? { aspectRatio: proporcion } : undefined}>
            <img
              id="estadio-img"
              ref={img}
              // la v1 trae src="" en el html; aqui se omite el atributo hasta
              // que hay mapa: un src vacio hace que el navegador vuelva a
              // descargar la pagina entera.
              src={configurado ? imagenmapa : undefined}
              alt="Mapa del estadio"
              onLoad={al_cargar_imagen}
              style={{ display: configurado ? 'block' : 'none' }}
            />
            <ZonasOverlay anchoimagen={ancho} />
          </div>
          {/* mientras no lleguen secciones se conserva el cartel de la v1 */}
          <div
            id="mapa-no-config"
            style={{
              display: configurado ? 'none' : 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 24px',
              color: '#9AA3B4',
              textAlign: 'center',
              gap: '12px',
              minHeight: '280px',
            }}
          >
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
              <circle cx="28" cy="28" r="26" stroke="#E4E7EC" strokeWidth="2" />
              <path d="M20 36 Q28 18 36 36" stroke="#E4E7EC" strokeWidth="2" fill="none" strokeLinecap="round" />
              <circle cx="28" cy="21" r="4" stroke="#E4E7EC" strokeWidth="2" />
            </svg>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#5A6478' }}>
              Mapa no configurado
            </div>
            <div style={{ fontSize: '13px' }}>
              Accede al Panel Admin → <strong>Crear</strong> para subir y publicar el mapa del
              estadio.
            </div>
          </div>
        </div>

        {/* PANEL DE DETALLE */}
        <div className="seccion-detalle">
          <div
            className="detalle-placeholder"
            id="detalle-placeholder"
            style={zonaactiva ? { display: 'none' } : undefined}
          >
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <circle cx="26" cy="26" r="24" stroke="#DDD" strokeWidth="1.5" />
              <path d="M18 34 Q26 20 34 34" stroke="#DDD" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              <circle cx="26" cy="26" r="3.5" fill="#DDD" />
            </svg>
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#999' }}>Selecciona una zona</p>
            <p style={{ fontSize: '12px', color: '#BBB', lineHeight: 1.5, maxWidth: '200px' }}>
              Haz clic en cualquier botón del mapa para ver precio, capacidad y disponibilidad.
            </p>
          </div>
          {/* el contenido del detalle llega en zona/zonadetalle.jsx */}
        </div>
      </div>
    </div>
  )
}
