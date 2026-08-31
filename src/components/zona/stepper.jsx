// ═══════════════════════════════════════════════════════════════════
// stepper.jsx — contador de +/- del panel de detalle.
// espejo 1:1 de v1: los dos bloques identicos de adultos y ninos del html
// (lineas 745-769) y el helper setBtn() de _detalleActualizar(), que apaga
// el boton al 35% de opacidad cuando se llega al limite.
// ═══════════════════════════════════════════════════════════════════

export default function stepper({ titulo, hint, valor, idvalor, idmenos, idmas, onmenos, onmas, menosdesactivado, masdesactivado }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#fff',
        border: '1.5px solid #E4E7EC',
        borderRadius: '8px',
        padding: '8px 14px',
        marginBottom: '8px',
      }}
    >
      <div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#5A6478' }}>{titulo}</div>
        <div style={{ fontSize: '10px', color: '#9AA3B4' }} id={idvalor + '-hint'}>{hint}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button
          id={idmenos}
          onClick={onmenos}
          disabled={menosdesactivado}
          style={{
            width: '30px', height: '30px', borderRadius: '50%',
            border: '1.5px solid #E4E7EC', background: '#fff', fontSize: '20px',
            lineHeight: 1, cursor: 'pointer', color: '#333', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            opacity: menosdesactivado ? 0.35 : 1,
          }}
        >
          −
        </button>
        <span id={idvalor} style={{ fontSize: '18px', fontWeight: 700, minWidth: '32px', textAlign: 'center' }}>
          {valor}
        </span>
        <button
          id={idmas}
          onClick={onmas}
          disabled={masdesactivado}
          style={{
            width: '30px', height: '30px', borderRadius: '50%', border: 'none',
            background: '#E05C1A', fontSize: '20px', lineHeight: 1, cursor: 'pointer',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: masdesactivado ? 0.35 : 1,
          }}
        >
          +
        </button>
      </div>
    </div>
  )
}
