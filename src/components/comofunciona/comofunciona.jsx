// ═══════════════════════════════════════════════════════════════════
// comofunciona.jsx — seccion "Reserva en 4 pasos".
// espejo 1:1 de v1: <div id="como-funciona"> de panel-inicio.html
// (lineas 790-802).
//
// el porcentaje del paso 4 es el unico dato dinamico: sale de politica_pagos
// igual que en _aplicarPoliticaEnganche(), y mientras no llega se ve
// atenuado con la clase .pct-pending.
// ═══════════════════════════════════════════════════════════════════

import uselandingconfig from '../../hooks/uselandingconfig'

const pasos = [
  {
    num: 1,
    titulo: 'Crea tu cuenta',
    desc: 'Regístrate con tu nombre, email y teléfono. Solo la primera vez.',
  },
  {
    num: 2,
    titulo: 'Elige el juego',
    desc: 'Selecciona el partido de tu preferencia del calendario de la temporada.',
  },
  {
    num: 3,
    titulo: 'Selecciona tu zona',
    desc: 'Elige una de las 27 zonas en el mapa interactivo del estadio.',
  },
  { num: 4, titulo: 'Paga y confirma', desc: null }, // texto propio: lleva el %
]

export default function comofunciona() {
  const { politica, cargandopolitica } = uselandingconfig()

  return (
    <div id="como-funciona" style={{ background: '#F0EDE6', padding: '64px 0' }}>
      <div className="section" style={{ paddingTop: 0, paddingBottom: 0 }}>
        <div className="section-title">Reserva en 4 pasos</div>
        <p className="section-sub" style={{ marginBottom: '32px' }}>
          Rápido, seguro y desde cualquier dispositivo.
        </p>
        <div className="pasos-grid">
          {pasos.map((p) => (
            <div className="paso" key={p.num}>
              <div className="paso-num">{p.num}</div>
              <div className="paso-titulo">{p.titulo}</div>
              <p className="paso-desc">
                {p.desc || (
                  <>
                    Paga el 100% o un enganche del{' '}
                    <span
                      id="txt-pct-paso4"
                      className={cargandopolitica ? 'pct-pending' : undefined}
                    >
                      {cargandopolitica ? '…' : politica.enganche_minimo}
                    </span>
                    %. Recibes confirmación por email.
                  </>
                )}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
