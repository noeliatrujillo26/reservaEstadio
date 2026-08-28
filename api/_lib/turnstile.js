// Validación SERVER-SIDE de Cloudflare Turnstile (la casilla "Soy humano").
// El token que genera el widget en el navegador se confirma aquí contra
// siteverify con la llave SECRETA (CLOUDFLARE_TURNSTILE_SECRET_KEY) — la
// site key del cliente es pública por diseño; la secreta jamás sale del
// servidor.
//
// Regresa { ok, skipped, codigos }:
//  - Sin secret configurada en el entorno → { ok:true, skipped:true }: la
//    verificación se OMITE para que el sitio no se rompa antes de configurar
//    la variable en Vercel.
//  - Cloudflare inaccesible (timeout/red) → también se omite (fail-open):
//    una caída del verificador no debe frenar ventas ni accesos legítimos.
async function verificarTurnstile(token, ip) {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true, skipped: true, codigos: [] };
  if (!token) return { ok: false, skipped: false, codigos: ['missing-input-response'] };
  try {
    const body = new URLSearchParams({ secret: secret, response: String(token) });
    if (ip) body.set('remoteip', String(ip).split(',')[0].trim());
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await resp.json();
    return { ok: data.success === true, skipped: false, codigos: data['error-codes'] || [] };
  } catch (e) {
    console.error('Turnstile siteverify inaccesible (se omite la verificación):', e.message || e);
    return { ok: true, skipped: true, codigos: ['siteverify-unreachable'] };
  }
}

module.exports = { verificarTurnstile };
