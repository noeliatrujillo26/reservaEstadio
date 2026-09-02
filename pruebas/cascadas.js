// ═══════════════════════════════════════════════════════════════════
// cascadas.js (pruebas) — puente para el banco diferencial de la cascada.
//
// Se compila con vite --ssr para que import.meta.env (la bandera de
// escritura) exista, y expone al runner las funciones migradas y un cliente
// de supabase FALSO. Ninguna prueba toca la base real.
// ═══════════════════════════════════════════════════════════════════

export {
  pagos_de_tarjeta, abonado_etapa, reservas_activas, enganche_requerido,
  indice_etapa, es_cotiz_especial, no_recalcular_area, total_reserva_card,
  saldo_pendiente_card, etapa_por_abono, pct_abonado, debe_reclasificar,
  num_monto, pipeline_etapas,
} from '../src/lib/pipeline'

export {
  es_abono_a_saldo_favor, toca_saldo_favor, cliente_id_de_cobro,
  mover_saldo_favor, saldo_favor_de, revertir_saldo_favor_de_cobro,
  sincronizar_pago_reserva, restar_pago_reserva, sincronizar_etapa,
  tarjeta_de_folio, afecta_saldo_reserva, texto_reversion_saldo,
} from '../src/lib/cascadas'

export {
  es_cobro_desde_saldo_favor, es_pago_desde_saldo_favor, cobro_sin_dinero_nuevo,
} from '../src/lib/cobros'

export { es_cobro_credito } from '../src/lib/dashboard'
export { redondear_dinero } from '../src/lib/dinero'
export { escritura_admin, motivo_bloqueo } from '../src/lib/escritura'
export { ruta_comprobante, comprobante_excede_limite } from '../src/lib/storage'

export { concepto_color, formato_fecha, hora_cobro, instante_cobro } from '../src/lib/cobros'
export { mensaje_reporte_dia, cobros_del_dia } from '../src/lib/reportedia'
export { buscar_facturacion_cliente, regimen_legible } from '../src/lib/facturacion'
export { html_recibo_cobro } from '../src/lib/recibo'
export { ruta_de_url, es_ruta_bucket, es_recibo_auto } from '../src/lib/storage'
