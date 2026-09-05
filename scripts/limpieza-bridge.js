// ═══════════════════════════════════════════════════════════════════
// limpieza-bridge.js — puente para limpieza-prospectos.mjs.
//
// Mismo mecanismo que pruebas/cascadas.js: se compila con vite --ssr para
// que import.meta.env exista (lo necesita motivo_bloqueo de escritura.js), y
// expone al script de limpieza EXACTAMENTE las mismas funciones auditadas
// que usa useprospectos.js para su propio "eliminar" — nada nuevo, nada
// escrito a mano por separado.
// ═══════════════════════════════════════════════════════════════════

export { map_prospecto } from '../src/lib/pipeline'
export {
  folios_de_prospecto, liberar_reservas_de_prospecto, msg_no_eliminable, puede_eliminarse,
} from '../src/lib/mapaocupacion'
export { cancelar_cobros_de_folios } from '../src/lib/cascadas'
export {
  actualizar_verificado, borrar_verificado, mensajes_bloqueo, motivo_bloqueo, registrar_movimiento,
} from '../src/lib/escritura'
