// ═══════════════════════════════════════════════════════════════════
// propina-express.js (pruebas) — puente SSR para propina-express.run.mjs.
// Expone las funciones de escritura verificada: el runner comprueba que un
// cobro con `propina` no pierda sus metadatos cuando la columna aún no está
// migrada en la base (reintento quirúrgico de insertar_verificado).
// ═══════════════════════════════════════════════════════════════════

export {
  insertar_verificado, columna_faltante, es_error_columna, subset_legacy,
} from '../src/lib/escritura'
