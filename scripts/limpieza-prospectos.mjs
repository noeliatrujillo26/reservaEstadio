#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// limpieza-prospectos.mjs — limpieza CONTROLADA de prospectos creados por
// una importacion accidental.
//
// Corre en DOS FASES SEPARADAS a proposito — nunca identifica y borra en la
// misma corrida:
//
//   1) PREVIEW (por defecto, no toca nada):
//        node scripts/limpieza-prospectos.mjs --desde "2026-09-04T18:00:00Z" --hasta "2026-09-04T19:00:00Z"
//      Busca en `pipeline_prospectos` por su columna `created_at` REAL de la
//      base (no `etapa_cambiada_en`, que la importacion pudo o no haber
//      llenado). Separa los candidatos en dos grupos:
//        SEGUROS   — sin reservas vinculadas y sin ningun cobro (ni siquiera
//                    cancelado) enlazado a su folio/id. Basura pura de
//                    importacion, sin huella de dinero.
//        REVISAR   — cualquier cosa con una reserva o un cobro enlazado.
//                    Esta corrida NUNCA los toca, en ningun modo: si algo de
//                    dinero real quedo pegado a un prospecto de la
//                    importacion, merece que una persona lo mire, no un
//                    borrado automatico en lote.
//      Escribe un archivo candidatos-limpieza-<fecha>.json con la lista
//      EXACTA de ids "seguros" — ese archivo es la fuente de verdad para el
//      paso 2, la ventana de tiempo NO se vuelve a usar.
//
//   2) CONFIRMAR (borra, pide confirmacion explicita):
//        node scripts/limpieza-prospectos.mjs --confirmar candidatos-limpieza-2026-09-04T183000.json
//      Relee CADA id del archivo, lo vuelve a verificar UNO POR UNO contra la
//      base en vivo (por si algo cambio entre el preview y ahora — si un
//      humano le agrego una reserva o registro un cobro en medio, esa fila se
//      SALTA con aviso, nunca se fuerza) y solo entonces:
//        - cancela (nunca borra) cualquier cobro que de verdad siga enlazado
//          (deberia ser ninguno, es la ultima red de seguridad)
//        - borra la fila de pipeline_prospectos
//        - deja un movimiento en la bitacora (`movimientos`) por cada una
//      Pide "si" escrito a mano antes de tocar la base, ademas de la
//      confirmacion de la linea de comandos.
//
// Usa LAS MISMAS funciones auditadas que useprospectos.js llama para su
// propio "eliminar" (ver scripts/limpieza-bridge.js) — la misma cascada seria
// que ya corre miles de veces en produccion desde la app, no una nueva
// escrita a mano para esta emergencia.
//
// Requiere iniciar sesion como un usuario real con rol Administrador: las
// politicas RLS de la base son la autoridad final, este script no las
// evade.
// ═══════════════════════════════════════════════════════════════════

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { createClient } from '@supabase/supabase-js'

// ── argumentos ────────────────────────────────────────────────────
const argv = process.argv.slice(2)
function arg(nombre) {
  const i = argv.indexOf('--' + nombre)
  return i >= 0 ? argv[i + 1] : null
}
const modoconfirmar = argv.includes('--confirmar')
const archivoconfirmar = modoconfirmar ? arg('confirmar') : null
const desde = arg('desde')
const hasta = arg('hasta')

if (!modoconfirmar && (!desde || !hasta)) {
  console.log('Uso:')
  console.log('  Preview:   node scripts/limpieza-prospectos.mjs --desde <ISO> --hasta <ISO>')
  console.log('  Confirmar: node scripts/limpieza-prospectos.mjs --confirmar <archivo.json>')
  console.log('')
  console.log('Ejemplo de fecha ISO: 2026-09-04T18:00:00Z')
  process.exit(1)
}

