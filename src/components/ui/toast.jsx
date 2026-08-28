// ═══════════════════════════════════════════════════════════════════
// toast.jsx — <div class="toast" id="toast"> de la v1 (linea 970).
// el css original ya define .toast y .toast.show; aqui solo se alterna la clase.
// ═══════════════════════════════════════════════════════════════════

import { usetoast } from '../../context/toastcontext'

export default function toast() {
  const { mensaje, visible } = usetoast()
  return (
    <div className={'toast' + (visible ? ' show' : '')} id="toast">
      {mensaje}
    </div>
  )
}
