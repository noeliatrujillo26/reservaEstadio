// ═══════════════════════════════════════════════════════════════════
// reservas.jsx — vista "Reservas" (secciones reservadas por juego).
// espejo 1:1 de v1: #page-seccionesreservadas de index.html (lineas
// 2805-2867) y renderSeccionesResTabla()/renderSeccionesResKPIs() de
// js/20-editor-mapa.js.
//
// ESCRITURA (Fase 2): crear y editar reservas, eliminar con confirmacion
// segura y su cascada, y bloquear/desbloquear secciones. Todo pasa por los
// tres candados de lib/escritura.js.
// Siguen sin migrar los botones de WhatsApp y de compartir codigo: disparan
// efectos externos y no forman parte de esta tanda.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import { usetoast } from '../../context/toastcontext'
import usereservasescritura from '../../hooks/usereservasescritura'
import { useconfirmarseguro } from './confirmarseguro'
import ReservaForm from './reservaform'
import { alternar_bloqueo, estado_vivo } from '../../lib/mapaocupacion'
import { sb } from '../../supabaseclient'
import useadmin from '../../hooks/useadmin'
import {
  badge_categoria, badge_estado, es_palco_compartido, filas_reservas,
  folio_visible, label_estado, total_personas_seccion,
} from '../../lib/reservasadmin'
import { hoy_hermosillo } from '../../lib/fechas'

