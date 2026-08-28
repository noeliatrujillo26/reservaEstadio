// ═══════════════════════════════════════════════════════════════════
// usemapa.js — acceso al estado del mapa del estadio.
// ═══════════════════════════════════════════════════════════════════

import { useContext } from 'react'
import { mapacontext } from '../context/mapacontext'

export function usemapa() {
  const valor = useContext(mapacontext)
  if (!valor) throw new Error('usemapa debe usarse dentro de <mapaprovider>')
  return valor
}

export default usemapa
