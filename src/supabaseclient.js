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

export const sb = createClient(supabase_url, supabase_anon_key)

export default sb
