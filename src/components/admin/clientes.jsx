// ═══════════════════════════════════════════════════════════════════
// clientes.jsx — expediente de clientes.
// espejo 1:1 de v1: #page-clientes de index.html (lineas 2870-2915),
// initClientesPage(), renderClientesTabla(), sortClientes(),
// onBuscarClientes(), paginaClientes() y el menu de acciones por fila
// (ver detalle/editar/autorizar credito/eliminar).
//
// ESCRITURA (Fase 2): nuevo cliente, editar la ficha, autorizar/revocar
// credito, eliminar e importar por CSV — ver useclientesescritura.js.
// "Descargar formato" y "Exportar CSV" son de solo lectura, disponibles
// tambien sin permiso de escritura. El formato de importacion/exportacion es
// el mismo de todo el panel (ver lib/exportarcsv.js): sin equivalente EXACTO
// en la v1, que exportaba a Excel con un armado propio por modulo.
//
// EL TOTAL PAGADO SE RECONCILIA: armar_clientes hace un pase final que toma
// lo MAYOR entre lo atribuido por reserva y la suma real de TODOS los cobros
// del cliente — incluye abonos registrados con el folio de su tarjeta del
// Pipeline antes de que existiera la reserva. Es la misma cuenta que pinta
// el expediente, para que nunca puedan decir cosas distintas.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react'
import useadmindatos from '../../hooks/useadmindatos'
import useclientesescritura from '../../hooks/useclientesescritura'
import { useconfirmarseguro } from './confirmarseguro'
import ClienteDetalle from './clientedetalle'
import ClienteForm from './clienteform'
import {
  armar_clientes, columnas_csv_clientes, columnas_csv_export_clientes,
  fila_csv_export_cliente, filas_csv_a_clientes, filtrar_clientes, ordenar_clientes,
  pagos_de_cliente, folios_de_cliente, por_pagina,
} from '../../lib/clientes'
import { consumos_de_cliente } from '../../lib/consumos'
import { csv_de_filas, descargar_csv, parsear_csv } from '../../lib/exportarcsv'
import { hoy_hermosillo } from '../../lib/fechas'

// ── menu de acciones "⋯" por fila ──────────────────────────────────
function MenuAcciones({ cliente, puede, oneditar, ondetalle, oncredito, oneliminar }) {
  const [abierto, setabierto] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!abierto) return
    const cerrar = (e) => { if (ref.current && !ref.current.contains(e.target)) setabierto(false) }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [abierto])

  const item = (onclick, texto, extra) => (
    <button
      type="button"
      onClick={() => { setabierto(false); onclick() }}
      style={{
        display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
        padding: '8px 14px', fontSize: '12.5px', cursor: 'pointer', color: 'var(--text-1)',
        whiteSpace: 'nowrap', ...extra,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
    >
      {texto}
    </button>
  )

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="btn btn-ghost btn-xs" onClick={() => setabierto((a) => !a)}
        title="Más acciones" aria-label="Más acciones"
      >
        ⋯
      </button>
      {abierto && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 500,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '8px', minWidth: '190px', overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          }}
        >
          {item(ondetalle, 'Ver Detalle / Historial')}
          {puede && item(oneditar, 'Editar')}
          {puede && item(
            oncredito,
            cliente.creditoautorizado ? 'Revocar crédito autorizado' : 'Autorizar Crédito'
          )}
          {puede && item(oneliminar, '🗑️ Eliminar', { color: 'var(--rojo)' })}
        </div>
      )}
    </div>
  )
}

