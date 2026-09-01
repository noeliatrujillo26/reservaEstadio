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
import { admindatoscontext } from '../src/context/admindatoscontext'
import { admincontext } from '../src/context/admincontext'
import ToastProvider from '../src/context/toastcontext'
import Dashboard from '../src/components/admin/dashboard'
import Cobros from '../src/components/admin/cobros'
import Reservas from '../src/components/admin/reservas'
import Clientes from '../src/components/admin/clientes'
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

const secciones=[{id:'sec-1',num:1,nombre:'Terraza Derecha 1',cap:64,es_compartida:false,min_personas:20,precio:9750,precio_extra:500,precio_nino:200,sku:'TD1',descripcion:'Carne asada incluida',short_description:'Vista al diamante',img:'https://x/a.png',img2:null},
 {id:'sec-2',num:2,nombre:'Palco All-Inc 2',cap:60,es_compartida:true,capacidad_maxima:40,precio2:12000,img:null,img2:'https://x/b.png'}]
const areas=[{id:'sec-1',nombre:'Terraza Derecha 1',cap:64,escompartida:false,estado:'libre'},
 {id:'sec-2',nombre:'Palco All-Inc 2',cap:60,escompartida:true,capacidadmaxima:40,estado:'libre'}]
const juegos=[{id:'j1',mes:'oct',fecha:'2026-10-14',hora:'19:30',rival:'Mayos',num:1,serie:'S1',estado:'Confirmado'}]
const reservas=[{id:1,cliente:'Ana',zona:'Terraza Derecha 1',juego:'vs Mayos',juegoid:'j1',zonaid:'sec-1',monto:9750,montopagado:5000,descuentomonto:0,estadopago:'parcial',pago:'',estado:'activa',email:'a@x.com',tel:'6621234567',personas:20,adultos:null,ninos:2,saldoconsumo:500}]
const cobros=[{id:1,fecha:'2026-08-05',mes:'Agosto',cliente:'Ana',concepto:'ABONO',monto:5000,formapago:'EFECTIVO',folio:'1',estado:'',createdat:null,zona:'Terraza Derecha 1',recibio:'FER',factura:'REQUERIDA'}]

const valor={secciones,areas,juegos,reservas,cobros,areasestados:{j1:{'sec-1':'reservada'}},
 movimientos:[{id:1,fecha:'2026-08-05',ts:'5 ago · 10:24',tipo:'Pago',desc:'Abono',ref:'1',usuario:'FER',monto:5000}],
 clientes:[{id:1,nombre:'Ana',email:'a@x.com',tel:'6621234567'}],
 usuarios:[{id:1,nombre:'Admin Uno',email:'a@n.mx',rol:'Administrador',estado:'Activo',permisos:{}}],
 descuentos:[{id:1,codigo:'NRJ10',tipo:'porcentaje',valor:10,descripcion:'x',usos:2,usosmax:10,vigencia:'2099-01-01',estado:'Activo',juegosaplicables:[]}],
 descuentosvolumen:[{id:1,nombre:'Grupo',minpersonas:20,porcentaje:5,juegos:null,zonas:null,activo:true}],
 metodos:[{id:1,tipo:'Efectivo',nombre:'Caja',detalle:'x',activo:true}],
 configlanding:{banner_activo:true,banner_texto:'Hola',banner_color:'#2d6a4f',faq:[{pregunta:'p',respuesta:'r'}],promo_strip_cards:[{icono:'personas',titulo:'5%',descripcion:'d',activa:true}],whatsapp_quote_message:'m',referral_whatsapp_message:'r'},
 slides:[{id:1,image_url:'https://x/c.png',title:'S',order_index:1,is_active:true}],
 cotizaciones:[{id:'COT-0001',fecha:'2026-08-01',cliente:'Ana',empresa:'',vendedora:'FER',total:12000,valida:'2026-09-01',estado:'Activa',areamonto:9000,consumomonto:3000,subtotal:12000,iva:0,descuento:0,adultoextracant:0,ninoextracant:0,extramonto:0,metodospago:[],tipocomida:'carne_asada',volumenpct:0,personasincluidas:20}],
 pipeline:[{id:'p-1735689600000',folio:'002',nombre:'Luis',zona:'Terraza Derecha 1',juego:'j1',monto:9750,etapa:'reservado',vendedora:'FER',adultos:20,ninos:2,reservaids:['1'],tipocomida:'carne_asada',etapacambiadaen:'2026-08-01T10:00:00Z'},
  {id:'p-2',folio:'003',nombre:'Eva',zona:'Palco All-Inc 2',juego:'j1',monto:5000,etapa:'completado',vendedora:'MELI',reservaids:['9'],tipocomida:'discada'}],
 cargando:false,errores:[]}
const sesion={usuario:{id:1,nombre:'Admin Uno',email:'a@n.mx',rol:'Administrador',permisos:{},iniciales:'AU'},estado:'dentro',error:'',seterror(){},iniciar_sesion(){},cerrar_sesion(){},escritura_admin:false}

export const vistas={dashboard:Dashboard,cobros:Cobros,seccionesreservadas:Reservas,clientes:Clientes,
 usuarios:Usuarios,consumos:Consumos,temporadas:Temporadas,descuentos:Descuentos,metodos:Metodos,
 reportes:Reportes,mensajes:Mensajes,landing:Landing,precios:Precios,cotizaciones:Cotizaciones,
 pipeline:Pipeline,palcos:Palcos,completados:Completados}

export function render(Comp){
  return renderToString(
    <admincontext.Provider value={sesion}>
      <ToastProvider>
        <admindatoscontext.Provider value={valor}><Comp /></admindatoscontext.Provider>
      </ToastProvider>
    </admincontext.Provider>)
}
