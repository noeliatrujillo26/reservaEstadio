// ═══════════════════════════════════════════════════════════════════
// vistas-admin.jsx — banco de pruebas de render de TODAS las vistas del panel.
//
// POR QUE EXISTE: se pudo colar a produccion un "Miniatura is not defined" en
// la vista de Precios. La logica estaba verificada con 10,000 casos, pero
// nadie habia RENDERIZADO el componente: la prueba miraba lib/, no la vista.
// Un error asi deja la pagina en blanco, y como el panel recuerda la ultima
// seccion visitada, recargar volvia a romperse.
//
// Esta prueba monta cada vista con datos de ejemplo y falla si alguna lanza.
// Se corre con:  npm run verificar-vistas
// ═══════════════════════════════════════════════════════════════════

import { renderToString } from 'react-dom/server'
import { escritura_admin } from '../src/lib/escritura'
import { admindatoscontext } from '../src/context/admindatoscontext'
import { admincontext } from '../src/context/admincontext'
import ToastProvider from '../src/context/toastcontext'
import Dashboard from '../src/components/admin/dashboard'
import Cobros from '../src/components/admin/cobros'
import Reservas from '../src/components/admin/reservas'
import Clientes from '../src/components/admin/clientes'
import ClienteDetalle from '../src/components/admin/clientedetalle'
import Usuarios from '../src/components/admin/usuarios'
import Movimientos from '../src/components/admin/movimientos'
import Consumos from '../src/components/admin/consumos'
import Temporadas from '../src/components/admin/temporadas'
import Descuentos from '../src/components/admin/descuentos'
import Metodos from '../src/components/admin/metodos'
import Reportes from '../src/components/admin/reportes'
import Mensajes from '../src/components/admin/mensajes'
import Landing from '../src/components/admin/landing'
import Precios from '../src/components/admin/precios'
import Cotizaciones from '../src/components/admin/cotizaciones'
import Pipeline from '../src/components/admin/pipeline'
import Palcos from '../src/components/admin/palcos'
import Completados from '../src/components/admin/completados'
import DetalleCobro from '../src/components/admin/detallecobro'
import NuevoCobro from '../src/components/admin/nuevocobro'
import Evidencia from '../src/components/admin/evidencia'
import ReservaForm from '../src/components/admin/reservaform'
import CotizForm from '../src/components/admin/cotizform'
import NuevoProspecto from '../src/components/admin/nuevoprospecto'
import DetalleProspecto from '../src/components/admin/detalleprospecto'
import { Confirmar } from '../src/components/admin/confirmar'
import { ConfirmarSeguro } from '../src/components/admin/confirmarseguro'

const secciones=[{id:'sec-1',num:1,nombre:'Terraza Derecha 1',cap:64,es_compartida:false,min_personas:20,precio:9750,precio_extra:500,precio_nino:200,sku:'TD1',descripcion:'Carne asada incluida',short_description:'Vista al diamante',img:'https://x/a.png',img2:null},
 {id:'sec-2',num:2,nombre:'Palco All-Inc 2',cap:60,es_compartida:true,capacidad_maxima:40,precio2:12000,img:null,img2:'https://x/b.png'}]
const areas=[{id:'sec-1',nombre:'Terraza Derecha 1',cap:64,escompartida:false,estado:'libre'},
 {id:'sec-2',nombre:'Palco All-Inc 2',cap:60,escompartida:true,capacidadmaxima:40,estado:'libre'}]
const juegos=[{id:'j1',mes:'oct',fecha:'2026-10-14',hora:'19:30',rival:'Mayos',num:1,serie:'S1',estado:'Confirmado'}]
const reservas=[{id:1,cliente:'Ana',zona:'Terraza Derecha 1',juego:'vs Mayos',juegoid:'j1',zonaid:'sec-1',monto:9750,montopagado:5000,descuentomonto:0,estadopago:'parcial',pago:'',estado:'activa',email:'a@x.com',tel:'6621234567',personas:20,adultos:null,ninos:2,saldoconsumo:500},
 // ocupa un palco COMPARTIDO (sec-2): sin esta fila el tablero de Palcos
 // siempre pintaba "Sin ventas todavia" en el banco de pruebas y la tarjeta
 // clicable —con role/tabIndex segun el modo de la bandera— nunca se probaba.
 {id:2,cliente:'Luis',zona:'Palco All-Inc 2',juego:'vs Mayos',juegoid:'j1',zonaid:'sec-2',monto:12000,montopagado:12000,descuentomonto:0,estadopago:'pagado',pago:'Completo',estado:'activa',email:'l@x.com',tel:'6629876543',personas:8,adultos:8,ninos:0,saldoconsumo:0}]