export default function reservas() {
  const { reservas: todas, cobros, juegos, areas, areasestados, cargando, recargar } = useadmindatos()
  const { usuario } = useadmin()
  const { mostrartoast } = usetoast()
  const {
    puede, puede_estados, guardar, guardando, eliminar, borrando,
  } = usereservasescritura()
  const { confirmarseguro, dialogo } = useconfirmarseguro()
  const [form, setform] = useState(null) // { editando } | null
  const [bloqueando, setbloqueando] = useState(null)

  const [juegoelegido, setjuegoelegido] = useState('')
  const [soloocupadas, setsoloocupadas] = useState(false)
  const [tipozona, settipozona] = useState('')

  // El proximo juego se PRESELECCIONA, igual que seleccionarProximoJuegoRes()
  // en la v1. Va DERIVADO y no en un useEffect: los juegos llegan asincronos,
  // asi que con un efecto la vista pintaba primero vacia y luego con datos —
  // y en el banco de pruebas, que renderiza sin ejecutar efectos, la tabla
  // salia siempre sin filas y no probaba nada de lo que hay dentro.
  const juegoauto = useMemo(() => {
    if (!juegos.length) return ''
    const hoy = hoy_hermosillo()
    const prox = juegos.find((j) => (j.fecha || '') >= hoy) || juegos[0]
    return prox ? String(prox.id) : ''
  }, [juegos])

  // lo elegido a mano manda; si no, el proximo juego.
  const juegoid = juegoelegido || juegoauto

  // String() en ambos lados: el value del select es texto y el id del juego
  // puede ser numerico — la comparacion estricta dejaba la tabla vacia.
  const juego = juegos.find((x) => String(x.id) === String(juegoid)) || null

  const datos = useMemo(
    () => filas_reservas({ areas, reservas: todas, cobros, areasestados, juego, soloocupadas, tipozona }),
    [areas, todas, cobros, areasestados, juego, soloocupadas, tipozona]
  )

  const subtitulo = juego
    ? new Date(juego.fecha + 'T12:00').toLocaleDateString('es-MX', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
      }) + ' · vs ' + juego.rival + ' · Juego ' + juego.num + ' · ' + juego.hora + ' h'
    : 'Disponibilidad por sección y juego'

  const conteo = !datos
    ? '0 filas'
    : soloocupadas || tipozona
      ? datos.filas.length + ' de ' + datos.total + ' secciones'
      : datos.total + ' secciones'

  // ELIMINAR: la v1 exige MOTIVO y CONTRASEÑA antes de borrar. Se conserva
  // igual — es la unica accion del panel que no tiene vuelta atras.
  async function pedir_eliminar(f) {
    const conf = await confirmarseguro({
      titulo: '🗑 Eliminar la reserva ' + folio_visible(f.reserva),
      descripcion: (
        <>
          Reserva de <strong>{f.reserva.cliente}</strong> en <strong>{f.a.nombre}</strong>.
          <br />
          La sección quedará libre, sus cobros se cancelarán y el prospecto del
          Pipeline (si existe) se desvinculará. Esta acción no se puede deshacer.
        </>
      ),
      etiquetamotivo: '¿Por qué se elimina esta reservación? *',
      textoconfirmar: 'Confirmar y Eliminar',
    })
    if (conf) eliminar(f.reserva, conf)
  }

  // BLOQUEAR / DESBLOQUEAR: sacar una seccion de venta tambien pide la
  // contraseña. La v1 la pide contra un '1234' escrito en el codigo; aqui se
  // valida la contraseña REAL de quien tiene la sesion (ver confirmarseguro).
  async function pedir_bloqueo(f) {
    const vivo = estado_vivo(areasestados, juegoid, f.a.id)
    if (vivo === 'reservada') {
      mostrartoast('⛔ No se puede bloquear una sección reservada')
      return
    }
    const siguiente = vivo === 'bloqueada' ? 'liberar' : 'bloquear'
    const conf = await confirmarseguro({
      titulo: (siguiente === 'bloquear' ? '🔒 Bloquear ' : '🔓 Liberar ') + f.a.nombre,
      descripcion: siguiente === 'bloquear'
        ? 'La sección dejará de estar disponible para venta en este juego.'
        : 'La sección volverá a estar disponible para venta en este juego.',
      pedirmotivo: false,
      textoconfirmar: siguiente === 'bloquear' ? 'Bloquear sección' : 'Liberar sección',
    })
    if (!conf) return
    setbloqueando(f.a.id)
    const r = await alternar_bloqueo(sb, usuario, {
      juegoid, zonaid: f.a.id, nombre: f.a.nombre, areasestados,
    })
    setbloqueando(null)
    if (!r.ok) {
      mostrartoast(
        r.motivo === 'reservada'
          ? '⛔ No se puede bloquear una sección reservada'
          : r.motivo === 'sin_filas'
            ? '⚠️ La base no aceptó el cambio (0 filas). Revisa las políticas RLS de `zona_juego_estado`.'
            : '⚠️ No se pudo cambiar el estado de la sección.'
      )
      return
    }
    mostrartoast((r.estado === 'bloqueada' ? '🔒 ' : '🔓 ') + f.a.nombre)
    recargar()
  }

  return (
    <div className="page active" id="page-seccionesreservadas">
      <div className="page-inner" style={{ padding: '28px' }}>
        <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2>Reservas</h2>
            <p>Secciones con estado de reserva por juego de la temporada</p>
          </div>
          {puede && (
            <button className="btn btn-primary btn-sm" onClick={() => setform({ editando: null })}>
              + Nueva reserva
            </button>
          )}
        </div>

        {/* ── KPIs ── */}
        <div id="sr-kpis" className="stats-grid" style={{ marginBottom: '20px' }}>
          <div className="stat-card">
            <div className="stat-card-label">Secciones</div>
            <div className="stat-card-value">{datos ? datos.total : 0}</div>
            <div className="stat-card-delta">en el juego</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Libres</div>
            <div className="stat-card-value" style={{ color: 'var(--verde)' }}>{datos ? datos.libres : 0}</div>
            <div className="stat-card-delta delta-up">
              {datos && datos.total > 0 ? Math.round((datos.libres / datos.total) * 100) : 0}% disponible
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Reservadas</div>
            <div className="stat-card-value" style={{ color: 'var(--azul)' }}>{datos ? datos.reservadas : 0}</div>
            <div className="stat-card-delta">{datos ? datos.pctocup : 0}% ocupación</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Bloqueadas</div>
            <div className="stat-card-value" style={{ color: 'var(--rojo)' }}>{datos ? datos.bloqueadas : 0}</div>
            <div className="stat-card-delta">fuera de venta</div>
          </div>
        </div>

        {/* ── controles ── */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          <select
            id="sr-filtro-juego" className="input select" style={{ width: '280px' }}
            value={juegoid} onChange={(e) => setjuegoelegido(e.target.value)}
          >
            <option value="">— Selecciona un juego —</option>
            {juegos.map((j) => (
              <option value={String(j.id)} key={j.id}>
                {j.fecha} · vs {j.rival}
              </option>
            ))}
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer', marginLeft: '8px' }}>
            <div
              id="sr-toggle-wrap" onClick={() => setsoloocupadas((v) => !v)}
              style={{ width: '40px', height: '22px', borderRadius: '11px', background: soloocupadas ? 'var(--naranja)' : 'var(--border)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
            >
              <div
                id="sr-toggle-knob"
                style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: soloocupadas ? '20px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
              />
            </div>
            <span title="Muestra las secciones reservadas Y bloqueadas (todo lo que no está libre)">
              Solo ocupadas
            </span>
          </label>

          <select
            id="sr-filtro-tipo" className="input select" style={{ width: '190px' }}
            title="Zonas exclusivas se venden completas; los palcos compartidos se venden por lugares"
            value={tipozona} onChange={(e) => settipozona(e.target.value)}
          >
            <option value="">Todas las zonas</option>
            <option value="exclusiva">Zonas exclusivas</option>
            <option value="compartida">Palcos compartidos</option>
          </select>

          <span id="sr-count" className="badge badge-gray" style={{ marginLeft: 'auto' }}>{conteo}</span>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title" id="sr-sub">{subtitulo}</div>
          </div>
          <div className="table-wrap" style={{ maxHeight: '62vh', overflowY: 'auto' }}>
            <table style={{ tableLayout: 'fixed', width: '100%' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  <th style={{ width: '5%', textAlign: 'center' }}>Nº</th>
                  <th style={{ width: '11%' }}>Folio</th>
                  <th style={{ width: '22%' }}>Sección</th>
                  <th style={{ width: '12%' }}>Categoría</th>
                  <th style={{ width: '14%' }}>Personas incluidas</th>
                  <th style={{ width: '12%' }}>Estado</th>
                  <th style={{ width: '16%' }}>Cliente</th>
                  <th style={{ width: '12%' }}>Pago</th>
                  {(puede || puede_estados) && <th style={{ width: '11%' }}>Acciones</th>}
                </tr>
              </thead>
              <tbody id="sr-tbody">
                {!juego && (
                  <tr>
                    <td colSpan={(puede || puede_estados) ? 9 : 8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)' }}>
                      {cargando ? 'Cargando datos…' : 'Selecciona un juego para ver la disponibilidad'}
                    </td>
                  </tr>
                )}

                {juego && datos && datos.filas.length === 0 && (
                  <tr>
                    <td colSpan={(puede || puede_estados) ? 9 : 8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-3)' }}>
                      {tipozona === 'compartida' ? (
                        <>
                          No hay palcos compartidos configurados.
                          <br />
                          <span style={{ fontSize: '12px' }}>
                            Se marcan con <b>es_compartida</b> en el editor del mapa.
                          </span>
                        </>
                      ) : soloocupadas && datos.total > 0 ? (
                        <>
                          Este juego aún no tiene secciones reservadas ni bloqueadas.
                          <br />
                          <span style={{ fontSize: '12px' }}>
                            Desactiva <b>"Solo ocupadas"</b> para ver las {datos.total} secciones del juego.
                          </span>
                        </>
                      ) : (
                        'No hay secciones configuradas para este juego'
                      )}
                    </td>
                  </tr>
                )}

                {juego && datos && datos.filas.map((f, idx) => {
                  const folio = folio_visible(f.reserva)
                  const cliente = f.reserva ? f.reserva.cliente : '—'
                  return (
                    <tr key={f.a.id}>
                      <td className="td-muted" style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-3)' }}>
                        {idx + 1}
                      </td>
                      <td className="td-muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }} title={folio}>
                        {folio}
                      </td>
                      <td className="td-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.a.nombre}>
                        {f.a.nombre}
                        {es_palco_compartido(f.a) && (
                          <span className="badge badge-purple" style={{ fontSize: '9px', marginLeft: '6px' }}>
                            Compartido
                          </span>
                        )}
                      </td>
                      <td><span className={'badge ' + (badge_categoria[f.cat] || 'badge-gray')}>{f.cat}</span></td>
                      <td className="td-muted" style={{ textAlign: 'center' }}>
                        {total_personas_seccion(f.a, f.reserva)}
                      </td>
                      <td>
                        <span className={'badge ' + badge_estado[f.est]}>
                          <span className="bdot" />
                          {label_estado[f.est]}
                        </span>
                      </td>
                      <td className="td-muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={cliente}>
                        {cliente}
                      </td>
                      <td>
                        {f.pago ? (
                          <span
                            className={'badge ' + f.pago.badge}
                            title="Los pagos se registran desde el detalle de la reserva (Historial de Pagos)"
                          >
                            {f.pago.label}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      {(puede || puede_estados) && (
                        <td>
                          <div style={{ display: 'flex', gap: '4px', whiteSpace: 'nowrap' }}>
                            {puede && f.reserva && (
                              <button
                                className="btn btn-ghost btn-xs"
                                title="Editar reserva"
                                onClick={() => setform({ editando: f.reserva })}
                                style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 8px' }}
                              >
                                ✎
                              </button>
                            )}
                            {puede && f.reserva && (
                              <button
                                className="btn btn-ghost btn-xs"
                                title="Eliminar reserva"
                                onClick={() => pedir_eliminar(f)}
                                disabled={borrando === f.reserva.id}
                                style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 8px', color: 'var(--rojo)' }}
                              >
                                {borrando === f.reserva.id ? '…' : '🗑'}
                              </button>
                            )}
                            {puede_estados && (
                              <button
                                className={'btn btn-xs ' + (f.est === 'bloqueada' ? 'btn-danger' : 'btn-outline')}
                                title={
                                  f.est === 'reservada'
                                    ? 'No se puede bloquear una sección reservada'
                                    : f.est === 'bloqueada' ? 'Liberar sección' : 'Bloquear sección'
                                }
                                onClick={() => pedir_bloqueo(f)}
                                disabled={f.est === 'reservada' || bloqueando === f.a.id}
                                style={f.est === 'reservada' ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                              >
                                {bloqueando === f.a.id ? '…' : f.est === 'bloqueada' ? '🔓' : '🔒'}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ReservaForm
        abierto={!!form}
        editando={form ? form.editando : null}
        juegoinicial={juegoid}
        zonainicial=""
        oncerrar={() => setform(null)}
        onguardar={guardar}
        guardando={guardando}
      />
      {dialogo}
    </div>
  )
}
