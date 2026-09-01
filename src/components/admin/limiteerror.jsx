// ═══════════════════════════════════════════════════════════════════
// limiteerror.jsx — aisla el fallo de UN modulo del resto del panel.
//
// POR QUE EXISTE: un error dentro de una vista desmontaba TODO el arbol de
// react y dejaba la pagina en blanco. Peor todavia, el panel recuerda la
// ultima seccion visitada en localStorage, asi que recargar volvia a entrar a
// la seccion rota y a romperse otra vez: no habia forma de salir sin borrar el
// cache del navegador. Paso de verdad con la vista de Precios.
//
// Con este limite, un modulo que falle muestra su error y deja el menu y el
// resto del panel en pie. Al cambiar de seccion se reinicia solo.
//
// Tiene que ser una clase: los limites de error son la unica parte de react
// que aun no tiene equivalente con hooks.
// ═══════════════════════════════════════════════════════════════════

import { Component } from 'react'

class limiteerror extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // al log del navegador, para que F12 diga exactamente que fallo y donde.
    console.error('Panel · fallo en la vista "' + this.props.vista + '":', error, info)
  }

  componentDidUpdate(prev) {
    // cambiar de seccion limpia el error: la vista nueva merece su oportunidad.
    if (this.state.error && prev.vista !== this.props.vista) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div style={{ padding: '28px' }}>
        <div className="card" style={{ padding: '22px 24px', maxWidth: '640px' }}>
          <div className="card-title" style={{ marginBottom: '8px' }}>
            No se pudo mostrar esta sección
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6, margin: '0 0 12px' }}>
            El resto del panel sigue funcionando: elige otra sección en el menú.
          </p>
          <pre
            style={{ fontSize: '11.5px', color: 'var(--text-3)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', overflowX: 'auto', margin: '0 0 14px' }}
          >
            {String(this.state.error && this.state.error.message)}
          </pre>
          <button className="btn btn-primary btn-sm" onClick={this.props.onvolver}>
            Ir al Dashboard
          </button>
        </div>
      </div>
    )
  }
}

export default limiteerror
