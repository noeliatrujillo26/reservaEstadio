import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

// css original de la v1, copiado textual desde el <style> de panel-inicio.html.
// se queda aqui porque lo usa la landing, que es la ruta por defecto; las
// hojas de /legales, /mis-reservas y /admin viajan con su propia pagina.
import './styles/panel-inicio.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
