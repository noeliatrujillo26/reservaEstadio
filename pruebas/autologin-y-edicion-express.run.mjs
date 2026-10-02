// ═══════════════════════════════════════════════════════════════════
// autologin-y-edicion-express.run.mjs — corrección integral del 04 oct
// 2026: (1) editar_reserva_express() ya no se cae con "La escritura del
// panel está desactivada en esta versión", y (3) autologin desde el
// enlace del correo en /mis-reservas.
//
// Dos bloques, dos técnicas distintas (y ambas con un límite real, no
// fingido):
//   a) leer_autologin_de_url() es PURA (sin React, sin fetch) — se corre
//      directo con Node, sin compilar nada.
//   b) editar_reserva_express() es un useCallback DENTRO de un hook de
//      React que depende de 3 contextos (useadmin/useadmindatos/useto
//      ast) y hace llamadas async a Supabase — no hay manera honesta de
//      ejecutarlo end-to-end sin un DOM real y sin tocar una base (este
//      proyecto no trae react-test-renderer ni mocks de hooks). Lo que SÍ
//      se puede verificar, y es la regresión real que importa, es que su
//      CÓDIGO FUENTE usa las funciones de escritura SIN candado
//      (actualizar_directo/bloquear_zona_directo, ya usadas por
//      crear_express en el mismo archivo) y NO las versiones gateadas por
//      VITE_ESCRITURA_ADMIN — que es exactamente lo que causaba el error.
// ═══════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { leer_autologin_de_url } from '../src/lib/autologinportal.js'

let ok = 0, fail = 0
function check(nombre, cond, extra) {
  if (cond) { ok++; console.log('  ✅ ' + nombre) }
  else { fail++; console.log('  ❌ ' + nombre + (extra != null ? ' — ' + JSON.stringify(extra) : '')) }
}

console.log('─── a) Autologin desde el enlace del correo (?folio=&email=) ───')
{
  const r1 = leer_autologin_de_url('?folio=RES-042&email=juan%40correo.com')
  check('Folio y email presentes: los regresa decodificados', r1.folio === 'RES-042' && r1.email === 'juan@correo.com', r1)

  const r2 = leer_autologin_de_url('?folio=042')
  check('Solo folio (sin email): NO dispara autologin a medias (los dos vacíos)',
    r2.folio === '' && r2.email === '', r2)

  const r3 = leer_autologin_de_url('?email=juan%40correo.com')
  check('Solo email (sin folio): tampoco', r3.folio === '' && r3.email === '', r3)

  const r4 = leer_autologin_de_url('')
  check('Sin query string: vacío, sin reventar', r4.folio === '' && r4.email === '', r4)

  const r5 = leer_autologin_de_url('?folio=  042  &email=  juan@correo.com  ')
  check('Espacios sueltos: se recortan', r5.folio === '042' && r5.email === 'juan@correo.com', r5)

  const r6 = leer_autologin_de_url('?folio=&email=juan@correo.com')
  check('Folio vacío explícito (folio=): tampoco dispara nada', r6.folio === '' && r6.email === '', r6)

  // Otros parámetros en la URL (utm_source, etc.) no deben estorbar.
  const r7 = leer_autologin_de_url('?utm_source=correo&folio=RES-7&email=a@b.com&utm_medium=email')
  check('Otros parámetros de la URL no interfieren', r7.folio === 'RES-7' && r7.email === 'a@b.com', r7)
}

console.log('\n─── b) Enlace del correo YA manda ?folio=&email= (api/_lib/reciboEmail.js) ───')
{
  const src = readFileSync('api/_lib/reciboEmail.js', 'utf8')
  check('El enlace "Consultar mi reserva en línea" incluye ?folio=',
    /\/mis-reservas\?folio=.*encodeURIComponent\(reserva\.id\)/.test(src), 'no se encontró el patrón')
  check('...y &email= con el correo de la reserva, también encodeURIComponent',
    /email=.*encodeURIComponent\(reserva\.email/.test(src), 'no se encontró el patrón')
}

console.log('\n─── c) editar_reserva_express() NO pasa por el candado de escritura del panel ───')
{
  const src = readFileSync('src/hooks/usereservaexpress.js', 'utf8')
  const inicio = src.indexOf('const editar_reserva_express = useCallback(')
  check('La función existe en usereservaexpress.js', inicio >= 0)

  // Se recorta el bloque de la función (hasta el cierre del useCallback
  // que le sigue, "COMPARTIR EL TICKET") para no quedar mirando el resto
  // del archivo por accidente.
  const fin = src.indexOf('COMPARTIR EL TICKET', inicio)
  const cuerpo = inicio >= 0 && fin > inicio ? src.slice(inicio, fin) : ''

  check('Usa actualizar_directo() (sin candado) para escribir en `reservas`',
    cuerpo.includes('actualizar_directo('))
  check('Usa bloquear_zona_directo() (sin candado) para el cambio de sección',
    cuerpo.includes('bloquear_zona_directo('))
  check('NO llama a actualizar_verificado() — esa SÍ exige VITE_ESCRITURA_ADMIN',
    !cuerpo.includes('actualizar_verificado('))
  check('NO llama a set_estado_zona() — esa SÍ exige VITE_ESCRITURA_ADMIN',
    !cuerpo.includes('set_estado_zona('))
  check('NO llama a motivo_bloqueo() directamente tampoco',
    !cuerpo.includes('motivo_bloqueo('))
  check('Sigue llamando recargar() — el Panel Admin ve el cambio de inmediato',
    cuerpo.includes('recargar()'))
}

console.log('\n─── d) verreservas.jsx guarda con editar_reserva_express(), no con el hook gateado ───')
{
  const src = readFileSync('src/components/reservaexpress/verreservas.jsx', 'utf8')
  check('Importa usereservaexpress (no usereservasescritura)',
    src.includes("from '../../hooks/usereservaexpress'") && !src.includes("from '../../hooks/usereservasescritura'"))
  check('guardarcambios() llama a editar_reserva_express(...)', src.includes('editar_reserva_express('))
}

console.log('\nResultado: ' + ok + ' ✅ / ' + fail + ' ❌')
process.exit(fail ? 1 : 0)