export default function clientes() {
  const { clientes: tabla, reservas, cobros, pipeline, cargando, errores, recargar } = useadmindatos()
  const { puede, editar, guardando, autorizar_credito, eliminar, importar, importando } = useclientesescritura()
  const { confirmarseguro, dialogo } = useconfirmarseguro()

  const [busqueda, setbusqueda] = useState('')
  const [orden, setorden] = useState({ col: 'nombre', dir: 'asc' })
  const [pagina, setpagina] = useState(0)
  const [detalle, setdetalle] = useState(null)
  const [form, setform] = useState(null) // { editando } | null
  const [refrescando, setrefrescando] = useState(false)
  const refarchivo = useRef(null)

  const todos = useMemo(
    () => armar_clientes({ clientes: tabla, reservas, cobros, pipeline }),
    [tabla, reservas, cobros, pipeline]
  )

  // el expediente abierto se deriva del id/clave, no del objeto guardado: si
  // recargar() trae datos frescos, el modal los refleja sin quedarse con la
  // foto de cuando se abrio.
  const abierto = useMemo(() => {
    if (!detalle) return null
    return todos.find((c) => (c.id != null ? c.id === detalle.id : c.nombre === detalle.nombre && c.tel === detalle.tel)) || detalle
  }, [detalle, todos])

  const pagos = useMemo(
    () => (abierto ? pagos_de_cliente(abierto, cobros, reservas, pipeline) : []),
    [abierto, cobros, reservas, pipeline]
  )
  const consumos = useMemo(
    () => (abierto ? consumos_de_cliente(abierto, reservas, folios_de_cliente(abierto, pipeline)) : []),
    [abierto, reservas, pipeline]
  )
  // Tarjetas del Pipeline vinculadas: por cliente_id explicito, o porque
  // alguna de sus reservaids coincide con una reserva del expediente — la
  // MISMA regla de identidad que usa armar_clientes para los folios.
  const tarjetas = useMemo(() => {
    if (!abierto) return []
    const misfolios = new Set(abierto.reservas.map((r) => String(r.folio)))
    return (pipeline || []).filter((p) => {
      if (abierto.id != null && p.clienteid != null) return String(p.clienteid) === String(abierto.id)
      return (p.reservaids || []).some((rid) => misfolios.has(String(rid)))
    })
  }, [abierto, pipeline])

  const filtrados = useMemo(() => filtrar_clientes(todos, busqueda), [todos, busqueda])
  const ordenados = useMemo(
    () => ordenar_clientes(filtrados, orden.col, orden.dir),
    [filtrados, orden]
  )

  const paginas = Math.max(1, Math.ceil(ordenados.length / por_pagina))
  const pag = Math.min(pagina, paginas - 1)
  const visibles = ordenados.slice(pag * por_pagina, pag * por_pagina + por_pagina)

  function ordenar_por(col) {
    setorden((o) => (o.col === col ? { col, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }))
    setpagina(0)
  }

  const flecha = (col) => (orden.col === col ? (orden.dir === 'asc' ? ' ↑' : ' ↓') : ' ↕')

  // ELIMINAR. Contraseña de administrador para confirmar — el historial de
  // reservas/cobros del cliente no se toca, solo desaparece su ficha.
  async function pedir_eliminar(c) {
    const conf = await confirmarseguro({
      titulo: '🗑 Eliminar cliente',
      descripcion: <>¿Eliminar a <strong>{c.nombre}</strong> del expediente de clientes? Esta acción no se puede deshacer.</>,
      pedirmotivo: false,
      etiquetapass: 'Contraseña de administrador *',
      textoconfirmar: 'Confirmar y Eliminar',
    })
    if (!conf) return
    await eliminar(c)
  }

  // AUTORIZAR / REVOCAR CRÉDITO. Misma puerta de contraseña: es un cambio de
  // control financiero (le permite al cliente registrar cobros como
  // compromiso a crédito, sin dinero de por medio).
  async function pedir_autorizar_credito(c) {
    const autorizando = !c.creditoautorizado
    const conf = await confirmarseguro({
      titulo: autorizando ? '🔓 Autorizar crédito' : '🔒 Revocar crédito autorizado',
      descripcion: autorizando ? (
        <>Estás por autorizar crédito a <strong>{c.nombre}</strong>. Podrá registrar cobros como compromiso a
          crédito, sin que se trate de dinero cobrado todavía.</>
      ) : (
        <>Estás por revocar el crédito autorizado a <strong>{c.nombre}</strong>.</>
      ),
      pedirmotivo: false,
      etiquetapass: 'Contraseña de administrador *',
      textoconfirmar: autorizando ? 'Autorizar crédito' : 'Revocar crédito',
    })
    if (!conf) return
    await autorizar_credito(c, autorizando)
  }

  // ACTUALIZAR. El icono gira mientras recargar() trae datos frescos — la
  // clase .cl-refresh-icon.girando ya vive en admin.css.
  async function actualizar_lista() {
    if (refrescando) return
    setrefrescando(true)
    try { await recargar() } finally { setrefrescando(false) }
  }

  // DESCARGAR FORMATO. Solo la cabecera (Nombre/Email/Teléfono/Empresa): la
  // misma plantilla que espera Importar CSV, para llenarla en Excel.
  function descargar_formato() {
    descargar_csv('formato_clientes.csv', csv_de_filas(columnas_csv_clientes, []))
  }

  // EXPORTAR CSV. El conjunto FILTRADO y ordenado tal como se ve en pantalla
  // (no solo la página visible), con las cifras de solo lectura del
  // expediente además de los campos editables.
  function exportar_csv() {
    const filas = ordenados.map(fila_csv_export_cliente)
    descargar_csv('clientes_' + hoy_hermosillo() + '.csv', csv_de_filas(columnas_csv_export_clientes, filas))
  }

  // IMPORTAR CSV. El input de archivo vive oculto; el botón solo lo dispara.
  function disparar_importar() {
    if (refarchivo.current) refarchivo.current.click()
  }
  async function manejar_archivo(e) {
    const archivo = e.target.files && e.target.files[0]
    e.target.value = '' // permite volver a elegir el mismo archivo despues
    if (!archivo) return
    const texto = await archivo.text()
    const filas = filas_csv_a_clientes(parsear_csv(texto))
    await importar(filas)
  }

  return (
    <div className="page active" id="page-clientes">
      <div className="page-inner" style={{ padding: '28px' }}>
        <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2>Clientes</h2>
            <p>Registrados vía plataforma web y manual</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              className="btn btn-outline btn-sm" onClick={actualizar_lista} disabled={refrescando}
              title="Actualizar"
            >
              <span className={'cl-refresh-icon' + (refrescando ? ' girando' : '')} style={{ display: 'inline-block' }}>↻</span>
              {' '}Actualizar
            </button>
            <button className="btn btn-outline btn-sm" onClick={descargar_formato}>
              Descargar formato
            </button>
            {puede && (
              <button className="btn btn-outline btn-sm" onClick={disparar_importar} disabled={importando}>
                ↑ {importando ? 'Importando…' : 'Importar CSV'}
              </button>
            )}
            <button className="btn btn-outline btn-sm" onClick={exportar_csv}>
              ↓ Exportar CSV
            </button>
            {puede && (
              <button className="btn btn-primary btn-sm" onClick={() => setform({ editando: null })}>
                + Nuevo cliente
              </button>
            )}
            <input
              ref={refarchivo} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
              onChange={manejar_archivo}
            />
          </div>
        </div>

        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <input
              id="cl-buscar" className="input" placeholder="Buscar por nombre, correo o tel…"
              style={{ width: '240px', fontSize: '13px' }}
              value={busqueda}
              onChange={(e) => { setbusqueda(e.target.value); setpagina(0) }}
            />
            {ordenados.length > 0 && (
              <div id="cl-paginacion" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-2)' }}>
                <span id="cl-rango" style={{ whiteSpace: 'nowrap', marginRight: '4px' }}>
                  {pag * por_pagina + 1}–{Math.min((pag + 1) * por_pagina, ordenados.length)} de {ordenados.length}
                </span>
                <button
                  className="btn btn-ghost btn-xs" title="Anterior" disabled={pag === 0}
                  onClick={() => setpagina((p) => Math.max(0, p - 1))}
                  style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 10px', lineHeight: 1 }}
                >‹</button>
                <button
                  className="btn btn-ghost btn-xs" title="Siguiente" disabled={pag >= paginas - 1}
                  onClick={() => setpagina((p) => Math.min(paginas - 1, p + 1))}
                  style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 10px', lineHeight: 1 }}
                >›</button>
              </div>
            )}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => ordenar_por('nombre')}>
                    Cliente<span className="sort-arrow">{flecha('nombre')}</span>
                  </th>
                  <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => ordenar_por('email')}>
                    Email<span className="sort-arrow">{flecha('email')}</span>
                  </th>
                  <th style={{ whiteSpace: 'nowrap' }}>Tel</th>
                  <th style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'center', whiteSpace: 'nowrap' }} onClick={() => ordenar_por('reservas')}>
                    Reservas<span className="sort-arrow">{flecha('reservas')}</span>
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="cl-tbody">
                {visibles.map((c, i) => (
                  <tr key={(c.id != null ? 'id' + c.id : 'n' + i) + c.email}>
                    <td className="td-name">
                      {c.nombre}
                      {c.empresa && (
                        <span className="badge badge-gray" style={{ fontSize: '9px', marginLeft: '6px' }}>{c.empresa}</span>
                      )}
                    </td>
                    <td className="td-muted">{c.email}</td>
                    <td className="td-muted">{c.tel}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{c.reservas.length}</td>
                    <td style={{ textAlign: 'right' }}>
                      <MenuAcciones
                        cliente={c}
                        puede={puede}
                        oneditar={() => setform({ editando: c })}
                        ondetalle={() => setdetalle(c)}
                        oncredito={() => pedir_autorizar_credito(c)}
                        oneliminar={() => pedir_eliminar(c)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!cargando && ordenados.length === 0 && (
            <div id="cl-empty" style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>👤</div>
              <div style={{ fontSize: '14px' }}>
                {errores.includes('clientes')
                  ? 'No se pudo leer la tabla de clientes'
                  : busqueda
                    ? 'Sin resultados para esa búsqueda'
                    : 'Sin compras registradas en la plataforma'}
              </div>
            </div>
          )}
          {cargando && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)', fontSize: '13px' }}>
              Cargando clientes…
            </div>
          )}
        </div>
      </div>

      {abierto && (
        <ClienteDetalle
          cliente={abierto}
          pagos={pagos}
          consumos={consumos}
          tarjetas={tarjetas}
          oncerrar={() => setdetalle(null)}
        />
      )}

      <ClienteForm
        abierto={!!form}
        editando={form ? form.editando : null}
        oncerrar={() => setform(null)}
        oneditar={editar}
        guardando={guardando}
      />
      {dialogo}
    </div>
  )
}