// ── .env (sin dependencias externas) ────────────────────────────────
function leer_env(clave) {
  const texto = readFileSync('.env', 'utf8')
  const m = texto.match(new RegExp('^' + clave + '=(.*)$', 'm'))
  return m ? m[1].trim() : null
}
const supabase_url = leer_env('VITE_SUPABASE_URL')
const supabase_anon_key = leer_env('VITE_SUPABASE_ANON_KEY')
if (!supabase_url || !supabase_anon_key) {
  console.log('FALLA: faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env')
  process.exit(1)
}

// ── compila el puente con vite --ssr, igual que pruebas/cascadas.run.mjs ──
const build = spawnSync(
  'npx',
  ['vite', 'build', '--ssr', 'scripts/limpieza-bridge.js', '--outDir', 'scripts/out-limpieza', '--logLevel', 'error'],
  { stdio: 'inherit', shell: true, env: { ...process.env, VITE_ESCRITURA_ADMIN: 'true' } }
)
if (build.status !== 0) {
  console.log('FALLA la compilacion del puente')
  process.exit(1)
}
const lib = await import('./out-limpieza/limpieza-bridge.js')

// ── prompts de terminal (sin dependencias externas) ─────────────────
function preguntar(texto) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(texto, (r) => { rl.close(); resolve(r) }))
}

// enmascara la contraseña con * mientras se escribe. Si stdin no es una TTY
// (input redirigido) cae al prompt normal en vez de fallar.
function preguntar_password(texto) {
  if (!process.stdin.isTTY) return preguntar(texto)
  return new Promise((resolve) => {
    process.stdout.write(texto)
    let valor = ''
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    const onData = (char) => {
      if (char === '\r' || char === '\n') {
        process.stdin.setRawMode(false)
        process.stdin.removeListener('data', onData)
        process.stdout.write('\n')
        resolve(valor)
      } else if (char === '') { // Ctrl+C
        process.exit(1)
      } else if (char === '' || char === '') { // backspace
        if (valor.length) { valor = valor.slice(0, -1); process.stdout.write('\b \b') }
      } else {
        valor += char
        process.stdout.write('*')
      }
    }
    process.stdin.on('data', onData)
  })
}

async function iniciar_sesion(sb) {
  console.log('── Inicia sesión con una cuenta con rol Administrador ──')
  const email = await preguntar('Correo: ')
  const password = await preguntar_password('Contraseña: ')
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    console.log('FALLA el inicio de sesión:', error ? error.message : 'sin usuario')
    process.exit(1)
  }
  console.log('Sesión iniciada como ' + email + '\n')
  return { nombre: email, rol: 'Administrador', permisos: {} }
}

const sb = createClient(supabase_url, supabase_anon_key)

