// ═══════════════════════════════════════════════════════════════════
// formularioexpress.jsx — el formulario de /reserva-express.
// Una sola pantalla, pensada para llenarse con el cliente en la línea:
// Cliente → Evento → Financiero → "Crear Reserva Momentánea".
//
// El buscador de "Cliente" es el MISMO patrón que nuevoprospecto.jsx: un
// input que filtra catalogo_clientes() con cliente_coincide() conforme se
// escribe, un desplegable con las coincidencias (nombre, correo, teléfono)
// y, al elegir una, nombre/email/teléfono se completan solos. Si lo tecleado
// no coincide con nadie, se sigue tecleando libremente y esa fila nace como
// cliente nuevo — no hace falta "elegir" nada del desplegable.
//
// NAVEGACION CON ENTER: pensada para llenarse sin soltar el teléfono ni
// tocar la pantalla. No hay <form> (nada que Enter pueda enviar), asi que
// aqui Enter solo mueve el foco al SIGUIENTE campo de la cadena (ver
// ordenrefs) — salvo en el buscador de cliente, donde con el desplegable
// abierto Enter elige el resultado resaltado (ArrowUp/ArrowDown lo mueven)
// en vez de avanzar, y de ahi salta a Teléfono. "Notas" queda FUERA de la
// cadena a propósito: es un textarea de varias líneas y ahi Enter debe
// seguir siendo un salto de línea, no un salto de campo.
//
// La zona/asador se filtra a las LIBRES para el juego elegido (estado_vivo,
// igual que reservaform.jsx/cotizform.jsx) y, al guardar, usereservaexpress
// crea la tarjeta en 'Reserva Momentánea' Y bloquea esa zona de inmediato —
// ver la cabecera de ese hook para el porqué.
//
// SIN CANDADO DE PERMISOS POR ROL: los campos se habilitan de inmediato en
// cuanto hay sesión (ReservaExpress.jsx ya exigió el login); no se repite
// aquí ninguna validación de permiso — ver la cabecera de
// usereservaexpress.js para el porqué.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import useadmin from '../../hooks/useadmin'
import usereservaexpress from '../../hooks/usereservaexpress'
import { catalogo_clientes, cliente_coincide } from '../../lib/clientes'
import { estado_vivo } from '../../lib/mapaocupacion'
import { redondear_dinero, mxn2 } from '../../lib/dinero'

const money = (n) => '$' + redondear_dinero(n || 0).toLocaleString('es-MX', mxn2)

const vacio = {
  nombre: '', tel: '', email: '',
  juegoid: '', zonaid: '', tipocomida: 'carne_asada',
  adultosextra: '', ninosextra: '', vendedora: '',
  monto: '', abonoinicial: '', notas: '',
}

