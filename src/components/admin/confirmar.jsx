// ═══════════════════════════════════════════════════════════════════
// confirmar.jsx — modal de confirmacion generico.
// espejo 1:1 de v1: _confirmarModal() (js/modules/utils.js).
//
// Devuelve true solo si el usuario confirma; false al cancelar, con Esc o
// con clic fuera. La v1 arma el HTML a mano e inyecta el mensaje con
// innerHTML; aqui el mensaje viaja como nodo de React, asi que no hace falta
// escapar nada ni existe la via de inyeccion.
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'

export function useconfirmar() {
  const [estado, setestado] = useState(null) // { mensaje, textoconfirmar }
  const resolver = useRef(null)

  const confirmar = useCallback((mensaje, textoconfirmar) => {
    return new Promise((resolve) => {
      resolver.current = resolve
      setestado({ mensaje, textoconfirmar: textoconfirmar || 'Sí, eliminar' })
    })
  }, [])

  const cerrar = useCallback((res) => {
    setestado(null)
    const r = resolver.current
    resolver.current = null
    if (r) r(res)
  }, [])

  const dialogo = estado ? <Confirmar estado={estado} oncerrar={cerrar} /> : null
  return { confirmar, dialogo }
}

function confirmar_modal({ estado, oncerrar }) {
  // Esc cierra sin confirmar, igual que la v1.
  useEffect(() => {
    const alteclado = (e) => {
      if (e.key === 'Escape') oncerrar(false)
    }
    document.addEventListener('keydown', alteclado)
    return () => document.removeEventListener('keydown', alteclado)
  }, [oncerrar])

  return (
    <div
      className="modal-overlay open"
      style={{ zIndex: 9999, padding: '16px' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) oncerrar(false)
      }}
    >
      <div className="modal" style={{ maxWidth: '440px', width: '100%', padding: '22px 24px' }}>
        <div style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text)' }}>
          {estado.mensaje}
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '18px' }}>
          <button type="button" className="btn btn-sm" onClick={() => oncerrar(false)}>
            Cancelar
          </button>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => oncerrar(true)}>
            {estado.textoconfirmar}
          </button>
        </div>
      </div>
    </div>
  )
}

// igual que ConfirmarSeguro: exportado para el banco de pruebas.
export const Confirmar = confirmar_modal

export default useconfirmar
