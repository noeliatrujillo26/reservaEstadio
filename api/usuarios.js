const { getSupabaseAdmin } = require('./_lib/supabaseAdmin');

// Gestión de usuarios del panel — SOLO acciones que requieren la service key
// (función 8 de 12 del plan Hobby).
//
// POST /api/usuarios  { action: 'cambiar-password', authId?, email, newPassword }
//   → { success: true }  |  { error: 'mensaje explícito' }
//
// POST /api/usuarios  { action: 'crear', email, password, nombre, rol }
//   → { success: true, authId }  |  { error: 'mensaje explícito' }
//
//   El panel creaba la cuenta con sb.auth.signUp() DESDE EL NAVEGADOR, y eso
//   depende del ajuste "Allow new users to sign up" del proyecto. Ese ajuste
//   está apagado —debe estarlo: la anon key es pública, y con él encendido
//   cualquiera podría darse de alta— así que el alta fallaba con
//   "Signups not allowed for this instance". admin.createUser usa la service
//   key y no está sujeto a ese candado, que es justo para lo que existe.
//
// SEGURIDAD: la service key puede cambiar la contraseña de CUALQUIER cuenta,
// así que el endpoint exige el token de sesión del panel (Authorization:
// Bearer <access_token>) y verifica contra la tabla usuarios que quien llama
// sea un Administrador ACTIVO. Sin eso responde 401/403 y no toca nada.

async function _adminDesdeToken(sb, req) {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return { error: 'Sesión requerida.', status: 401 };
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data || !data.user) return { error: 'Sesión inválida o expirada. Vuelve a iniciar sesión.', status: 401 };
  const email = String(data.user.email || '').trim().toLowerCase();
  const { data: perfil, error: ePerfil } = await sb.from('usuarios')
    .select('rol, estado').eq('email', email).maybeSingle();
  if (ePerfil) return { error: 'No se pudo verificar el perfil del solicitante.', status: 500 };
  if (!perfil || perfil.rol !== 'Administrador' || perfil.estado !== 'Activo') {
    return { error: 'Solo un Administrador activo puede gestionar usuarios.', status: 403 };
  }
  return { email };
}

// Alta de la cuenta de acceso. Solo la cuenta de Auth: el PERFIL (tabla
// usuarios, con permisos y estado) lo sigue escribiendo el panel, que es quien
// tiene ese formulario. Aquí solo vive lo que exige la service key.
async function _crearUsuario(sb, body, res) {
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const nombre = String(body.nombre || '').trim();
  const rol = String(body.rol || '').trim();

  if (!email || !password) { res.status(400).json({ error: 'Faltan el correo o la contraseña.' }); return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { res.status(400).json({ error: 'El correo no es válido.' }); return; }
  // La MISMA regla del panel: 8+ caracteres con letras y números.
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres, incluir números y letras.' });
    return;
  }

  // email_confirm: la cuenta nace utilizable. El admin acaba de teclear la
  // contraseña que le va a dar al usuario en persona; mandarlo a confirmar un
  // correo antes de poder entrar solo añade un paso que se atasca (y depende
  // de que la URL de retorno esté en la lista de Redirect URLs).
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre: nombre, rol: rol },
  });

  if (error) {
    const msg = String(error.message || '');
    if (/already been registered|already exists|duplicate/i.test(msg)) {
      res.status(409).json({ error: 'Ese correo ya tiene una cuenta en el sistema.' }); return;
    }
    if (/password/i.test(msg)) {
      res.status(400).json({ error: 'La contraseña no cumple la política de seguridad: ' + msg }); return;
    }
    console.error('usuarios/crear:', error);
    res.status(500).json({ error: 'No se pudo crear la cuenta: ' + msg });
    return;
  }

  res.status(200).json({ success: true, authId: data && data.user ? data.user.id : null });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido' }); return; }
  try {
    const body = req.body || {};
    const accion = String(body.action || '');
    if (accion !== 'cambiar-password' && accion !== 'crear') {
      res.status(400).json({ error: 'Acción no soportada.' }); return;
    }

    const sb = getSupabaseAdmin();
    const quien = await _adminDesdeToken(sb, req);
    if (quien.error) { res.status(quien.status).json({ error: quien.error }); return; }

    if (accion === 'crear') { await _crearUsuario(sb, body, res); return; }

    const email = String(body.email || '').trim().toLowerCase();
    const newPassword = String(body.newPassword || '');
    if (!email || !newPassword) { res.status(400).json({ error: 'Faltan el correo o la contraseña nueva.' }); return; }
    // La MISMA regla del panel: 8+ caracteres con letras y números.
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres, incluir números y letras.' });
      return;
    }

    // Resolver la cuenta Auth del usuario objetivo: auth_id directo (perfiles
    // nuevos lo guardan) o búsqueda por correo en Auth (perfiles antiguos).
    let authId = String(body.authId || '').trim() || null;
    if (!authId) {
      const { data: lista, error: eLista } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (eLista) throw eLista;
      const cuenta = ((lista && lista.users) || []).find(u => String(u.email || '').trim().toLowerCase() === email);
      if (!cuenta) { res.status(404).json({ error: 'No existe una cuenta de acceso con el correo ' + email + '.' }); return; }
      authId = cuenta.id;
    }

    const { error: eUpd } = await sb.auth.admin.updateUserById(authId, { password: newPassword });
    if (eUpd) {
      console.error('updateUserById falló:', eUpd);
      res.status(400).json({ error: eUpd.message || 'No se pudo cambiar la contraseña.' });
      return;
    }

    console.log('Contraseña actualizada por el admin ' + quien.email + ' para la cuenta ' + email + '.');
    res.status(200).json({ success: true });
  } catch (e) {
    console.error('api/usuarios:', e);
    res.status(500).json({ error: (e && e.message) || 'Error del servidor.' });
  }
};
