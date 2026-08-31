// ═══════════════════════════════════════════════════════════════════
// vistareserva.jsx — vista principal del portal: detalles, estado de pago,
// ayuda, beneficios e invitados.
// espejo 1:1 de v1: #view-reserva del html (lineas 252-325) y el render()
// que lo rellena (lineas 905-975).
//
// SOLO LECTURA en esta fase: "Pagar saldo", "Agregar invitado" y el codigo de
// referido escriben en produccion, asi que quedan inhabilitados hasta que se
// active VITE_ESCRITURA_PORTAL (y, para el saldo, la pasarela de pagos).
// ═══════════════════════════════════════════════════════════════════

import useportal from '../../hooks/useportal'
import { money } from '../../lib/reservas'

export default function vistareserva() {
  const { actual: r, escritura_portal } = useportal()

  if (!r) return null

  const due = r.porpagar
  const pct = r.total > 0 ? Math.min(100, Math.round((r.pagado / r.total) * 100)) : 0

  const estado_pago_label = r.cubiertaconcredito
    ? 'Cubierta con crédito'
    : r.estadopago === 'pagado'
      ? 'Pago completo'
      : r.estadopago === 'parcial'
        ? 'Pago parcial'
        : 'Pendiente de pago'

  // el mensaje de whatsapp lleva el folio para que soporte lo ubique al instante.
  const wa_help =
    'https://wa.me/526621195169?text=' +
    encodeURIComponent('Necesito ayuda con mi reserva #' + r.id)

  // mismo arbol de decision del boton de saldo que la v1.
  let texto_pago = 'Reserva liquidada'
  if (due > 0 && r.estado === 'activa') texto_pago = 'Pagar saldo - ' + money(due)
  else if (due > 0) texto_pago = 'Reserva cancelada'
  else if (r.cubiertaconcredito) texto_pago = 'Saldo cubierto con crédito'

  return (
    <div id="view-reserva">
      <div className="orders-head">
        <div>
          <h1 className="page-title">Mis reservas</h1>
          <p className="page-sub">Consulta tu reserva actual o revisa tu historial.</p>
        </div>
      </div>

      <p id="resTitle" style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ink)', marginBottom: '24px' }}>
        {r.partido}{' '}
        <span style={{ color: 'var(--muted)', fontWeight: 600, fontSize: '14px' }}>#{r.id}</span>
      </p>

      <div className="grid">
        <section className="card">
          <h4>Detalles de la reserva</h4>
          <div id="detalles">
            <div className="row"><span className="k">Seccion</span><span className="v">{r.seccion}</span></div>
            <div className="row">
              <span className="k">Personas</span>
              <span className="v">
                {r.personas} lugares
                {r.adultos || r.ninos ? ' (' + r.adultos + ' adultos, ' + r.ninos + ' niños)' : ''}
              </span>
            </div>
            <div className="row"><span className="k">Titular</span><span className="v">{r.cliente}</span></div>
            {r.descuento > 0 && (
              <div className="row">
                <span className="k">Descuento aplicado</span>
                <span className="v" style={{ color: 'var(--green)' }}>-{money(r.descuento)}</span>
              </div>
            )}
            {r.credito > 0 && (
              <div className="row">
                <span className="k">A crédito</span>
                <span className="v" style={{ color: 'var(--orange,#F15A22)' }}>{money(r.credito)}</span>
              </div>
            )}
            <div className="row"><span className="k">Metodo de pago</span><span className="v">{r.metodo}</span></div>
            <div className="row"><span className="k">Estado</span><span className="v">{estado_pago_label}</span></div>
          </div>
        </section>

        <section className="card">
          <h4>Estado de pago</h4>
          <div className="amounts">
            <div className="amount">
              <div className="lbl">Pagado</div>
              <div className="val paid" id="pagado">{money(r.pagado)}</div>
            </div>
            <div className="amount">
              <div className="lbl">Por pagar</div>
              <div className="val due" id="porpagar">{money(due)}</div>
            </div>
          </div>
          <div className="bar"><div id="barfill" style={{ width: pct + '%' }} /></div>
          <div className="bar-note" id="barnote">
            {pct}% liquidado - Total {money(r.total)}
            {r.credito > 0 ? ' (incluye ' + money(r.credito) + ' a crédito)' : ''}
          </div>
          <button className="pay-btn" id="payBtn" disabled>{texto_pago}</button>
          <div className="pay-history" id="payHistory">
            {r.pagos.length > 0 && (
              <>
                <h5>Historial de pagos</h5>
                {r.pagos.map((p, i) => (
                  <div className="pay-row" key={i}>
                    <span className="pd">
                      {[p.escredito ? 'Crédito' : 'Pago ' + (i + 1), p.fecha, p.metodo]
                        .filter(Boolean)
                        .join(' · ')}
                      {p.escredito && (
                        <span style={{ color: 'var(--orange,#F15A22)', fontWeight: 600 }}>
                          {' '}· pendiente de cobro
                        </span>
                      )}
                    </span>
                    <span className="pm">{money(p.monto)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </section>
      </div>

      {/* Soporte por WhatsApp: el folio viaja en el mensaje */}
      <section className="card" id="ayudaCard" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px', border: '1.5px solid #C9EBD4', background: '#F2FBF5' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <h4 style={{ marginBottom: '4px' }}>¿Necesitas ayuda con tu reserva?</h4>
          <p className="msub" style={{ margin: 0 }}>Nuestro equipo te responde por WhatsApp.</p>
        </div>
        <a
          id="waHelpBtn" href={wa_help} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', background: '#25D366', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: '14px', padding: '12px 20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(37,211,102,0.35)', whiteSpace: 'nowrap' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Ayuda por WhatsApp
        </a>
      </section>

      <section className="card">
        <h4>Beneficios incluidos</h4>
        <div className="benefits" id="beneficios">
          {r.beneficios.length ? (
            r.beneficios.map((b, i) => (
              <div className="benefit-item" key={i}>
                <span className="check">&#10003;</span>
                <span>{b}</span>
              </div>
            ))
          ) : (
            <div className="benefits-empty">
              Esta reserva no tiene beneficios adicionales registrados.
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="guests-head">
          <h4>Invitados de tu reserva</h4>
          <button className="add-btn" id="addBtn" disabled>+ Agregar invitado</button>
        </div>
        {!escritura_portal && (
          <div className="guest-hint">
            Consulta de solo lectura: la edición de invitados se habilitará más adelante.
          </div>
        )}
        <div className="guests" id="guests">
          {r.invitados.map((g, i) => {
            const vacio = !g.nombre
            const contacto = [g.correo, g.celular].filter(Boolean).join('  ·  ')
            return (
              <div className={'guest' + (vacio ? ' empty' : '')} key={i}>
                <span className="seat">{g.asiento}</span>
                <span className="body">
                  <div className="name" style={vacio ? { color: 'var(--muted)' } : undefined}>
                    {vacio ? 'Asiento libre' : g.nombre}
                  </div>
                  <div className="state">{vacio ? 'Disponible para asignar' : contacto || g.estado}</div>
                </span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
