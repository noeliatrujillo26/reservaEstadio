const { getSupabaseAdmin } = require('./_lib/supabaseAdmin');
const { esCobroCredito } = require('./_lib/dinero');

// Portal del cliente ("Mis Reservas").
//
// El acceso es por folio + email: el cliente demuestra que es dueño de la
// reserva presentando ambos datos (mismo modelo que una aerolínea: código de
// reservación + correo). No requiere cuenta de Supabase Auth — las cuentas
// Auth de este proyecto son solo para administradores del panel.
//
// GET  /api/mis-reservas?folio=001&email=cliente@correo.com
//      → { reservas: [...], cobros: [...] } (todas las reservas de ese email)
// POST /api/mis-reservas  { folio, email, action: 'invitados'|'perfil', ... }
//      → guarda invitados de una reserva o actualiza nombre/teléfono del cliente.

function normalizarEmail(v) {
  return String(v || '').trim().toLowerCase();
}

// El correo del portal viaja a consultas ilike, donde % _ y * son COMODINES.
// Sin este filtro, mandar '%' convertia la busqueda en "todas las filas":
// con un folio cualquiera se volcaba la base entera y, en la accion perfil,
// se reescribian todas las reservas. Un correo legitimo no contiene % * \
// ni espacios, asi que rechazarlos no bloquea a nadie real.
function emailSeguro(v) {
  const e = normalizarEmail(v);
  if (!e || e.length > 160) return null;
  if (/[%*\\\s]/.test(e)) return null;
  if (!/^[^@]+@[^@]+\.[a-z]{2,}$/i.test(e)) return null;
  return e;
}

// '_' SI es valido en un correo (juan_perez@x.com) pero en LIKE significa
// "cualquier caracter": se escapa para que coincida de forma literal.
function patronEmail(e) {
  return String(e).replace(/_/g, '\\_');
}

// Confirma que el folio pertenece a ese email y regresa todas las reservas
// del cliente. Es la validación de acceso de todo el portal.
async function autenticar(sb, folio, email) {
  if (!folio || !email) return { error: 'Ingresa tu folio y tu correo.', status: 400 };
  const seguro = emailSeguro(email);
  if (!seguro) return { error: 'Ingresa tu folio y tu correo.', status: 400 };
  const { data, error } = await sb.from('reservas').select('*').ilike('email', patronEmail(seguro)).order('id');
  if (error) { console.error('mis-reservas auth error:', error); return { error: 'No se pudo consultar tus reservas.', status: 500 }; }
  const propia = (data || []).find(r => String(r.id) === String(folio));
  if (!propia) return { error: 'No encontramos una reserva con ese folio y correo.', status: 404 };
  // De aqui en adelante manda el correo GUARDADO en la reserva autenticada,
  // no el texto que escribio el visitante: ninguna consulta posterior vuelve
  // a depender de una cadena que el cliente controla.
  return { reservas: data, email: normalizarEmail(propia.email) || seguro, propia };
}

