// ═══════════════════════════════════════════════════════════════════
// usemovimientos.js — paginacion de movimientos contra supabase.
// espejo de v1: cargarMovimientosPagina(), onFiltrarMovimientos() y
// paginaMovimientos() (js/30-init.js).
//
// Se pagina en el SERVIDOR con .range() y count:'exact', no en memoria: el
// techo viejo de 200 filas hacia que los movimientos antiguos parecieran
// borrados cuando solo dejaban de traerse.
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { sb } from '../supabaseclient'
import { consulta_movimientos, map_movimiento, mov_por_pagina } from '../lib/movimientos'

export function usemovimientos() {
  const [filtros, setfiltros] = useState({ q: '', tipo: '', desde: '', hasta: '' })
  const [pagina, setpagina] = useState(1)
  const [filas, setfilas] = useState([])
  const [total, settotal] = useState(0)
  const [cargando, setcargando] = useState(true)
  const [error, seterror] = useState('')

  useEffect(() => {
    let vivo = true
    setcargando(true)
    consulta_movimientos(sb, filtros, pagina)
      .then((res) => {
        if (!vivo) return
        if (res.error) throw res.error
        settotal(typeof res.count === 'number' ? res.count : (res.data || []).length)
        setfilas((res.data || []).map(map_movimiento))
        seterror('')
      })
      .catch((e) => {
        if (!vivo) return
        console.error('Movimientos:', e)
        seterror(e.message || 'No se pudieron cargar los movimientos.')
        setfilas([])
        settotal(0)
      })
      .finally(() => { if (vivo) setcargando(false) })
    return () => { vivo = false }
  }, [filtros, pagina])

  // cambiar un filtro vuelve a la pagina 1: quedarse en la 7 de un resultado
  // que ahora tiene 2 paginas muestra una tabla vacia sin explicar por que.
  const cambiar_filtros = useCallback((parche) => {
    setfiltros((f) => ({ ...f, ...parche }))
    setpagina(1)
  }, [])

  const totalpaginas = Math.max(1, Math.ceil(total / mov_por_pagina))

  const mover = useCallback(
    (delta) => {
      setpagina((p) => {
        const destino = p + delta
        if (destino < 1 || destino > Math.max(1, Math.ceil(total / mov_por_pagina))) return p
        return destino
      })
    },
    [total]
  )

  return { filtros, cambiar_filtros, pagina, totalpaginas, total, filas, cargando, error, mover }
}

export default usemovimientos
