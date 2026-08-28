// ═══════════════════════════════════════════════════════════════════
// calendariodesplegable.jsx — boton "Calendario de Juegos" y su panel.
// espejo 1:1 de v1: el bloque del html (lineas 620-678) mas toggleCalendario()
// (linea 2630) y selDia() (linea 2740).
//
// reglas conservadas:
//   · el panel nace cerrado; al abrir, el chevron gira 180° y el boton se
//     pinta de naranja (#E05C1A)
//   · el mes inicial es el del proximo juego, igual que hace cargarJuegos()
//   · al elegir un dia: se marca en el calendario, se llena el panel derecho,
//     se sincroniza la tarjeta de arriba y se avisa con un toast
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react'
import usereserva from '../../hooks/usereserva'
import { usetoast } from '../../context/toastcontext'
import app_config from '../../lib/config'
import { fecha_con_dia } from '../../lib/fechas'
import MiniCalendario from './minicalendario'
import CalJuegoPanel from './caljuegopanel'

export default function calendariodesplegable() {
  const { proximos, juegosporfecha, setcaljuegoactual, setjuegoactivofecha } = usereserva()
  const { mostrartoast } = usetoast()

  const [abierto, setabierto] = useState(false)

  // mes inicial = el del proximo juego (espejo del final de cargarJuegos()).
  const proximo = proximos[0]
  const [anio, setanio] = useState(() =>
    proximo ? parseInt(proximo.fecha.split('-')[0]) : 2026
  )
  const [mes, setmes] = useState(() =>
    proximo ? parseInt(proximo.fecha.split('-')[1]) - 1 : 9
  )

  function cambiar_mes(a, m) {
    setanio(a)
    setmes(m)
  }

  function sel_dia(fecha) {
    const j = juegosporfecha[fecha]
    if (!j) return
    setcaljuegoactual(j)
    setjuegoactivofecha(fecha)
    const label = fecha_con_dia(fecha, true)
    mostrartoast('Juego seleccionado: ' + label + ' vs ' + j.rival)
  }

  return (
    <div style={{ marginTop: '4px', marginBottom: '36px' }}>
      <button
        onClick={() => setabierto((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#fff',
          border: '1.5px solid #E8E4DC',
          borderRadius: '10px',
          padding: '13px 20px',
          fontSize: '13px',
          fontWeight: 600,
          color: abierto ? '#E05C1A' : '#5A6478',
          cursor: 'pointer',
          width: '100%',
          justifyContent: 'center',
          transition: 'border-color 0.2s,color 0.2s,box-shadow 0.2s',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="2.5" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M5 1v3M11 1v3M1 6.5h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        Calendario de Juegos — <span>{app_config.temporadalabel}</span>
        <svg
          id="cal-chevron"
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          style={{
            marginLeft: 'auto',
            transition: 'transform 0.25s',
            transform: abierto ? 'rotate(180deg)' : undefined,
          }}
        >
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div id="cal-dropdown" style={{ display: abierto ? 'block' : 'none', marginTop: '12px' }}>
        <div className="cal-layout">
          <div>
            <MiniCalendario anio={anio} mes={mes} onmes={cambiar_mes} onseldia={sel_dia} />
          </div>
          <CalJuegoPanel />
        </div>
      </div>
    </div>
  )
}