const cobros=[{id:1,fecha:'2026-08-05',mes:'Agosto',cliente:'Ana',concepto:'ABONO',monto:5000,formapago:'EFECTIVO',folio:'1',estado:'',createdat:'2026-08-05T17:24:00Z',zona:'Terraza Derecha 1',area:'ASADOR',recibio:'FER',factura:'REQUERIDA',email:'a@x.com',notas:'captura manual',evidencia:'https://x.supabase.co/storage/v1/object/sign/comprobantes_pagos/cobros/1_v.pdf?token=t',facturapdf:'',facturaxml:''},
 {id:2,fecha:'2026-08-06',mes:'Agosto',cliente:'Luis',concepto:'CRÉDITO',monto:3000,formapago:'CREDITO',folio:'1',estado:'cancelado',createdat:null,zona:'Palco All-Inc 2',area:'ASADOR',recibio:'MELI',factura:'',email:'',notas:'',evidencia:'',facturapdf:'https://x/cfdi.pdf',facturaxml:''}]

const valor={secciones,areas,juegos,reservas,cobros,areasestados:{j1:{'sec-1':'reservada'}},
 movimientos:[{id:1,fecha:'2026-08-05',ts:'5 ago · 10:24',tipo:'Pago',desc:'Abono',ref:'1',usuario:'FER',monto:5000}],
 clientes:[{id:1,nombre:'Ana',email:'a@x.com',tel:'6621234567',facturacion:{rfc:'XAXX010101000',regimen:'626',razonSocial:'ANA SA',usoCfdi:'G03',cp:'83000',constanciaUrl:'https://x/csf.pdf',constanciaArchivo:'csf.pdf'}}],
 usuarios:[{id:1,nombre:'Admin Uno',email:'a@n.mx',rol:'Administrador',estado:'Activo',permisos:{}}],
 descuentos:[{id:1,codigo:'NRJ10',tipo:'porcentaje',valor:10,descripcion:'x',usos:2,usosmax:10,vigencia:'2099-01-01',estado:'Activo',juegosaplicables:[]}],
 descuentosvolumen:[{id:1,nombre:'Grupo',minpersonas:20,porcentaje:5,juegos:null,zonas:null,activo:true}],
 metodos:[{id:1,tipo:'Efectivo',nombre:'Caja',detalle:'x',activo:true}],
 configlanding:{banner_activo:true,banner_texto:'Hola',banner_color:'#2d6a4f',faq:[{pregunta:'p',respuesta:'r'}],promo_strip_cards:[{icono:'personas',titulo:'5%',descripcion:'d',activa:true}],whatsapp_quote_message:'m',referral_whatsapp_message:'r'},
 slides:[{id:1,image_url:'https://x/c.png',title:'S',order_index:1,is_active:true}],
 cotizaciones:[{id:'COT-0001',fecha:'2026-08-01',cliente:'Ana',email:'a@x.com',tel:'6621234567',empresa:'',descripcion:'Cumpleaños',vendedora:'FER',total:12000,valida:'2026-09-01',estado:'Activa',juegoid:'j1',zonaid:'sec-1',zona:'Terraza Derecha 1',consumodesc:'Botanas',areamonto:9000,consumomonto:3000,subtotal:12000,iva:0,descuento:0,adultoextracant:0,ninoextracant:0,extramonto:0,metodospago:[],tipocomida:'carne_asada',volumenpct:0,personasincluidas:20,notas:'Confirmar antes del juego',enpipeline:false}],
 pipeline:[{id:'p-1735689600000',folio:'002',nombre:'Luis',zona:'Terraza Derecha 1',juego:'j1',monto:9750,etapa:'reservado',vendedora:'FER',adultos:20,ninos:2,reservaids:['1'],tipocomida:'carne_asada',etapacambiadaen:'2026-08-01T10:00:00Z'},
  {id:'p-2',folio:'003',nombre:'Eva',zona:'Palco All-Inc 2',juego:'j1',monto:5000,etapa:'completado',vendedora:'MELI',reservaids:['9'],tipocomida:'discada'}],
 politica:{enganche_minimo:50,dias_limite_liquidar:5},
 cargando:false,errores:[]}