// ── FASE 1: PREVIEW ──────────────────────────────────────────────
async function fase_preview() {
  // el preview solo LEE, pero se pide sesion de todos modos: los nombres,
  // correos y telefonos de los prospectos son datos sensibles y no deberian
  // verse con solo la llave anonima.
  await iniciar_sesion(sb)

  console.log('Buscando prospectos con created_at entre ' + desde + ' y ' + hasta + ' …\n')
  const rprospectos = await sb.from('pipeline_prospectos').select('*')
    .gte('created_at', desde).lt('created_at', hasta)
  if (rprospectos.error) {
    console.log('FALLA la consulta:', rprospectos.error.message)
    process.exit(1)
  }
  const filas = rprospectos.data || []

  if (!filas.length) {
    console.log('0 prospectos encontrados en esa ventana.\n')
    console.log('Diagnóstico — los 10 más recientes por created_at, para confirmar que la')
    console.log('columna existe y trae datos (por si la ventana de tiempo está mal):')
    const rdiag = await sb.from('pipeline_prospectos').select('id, folio, nombre, created_at')
      .order('created_at', { ascending: false }).limit(10)
    if (rdiag.error) console.log('  (no se pudo leer ni el diagnóstico: ' + rdiag.error.message + ')')
    else (rdiag.data || []).forEach((r) => console.log('  ' + r.id + ' · ' + (r.folio || '—') + ' · ' + (r.nombre || '—') + ' · ' + r.created_at))
    process.exit(0)
  }

  const cards = filas.map(lib.map_prospecto)
  const todosfolios = [...new Set(cards.flatMap((c) => lib.folios_de_prospecto(c)))]
  const rcobros = todosfolios.length
    ? await sb.from('cobros').select('id, folio, estado, monto, concepto').in('folio', todosfolios)
    : { data: [] }
  const cobros = rcobros.data || []

  const seguros = []
  const revisar = []
  cards.forEach((card) => {
    const folios = lib.folios_de_prospecto(card)
    const cobrosligados = cobros.filter((c) => folios.indexOf(String(c.folio || '')) >= 0)
    const tienereservas = (card.reservaids || []).length > 0
    if (tienereservas || cobrosligados.length) {
      revisar.push({ card, cobrosligados, tienereservas })
    } else {
      seguros.push(card)
    }
  })

  console.log('══ RESULTADO DEL PREVIEW ══════════════════════════════════')
  console.log('Total encontrados en la ventana: ' + cards.length)
  console.log('  SEGUROS para borrar (sin reserva ni cobro enlazado): ' + seguros.length)
  console.log('  REQUIEREN REVISIÓN MANUAL (tienen reserva y/o cobro):  ' + revisar.length)
  console.log('')

  if (seguros.length) {
    console.log('── SEGUROS ──')
    seguros.forEach((c) => {
      console.log('  ' + c.id + ' · ' + (c.folio || '—') + ' · ' + (c.nombre || '—') +
        ' · ' + (c.email || '—') + ' · ' + (c.tel || '—') + ' · etapa=' + c.etapa +
        ' · vendedora=' + (c.vendedora || '—') + ' · monto=' + c.monto +
        ' · creado=' + (filas.find((f) => f.id === c.id)?.created_at || '—'))
    })
    console.log('')
  }
  if (revisar.length) {
    console.log('── REQUIEREN REVISIÓN MANUAL (este script NO los toca) ──')
    revisar.forEach(({ card, cobrosligados, tienereservas }) => {
      console.log('  ' + card.id + ' · ' + (card.folio || '—') + ' · ' + (card.nombre || '—') +
        (tienereservas ? ' · TIENE RESERVA(S): ' + card.reservaids.join(', ') : '') +
        (cobrosligados.length ? ' · ' + cobrosligados.length + ' cobro(s) enlazado(s) ($' +
          cobrosligados.reduce((s, x) => s + (Number(x.monto) || 0), 0) + ')' : ''))
    })
    console.log('\n  Estas filas se eliminan a mano desde el panel (Pipeline → tarjeta →')
    console.log('  Eliminar), que ya pide contraseña y motivo y hace la cascada completa.\n')
  }

  if (!seguros.length) {
    console.log('Nada que pase a la fase de confirmación — no se escribió ningún archivo.')
    process.exit(0)
  }

  const nombrearchivo = 'scripts/candidatos-limpieza-' +
    new Date().toISOString().replace(/[:.]/g, '') + '.json'
  writeFileSync(nombrearchivo, JSON.stringify({
    generado: new Date().toISOString(),
    desde, hasta,
    seguros: seguros.map((c) => ({
      id: c.id, folio: c.folio, nombre: c.nombre,
      creado: filas.find((f) => f.id === c.id)?.created_at || null,
    })),
  }, null, 2))
  console.log('Lista de candidatos SEGUROS guardada en: ' + nombrearchivo)
  console.log('\nRevísala tú mismo (ábrela y lee cada fila) y, si todo se ve correcto:')
  console.log('  node scripts/limpieza-prospectos.mjs --confirmar ' + nombrearchivo)
}

