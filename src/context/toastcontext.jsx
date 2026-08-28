// ═══════════════════════════════════════════════════════════════════
// toastcontext.jsx — avisos flotantes.
// espejo 1:1 de v1: mostrarToast() de panel-inicio.html, que escribia en
// <div class="toast" id="toast"> y quitaba la clase .show a los 3 segundos.
// ═══════════════════════════════════════════════════════════════════

import { createContext, useCallback, useContext, useRef, useState } from 'react'

const toastcontext = createContext(null)

export function toastprovider({ children }) {
  const [mensaje, setmensaje] = useState('')
  const [visible, setvisible] = useState(false)
  const temporizador = useRef(null)

  const mostrartoast = useCallback((msg) => {
    setmensaje(msg)
    setvisible(true)
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setvisible(false), 3000)
  }, [])

  return (
    <toastcontext.Provider value={{ mensaje, visible, mostrartoast }}>
      {children}
    </toastcontext.Provider>
  )
}

export function usetoast() {
  const valor = useContext(toastcontext)
  if (!valor) throw new Error('usetoast debe usarse dentro de <toastprovider>')
  return valor
}

export default toastprovider