const sesion={usuario:{id:1,nombre:'Admin Uno',email:'a@n.mx',rol:'Administrador',permisos:{},iniciales:'AU'},estado:'dentro',error:'',seterror(){},iniciar_sesion(){},cerrar_sesion(){},escritura_admin:false}

// Los MODALES no se montan solos desde la vista: hay que abrirlos. Envueltos
// asi entran al banco como una vista mas — si no, su codigo no se renderiza
// nunca y volveriamos al punto ciego de "Miniatura is not defined".
const DetalleAbierto = () => <DetalleCobro cobro={cobros[0]} oncerrar={()=>{}} oncancelar={()=>{}} cancelando={null} />
const DetalleCancelado = () => <DetalleCobro cobro={cobros[1]} oncerrar={()=>{}} oncancelar={()=>{}} cancelando={null} />
const NuevoAbierto = () => <NuevoCobro abierto oncerrar={()=>{}} onregistrar={async()=>({ok:true})} guardando={false} />
const EvidenciaPdf = () => <Evidencia abierto archivo={cobros[0].evidencia} concepto="ABONO" monto={5000} fecha="5 ago 26" oncerrar={()=>{}} />
const EvidenciaSinLiga = () => <Evidencia abierto archivo="comprobante.jpg" concepto="ABONO" monto={null} fecha="" oncerrar={()=>{}} />
const ReservaNueva = () => <ReservaForm abierto editando={null} juegoinicial="j1" zonainicial="" oncerrar={()=>{}} onguardar={async()=>({ok:true})} guardando={false} />
const ReservaEditar = () => <ReservaForm abierto editando={reservas[0]} juegoinicial="j1" zonainicial="sec-1" oncerrar={()=>{}} onguardar={async()=>({ok:true})} guardando={false} />
const CotizNueva = () => <CotizForm abierto editando={null} oncerrar={()=>{}} onguardar={async()=>({ok:true})} guardando={false} />
// la zona propia (sec-1) esta 'reservada' en areasestados a proposito: prueba
// que editar conserva la zona ya ocupada en el <select>, igual que reservaform.jsx.
const CotizEditar = () => <CotizForm abierto editando={valor.cotizaciones[0]} oncerrar={()=>{}} onguardar={async()=>({ok:true})} guardando={false} />
const ConfirmSimple = () => <Confirmar estado={{mensaje:'¿Cancelar este cobro?',textoconfirmar:'Sí, cancelar'}} oncerrar={()=>{}} />
const ConfirmSeguro = () => <ConfirmarSeguro estado={{titulo:'🗑 Eliminar',descripcion:'Se borra la reserva.',etiquetamotivo:'¿Por qué? *',textoconfirmar:'Confirmar y Eliminar',pedirmotivo:true}} oncerrar={()=>{}} />
const ProspectoNuevo = () => <NuevoProspecto abierto oncerrar={()=>{}} oncrear={async()=>({ok:true})} guardando={false} />
// dos estados que se comportan distinto: una tarjeta SIN reserva (ofrece
// generarla) y otra CON reserva vinculada (la oferta desaparece).
const ProspectoDetalle = () => <DetalleProspecto card={valor.pipeline[0]} puede oncerrar={()=>{}} oneditar={async()=>({ok:true})} ongenerar={async()=>({ok:true})} oneliminar={async()=>{}} onpagar={async()=>({ok:true})} guardando={false} borrando={null} pagando={false} />
const ProspectoSinReserva = () => <DetalleProspecto card={{...valor.pipeline[0], reservaids:[]}} puede oncerrar={()=>{}} oneditar={async()=>({ok:true})} ongenerar={async()=>({ok:true})} oneliminar={async()=>{}} onpagar={async()=>({ok:true})} guardando={false} borrando={null} pagando={false} />
const ProspectoSoloLectura = () => <DetalleProspecto card={valor.pipeline[0]} puede={false} oncerrar={()=>{}} oneditar={async()=>({ok:true})} ongenerar={async()=>({ok:true})} oneliminar={async()=>{}} onpagar={async()=>({ok:true})} guardando={false} borrando={null} pagando={false} />
// en Boletos enviados el borrado esta prohibido: el boton sale apagado.
const ProspectoBoletos = () => <DetalleProspecto card={{...valor.pipeline[0], etapa:'boletos_entregados'}} puede oncerrar={()=>{}} oneditar={async()=>({ok:true})} ongenerar={async()=>({ok:true})} oneliminar={async()=>{}} onpagar={async()=>({ok:true})} guardando={false} borrando={null} pagando={false} />
const ConfirmSeguroSinMotivo = () => <ConfirmarSeguro estado={{titulo:'🔒 Bloquear',descripcion:'Sale de venta.',textoconfirmar:'Bloquear',pedirmotivo:false}} oncerrar={()=>{}} />

