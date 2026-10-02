// ═══════════════════════════════════════════════════════════════════
// toast.jsx — <div class="toast" id="toast"> de la v1 (linea 970).
// el css original ya define .toast y .toast.show; aqui solo se alterna la clase.
//
// Variante de color (06 oct 2026): "✅" → toast-exito (verde), "⚠️/⛔/❌/🚫"
// → toast-error — mismo prefijo de emoji que toastcontext.jsx ya usa para
// decidir cuánto dura el aviso, reutilizado aquí para el color en vez de
// inventar un segundo parámetro `tipo` en mostrartoast() que cada llamada
// existente tendría que empezar a pasar.
// ═══════════════════════════════════════════════════════════════════

import { usetoast } from '../../context/toastcontext'

export default function toast() {
  const { mensaje, visible } = usetoast()
  const t = String(mensaje || '').trim()
  const tipo = t.startsWith('✅') ? ' toast-exito'
    : (t.startsWith('⚠') || t.startsWith('⛔') || t.startsWith('❌') || t.startsWith('🚫')) ? ' toast-error'
      : ''
  return (
    <div className={'toast' + tipo + (visible ? ' show' : '')} id="toast">
      {mensaje}
    </div>
  )
}
