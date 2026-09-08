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
// DESGLOSE FINANCIERO: EL MISMO motor que "Nuevo prospecto"
// (calc_total_prospecto, en lib/prospectos.js) — Área/Zona se toma del
// catálogo de Precios para la zona elegida (precio_seccion/min_seccion,
// igual que ese modal), y Consumo/Extra/Adultos extra/Niños extra/
// Descuento son los mismos campos que ahi. El "Código de descuento" es
// nuevo: valida contra el catálogo YA CARGADO (validar_codigo_descuento en
// lib/catalogos.js, mismas reglas que el checkout público) y, si es válido,
// su % o monto fijo SUSTITUYE al descuento manual — no se suman los dos.
// Todo se recalcula EN VIVO con useMemo: la tarjeta de desglose muestra
// exactamente lo que se va a guardar.
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
import { validar_codigo_descuento } from '../../lib/catalogos'
import { estado_vivo } from '../../lib/mapaocupacion'
import { map_precio } from '../../lib/preciosadmin'
import { calc_total_prospecto } from '../../lib/prospectos'
import { min_seccion, precio_extra_seccion, precio_nino_seccion, precio_seccion } from '../../lib/reservasadmin'
import { redondear_dinero, mxn2 } from '../../lib/dinero'

const money = (n) => '$' + redondear_dinero(n || 0).toLocaleString('es-MX', mxn2)

// mismos nombres de campo que nuevoprospecto.jsx (adultoextracant, no
// "adultosextra"): calc_total_prospecto los lee tal cual, sin traducir.
const vacio = {
  nombre: '', tel: '', email: '',
  juegoid: '', zonaid: '', tipocomida: 'carne_asada',
  adultoextracant: '', ninoextracant: '', vendedora: '',
  consumomonto: '', extramonto: '', adultoextraprecio: '', ninoextraprecio: '',
  descuento: '', notas: '',
}