// ── FASE 2: CONFIRMAR (borra) ────────────────────────────────────
async function fase_confirmar() {
  const contenido = JSON.parse(readFileSync(archivoconfirmar, 'utf8'))
  const candidatos = contenido.seguros || []
  if (!candidatos.length) {
    console.log('El archivo no trae candidatos. Nada que hacer.')
    process.exit(0)
  }

  console.log('Archivo: ' + archivoconfirmar + ' (generado ' + contenido.generado + ')')
  console.log(candidatos.length + ' candidato(s) guardado(s) en el preview:\n')
  candidatos.forEach((c) => console.log('  ' + c.id + ' · ' + (c.folio || '—') + ' · ' + (c.nombre || '—')))

  const respuesta = await preguntar(
    '\n¿Confirmas eliminar EXACTAMENTE estos ' + candidatos.length +
    ' prospecto(s)? Esta acción NO se puede deshacer. Escribe "si" para continuar: '
  )
  if (respuesta.trim().toLowerCase() !== 'si') {
    console.log('Cancelado. No se borró nada.')
    process.exit(0)
  }

  const usuario = await iniciar_sesion(sb)

  let borrados = 0
  let saltados = 0
  const avisos = []

  for (const cand of candidatos) {
    // Re-verificacion UNO POR UNO contra la base en vivo — nunca se confia
    // ciegamente en la foto del preview.
    const rfila = await sb.from('pipeline_prospectos').select('*').eq('id', cand.id).maybeSingle()
    if (rfila.error || !rfila.data) {
      console.log('  ⏭  ' + cand.id + ' ya no existe — se salta.')
      saltados++
      continue
    }
    const card = lib.map_prospecto(rfila.data)
    const tienereservas = (card.reservaids || []).length > 0
    const folios = lib.folios_de_prospecto(card)
    const rcobros = await sb.from('cobros').select('id, folio, estado, monto').in('folio', folios)
    const cobrosligados = (rcobros.data || [])
    if (tienereservas || cobrosligados.length || !lib.puede_eliminarse(card)) {
      console.log('  ⏭  ' + cand.id + ' CAMBIÓ desde el preview (ahora tiene reserva/cobro/estado protegido) — se salta, revísalo a mano.')
      saltados++
      continue
    }

    const bloqueo = lib.motivo_bloqueo(usuario, 'pipeline_prospectos')
    if (bloqueo) {
      console.log('FALLA de permisos: ' + lib.mensajes_bloqueo[bloqueo])
      process.exit(1)
    }

    const res = await lib.borrar_verificado(sb, usuario, 'pipeline_prospectos', card.id)
    if (!res.ok) {
      console.log('  ⚠️  ' + cand.id + ' no se pudo borrar: ' + (res.motivo || (res.error && res.error.message)))
      saltados++
      continue
    }

    // ultima red de seguridad: si algo se coló como cobro en el instante
    // entre la re-verificacion y el borrado, se cancela (nunca se pierde).
    try {
      const r = await lib.cancelar_cobros_de_folios(
        sb, usuario, folios, 'limpieza de importación accidental', { cobros: [], clientes: [], reservas: [] }
      )
      r.avisos.forEach((a) => avisos.push(a))
    } catch (e) {
      console.error('cascada de cobros (no crítico):', e)
    }

    lib.registrar_movimiento(sb, {
      tipo: 'LIMPIEZA_IMPORTACION_ACCIDENTAL',
      desc: 'Prospecto de importación accidental eliminado · ' + (card.nombre || '—') +
        ' · folio ' + (card.folio || card.id),
      ref: card.folio || card.id,
      usuario: usuario.nombre,
    })
    console.log('  ✅ ' + cand.id + ' eliminado')
    borrados++
  }

  console.log('\n══ RESUMEN ══════════════════════════════════════════════')
  console.log('  eliminados: ' + borrados)
  console.log('  saltados:   ' + saltados)
  if (avisos.length) console.log('  avisos: ' + avisos.join(' · '))

  const rfinal = await sb.from('pipeline_prospectos').select('*')
    .gte('created_at', contenido.desde).lt('created_at', contenido.hasta)
  console.log('\nConteo final en la ventana original (' + contenido.desde + ' → ' + contenido.hasta + '): ' +
    (rfinal.data ? rfinal.data.length : '¿error: ' + rfinal.error?.message + '?') +
    ' fila(s) restante(s) — deberían ser solo las que quedaron en "revisar".')
}

if (modoconfirmar) await fase_confirmar()
else await fase_preview()
