const { createClient } = require('@supabase/supabase-js');

// Cliente con la service_role key: ignora RLS, solo se usa desde funciones
// serverless (nunca desde el navegador). Requiere las variables de entorno
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY configuradas en Vercel.
let cliente;
function getSupabaseAdmin() {
  if (!cliente) {
    cliente = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
  }
  return cliente;
}

module.exports = { getSupabaseAdmin };
