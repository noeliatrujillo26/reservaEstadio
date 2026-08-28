// ═══════════════════════════════════════════════════════════════════
// zonasfallback.js — zonas quemadas del mapa, copiadas textual de la v1
// (panel-inicio.html lineas 1256-1337: zonas, zonaPosiciones, zonaClases y
// zonaLabels).
//
// solo se usan si NUNCA llegan secciones: en cuanto responde
// /api/sitio?r=mapa (o el cache local), _aplicarSeccionesMapa las borra por
// completo y el mapa se arma con las secciones reales de mapa_secciones.
// ═══════════════════════════════════════════════════════════════════

export const zonas_fallback = {
  'td-1': { nombre:'Terraza Derecha 1', seccion:'Terraza Derecha', cap:64, min:20, precioPP:110, precio:'110', disponible:true, desc:'Zona elevada extremo derecho. Vista privilegiada del diamante completo y la pista de calentamiento.' },
  'td-2': { nombre:'Terraza Derecha 2', seccion:'Terraza Derecha', cap:57, min:20, precioPP:110, precio:'110', disponible:true, desc:'Sección en terraza derecha con excelente ángulo del infield y bateadores.' },
  'td-3': { nombre:'Terraza Derecha 3', seccion:'Terraza Derecha', cap:52, min:20, precioPP:110, precio:'110', disponible:true, desc:'Zona de terraza con vista frontal del diamante. Muy popular entre familias.' },
  'td-4': { nombre:'Terraza Derecha 4', seccion:'Terraza Derecha', cap:78, min:20, precioPP:115, precio:'115', disponible:true, desc:'La zona más grande de la Terraza Derecha. Ubicación central con vista panorámica del campo.' },
  'ti-7': { nombre:'Terraza Izquierda 7', seccion:'Terraza Izquierda', cap:58, min:20, precioPP:110, precio:'110', disponible:true, desc:'Zona de terraza izquierda cerca del centro. Vista directa al pitcher y al bateador.' },
  'ti-6': { nombre:'Terraza Izquierda 6', seccion:'Terraza Izquierda', cap:26, min:10, precioPP:95,  precio:'95',  disponible:true, desc:'Zona íntima de la terraza izquierda. Ideal para grupos pequeños con ambiente exclusivo.' },
  'ti-5': { nombre:'Terraza Izquierda 5', seccion:'Terraza Izquierda', cap:33, min:15, precioPP:100, precio:'100', disponible:true, desc:'Sección con excelente vista del jardín izquierdo y la pared de cuadrangulares.' },
  'ti-4': { nombre:'Terraza Izquierda 4', seccion:'Terraza Izquierda', cap:33, min:15, precioPP:100, precio:'100', disponible:true, desc:'Vista del bullpen izquierdo y el jardín. Perfecta para fans del pitcheo.' },
  'ti-3': { nombre:'Terraza Izquierda 3', seccion:'Terraza Izquierda', cap:40, min:15, precioPP:105, precio:'105', disponible:true, desc:'Zona media de la terraza izquierda. Equilibrio perfecto entre vista del campo y ambiente.' },
  'ti-2': { nombre:'Terraza Izquierda 2', seccion:'Terraza Izquierda', cap:40, min:15, precioPP:105, precio:'105', disponible:true, desc:'Excelente posición para ver las jugadas del cuadro interior desde el lado izquierdo.' },
  'ti-1': { nombre:'Terraza Izquierda 1', seccion:'Terraza Izquierda', cap:42, min:15, precioPP:105, precio:'105', disponible:true, desc:'Zona final de la terraza izquierda. Vista del jardín izquierdo y zona de calentamiento.' },
  'pd-1': { nombre:'Platea Derecha 1', seccion:'Platea Derecha', cap:50, min:15, precioPP:90, precio:'90', disponible:true, desc:'Platea lateral derecha, nivel medio. Muy cerca de la acción. Ideal para grupos medianos.' },
  'pd-2': { nombre:'Platea Derecha 2', seccion:'Platea Derecha', cap:50, min:15, precioPP:90, precio:'90', disponible:true, desc:'Segunda sección de platea derecha. Vista del jardín derecho y línea de primera base.' },
  'pi-1': { nombre:'Platea Izquierda 1', seccion:'Platea Izquierda', cap:50, min:15, precioPP:90, precio:'90', disponible:true, desc:'Platea lateral izquierda. Perspectiva única de la tercera base y el jardín izquierdo.' },
  'pi-2': { nombre:'Platea Izquierda 2', seccion:'Platea Izquierda', cap:50, min:15, precioPP:90, precio:'90', disponible:true, desc:'Segunda sección de platea izquierda. Vista del bullpen y acceso a la zona de asadores.' },
  'palco-der': { nombre:'Palco All-Inclusive Derecho', seccion:'Palco All-Inclusive', cap:60, min:20, precioPP:150, precio:'150', disponible:true, desc:'Palco premium con servicio all-inclusive. Bebidas, botanas y área VIP incluidos.' },
  'palco-izq': { nombre:'Palco All-Inclusive Izquierdo', seccion:'Palco All-Inclusive', cap:60, min:20, precioPP:150, precio:'150', disponible:true, desc:'Palco VIP lado izquierdo. Experiencia completa con servicio personalizado y vista privilegiada.' },
  'jd-a': { nombre:'Jardín Derecho A', seccion:'Jardín Derecho', cap:50, min:15, precioPP:83, precio:'83', disponible:true, desc:'Zona A del jardín derecho. Ambiente relajado con vista al outfield.' },
  'jd-b': { nombre:'Jardín Derecho B', seccion:'Jardín Derecho', cap:50, min:15, precioPP:83, precio:'83', disponible:true, desc:'Zona B del jardín derecho. Cerca de la barda donde caen los cuadrangulares.' },
  'jd-c': { nombre:'Jardín Derecho C', seccion:'Jardín Derecho', cap:50, min:15, precioPP:83, precio:'83', disponible:true, desc:'Zona C del jardín derecho. Ambiente familiar, ideal para disfrutar el asador tranquilamente.' },
  'ji-a': { nombre:'Jardín Izquierdo A', seccion:'Jardín Izquierdo', cap:50, min:15, precioPP:83, precio:'83', disponible:true, desc:'Zona A del jardín izquierdo. Vista del outfield izquierdo y la barda de cuadrangulares.' },
  'ji-b': { nombre:'Jardín Izquierdo B', seccion:'Jardín Izquierdo', cap:50, min:15, precioPP:83, precio:'83', disponible:true, desc:'Zona B del jardín izquierdo. Ambiente animado con fans del jardín.' },
  'ji-c': { nombre:'Jardín Izquierdo C', seccion:'Jardín Izquierdo', cap:30, min:10, precioPP:75, precio:'75', disponible:true, desc:'Zona C del jardín izquierdo. Ambiente tranquilo cercano al palco all-inclusive.' },
  'jc-a': { nombre:'Jardín Central A', seccion:'Jardín Central', cap:30, min:10, precioPP:70, precio:'70', disponible:true, desc:'Zona A del jardín central. Vista panorámica del campo completo desde el centro.' },
  'jc-b': { nombre:'Jardín Central B', seccion:'Jardín Central', cap:30, min:10, precioPP:70, precio:'70', disponible:true, desc:'Zona B del jardín central. La mejor vista panorámica del estadio completo.' },
  'jc-c': { nombre:'Jardín Central C', seccion:'Jardín Central', cap:30, min:10, precioPP:70, precio:'70', disponible:true, desc:'Zona C del jardín central. Vista simétrica del diamante y ambos jardines.' },
  'jc-d': { nombre:'Jardín Central D', seccion:'Jardín Central', cap:30, min:10, precioPP:70, precio:'70', disponible:true, desc:'Zona D del jardín central. Acceso directo desde la entrada del jardín.' },
};

