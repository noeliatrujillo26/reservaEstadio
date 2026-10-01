// ═══════════════════════════════════════════════════════════════════
// biometria-puente.js — puente SSR para pruebas/biometria.run.mjs.
// Se compila con vite --ssr porque supabaseclient.js lee
// import.meta.env.VITE_SUPABASE_URL/ANON_KEY (solo Vite las resuelve).
// ═══════════════════════════════════════════════════════════════════
export { sb } from '../src/supabaseclient'
export {
  biometria_disponible, biometria_habilitada, habilitar_biometria,
  desbloquear_biometria, deshabilitar_biometria, expirar_verificacion_biometria,
  dentro_de_periodo_gracia, GRACIA_MS,
} from '../src/lib/biometria'
