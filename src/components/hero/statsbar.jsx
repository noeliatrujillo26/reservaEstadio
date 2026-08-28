// ═══════════════════════════════════════════════════════════════════
// statsbar.jsx — barra naranja de 4 cifras bajo el hero.
// espejo 1:1 de v1: panel-inicio.html lineas 605-610 (<div class="stats-bar">).
//
// la segunda cifra es especial: en el html arranca como "…%" con la clase
// .pct-pending (opacidad .35) y la rellena _aplicarPoliticaEnganche() con el
// enganche minimo real de la tabla politica_pagos, quitando esa clase. aqui
// pasa lo mismo: mientras la consulta no responde se ve "…%" atenuado.
//
// las otras tres cifras salen del cache 'nrj_landing' si el admin las edito,
// o de los valores del html original.
// ═══════════════════════════════════════════════════════════════════

import uselandingconfig from '../../hooks/uselandingconfig'

export default function statsbar() {
  const { stats, politica, cargandopolitica } = uselandingconfig()

  return (
    <div className="stats-bar">
      {stats.map((s, i) => {
        // indice 1 = enganche minimo: valor y estado pendiente vienen de politica_pagos.
        const es_enganche = i === 1 && s.num == null
        const pendiente = es_enganche && cargandopolitica
        const texto = es_enganche ? (pendiente ? '…%' : politica.enganche_minimo + '%') : s.num

        return (
          <div className="stat-item" key={i}>
            <span
              className={'stat-num' + (pendiente ? ' pct-pending' : '')}
              id={'stat-num-' + i}
            >
              {texto}
            </span>
            <span className="stat-label" id={'stat-lbl-' + i}>{s.lbl}</span>
          </div>
        )
      })}
    </div>
  )
}
