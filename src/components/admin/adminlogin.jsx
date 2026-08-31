// ═══════════════════════════════════════════════════════════════════
// adminlogin.jsx — pantalla de acceso al panel.
// espejo 1:1 de v1: #login-screen de index.html (lineas 1729-1757),
// iniciarSesion() y toggleVerPassword().
//
// la casilla "Soy humano" (Turnstile) de la v1 no se monta todavia: su token
// se valida con un POST a /api/checkout?action=verificar-humano, y esta fase
// es de solo lectura. La v1 ya contempla que el widget falte (no bloquea el
// acceso si el script no cargo), asi que el flujo se comporta igual.
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react'
import useadmin from '../../hooks/useadmin'

export default function adminlogin() {
  const { iniciar_sesion, error } = useadmin()
  const [email, setemail] = useState('')
  const [password, setpassword] = useState('')
  const [ver, setver] = useState(false)
  const [entrando, setentrando] = useState(false)

  async function entrar() {
    setentrando(true)
    await iniciar_sesion(email.trim(), password)
    setentrando(false)
  }

  return (
    <div id="login-screen">
      <div className="login-card">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <img
            src="/logo-naranjeros.png" alt="Naranjeros"
            style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
          />
          <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-2)' }}>
            Panel Admin
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Correo</label>
          <input
            className="input" id="login-email" type="email" autoComplete="username"
            placeholder="tu@naranjeros.mx"
            value={email} onChange={(e) => setemail(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Contraseña</label>
          {/* contenedor relativo + boton de ojo; padding-right para que el
              texto no se traslape con el icono. type="button": jamas dispara
              el login. */}
          <div style={{ position: 'relative' }}>
            <input
              className="input" id="login-password"
              type={ver ? 'text' : 'password'}
              autoComplete="current-password" placeholder="••••••••"
              style={{ paddingRight: '38px' }}
              value={password} onChange={(e) => setpassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') entrar() }}
            />
            <button
              type="button" onClick={() => setver((v) => !v)} title="Mostrar contraseña"
              style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-3)', display: 'flex' }}
            >
              <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
                <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </button>
          </div>
        </div>

        <div
          id="login-error"
          style={{ display: error ? 'block' : 'none', fontSize: '12px', color: 'var(--rojo)', background: 'var(--rojo-bg)', padding: '8px 10px', borderRadius: '6px', marginBottom: '12px' }}
        >
          {error}
        </div>

        <button
          type="button" className="btn btn-primary" style={{ width: '100%' }}
          id="login-btn" onClick={entrar} disabled={entrando}
        >
          {entrando ? 'Entrando…' : 'Iniciar sesión'}
        </button>
      </div>
    </div>
  )
}
