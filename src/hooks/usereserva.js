// ═══════════════════════════════════════════════════════════════════
// usereserva.js — acceso al estado compartido del flujo de reserva
// (juegos, juego activo, filtro de capacidad y disponibilidad).
// ═══════════════════════════════════════════════════════════════════

import { useContext } from 'react'
import { reservacontext } from '../context/reservacontext'

export function usereserva() {
  const valor = useContext(reservacontext)
  if (!valor) throw new Error('usereserva debe usarse dentro de <reservaprovider>')
  return valor
}

export default usereserva