export const zona_posiciones_fallback = {
  'td-1': [6.07,  23.52],
  'td-2': [10.26, 16.95],
  'td-3': [14.72, 11.12],
  'td-4': [19.45,  6.89],
  'ti-7': [80.55,  6.89],
  'ti-6': [85.28, 11.12],
  'ti-5': [89.65, 15.68],
  'ti-4': [92.95, 20.87],
  'ti-3': [95.09, 26.27],
  'ti-2': [96.16, 31.99],
  'ti-1': [96.34, 37.92],
  'pd-1': [ 8.92, 38.98],
  'pd-2': [ 8.92, 44.49],
  'pi-1': [90.81, 38.98],
  'pi-2': [90.81, 44.49],
  'palco-der': [27.65, 54.03],
  'palco-izq': [72.08, 54.03],
  'jd-a': [22.12, 68.11],
  'jd-b': [17.22, 73.09],
  'jd-c': [13.20, 77.75],
  'ji-a': [77.43, 68.11],
  'ji-b': [82.16, 73.09],
  'ji-c': [86.17, 77.75],
  'jc-a': [36.40, 90.57],
  'jc-b': [41.57, 91.31],
  'jc-c': [47.28, 91.31],
  'jc-d': [52.99, 90.57],
};

export const zona_clases = {
  'td-1':'btn-terraza-der','td-2':'btn-terraza-der','td-3':'btn-terraza-der','td-4':'btn-terraza-der',
  'ti-7':'btn-terraza-izq','ti-6':'btn-terraza-izq','ti-5':'btn-terraza-izq','ti-4':'btn-terraza-izq','ti-3':'btn-terraza-izq','ti-2':'btn-terraza-izq','ti-1':'btn-terraza-izq',
  'pd-1':'btn-platea','pd-2':'btn-platea',
  'pi-1':'btn-platea','pi-2':'btn-platea',
  'palco-der':'btn-palco','palco-izq':'btn-palco',
  'jd-a':'btn-jardin','jd-b':'btn-jardin','jd-c':'btn-jardin',
  'ji-a':'btn-jardin','ji-b':'btn-jardin','ji-c':'btn-jardin',
  'jc-a':'btn-jardin-cen','jc-b':'btn-jardin-cen','jc-c':'btn-jardin-cen','jc-d':'btn-jardin-cen',
};

export const zona_labels = {
  'td-1':'1','td-2':'2','td-3':'3','td-4':'4',
  'ti-7':'7','ti-6':'6','ti-5':'5','ti-4':'4','ti-3':'3','ti-2':'2','ti-1':'1',
  'pd-1':'1','pd-2':'2','pi-1':'1','pi-2':'2',
  'palco-der':'60','palco-izq':'60',
  'jd-a':'A','jd-b':'B','jd-c':'C',
  'ji-a':'A','ji-b':'B','ji-c':'C',
  'jc-a':'A','jc-b':'B','jc-c':'C','jc-d':'D',
};
