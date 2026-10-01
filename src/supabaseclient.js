// ═══════════════════════════════════════════════════════════════════
// supabaseclient.js — conexion unica a supabase para toda la spa.
// espejo de v1: js/00-conexion.js (ahi era `const sb = supabase.createClient(...)`
// via cdn global). aqui se importa como modulo: `import { sb } from '../supabaseclient'`
// las credenciales viven en .env (nunca en el repo).
// ═══════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'

const supabase_url = import.meta.env.VITE_SUPABASE_URL
const supabase_anon_key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabase_url || !supabase_anon_key) {
  throw new Error(
    'faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. copia .env.example a .env y llenalo.'
  )
}

// Sesión fija (02 oct 2026, /reserva-express): persistSession/autoRefreshToken
// YA eran el default de @supabase/supabase-js en el navegador — se dejan
// explícitos para que la intención quede escrita en el código y no dependa
// de que un default de la librería no cambie en una actualización futura.
// `storage` se resuelve en caliente (nunca `window.localStorage` a secas):
// este mismo archivo se importa también desde los puentes SSR de
// pruebas/*.jsx (renderToString en Node, sin `window`) — evaluar `window`
// ahí arriba tronaría esos bancos de pruebas antes de llegar a createClient.
const storage_navegador = typeof window !== 'undefined' ? window.localStorage : undefined

export const sb = createClient(supabase_url, supabase_anon_key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: storage_navegador,
  },
})

export default sb