const ClienteDetalleAbierto = () => {
  const expediente = { id: 1, nombre: 'Ana', email: 'a@x.com', tel: '6621234567', empresa: '',
    creditoautorizado: true, saldofavor: 300, creditototal: 0,
    reservas: [{ folio: 1, zona: 'Terraza Derecha 1', juego: 'vs Mayos', montopagado: 5000, saldo: 4750, cortesia: false }],
    totalpagado: 5000, saldototal: 4750 }
  const pagos = [{ id: 1, fecha: '2026-08-05', concepto: 'ABONO', monto: 5000, formapago: 'EFECTIVO', folio: '1' }]
  const consumos = [{ id: 1, zona: 'Terraza Derecha 1', juego: 'vs Mayos', saldoconsumo: 500 }]
  const tarjetas = [valor.pipeline[0]]
  return <ClienteDetalle cliente={expediente} pagos={pagos} consumos={consumos} tarjetas={tarjetas} oncerrar={()=>{}} />
}
const ClienteDetalleVacio = () => {
  const expediente = { id: 2, nombre: 'Sin Historial', email: '—', tel: '—', empresa: '',
    creditoautorizado: false, saldofavor: 0, creditototal: 0, reservas: [], totalpagado: 0, saldototal: 0 }
  return <ClienteDetalle cliente={expediente} pagos={[]} consumos={[]} tarjetas={[]} oncerrar={()=>{}} />
}
export const vistas={dashboard:Dashboard,cobros:Cobros,seccionesreservadas:Reservas,clientes:Clientes,
 usuarios:Usuarios,movimientos:Movimientos,consumos:Consumos,temporadas:Temporadas,descuentos:Descuentos,metodos:Metodos,
 reportes:Reportes,mensajes:Mensajes,landing:Landing,precios:Precios,cotizaciones:Cotizaciones,
 pipeline:Pipeline,palcos:Palcos,completados:Completados,
 detallecobro:DetalleAbierto,detallecancelado:DetalleCancelado,nuevocobro:NuevoAbierto,
 evidenciapdf:EvidenciaPdf,evidenciasinliga:EvidenciaSinLiga,
 reservanueva:ReservaNueva,reservaeditar:ReservaEditar,
 cotiznueva:CotizNueva,cotizeditar:CotizEditar,
 confirmsimple:ConfirmSimple,confirmseguro:ConfirmSeguro,confirmseguro2:ConfirmSeguroSinMotivo,
 prospectonuevo:ProspectoNuevo,prospectodetalle:ProspectoDetalle,
 cliente_expediente:ClienteDetalleAbierto,cliente_expediente_vacio:ClienteDetalleVacio,
 prospectosinreserva:ProspectoSinReserva,prospectosololectura:ProspectoSoloLectura,
 prospectoboletos:ProspectoBoletos}

export function render(Comp){
  return renderToString(
    <admincontext.Provider value={sesion}>
      <ToastProvider>
        <admindatoscontext.Provider value={valor}><Comp /></admindatoscontext.Provider>
      </ToastProvider>
    </admincontext.Provider>)
}

// el runner comprueba con esto que la bandera de compilacion llego de verdad
// al bundle: sin esta senal, el modo escritura podria estar repitiendo en
// silencio el de lectura y la prueba pasaria sin probar nada nuevo.
export const escritura_activa = escritura_admin
