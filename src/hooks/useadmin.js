// ═══════════════════════════════════════════════════════════════════
// useadmin.js — acceso a la sesion y los permisos del panel.
// ═══════════════════════════════════════════════════════════════════

import { useContext } from 'react'
import { admincontext } from '../context/admincontext'

export function useadmin() {
  const valor = useContext(admincontext)
  if (!valor) throw new Error('useadmin debe usarse dentro de <adminprovider>')
  return valor
}

export default useadmin