function fecha_juego(j) {
  return new Date(j.fecha + 'T12:00').toLocaleDateString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export default function formularioexpress() {
  const { usuario, cerrar_sesion } = useadmin()
  const { juegos, areas, areasestados, usuarios, clientes, reservas, cargando } = useadmindatos()
  const { crear_express, guardando } = usereservaexpress()

  const [d, setd] = useState(vacio)
  const [campos, setcampos] = useState([])
  const [exito, setexito] = useState(null) // { folio, ...resumen, avisobloqueo } | null

  // buscador de cliente — mismo patron que nuevoprospecto.jsx.
  const [busqueda, setbusqueda] = useState('')
  const [abrirdrop, setabrirdrop] = useState(false)
  const [elegido, setelegido] = useState(false) // cliente tomado del catalogo
  const [resaltado, setresaltado] = useState(0) // indice activo del desplegable
  const refcliente = useRef(null)

  // cadena de "Enter avanza al siguiente campo" — Teléfono es el destino
  // tanto del buscador de cliente como del primer eslabon de la cadena.
  // "Notas" queda al final y sin manejador propio: ahi Enter sigue siendo
  // un salto de línea normal.
  const reftelefono = useRef(null)
  const refemail = useRef(null)
  const refjuego = useRef(null)
  const refzona = useRef(null)
  const refadultos = useRef(null)
  const refninos = useRef(null)
  const refvendedora = useRef(null)
  const refmonto = useRef(null)
  const refabono = useRef(null)
  const refnotas = useRef(null)
  const ordenrefs = [
    reftelefono, refemail, refjuego, refzona,
    refadultos, refninos, refvendedora, refmonto, refabono, refnotas,
  ]

  // enfoca el primer campo DESPUES de refactual que no esté deshabilitado
  // (salta "Zona" mientras siga bloqueada por no haber elegido juego).
  function enfocar_siguiente(refactual) {
    const idx = ordenrefs.indexOf(refactual)
    for (let i = idx + 1; i < ordenrefs.length; i++) {
      const el = ordenrefs[i].current
      if (el && !el.disabled) { el.focus(); return }
    }
  }

  // Enter en un campo de la cadena: nunca envia nada (no hay <form>), solo
  // avanza. Se usa en Teléfono/Email/Juego/Zona/Adultos/Niños/Vendedora/
  // Monto/Abono.
  function alenter_avanzar(refactual) {
    return (e) => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      enfocar_siguiente(refactual)
    }
  }

  const set = (k, v) => setd((x) => ({ ...x, [k]: v }))
  const err = (k) => (campos.includes(k) ? ' re-error' : '')

  const catalogoclientes = useMemo(
    () => catalogo_clientes({ clientes, reservas }),
    [clientes, reservas]
  )
  const coincidencias = useMemo(
    () => catalogoclientes.filter((c) => cliente_coincide(c, busqueda)),
    [catalogoclientes, busqueda]
  )
  const coincidenciasvisibles = coincidencias.slice(0, 60)
  const indiceactivo = Math.min(resaltado, Math.max(0, coincidenciasvisibles.length - 1))

  function elegir_cliente(c) {
    setd((x) => ({
      ...x,
      nombre: c.nombre || '',
      email: c.email === '—' ? '' : c.email || '',
      tel: c.tel === '—' ? '' : c.tel || '',
    }))
    setelegido(true)
    setabrirdrop(false)
  }

  // cerrar el desplegable al tocar/hacer clic fuera del buscador — mismo
  // patron que MenuAcciones en clientes.jsx.
  useEffect(() => {
    if (!abrirdrop) return
    const cerrar = (e) => {
      if (refcliente.current && !refcliente.current.contains(e.target)) setabrirdrop(false)
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [abrirdrop])

  const juegosordenados = useMemo(
    () => [...(juegos || [])].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))),
    [juegos]
  )

  const juego = useMemo(
    () => (juegos || []).find((j) => String(j.id) === String(d.juegoid)) || null,
    [juegos, d.juegoid]
  )

  // solo zonas LIBRES para el juego elegido — misma regla que reservaform.jsx
  // y cotizform.jsx (estado_vivo contra areasestados, no el estado estatico).
  const zonaslibres = useMemo(() => {
    if (!d.juegoid) return []
    return (areas || []).filter((a) => estado_vivo(areasestados, d.juegoid, a.id) === 'libre')
  }, [areas, areasestados, d.juegoid])

  // si cambia el juego (o la zona elegida deja de estar libre), se limpia.
  useEffect(() => {
    if (d.zonaid && !zonaslibres.some((a) => a.id === d.zonaid)) set('zonaid', '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.juegoid, zonaslibres])

  const vendedoras = useMemo(
    () => (usuarios || []).filter((u) => u.rol === 'Vendedora' && u.estado === 'Activo').map((u) => u.nombre),
    [usuarios]
  )

  const zonaelegida = zonaslibres.find((a) => a.id === d.zonaid) || null

  async function guardar() {
    setcampos([])
    const r = await crear_express({
      ...d, zona: zonaelegida ? zonaelegida.nombre : '',
    })
    if (r && r.ok) {
      setexito({
        folio: r.folio, nombre: d.nombre, zona: zonaelegida ? zonaelegida.nombre : '',
        juego, monto: d.monto, abonoinicial: d.abonoinicial, avisobloqueo: r.avisobloqueo,
      })
    } else if (r && r.campos) {
      setcampos(r.campos)
    }
  }

  function nuevaReserva() {
    setd(vacio)
    setcampos([])
    setexito(null)
    setbusqueda('')
    setabrirdrop(false)
    setelegido(false)
    setresaltado(0)
  }

  if (cargando) {
    return <div className="re-cargando">Cargando juegos y zonas…</div>
  }

  return (
    <>
      <div className="re-topbar">
        <a href="/" className="re-logo-link" aria-label="Ir a la página principal" title="Ir a la página principal">
          <img src="/logo-naranjeros.png" alt="Naranjeros" />
        </a>
        <div className="re-topbar-titulo">Reserva Express</div>
        <div className="re-topbar-usuario">
          {usuario ? usuario.nombre : '—'}
          <br />
          {usuario ? usuario.rol : ''}
        </div>
        <button className="re-salir" onClick={cerrar_sesion} title="Cerrar sesión" aria-label="Cerrar sesión">⏻</button>
      </div>

      <div className="re-form">
        <div className="re-seccion">
          <div className="re-seccion-titulo">👤 Cliente</div>
          <div className="re-campo">
            <label>Nombre completo o Empresa *</label>
            {!elegido ? (
              <div style={{ position: 'relative' }} ref={refcliente}>
                <input
                  className={'re-input' + err('nombre')}
                  placeholder="Buscar cliente por nombre, correo o teléfono…"
                  autoComplete="off" value={busqueda}
                  onChange={(e) => {
                    setbusqueda(e.target.value)
                    set('nombre', e.target.value.trim())
                    setabrirdrop(true)
                    setresaltado(0)
                  }}
                  onFocus={() => setabrirdrop(true)}
                  onBlur={() => setabrirdrop(false)}
                  onKeyDown={(e) => {
                    const haycoincidencias = abrirdrop && coincidenciasvisibles.length > 0
                    if (haycoincidencias && e.key === 'ArrowDown') {
                      e.preventDefault()
                      setresaltado((i) => Math.min(i + 1, coincidenciasvisibles.length - 1))
                      return
                    }
                    if (haycoincidencias && e.key === 'ArrowUp') {
                      e.preventDefault()
                      setresaltado((i) => Math.max(i - 1, 0))
                      return
                    }
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      // con el desplegable abierto, Enter elige el resultado
                      // resaltado en vez de solo avanzar de campo.
                      if (haycoincidencias) elegir_cliente(coincidenciasvisibles[indiceactivo])
                      else setabrirdrop(false)
                      if (reftelefono.current) reftelefono.current.focus()
                      return
                    }
                    if (e.key === 'Escape') { setabrirdrop(false); e.target.blur() }
                  }}
                />
                {abrirdrop && coincidenciasvisibles.length > 0 && (
                  <div className="re-dropdown">
                    {coincidenciasvisibles.map((c, i) => (
                      <div
                        key={(c.id != null ? c.id : 'r') + '-' + i}
                        className={'re-dropdown-item' + (i === indiceactivo ? ' resaltado' : '')}
                        onMouseEnter={() => setresaltado(i)}
                        onMouseDown={() => elegir_cliente(c)}
                      >
                        <div className="re-dropdown-nombre">{c.nombre}</div>
                        <div className="re-dropdown-sub">
                          {(c.email || 'sin correo') + (c.tel ? ' · ' + c.tel : '')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="re-cliente-elegido">
                <div className="re-cliente-elegido-nombre">{d.nombre}</div>
                <button
                  type="button"
                  onClick={() => { setelegido(false); setbusqueda(''); setd((x) => ({ ...x, nombre: '', email: '', tel: '' })) }}
                  className="re-cliente-elegido-cambiar"
                  aria-label="Cambiar cliente"
                >
                  ×
                </button>
              </div>
            )}
          </div>
          <div className="re-fila-2">
            <div className="re-campo">
              <label>Teléfono *</label>
              <input
                ref={reftelefono}
                className={'re-input' + err('tel')} value={d.tel} maxLength={10} inputMode="numeric"
                onChange={(e) => set('tel', e.target.value.replace(/\D/g, ''))}
                onKeyDown={alenter_avanzar(reftelefono)}
                placeholder="10 dígitos"
              />
            </div>
            <div className="re-campo">
              <label>Email</label>
              <input
                ref={refemail}
                className={'re-input' + err('email')} type="email" value={d.email}
                onChange={(e) => set('email', e.target.value)}
                onKeyDown={alenter_avanzar(refemail)}
                placeholder="Opcional"
              />
            </div>
          </div>
        </div>

        <div className="re-seccion">
          <div className="re-seccion-titulo">🏟️ Evento</div>
          <div className="re-campo">
            <label>Juego *</label>
            <select
              ref={refjuego}
              className={'re-select' + err('juego')} value={d.juegoid}
              onChange={(e) => set('juegoid', e.target.value)}
              onKeyDown={alenter_avanzar(refjuego)}
            >
              <option value="">— Selecciona el juego —</option>
              {juegosordenados.map((j) => (
                <option key={j.id} value={j.id}>{fecha_juego(j)} · vs {j.rival}</option>
              ))}
            </select>
          </div>
          <div className="re-campo">
            <label>Zona / Asador *</label>
            <select
              ref={refzona}
              className={'re-select' + err('zona')} value={d.zonaid} disabled={!d.juegoid}
              onChange={(e) => set('zonaid', e.target.value)}
              onKeyDown={alenter_avanzar(refzona)}
            >
              <option value="">
                {d.juegoid ? '— Selecciona una zona libre —' : '— Elige primero el juego —'}
              </option>
              {zonaslibres.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
            {d.juegoid && !zonaslibres.length && (
              <div className="re-ayuda" style={{ color: 'var(--rojo)' }}>
                No hay zonas libres para este juego.
              </div>
            )}
          </div>

          <div className="re-campo">
            <label>Tipo de comida</label>
            <div className="re-segmento">
              <button
                type="button" className={d.tipocomida === 'carne_asada' ? 'activo' : ''}
                onClick={() => set('tipocomida', 'carne_asada')}
              >
                🥩 Carne asada
              </button>
              <button
                type="button" className={d.tipocomida === 'discada' ? 'activo' : ''}
                onClick={() => set('tipocomida', 'discada')}
              >
                🌮 Discada
              </button>
            </div>
          </div>

          <div className="re-fila-2">
            <div className="re-campo">
              <label>Adultos extra</label>
              <input
                ref={refadultos}
                className="re-input" type="number" min="0" step="1" inputMode="numeric"
                value={d.adultosextra} onChange={(e) => set('adultosextra', e.target.value)}
                onKeyDown={alenter_avanzar(refadultos)}
                placeholder="0"
              />
            </div>
            <div className="re-campo">
              <label>Niños extra</label>
              <input
                ref={refninos}
                className="re-input" type="number" min="0" step="1" inputMode="numeric"
                value={d.ninosextra} onChange={(e) => set('ninosextra', e.target.value)}
                onKeyDown={alenter_avanzar(refninos)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="re-campo">
            <label>Vendedora</label>
            <select
              ref={refvendedora}
              className="re-select" value={d.vendedora} onChange={(e) => set('vendedora', e.target.value)}
              onKeyDown={alenter_avanzar(refvendedora)}
            >
              <option value="">— Sin asignar —</option>
              {vendedoras.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        <div className="re-seccion">
          <div className="re-seccion-titulo">💰 Financiero</div>
          <div className="re-fila-2">
            <div className="re-campo">
              <label>Monto Total ($) *</label>
              <input
                ref={refmonto}
                className={'re-input' + err('monto')} type="number" min="0" step="0.01" inputMode="decimal"
                value={d.monto} onChange={(e) => set('monto', e.target.value)}
                onKeyDown={alenter_avanzar(refmonto)}
                placeholder="0.00"
              />
            </div>
            <div className="re-campo">
              <label>Abono Inicial ($)</label>
              <input
                ref={refabono}
                className="re-input" type="number" min="0" step="0.01" inputMode="decimal"
                value={d.abonoinicial} onChange={(e) => set('abonoinicial', e.target.value)}
                onKeyDown={alenter_avanzar(refabono)}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="re-campo">
            <label>Notas (opcional)</label>
            <textarea
              ref={refnotas}
              className="re-textarea" value={d.notas} onChange={(e) => set('notas', e.target.value)}
              placeholder="Cualquier detalle acordado por teléfono…"
            />
          </div>
        </div>

        <div className="re-resumen">
          <div><strong>{d.nombre || 'Cliente'}</strong> · {zonaelegida ? zonaelegida.nombre : 'Sin zona'}</div>
          <div>{juego ? fecha_juego(juego) + ' · vs ' + juego.rival : 'Sin juego seleccionado'}</div>
          <div className="re-resumen-total">{money(d.monto)}</div>
          {Number(d.abonoinicial) > 0 && (
            <div>Abono inicial acordado: {money(d.abonoinicial)}</div>
          )}
        </div>
      </div>

      <div className="re-cta-wrap">
        <button
          className="re-btn re-btn-primario" onClick={guardar}
          disabled={guardando}
        >
          {guardando ? 'Creando…' : 'Crear Reserva Momentánea'}
        </button>
      </div>

      {exito && (
        <div className="re-exito-overlay" role="dialog" aria-modal="true">
          <div className="re-exito-card">
            <div className="re-exito-icono">✓</div>
            <h2>¡Reserva Momentánea creada!</h2>
            <div className="re-exito-folio">{exito.folio}</div>
            <div className="re-exito-detalle">
              <div><strong>Cliente:</strong> {exito.nombre}</div>
              <div><strong>Zona:</strong> {exito.zona}</div>
              {exito.juego && <div><strong>Juego:</strong> {fecha_juego(exito.juego)} · vs {exito.juego.rival}</div>}
              <div><strong>Monto:</strong> {money(exito.monto)}</div>
              {Number(exito.abonoinicial) > 0 && (
                <div><strong>Abono acordado:</strong> {money(exito.abonoinicial)}</div>
              )}
            </div>
            {exito.avisobloqueo ? (
              <div className="re-exito-aviso">{exito.avisobloqueo}</div>
            ) : (
              <div className="re-ayuda" style={{ marginBottom: '16px' }}>
                🟢 La zona quedó bloqueada de inmediato en el mapa.
              </div>
            )}
            <button className="re-btn re-btn-primario" onClick={nuevaReserva} style={{ marginBottom: '10px' }}>
              + Crear otra reserva
            </button>
            <a href="/admin" className="re-btn re-btn-secundario" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', lineHeight: '54px' }}>
              Ir al Pipeline Comercial
            </a>
          </div>
        </div>
      )}
    </>
  )
}