function fecha_juego(j) {
  return new Date(j.fecha + 'T12:00').toLocaleDateString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export default function formularioexpress() {
  const { usuario, cerrar_sesion } = useadmin()
  const {
    juegos, areas, areasestados, usuarios, clientes, reservas, secciones,
    descuentosvolumen, descuentos, cargando,
  } = useadmindatos()
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

  // código de descuento — mismo criterio que aplicar_promo() del checkout
  // público (paso3pago.jsx), pero validado LOCAL contra el catálogo ya
  // cargado (ver validar_codigo_descuento en lib/catalogos.js).
  const [codigo, setcodigo] = useState('')
  const [cupon, setcupon] = useState(null) // { codigo, tipo, valor } | null
  const [mensajecupon, setmensajecupon] = useState(null) // { ok, texto } | null

  // cadena de "Enter avanza al siguiente campo" — Teléfono es el destino
  // tanto del buscador de cliente como del primer eslabon de la cadena.
  // "Monto Área" y "Precio adulto/niño extra" son de SOLO LECTURA y no
  // llevan ref: un campo deshabilitado no puede recibir foco, asi que jamas
  // entrarian en esta cadena de todos modos. "Notas" queda al final y sin
  // manejador propio: ahi Enter sigue siendo un salto de línea normal.
  const reftelefono = useRef(null)
  const refemail = useRef(null)
  const refjuego = useRef(null)
  const refzona = useRef(null)
  const refconsumo = useRef(null)
  const refvendedora = useRef(null)
  const refextra = useRef(null)
  const refadultos = useRef(null)
  const refninos = useRef(null)
  const refdescuento = useRef(null)
  const refcodigo = useRef(null)
  const refnotas = useRef(null)
  const ordenrefs = [
    reftelefono, refemail, refjuego, refzona, refconsumo, refvendedora,
    refextra, refadultos, refninos, refdescuento, refcodigo, refnotas,
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
  // avanza. Se usa en Teléfono/Email/Juego/Zona/Consumo/Vendedora/Extra/
  // Adultos/Niños/Descuento.
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

  // ── motor de precios — EL MISMO que "Nuevo prospecto" ──────────
  // catálogo de Precios (map_precio) para resolver el "Monto Área" y el
  // mínimo de personas que ya incluye la zona, exactamente como ahi.
  const catalogo = useMemo(() => (secciones || []).map(map_precio), [secciones])
  const areamonto = zonaelegida ? precio_seccion(zonaelegida, catalogo) || 0 : 0
  const minpersonas = zonaelegida ? min_seccion(zonaelegida, catalogo, juego) : 0
  const precioadultobase = zonaelegida ? precio_extra_seccion(zonaelegida, catalogo) : 0
  const precioninobase = zonaelegida ? precio_nino_seccion(zonaelegida, catalogo) : 0

  // "Precio adulto/niño extra" se PRELLENAN con la tarifa de la zona en
  // cuanto se elige — el vendedor solo teclea cuántos, no cuánto. Atados a
  // d.zonaid (no al precio en si) para no pisar un ajuste manual en cada
  // render; cambiar de zona SI refresca el precio, igual que "Área/Zona".
  useEffect(() => {
    if (!zonaelegida) return
    setd((x) => ({
      ...x,
      adultoextraprecio: precioadultobase > 0 ? String(precioadultobase) : x.adultoextraprecio,
      ninoextraprecio: precioninobase > 0 ? String(precioninobase) : x.ninoextraprecio,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.zonaid])

  const calc = useMemo(
    () => calc_total_prospecto(
      { ...d, areamonto, minpersonas, cupon },
      { areas, descuentosvolumen }
    ),
    [d, areamonto, minpersonas, cupon, areas, descuentosvolumen]
  )
  // % EFECTIVO mostrado en la tarjeta: junta el manual/código Y el
  // automático por volumen en una sola línea, como pide el desglose.
  const pctdescuento = calc.subtotal > 0 ? Math.round((calc.descuentototal / calc.subtotal) * 100) : 0

  // ── código de descuento ─────────────────────────────────────────
  function aplicar_codigo() {
    if (!codigo.trim()) return
    const r = validar_codigo_descuento(descuentos, codigo, d.juegoid)
    if (r.ok) {
      setcupon({ codigo: r.descuento.codigo, tipo: r.descuento.tipo, valor: r.descuento.valor })
      setmensajecupon({ ok: true, texto: 'Código "' + r.descuento.codigo + '" aplicado' })
    } else {
      setcupon(null)
      setmensajecupon({ ok: false, texto: r.mensaje })
    }
  }

  function quitar_codigo() {
    setcupon(null)
    setcodigo('')
    setmensajecupon(null)
  }

  // si el juego cambia despues de aplicar un codigo restringido a otros
  // juegos, se revalida y se avisa en vez de dejarlo aplicado en silencio.
  useEffect(() => {
    if (!cupon) return
    const r = validar_codigo_descuento(descuentos, cupon.codigo, d.juegoid)
    if (!r.ok) {
      setcupon(null)
      setmensajecupon({ ok: false, texto: 'El código dejó de aplicar: ' + r.mensaje })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.juegoid])

  async function guardar() {
    setcampos([])
    const r = await crear_express({
      ...d, zona: zonaelegida ? zonaelegida.nombre : '', areamonto, minpersonas, cupon,
    })
    if (r && r.ok) {
      setexito({
        folio: r.folio, nombre: d.nombre, zona: zonaelegida ? zonaelegida.nombre : '',
        juego, monto: r.monto, avisobloqueo: r.avisobloqueo,
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
    quitar_codigo()
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

          {/* Monto Área: de solo lectura, cargado del catálogo de Precios en
              cuanto se elige la zona — mismo maquetado que "Nuevo prospecto"
              (Monto Área junto a Consumo), pero como campo real en vez de
              texto suelto. */}
          <div className="re-fila-2">
            <div className="re-campo">
              <label>Monto Área ($)</label>
              <input className="re-input" type="number" value={areamonto} disabled />
            </div>
            <div className="re-campo">
              <label>Monto Consumo ($)</label>
              <input
                ref={refconsumo}
                className="re-input" type="number" min="0" step="0.01" inputMode="decimal"
                value={d.consumomonto} onChange={(e) => set('consumomonto', e.target.value)}
                onKeyDown={alenter_avanzar(refconsumo)}
                placeholder="0.00"
              />
            </div>
          </div>
          {zonaelegida ? (
            minpersonas > 0 && (
              <div className="re-ayuda" style={{ marginTop: '-6px', marginBottom: '14px' }}>
                Incluye {minpersonas} persona(s) en el precio de la zona.
              </div>
            )
          ) : (
            <div className="re-ayuda" style={{ marginTop: '-6px', marginBottom: '14px' }}>
              Elige una zona para tomar la tarifa del catálogo.
            </div>
          )}

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

          <div className="re-campo">
            <label>Extra ($)</label>
            <input
              ref={refextra}
              className="re-input" type="number" min="0" step="0.01" inputMode="decimal"
              value={d.extramonto} onChange={(e) => set('extramonto', e.target.value)}
              onKeyDown={alenter_avanzar(refextra)}
              placeholder="0.00"
            />
          </div>

          {/* Personas extra: precio (SOLO LECTURA, tarifa oficial de la zona
              — ver el useEffect de precioadultobase/precioninobase) junto a
              su cantidad, en la MISMA fila — mismo maquetado que "Nuevo
              prospecto" (Precio adulto extra + Adultos extra, y su par de
              niño). El vendedor solo teclea cuántos. */}
          <div className="re-fila-2">
            <div className="re-campo">
              <label>Precio adulto extra ($)</label>
              <input className="re-input" type="number" value={d.adultoextraprecio} disabled />
            </div>
            <div className="re-campo">
              <label>Adultos extra</label>
              <input
                ref={refadultos}
                className="re-input" type="number" min="0" step="1" inputMode="numeric"
                value={d.adultoextracant} onChange={(e) => set('adultoextracant', e.target.value)}
                onKeyDown={alenter_avanzar(refadultos)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="re-fila-2">
            <div className="re-campo">
              <label>Precio niño extra ($)</label>
              <input className="re-input" type="number" value={d.ninoextraprecio} disabled />
            </div>
            <div className="re-campo">
              <label>Niños extra</label>
              <input
                ref={refninos}
                className="re-input" type="number" min="0" step="1" inputMode="numeric"
                value={d.ninoextracant} onChange={(e) => set('ninoextracant', e.target.value)}
                onKeyDown={alenter_avanzar(refninos)}
                placeholder="0"
              />
            </div>
          </div>
          {zonaelegida && (
            <div className="re-ayuda" style={{ marginTop: '-6px', marginBottom: '14px' }}>
              Tarifa oficial de {zonaelegida.nombre} — solo agrega cuántos adultos/niños extra.
            </div>
          )}

          {/* Descuento (%) y Código de descuento, en la misma fila. */}
          <div className="re-fila-2">
            <div className="re-campo">
              <label>Descuento (%)</label>
              <input
                ref={refdescuento}
                className="re-input" type="number" min="0" max="100" step="1" inputMode="numeric"
                value={d.descuento} onChange={(e) => set('descuento', e.target.value)}
                onKeyDown={alenter_avanzar(refdescuento)}
                placeholder="0" disabled={!!cupon}
                title={cupon ? 'Un código de descuento aplicado sustituye el % manual' : undefined}
              />
            </div>
            <div className="re-campo">
              <label>Código de descuento</label>
              {!cupon ? (
                <div className="re-codigo-fila">
                  <input
                    ref={refcodigo}
                    className="re-input" style={{ textTransform: 'uppercase' }}
                    value={codigo} onChange={(e) => setcodigo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return
                      e.preventDefault()
                      aplicar_codigo()
                      if (refnotas.current) refnotas.current.focus()
                    }}
                    placeholder="Ej. NARANJEROS10"
                  />
                  <button type="button" className="re-btn-aplicar" onClick={aplicar_codigo}>
                    Aplicar
                  </button>
                </div>
              ) : (
                <div className="re-cliente-elegido">
                  <div className="re-cliente-elegido-nombre">✓ {cupon.codigo} aplicado</div>
                  <button
                    type="button" onClick={quitar_codigo}
                    className="re-cliente-elegido-cambiar" aria-label="Quitar código"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>
          {mensajecupon && !cupon && (
            <div className="re-ayuda" style={{ marginTop: '-6px', marginBottom: '14px', color: mensajecupon.ok ? 'var(--verde)' : 'var(--rojo)' }}>
              {mensajecupon.texto}
            </div>
          )}

          <div className="re-campo">
            <label>Notas (opcional)</label>
            <textarea
              ref={refnotas}
              className="re-textarea" value={d.notas} onChange={(e) => set('notas', e.target.value)}
              placeholder="Cualquier detalle acordado por teléfono…"
            />
          </div>

          {/* ── Desglose financiero en tiempo real — mismo motor que
              "Nuevo prospecto" (calc_total_prospecto), con el desglose
              itemizado del detalle de Cotizaciones. */}
          <div className="re-desglose">
            <div className="re-desglose-fila"><span>Área / Zona</span><span>{money(areamonto)}</span></div>
            {Number(d.consumomonto) > 0 && (
              <div className="re-desglose-fila"><span>Consumo</span><span>{money(d.consumomonto)}</span></div>
            )}
            {Number(d.extramonto) > 0 && (
              <div className="re-desglose-fila"><span>Extra</span><span>{money(d.extramonto)}</span></div>
            )}
            {calc.adultocant > 0 && (
              <div className="re-desglose-fila">
                <span>Adultos extra ({calc.adultocant} × {money(d.adultoextraprecio)})</span>
                <span>{money((Number(d.adultoextraprecio) || 0) * calc.adultocant)}</span>
              </div>
            )}
            {calc.ninocant > 0 && (
              <div className="re-desglose-fila">
                <span>Niños extra ({calc.ninocant} × {money(d.ninoextraprecio)})</span>
                <span>{money((Number(d.ninoextraprecio) || 0) * calc.ninocant)}</span>
              </div>
            )}
            <div className="re-desglose-fila"><span>Subtotal</span><span>{money(calc.subtotal)}</span></div>
            {calc.descuentototal > 0 && (
              <div className="re-desglose-fila re-desglose-descuento">
                <span>Descuento ({pctdescuento}%)</span><span>−{money(calc.descuentototal)}</span>
              </div>
            )}
            <div className="re-desglose-fila re-desglose-personas">
              <span>Total de personas</span><span>{calc.personas}</span>
            </div>
            <div className="re-desglose-total">
              <span>Precio final total</span><span>{money(calc.total)}</span>
            </div>
          </div>
        </div>

        <div className="re-resumen">
          <div><strong>{d.nombre || 'Cliente'}</strong> · {zonaelegida ? zonaelegida.nombre : 'Sin zona'}</div>
          <div>{juego ? fecha_juego(juego) + ' · vs ' + juego.rival : 'Sin juego seleccionado'}</div>
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
            </div>
            {exito.avisobloqueo && (
              <div className="re-exito-aviso">{exito.avisobloqueo}</div>
            )}
            <button className="re-btn re-btn-primario" onClick={nuevaReserva}>
              ¡Listo!
            </button>
          </div>
        </div>
      )}
    </>
  )
}
