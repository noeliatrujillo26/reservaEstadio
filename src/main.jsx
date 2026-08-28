import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import LandingConfigProvider from './context/landingconfig'

// css original de la v1, copiado textual desde el <style> de panel-inicio.html.
import './styles/panel-inicio.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <LandingConfigProvider>
        <App />
      </LandingConfigProvider>
    </BrowserRouter>
  </StrictMode>
)
