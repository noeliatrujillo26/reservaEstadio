// ═══════════════════════════════════════════════════════════════════
// cobrosfiltros.jsx — barra de filtros del Registro de Cobros.
// espejo 1:1 de v1: los .ms-filtro del html y _msRenderFiltro()/filtrarCobros().
//
// cada filtro es un desplegable con casillas: OR entre las opciones marcadas
// del MISMO filtro y AND entre filtros distintos. Lista vacia = no aplica.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'

function multiselect({ etiqueta, opciones, valor, oncambio }) {
  const [abierto, setabierto] = useState(false)
  const caja = useRef(null)

  useEffect(() => {
    function fuera(e) {
      if (caja.current && !caja.current.contains(e.target)) setabierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [])

  function alternar(v) {
    oncambio(valor.includes(v) ? valor.filter((x) => x !== v) : valor.concat(v))
  }

  const activo = valor.length > 0

  return (
    <div className="ms-filtro" ref={caja} style={{ flex: '1 1 140px', minWidth: '120px' }}>
      <button
        type="button"
        className={'input ms-btn' + (activo ? ' ms-activo' : '')}
        onClick={() => setabierto((v) => !v)}
      >
        <span>{activo ? etiqueta + ' (' + valor.length + ')' : etiqueta}</span>
        <span className="ms-caret">▼</span>
      </button>
      <div className={'ms-panel' + (abierto ? ' open' : '')} style={{ position: 'absolute', top: '100%', left: 0 }}>
        <div className="ms-acciones">
          <button type="button" onClick={() => oncambio(opciones.slice())}>Todos</button>
          <button type="button" onClick={() => oncambio([])}>Ninguno</button>
        </div>
        {opciones.map((o) => (
          <label className="ms-op" key={o}>
            <input type="checkbox" checked={valor.includes(o)} onChange={() => alternar(o)} />
            {o}
          </label>
        ))}
        {!opciones.length && (
          <div style={{ padding: '6px', fontSize: '12px', color: 'var(--text-3)' }}>Sin opciones</div>
        )}
      </div>
    </div>
  )
}

const MultiSelect = multiselect

export default function cobrosfiltros({ filtros, setfiltros, opciones, mostrados, total, onlimpiar }) {
  const set = (k) => (v) => setfiltros({ ...filtros, [k]: v })

  return (
    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-wrap" style={{ flex: '1 1 200px', minWidth: '180px' }}>
          <svg className="search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="#9AA3B4" strokeWidth="1.4" />
            <path d="M10 10l2.5 2.5" stroke="#9AA3B4" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            className="input" id="cobros-search" placeholder="Buscar cliente, zona, folio..."
            value={filtros.busqueda} onChange={(e) => set('busqueda')(e.target.value)}
            style={{ paddingLeft: '32px', width: '100%' }}
          />
        </div>

        <MultiSelect etiqueta="Mes" opciones={opciones.mes} valor={filtros.mes} oncambio={set('mes')} />
        <MultiSelect etiqueta="Concepto" opciones={opciones.concepto} valor={filtros.concepto} oncambio={set('concepto')} />
        <MultiSelect etiqueta="Forma de pago" opciones={opciones.forma} valor={filtros.forma} oncambio={set('forma')} />
        <MultiSelect etiqueta="Vendedores" opciones={opciones.recibio} valor={filtros.recibio} oncambio={set('recibio')} />
        <MultiSelect etiqueta="Factura" opciones={['SI', 'NO']} valor={filtros.factura} oncambio={set('factura')} />

        <select
          className="input" id="filtro-estado-cobro" title="Estado del cobro"
          style={{ flex: '1 1 150px', minWidth: '140px' }}
          value={filtros.estado} onChange={(e) => set('estado')(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="activo">Solo activos</option>
          <option value="cancelado">Solo cancelados</option>
        </select>

        <input
          type="date" className="input" id="filtro-fecha"
          style={{ flex: '1 1 150px', minWidth: '150px' }}
          value={filtros.fecha} onChange={(e) => set('fecha')(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
        <span id="cobros-count" style={{ fontSize: '12px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
          Mostrando {mostrados} de {total} cobros
        </span>
        <button className="btn btn-ghost btn-sm" onClick={onlimpiar} style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>
          ✕ Limpiar filtros
        </button>
      </div>
    </div>
  )
}
