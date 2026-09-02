// ═══════════════════════════════════════════════════════════════════
// confirmarseguro.jsx — confirmacion de segundo factor para acciones graves.
// espejo de v1: _confirmarEliminacionReservaSegura() (js/modules/utils.js).
//
// Pide MOTIVO (cuando se exige) y la CONTRASEÑA del usuario con sesion, que se
// valida re-firmando contra Supabase Auth — misma cuenta, la sesion no cambia.
// Devuelve { motivo } al confirmar, o null al cancelar.
//
// DESVIACION DELIBERADA, Y ES DE SEGURIDAD.
// La v1 tiene DOS puertas distintas para esto:
//   · borrar una reserva  → contraseña real del usuario (lo correcto)
//   · bloquear una sección → pedirClaveGerente(), que compara contra '1234'
//     escrito en el codigo (js/20-editor-mapa.js:766)
// Esa segunda no protege nada: la cadena viaja en el bundle y cualquiera que
// abra las herramientas del navegador la lee. Migrarla tal cual seria publicar
// una contraseña maestra. Las dos usan aqui la MISMA puerta: la contraseña
// real de quien tiene la sesion abierta.
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { sb } from '../../supabaseclient'
import useadmin from '../../hooks/useadmin'

export function useconfirmarseguro() {
  const [estado, setestado] = useState(null)
  const resolver = useRef(null)

  // opciones: { titulo, descripcion, textoconfirmar, pedirmotivo }
  const confirmarseguro = useCallback((opciones) => {
    return new Promise((resolve) => {
      resolver.current = resolve
      setestado({
        titulo: '🔒 Confirmar acción',
        textoconfirmar: 'Confirmar',
        pedirmotivo: true,
        ...(opciones || {}),
      })
    })
  }, [])

  const cerrar = useCallback((res) => {
    setestado(null)
    const r = resolver.current
    resolver.current = null
    if (r) r(res)
  }, [])

  const dialogo = estado ? <ConfirmarSeguro estado={estado} oncerrar={cerrar} /> : null
  return { confirmarseguro, dialogo }
}

function confirmar_seguro({ estado, oncerrar }) {
  const { usuario } = useadmin()
  const [motivo, setmotivo] = useState('')
  const [pass, setpass] = useState('')
  const [error, seterror] = useState('')
  const [verificando, setverificando] = useState(false)
  const refmotivo = useRef(null)
  const refpass = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => {
      const el = estado.pedirmotivo ? refmotivo.current : refpass.current
      if (el) el.focus()
    }, 50)
    return () => clearTimeout(t)
  }, [estado.pedirmotivo])

  useEffect(() => {
    const alteclado = (e) => { if (e.key === 'Escape' && !verificando) oncerrar(null) }
    document.addEventListener('keydown', alteclado)
    return () => document.removeEventListener('keydown', alteclado)
  }, [oncerrar, verificando])

  const listo = (!estado.pedirmotivo || motivo.trim() !== '') && pass !== ''

  async function confirmar() {
    if (!listo || verificando) return
    seterror('')
    setverificando(true)
    try {
      const email = usuario && usuario.email ? usuario.email : ''
      if (!email) throw new Error('sin-sesion')
      // Re-firma con la MISMA cuenta: verifica la contraseña sin cambiar de
      // sesion ni de permisos.
      const r = await sb.auth.signInWithPassword({ email, password: pass })
      if (r.error) throw r.error
      oncerrar({ motivo: motivo.trim() })
    } catch (e) {
      seterror(
        e && e.message === 'sin-sesion'
          ? 'No hay sesión activa. Vuelve a entrar al panel.'
          : 'Contraseña incorrecta'
      )
      setpass('')
      if (refpass.current) refpass.current.focus()
    } finally {
      setverificando(false)
    }
  }

  return (
    <div
      className="modal-overlay open"
      style={{ zIndex: 10060, padding: '16px' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !verificando) oncerrar(null) }}
    >
      <div className="modal" style={{ maxWidth: '460px', width: '100%', padding: '22px 24px' }}>
        <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '6px' }}>{estado.titulo}</div>
        {estado.descripcion && (
          <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text-2)' }}>
            {estado.descripcion}
          </div>
        )}

        {estado.pedirmotivo && (
          <>
            <label className="form-label" style={{ display: 'block', margin: '14px 0 4px' }}>
              {estado.etiquetamotivo || '¿Por qué se elimina? *'}
            </label>
            <textarea
              ref={refmotivo} className="input" rows={2}
              style={{ width: '100%', resize: 'vertical' }}
              placeholder="Motivo / comentario (obligatorio)"
              value={motivo} onChange={(e) => setmotivo(e.target.value)}
            />
          </>
        )}

        <label className="form-label" style={{ display: 'block', margin: '14px 0 4px' }}>
          Tu contraseña *
        </label>
        <input
          ref={refpass} className="input" type="password" autoComplete="current-password"
          style={{ width: '100%' }} placeholder="Contraseña de tu cuenta"
          value={pass} onChange={(e) => setpass(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && listo) confirmar() }}
        />
        <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>
          Se verifica contra tu propia cuenta ({usuario ? usuario.email : '—'}).
        </div>

        {error && (
          <div style={{ fontSize: '12px', color: 'var(--rojo)', marginTop: '8px', fontWeight: 600 }}>
            ❌ {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '18px' }}>
          <button type="button" className="btn btn-sm" onClick={() => oncerrar(null)} disabled={verificando}>
            Cancelar
          </button>
          <button
            type="button" className="btn btn-danger btn-sm"
            onClick={confirmar} disabled={!listo || verificando}
            style={{ opacity: listo && !verificando ? 1 : 0.55, cursor: listo && !verificando ? 'pointer' : 'not-allowed' }}
          >
            {verificando ? '⏳ Verificando…' : estado.textoconfirmar}
          </button>
        </div>
      </div>
    </div>
  )
}

// se exporta para que el banco de pruebas pueda montarlo: el dialogo solo
// aparece a traves del hook, y sin esto su render nunca se probaria.
export const ConfirmarSeguro = confirmar_seguro

export default useconfirmarseguro
