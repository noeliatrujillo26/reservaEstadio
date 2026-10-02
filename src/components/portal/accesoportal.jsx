// ═══════════════════════════════════════════════════════════════════
// accesoportal.jsx — pantalla de acceso al portal.
// espejo 1:1 de v1: #access-screen del html (lineas 208-225) y entrarPortal().
//
// protege todo el portal: sin folio + correo validados contra la tabla
// `reservas` (via /api/mis-reservas) no se muestra nada.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import useportal from '../../hooks/useportal'
import { leer_autologin_de_url } from '../../lib/autologinportal'

export default function accesoportal() {
  const { entrar, error, seterror } = useportal()
  const [folio, setfolio] = useState('')
  const [email, setemail] = useState('')
  const [cargando, setcargando] = useState(false)

  async function consultar(folioArg, emailArg) {
    seterror('')
    setcargando(true)
    const r = await entrar(folioArg != null ? folioArg : folio, emailArg != null ? emailArg : email)
    setcargando(false)
    if (!r.exito) seterror(r.mensaje)
  }

  // Autologin desde el enlace del correo (04 oct 2026): "Consultar mi
  // reserva en línea" ahora manda ?folio=...&email=... (ver
  // api/_lib/reciboEmail.js) — con los dos presentes, el formulario se
  // autocompleta Y se envía solo, sin que el cliente tenga que teclear
  // nada. Solo al montar: si entrar() falla (folio/correo no coinciden,
  // ya se usaron para otra reserva, etc.), el formulario queda ahí
  // normal, ya con los campos rellenos, para que el cliente corrija y
  // reintente a mano.
  useEffect(() => {
    const { folio: folioURL, email: emailURL } = leer_autologin_de_url(window.location.search)
    if (!folioURL || !emailURL) return
    setfolio(folioURL)
    setemail(emailURL)
    consultar(folioURL, emailURL)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function al_teclear(e) {
    if (e.key === 'Enter') consultar()
  }

  return (
    <div id="access-screen">
      <div className="access-card">
        <div className="logo">
          <a href="/" title="Ir a la página principal">
            <img src="/logo-naranjeros.png" alt="Naranjeros" />
          </a>
        </div>
        <h3>Mis reservas</h3>
        <p className="msub">Ingresa el folio de tu reserva y el correo con el que la hiciste.</p>
        <div className="access-err" id="accessErr" style={{ display: error ? 'block' : 'none' }}>
          {error}
        </div>
        <div className="field">
          <label htmlFor="accFolio">Folio de reserva</label>
          <input
            id="accFolio" type="text" placeholder="Ej. 001" autoComplete="off"
            value={folio} onChange={(e) => setfolio(e.target.value)} onKeyDown={al_teclear}
          />
        </div>
        <div className="field">
          <label htmlFor="accEmail">Correo electronico</label>
          <input
            id="accEmail" type="email" placeholder="nombre@correo.com" autoComplete="email"
            value={email} onChange={(e) => setemail(e.target.value)} onKeyDown={al_teclear}
          />
        </div>
        <button
          className="pay-btn" id="accBtn" style={{ marginTop: '6px' }}
          onClick={() => consultar()} disabled={cargando}
        >
          Consultar mis reservas
        </button>
        <div className="loading-note" id="accLoading" style={{ display: cargando ? 'block' : 'none' }}>
          Buscando tus reservas…
        </div>
        <p className="access-note">
          El folio viene en tu recibo y en el correo de confirmación.
          <br />
          ¿Aún no tienes reserva? <a href="/">Reserva aquí</a>.
        </p>
      </div>
    </div>
  )
}
