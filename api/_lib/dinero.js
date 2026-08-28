// Clasificación de dinero en el servidor — espejo de _esPagoCredito del
// panel (js/modules/utils.js): un cobro con concepto o forma de pago
// CRÉDITO es un COMPROMISO de pago (cuenta por cobrar), no dinero cobrado.
// Jamás debe sumar a ingresos, monto_pagado ni "pagado real"; sí puede
// avanzar la etapa comercial del Pipeline.
//
// Igualdad EXACTA normalizada (acentos fuera) — nunca substring: "TARJETA
// DE CREDITO" / "Tarjeta de crédito" son dinero real y no deben caer aquí.

const _norm = (v) => String(v || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

function esCobroCredito(c) {
  if (!c) return false;
  return _norm(c.concepto) === 'CREDITO' || _norm(c.forma_pago || c.formaPago || c.forma) === 'CREDITO';
}

// ── CENTAVOS ───────────────────────────────────────────────────────────────
// Todo el dinero del sistema se maneja en PESOS con dos decimales. Antes se
// redondeaba al peso entero en cada cálculo (Math.round), así que un precio
// de $9,750.50 se cobraba como $9,750 o $9,751 según el caso.
//
// El redondeo va con un margen de 1e-9 porque en coma flotante binaria
// 1.005 * 100 da 100.49999999999999 y Math.round lo bajaría a 1.00 en vez de
// 1.01. Ese margen es catorce órdenes de magnitud menor que un centavo, así
// que no altera ningún importe real.
const _MXN2 = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

function redondearDinero(n) {
  const v = Number(n);
  if (!isFinite(v)) return 0;
  const r = Math.round(Math.abs(v) * 100 + 1e-9) / 100;
  return v < 0 ? -r : r;
}

// Pesos → centavos enteros, que es lo que exigen Stripe y cualquier pasarela.
function aCentavos(n) {
  return Math.round(redondearDinero(n) * 100);
}

// Texto de la interfaz o de un CSV → número. Acepta "$9,750.50", "9750,50"
// (coma decimal) y "9 750.50". Devuelve null si no hay ningún dígito, para
// poder distinguir "campo vacío" de "cero".
function parseDinero(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? redondearDinero(v) : null;
  let s = String(v).trim().replace(/[^\d.,-]/g, '');
  if (!/\d/.test(s)) return null;
  const ultimaComa = s.lastIndexOf(','), ultimoPunto = s.lastIndexOf('.');
  if (ultimaComa > -1 && ultimaComa > ultimoPunto) {
    // Formato europeo: la coma es el separador decimal ("9.750,50").
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // Formato mexicano: la coma separa miles ("9,750.50").
    s = s.replace(/,/g, '');
  }
  const n = Number(s);
  return isFinite(n) ? redondearDinero(n) : null;
}

// Formato de despliegue: SIEMPRE dos decimales, incluso en importes cerrados
// ($9,750.00). Sin el símbolo, para que cada vista lo componga como necesite.
function fmtDinero(n) {
  return redondearDinero(n).toLocaleString('es-MX', _MXN2);
}

module.exports = { esCobroCredito, redondearDinero, aCentavos, parseDinero, fmtDinero, _MXN2 };
