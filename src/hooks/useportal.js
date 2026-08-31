// ═══════════════════════════════════════════════════════════════════
// useportal.js — acceso a la sesion y los datos de "Mis reservas".
// ═══════════════════════════════════════════════════════════════════

import { useContext } from 'react'
import { portalcontext } from '../context/portalcontext'

export function useportal() {
  const valor = useContext(portalcontext)
  if (!valor) throw new Error('useportal debe usarse dentro de <portalprovider>')
  return valor
}

export default useportal
