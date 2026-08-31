// ═══════════════════════════════════════════════════════════════════
// usecheckout.js — acceso al estado del checkout de 4 pasos.
// ═══════════════════════════════════════════════════════════════════

import { useContext } from 'react'
import { checkoutcontext } from '../context/checkoutcontext'

export function usecheckout() {
  const valor = useContext(checkoutcontext)
  if (!valor) throw new Error('usecheckout debe usarse dentro de <checkoutprovider>')
  return valor
}

export default usecheckout