module.exports = async (req, res) => {
  const sb = getSupabaseAdmin();
  // Datos de pago SIEMPRE frescos: sin esta cabecera, la CDN podía servir una
  // respuesta vieja para el mismo folio+correo y el portal se quedaba en
  // "Pago parcial" aunque la reserva ya estuviera liquidada.
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'GET') {
    const folio = String(req.query.folio || '').trim();
    const email = normalizarEmail(req.query.email);
    const auth = await autenticar(sb, folio, email);
    if (auth.error) { res.status(auth.status).json({ error: auth.error }); return; }

    // Historial de pagos: cobros ligados a los folios del cliente. La columna
    // `email` de cobros es de la migración opcional; si no existe, con folio basta.
    const folios = auth.reservas.map(r => String(r.id));

    // Cobros ligados VÍA EL PIPELINE: un abono registrado ANTES de generar la
    // reserva (flujo Reserva Momentánea) queda en cobros con el folio del
    // PROSPECTO (PROS-…). Sin este puente, el panel mostraba el pago pero el
    // portal decía $0 (el caso NRJ-ADM-BFKHS). Se localizan las tarjetas
    // vinculadas a estas reservas y sus folios entran a la consulta.
    let cardsVinc = [];
    try {
      const rCards = await sb.from('pipeline_prospectos').select('folio, reserva_ids').overlaps('reserva_ids', folios);
      cardsVinc = ((rCards && rCards.data) || []).filter(c => c.folio);
    } catch (e) { console.warn('Vínculo pipeline no disponible:', e && e.message); }
    const reservaDeCard = {};   // folio del prospecto → id de SU reserva del cliente
    cardsVinc.forEach(c => {
      const rid = (c.reserva_ids || []).map(String).find(id => folios.includes(id));
      if (rid) reservaDeCard[String(c.folio)] = rid;
    });
    const foliosPipeline = Object.keys(reservaDeCard);

    let cobros = [];
    const porFolio = await sb.from('cobros').select('*').in('folio', folios.concat(foliosPipeline)).order('fecha');
    if (!porFolio.error && porFolio.data) cobros = porFolio.data;
    const porEmail = await sb.from('cobros').select('fecha, monto, forma_pago, concepto, folio, email, estado').eq('email', auth.email).order('fecha');
    if (!porEmail.error && porEmail.data) {
      porEmail.data.forEach(c => {
        if (!cobros.some(x => x.fecha === c.fecha && x.monto === c.monto && x.folio === c.folio)) cobros.push(c);
      });
    }
    // Cobros CANCELADOS (soft delete del panel): fuera del portal.
    cobros = cobros.filter(c => String(c.estado || '').toLowerCase() !== 'cancelado');
    // Los cobros con folio de prospecto se RE-ETIQUETAN en la respuesta al
    // folio de su reserva: el portal los suma en el historial correcto.
    cobros.forEach(c => { const rid = reservaDeCard[String(c.folio)]; if (rid) c.folio = rid; });

    // ── FUENTE ÚNICA DE VERDAD del pagado ─────────────────────────────────
    // total_pagado = MAX(monto_pagado guardado, SUMA de los cobros activos
    // del folio) y por_pagar = total − total_pagado. El campo guardado puede
    // quedarse atrás (abonos previos a generar la reserva); la suma dinámica
    // siempre alcanza al panel. estado_pago y la etiqueta `pago` se derivan
    // aquí mismo para que el badge del portal y el botón "Pagar saldo"
    // reaccionen sin depender de ninguna sincronización.
    auth.reservas.forEach(r => {
      // Los cobros a CRÉDITO son cuenta por cobrar: no suman al pagado del
      // portal — el badge sigue en Parcial/Pendiente y "Pagar saldo" vivo.
      const suma = cobros.filter(c => String(c.folio) === String(r.id) && !esCobroCredito(c))
        .reduce((s, c) => s + (Number(c.monto) || 0), 0);
      const pagadoReal = Math.max(Number(r.monto_pagado) || 0, suma);
      const neto = Math.max(0, (Number(r.monto) || 0) - (Number(r.descuento_monto) || 0));
      // ESTRICTAMENTE por números (tolerancia de centavos): liquidada SOLO si
      // pagado ≥ total del contrato. Un estado_pago='pagado' guardado con
      // saldo real pendiente se DEGRADA aquí — antes se respetaba y el portal
      // mostraba "liquidada" reescribiendo el Total con lo abonado (el caso
      // NRJ-ADM-GHYH4: total $18,000, pagado $17,980, restante $20).
      // Cortesía/descuento del 100% sobre un precio real (bruto > 0, neto $0):
      // es una reserva LIQUIDADA, no 'pendiente' — antes el portal la dejaba
      // pagable con botón de saldo en $0.
      const bruto = Number(r.monto) || 0;
      const liquidada = (bruto > 0 && neto <= 0.01) || (neto > 0 && pagadoReal >= neto - 0.01);
      r.monto_pagado = pagadoReal;
      r.estado_pago = liquidada ? 'pagado' : (pagadoReal > 0 ? 'parcial' : 'pendiente');
      r.pago = liquidada ? 'Completo' : (pagadoReal > 0 ? 'Parcial' : (r.pago || 'Sin pago'));

      // ── TOTALES CANÓNICOS para el portal ──────────────────────────────
      // El neto ya se calculaba aquí y se tiraba: el portal lo recomponía
      // por su cuenta y, si la fila traía descuento_monto en 0, pintaba el
      // precio de LISTA. Ahora se publican derivados para que exista UNA
      // sola verdad (portal, checkout y panel muestran el mismo número).
      // El CRÉDITO no es dinero cobrado (no entra en pagado_real), pero sí
      // cubre el saldo: por_pagar descuenta el compromiso vigente.
      const credito = cobros
        .filter(c => String(c.folio) === String(r.id) && esCobroCredito(c))
        .reduce((s, c) => s + (Number(c.monto) || 0), 0);
      r.total_bruto = bruto;
      r.total_neto = neto;
      r.pagado_real = pagadoReal;
      r.credito_monto = credito;
      r.por_pagar = Math.max(0, neto - pagadoReal - credito);
    });

    // Cada cobro viaja marcado: el portal ya no puede confundir un
    // compromiso a crédito con dinero recibido (lo re-sumaba y contradecía
    // al estado_pago que este mismo endpoint acababa de calcular).
    cobros.forEach(c => { c.es_credito = esCobroCredito(c); });

    // Capacidad BASE de la sección de cada reserva (mapa_secciones.min_personas):
    // el portal la necesita para el desglose estricto de personas
    // (total_adultos = base + adultos_extra). Fail-soft: sin dato, el portal
    // usa sus reglas de respaldo.
    try {
      const zonaIds = [...new Set(auth.reservas.map(r => r.zona_id).filter(Boolean))];
      if (zonaIds.length) {
        const rMapa = await sb.from('mapa_secciones').select('id, min_personas').in('id', zonaIds);
        if (!rMapa.error && rMapa.data) {
          const minPorZona = {};
          rMapa.data.forEach(s => { minPorZona[s.id] = Number(s.min_personas) || 0; });
          // La columna base_capacity GUARDADA en la reserva (fijada por el
          // checkout al momento de reservar) manda; el catálogo actual del
          // mapa solo rellena filas antiguas que no la traen.
          auth.reservas.forEach(r => {
            if (!(Number(r.base_capacity) > 0)) r.base_capacity = minPorZona[r.zona_id] || null;
          });
        }
      }
    } catch (e) { console.warn('base_capacity no disponible:', e && e.message); }

    // Perfil extendido del cliente (fecha de nacimiento y género): vive en la
    // tabla `clientes`; select('*') tolera que las columnas de la migración
    // aún no existan (simplemente no vienen).
    let perfil = null;
    const rCli = await sb.from('clientes').select('*').ilike('email', patronEmail(auth.email)).limit(1);
    if (!rCli.error && rCli.data && rCli.data[0]) {
      const c = rCli.data[0];
      perfil = { birth_date: c.birth_date || null, gender: c.gender || null };
    }

    res.status(200).json({ reservas: auth.reservas, cobros, perfil });
    return;
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const folio = String(body.folio || '').trim();
    const email = normalizarEmail(body.email);
    const auth = await autenticar(sb, folio, email);
    if (auth.error) { res.status(auth.status).json({ error: auth.error }); return; }

    if (body.action === 'invitados') {
      const reservaId = String(body.reservaId || '').trim();
      // Solo puede editar invitados de sus propias reservas.
      if (!auth.reservas.some(r => String(r.id) === reservaId)) {
        res.status(403).json({ error: 'Esa reserva no pertenece a tu cuenta.' }); return;
      }
      const invitados = Array.isArray(body.invitados) ? body.invitados.slice(0, 50).map(g => ({
        nombre:  String(g.nombre  || '').slice(0, 120),
        correo:  String(g.correo  || '').slice(0, 120),
        celular: String(g.celular || '').slice(0, 30),
        asiento: String(g.asiento || '').slice(0, 12),
        estado:  String(g.estado  || 'Confirmado').slice(0, 20),
      })) : [];
      const { error } = await sb.from('reservas').update({ invitados }).eq('id', reservaId);
      if (error) {
        // Columna `invitados` aún no existe (migración opcional pendiente).
        if (error.code === 'PGRST204' || /column/i.test(error.message || '')) {
          res.status(409).json({ error: 'MIGRACION_REQUERIDA' }); return;
        }
        console.error('mis-reservas invitados error:', error);
        res.status(500).json({ error: 'No se pudieron guardar los invitados.' }); return;
      }
      res.status(200).json({ ok: true });
      return;
    }

    if (body.action === 'perfil') {
      const nombre = String(body.nombre || '').trim().slice(0, 120);
      const tel    = String(body.tel    || '').trim().slice(0, 30);
      if (!nombre) { res.status(400).json({ error: 'El nombre es obligatorio.' }); return; }
      const cambios = { cliente: nombre };
      if (tel) cambios.tel = tel;
      // Acotado a los folios que YA se autenticaron: antes el patron del
      // cliente elegia que filas se sobrescribian y '%' alcanzaba la tabla
      // completa. Un UPDATE jamas debe depender de texto del usuario.
      const idsPropios = auth.reservas.map(r => String(r.id));
      const { error } = await sb.from('reservas').update(cambios).in('id', idsPropios);
      if (error) { console.error('mis-reservas perfil error:', error); res.status(500).json({ error: 'No se pudo actualizar tu perfil.' }); return; }

      // Perfil extendido — validado en servidor: fecha ISO real y género SOLO
      // del catálogo cerrado. Todo opcional. (El campo Ciudad se retiró del
      // portal; el valor de `ciudad` que llegue en el body se ignora.)
      const extras = {};
      const nacimiento = String(body.nacimiento || '').trim().slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(nacimiento)) extras.birth_date = nacimiento;
      const genero = String(body.genero || '').trim();
      if (['Hombre', 'Mujer', 'No especificar'].indexOf(genero) >= 0) extras.gender = genero;

      // Reflejar en la tabla de clientes del admin. Si las columnas nuevas aún
      // no existen (migracion-perfil-cliente.sql pendiente), se reintenta sin
      // ellas: nombre/tel se guardan igual y se avisa en la respuesta.
      let aviso = null;
      const datosCliente = Object.assign({ nombre }, tel ? { tel } : {}, extras);
      let rUpd = await sb.from('clientes').update(datosCliente).eq('email', auth.email).select();
      const faltaColumna = (e) => e && (e.code === 'PGRST204' || /column/i.test(e.message || ''));
      if (rUpd.error && faltaColumna(rUpd.error) && Object.keys(extras).length) {
        aviso = 'MIGRACION_PERFIL';
        console.error('Columnas de perfil faltantes (corre migracion-perfil-cliente.sql):', rUpd.error.message);
        rUpd = await sb.from('clientes').update({ nombre, ...(tel ? { tel } : {}) }).eq('email', auth.email).select();
      }
      // Cliente sin ficha en `clientes` (compró solo en línea): crearla para
      // que el perfil tenga dónde vivir. Fallo aquí no tumba el guardado.
      if (!rUpd.error && (!rUpd.data || !rUpd.data.length)) {
        const rIns = await sb.from('clientes').insert(Object.assign({ email: auth.email }, datosCliente));
        if (rIns.error && faltaColumna(rIns.error)) {
          await sb.from('clientes').insert({ email: auth.email, nombre, ...(tel ? { tel } : {}) });
          if (Object.keys(extras).length) aviso = 'MIGRACION_PERFIL';
        }
      }

      res.status(200).json({ ok: true, aviso });
      return;
    }

    // Código de referido del titular → cupón REAL en la tabla central de
    // descuentos (la única fuente que validar-cupon consulta). Se deriva EN
    // EL SERVIDOR del nombre de la reserva — nunca del cliente.
    //
    // FORMATO: primer nombre limpio + 3 o 4 dígitos aleatorios (MANUEL572).
    // El viejo "NOMBRE15" era adivinable: cualquiera podía deducir el código
    // de otro cliente y gastarle sus usos.
    //
    // IDEMPOTENCIA POR DUEÑO: el portal pide su código en CADA carga. Con un
    // sufijo aleatorio ya no basta con buscar el código por su valor (nunca
    // coincidiría) — se busca el cupón de referido de ESTE correo y, si ya
    // tiene uno, se devuelve tal cual. Sin esto cada visita crearía un cupón.
    if (body.action === 'referido') {
      const titular = auth.reservas.find(r => String(r.id) === folio) || auth.reservas[0];
      const nombreTitular = String(titular.cliente || '').trim();
      // Acentos y caracteres especiales fuera, pero SIN perder la letra:
      // "María José" → MARIA (antes la Í se borraba y quedaba "MARA").
      const primerNombre = nombreTitular.split(/\s+/)[0]
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toUpperCase().replace(/[^A-ZÑ]/g, '');
      if (!primerNombre || primerNombre.length < 2) {
        res.status(400).json({ error: 'La reserva no tiene un nombre de titular válido.' }); return;
      }

      // ¿Ya tiene código? Primero por dueño (formato nuevo); si las columnas
      // de la migración no existen, por el código legado NOMBRE15 — así un
      // cliente que ya compartió su código conserva EXACTAMENTE ese.
      let codigoExistente = null;
      try {
        const rMio = await sb.from('descuentos').select('codigo')
          .eq('owner_email', email).eq('origen', 'REFERRAL').limit(1);
        if (!rMio.error && rMio.data && rMio.data.length) codigoExistente = rMio.data[0].codigo;
      } catch (eOwn) { /* columnas de la migración ausentes: se cae al legado */ }
      if (!codigoExistente) {
        const rLegado = await sb.from('descuentos').select('codigo')
          .eq('codigo', primerNombre + '15').maybeSingle();
        if (!rLegado.error && rLegado.data) codigoExistente = rLegado.data.codigo;
      }
      if (codigoExistente) { res.status(200).json({ codigo: codigoExistente, creado: false }); return; }

      // Sufijo aleatorio de 3 o 4 dígitos, verificando que no exista ya.
      // Varios intentos: con ~11,000 combinaciones por nombre, un choque es
      // raro, pero reintentar cuesta nada y evita el fallo por clave duplicada.
      const sufijo = () => {
        const largo = Math.random() < 0.5 ? 3 : 4;
        const min = Math.pow(10, largo - 1);
        return String(Math.floor(min + Math.random() * (min * 9)));
      };
      let codigo = null;
      for (let intento = 0; intento < 8; intento++) {
        const cand = primerNombre + sufijo();
        const rDup = await sb.from('descuentos').select('codigo').eq('codigo', cand).maybeSingle();
        if (!rDup.error && !rDup.data) { codigo = cand; break; }
      }
      if (!codigo) {
        console.error('No se pudo generar un código de referido único para ' + email);
        res.status(500).json({ error: 'No se pudo generar el código de referido. Intenta de nuevo.' }); return;
      }

      const cupon = {
        codigo,
        tipo: 'porcentaje',
        valor: 15,
        descripcion: 'Código de referido de ' + nombreTitular,
        // Tope de 10 usos por código (antes 0 = ilimitado): un referido no
        // puede convertirse en un descuento perpetuo para medio mundo.
        usos_max: 10,
        vigencia: null,
        estado: 'Activo',
        juegos_aplicables: [],
        // Columnas de migracion-referidos-descuentos.sql (origen del cupón y
        // dueño para acreditarle el uso); si aún no existen, se reintenta sin ellas.
        origen: 'REFERRAL',
        owner_email: email,
      };
      let rIns = await sb.from('descuentos').insert(cupon);
      if (rIns.error && (rIns.error.code === 'PGRST204' || /column/i.test(rIns.error.message || ''))) {
        const core = Object.assign({}, cupon);
        delete core.origen; delete core.owner_email;
        rIns = await sb.from('descuentos').insert(core);
      }
      if (rIns.error) {
        console.error('No se pudo registrar el cupón de referido:', rIns.error);
        res.status(500).json({ error: 'No se pudo registrar el código de referido.' }); return;
      }
      console.log('Cupón de referido creado: ' + codigo + ' (' + email + ') · tope 10 usos');
      res.status(200).json({ codigo, creado: true });
      return;
    }

    res.status(400).json({ error: 'Acción no reconocida.' });
    return;
  }

  res.status(405).json({ error: 'Método no permitido' });
};
