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
  num_monto, pipeline_etapas, capacidad_palco, lugares_de_reserva,
  ocupacion_palco, palcos_del_mapa, estado_pago_palco, suma_pagos_dinero,
} from '../src/lib/pipeline'

export {
  es_abono_a_saldo_favor, toca_saldo_favor, cliente_id_de_cobro,
  mover_saldo_favor, saldo_favor_de, revertir_saldo_favor_de_cobro,
  sincronizar_pago_reserva, restar_pago_reserva, sincronizar_etapa,
  tarjeta_de_folio, afecta_saldo_reserva, texto_reversion_saldo,
  cancelar_cobros_de_folios,
} from '../src/lib/cascadas'

export {
  es_cobro_desde_saldo_favor, es_pago_desde_saldo_favor, cobro_sin_dinero_nuevo,
} from '../src/lib/cobros'

export {
  es_cobro_credito, es_pago_credito, es_forma_efectivo, nombres_formas_pago,
} from '../src/lib/dashboard'
export { redondear_dinero } from '../src/lib/dinero'
export {
  csv_arqueo, arqueo_por_forma, barras, datos_reporte, filas_arqueo, forma_pago_legible,
  mas_frecuente, mes_label, rango_reporte,
} from '../src/lib/reportes'
export { celda_csv, csv_de_filas, csv_texto, fila_csv } from '../src/lib/exportarcsv'
export { escritura_admin, motivo_bloqueo, actualizar_verificado } from '../src/lib/escritura'
export { ruta_comprobante, comprobante_excede_limite } from '../src/lib/storage'

export { concepto_color, formato_fecha, hora_cobro, instante_cobro } from '../src/lib/cobros'
export { mensaje_reporte_dia, cobros_del_dia } from '../src/lib/reportedia'
export { buscar_facturacion_cliente, regimen_legible } from '../src/lib/facturacion'
export { html_recibo_cobro } from '../src/lib/recibo'
export { ruta_de_url, es_ruta_bucket, es_recibo_auto } from '../src/lib/storage'

export {
  generar_folio_reserva, economia_reserva, cobro_inicial, estado_pago_reserva,
  email_valido, tel_valido, etiqueta_juego, folios_de_reserva_borrada,
  precio_seccion, min_seccion, folio_visible, reserva_liquidada,
} from '../src/lib/reservasadmin'
export {
  estado_vivo, puede_bloquearse, set_estado_zona, alternar_bloqueo, estados_zona,
  texto_fallo_estado, liberar_reservas_de_prospecto, folios_de_prospecto,
  puede_eliminarse, msg_no_eliminable,
} from '../src/lib/mapaocupacion'

export {
  nuevo_folio_prospecto, regla_volumen_activa, descuento_volumen_aplicable,
  calc_total_prospecto, bruto_tarjeta, validar_prospecto, validar_edicion_prospecto,
  puede_generar_reserva, validar_mover_etapa,
} from '../src/lib/prospectos'

export {
  datos_recibo_pago, html_recibo_pago, juego_label_recibo, nombre_archivo_recibo,
} from '../src/lib/reciboauto'
export { esc } from '../src/lib/recibo'

export {
  armar_clientes, cobro_es_del_cliente, folios_de_cliente, pagos_de_cliente,
  buscar_cliente, nombre_norm, tel_norm,
} from '../src/lib/clientes'
export { consumos_de_cliente, consumo_activo } from '../src/lib/consumos'

export {
  calcular_cotizacion, cotiz_transicion_bloqueada, cotizacion_a_prospecto_payload,
  cotizacion_activa_en_pipeline, fecha_validez_cotizacion, folio_cotizacion, validar_cotizacion,
} from '../src/lib/cotizaciones'
