// ═══════════════════════════════════════════════════════════════════
// useadmindatos.js — acceso a los datos cargados del panel.
// ═══════════════════════════════════════════════════════════════════

import { useContext } from 'react'
import { admindatoscontext } from '../context/admindatoscontext'

export function useadmindatos() {
  const valor = useContext(admindatoscontext)
  if (!valor) throw new Error('useadmindatos debe usarse dentro de <admindatosprovider>')
  return valor
}

export default useadmindatos
