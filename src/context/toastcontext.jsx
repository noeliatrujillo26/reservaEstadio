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

  // mostrartoast(msg, ms?) — espejo de toast(msg, ms) de la v1.
  //
  // La duracion NO es cosmetica. Se migro sin el segundo parametro y con un
  // 3000 fijo, asi que un aviso largo como "la reserva se creó pero la sección
  // NO se marcó como reservada" duraba lo mismo que un "✅ guardado" y se
  // perdia. Aqui vuelve la regla de la v1: los avisos de ERROR duran 8 s para
  // alcanzar a leerlos y los informativos 1.8 s, con `ms` para forzar una
  // duracion concreta.
  const mostrartoast = useCallback((msg, ms) => {
    setmensaje(msg)
    setvisible(true)
    clearTimeout(temporizador.current)
    const t = String(msg || '').trim()
    const eserror = t.startsWith('⚠') || t.startsWith('⛔') || t.startsWith('❌') || t.startsWith('🚫')
    temporizador.current = setTimeout(() => setvisible(false), ms || (eserror ? 8000 : 1800))
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
