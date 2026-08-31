// ═══════════════════════════════════════════════════════════════════
// areasdata.js — catalogo de zonas del estadio con su capacidad.
// copiado VERBATIM de const areasData (js/modules/precios-mapa.js de la v1).
//
// el `estado` de cada zona es solo el valor inicial: la v1 lo sobrescribe con
// lo que devuelve la tabla `areas`, y los estados POR JUEGO salen de
// zona_juego_estado. El dashboard usa `nombre` para agrupar por categoria y
// `id` para cruzar contra esos estados.
// ═══════════════════════════════════════════════════════════════════

export const areas_data = [
  {id:'td-1',nombre:'Terraza Derecha 1',cap:64,estado:'libre'},
  {id:'td-2',nombre:'Terraza Derecha 2',cap:57,estado:'libre'},
  {id:'td-3',nombre:'Terraza Derecha 3',cap:52,estado:'libre'},
  {id:'td-4',nombre:'Terraza Derecha 4',cap:78,estado:'libre'},
  {id:'ti-7',nombre:'Terraza Izquierda 7',cap:58,estado:'libre'},
  {id:'ti-6',nombre:'Terraza Izquierda 6',cap:26,estado:'libre'},
  {id:'ti-5',nombre:'Terraza Izquierda 5',cap:33,estado:'libre'},
  {id:'ti-4',nombre:'Terraza Izquierda 4',cap:33,estado:'libre'},
  {id:'ti-3',nombre:'Terraza Izquierda 3',cap:40,estado:'libre'},
  {id:'ti-2',nombre:'Terraza Izquierda 2',cap:40,estado:'libre'},
  {id:'ti-1',nombre:'Terraza Izquierda 1',cap:42,estado:'libre'},
  {id:'pd-1',nombre:'Platea Derecha 1',cap:50,estado:'libre'},
  {id:'pd-2',nombre:'Platea Derecha 2',cap:50,estado:'libre'},
  {id:'pi-1',nombre:'Platea Izquierda 1',cap:50,estado:'libre'},
  {id:'pi-2',nombre:'Platea Izquierda 2',cap:50,estado:'libre'},
  {id:'palco-der',nombre:'Palco All-Inc. Derecho',cap:60,estado:'libre'},
  {id:'palco-izq',nombre:'Palco All-Inc. Izquierdo',cap:60,estado:'libre'},
  {id:'jd-a',nombre:'Jardín Derecho A',cap:50,estado:'libre'},
  {id:'jd-b',nombre:'Jardín Derecho B',cap:50,estado:'libre'},
  {id:'jd-c',nombre:'Jardín Derecho C',cap:50,estado:'libre'},
  {id:'ji-a',nombre:'Jardín Izquierdo A',cap:50,estado:'libre'},
  {id:'ji-b',nombre:'Jardín Izquierdo B',cap:50,estado:'libre'},
  {id:'ji-c',nombre:'Jardín Izquierdo C',cap:30,estado:'libre'},
  {id:'jc-a',nombre:'Jardín Central A',cap:30,estado:'libre'},
  {id:'jc-b',nombre:'Jardín Central B',cap:30,estado:'libre'},
  {id:'jc-c',nombre:'Jardín Central C',cap:30,estado:'libre'},
  {id:'jc-d',nombre:'Jardín Central D',cap:30,estado:'libre'},
]

export default areas_data
