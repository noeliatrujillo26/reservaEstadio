// ═══════════════════════════════════════════════════════════════════
// bloqueobiometrico.jsx — candado y oferta de Face ID / Touch ID para
// /reserva-express (02 oct 2026). Ver la nota de seguridad al inicio de
// src/lib/biometria.js: esto es un candado LOCAL sobre la sesión ya
// persistida de Supabase, no un segundo factor verificado por servidor.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import {
  biometria_disponible, biometria_habilitada, desbloquear_biometria,
  habilitar_biometria,
} from '../../lib/biometria'
import { IconBiometria } from './iconos'

const MENSAJES_FALLO = {
  no_soportado: 'Este dispositivo o navegador no ofrece Face ID / Touch ID.',
  cancelado: 'Cancelaste la verificación — intenta de nuevo o usa tu contraseña.',
  no_habilitada: 'Face ID / Touch ID no está habilitado en este dispositivo.',
  sin_almacenamiento: 'No se pudo guardar la credencial en este dispositivo.',
  error: 'No se pudo verificar. Intenta de nuevo o usa tu contraseña.',
}

// Pantalla COMPLETA que remplaza las pestañas mientras la sesión (ya
// persistida y válida) está bloqueada a la espera de Face ID/Touch ID.
// `oncerrarsesion` es el fallback "login estándar con contraseña" del
// requerimiento: cierra la sesión real y regresa a la pantalla de acceso
// de siempre — no hay un estado intermedio ambiguo.
export function BloqueoBiometrico({ usuario, ondesbloquear, oncerrarsesion }) {
  const [verificando, setverificando] = useState(false)
  const [motivo, setmotivo] = useState(null)

  async function intentar() {
    setverificando(true)
    setmotivo(null)
    const r = await desbloquear_biometria(usuario.email)
    setverificando(false)
    if (r.ok) { ondesbloquear(); return }
    setmotivo(r.motivo || 'error')
  }

  // El gesto se dispara solo al entrar — como cualquier pantalla de
  // bloqueo con Face ID — pero el botón sigue ahí para reintentar si el
  // navegador no deja autoexhibir el diálogo (algunos exigen un clic).
  useEffect(() => { intentar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="re-acceso">
      <div className="re-acceso-card">
        <a href="/" className="re-logo-link" aria-label="Ir a la página principal" title="Ir a la página principal">
          <img src={import.meta.env.BASE_URL + 'logo-naranjeros.png'} alt="Naranjeros" className="re-logo" />
        </a>
        <div className="re-biometria-icono"><IconBiometria /></div>
        <h1>Reserva Express bloqueada</h1>
        <p className="re-sub">Hola {usuario.nombre || usuario.email} — confirma con Face ID / Touch ID para continuar.</p>

        {motivo && <div className="re-error">{MENSAJES_FALLO[motivo] || MENSAJES_FALLO.error}</div>}

        <button className="re-btn re-btn-primario" onClick={intentar} disabled={verificando}>
          <IconBiometria /> {verificando ? 'Verificando…' : 'Desbloquear con Face ID / Touch ID'}
        </button>
        <button
          className="re-btn re-btn-secundario" style={{ marginTop: '10px' }}
          onClick={oncerrarsesion} disabled={verificando}
        >
          Usar contraseña en su lugar
        </button>
      </div>
    </div>
  )
}

// Banner discreto, NO modal: aparece debajo de la topbar mientras el
// dispositivo soporte Face ID/Touch ID y la cuenta todavía no lo haya
// habilitado aquí. "Ahora no" lo apaga por esta sesión del navegador
// (sessionStorage, no localStorage — vuelve a ofrecerse la próxima vez
// que se abra la app, a propósito: no es una decisión permanente).
export function OfertaBiometria({ usuario }) {
  const [disponible, setdisponible] = useState(false)
  const [habilitada, sethabilitada] = useState(true) // optimista: no parpadea el banner si ya estaba habilitada
  const [oculto, setoculto] = useState(false)
  const [activando, setactivando] = useState(false)
  const [aviso, setaviso] = useState(null)

  useEffect(() => {
    let vivo = true
    sethabilitada(biometria_habilitada(usuario.email))
    biometria_disponible().then((d) => { if (vivo) setdisponible(d) })
    try { setoculto(sessionStorage.getItem('re_biometria_oferta_oculta') === '1') } catch (e) {}
    return () => { vivo = false }
  }, [usuario.email])

  if (!disponible || habilitada || oculto) return null

  async function activar() {
    setactivando(true)
    setaviso(null)
    const r = await habilitar_biometria(usuario)
    setactivando(false)
    if (r.ok) { sethabilitada(true); return }
    if (r.motivo !== 'cancelado') setaviso(MENSAJES_FALLO[r.motivo] || MENSAJES_FALLO.error)
  }

  function descartar() {
    try { sessionStorage.setItem('re_biometria_oferta_oculta', '1') } catch (e) {}
    setoculto(true)
  }

  return (
    <div className="re-biometria-oferta">
      <IconBiometria />
      <div className="re-biometria-oferta-texto">
        <strong>Habilitar Face ID / Touch ID en este dispositivo</strong>
        <div>Desbloquea Reserva Express sin volver a teclear tu contraseña cada vez.</div>
        {aviso && <div className="re-biometria-oferta-aviso">{aviso}</div>}
      </div>
      <div className="re-biometria-oferta-botones">
        <button type="button" onClick={activar} disabled={activando}>
          {activando ? 'Activando…' : 'Activar'}
        </button>
        <button type="button" onClick={descartar} disabled={activando}>Ahora no</button>
      </div>
    </div>
  )
}
