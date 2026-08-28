import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import LandingConfigProvider from './context/landingconfig'
import ReservaProvider from './context/reservacontext'
import ToastProvider from './context/toastcontext'

// css original de la v1, copiado textual desde el <style> de panel-inicio.html.
import './styles/panel-inicio.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <LandingConfigProvider>
          <ReservaProvider>
            <App />
          </ReservaProvider>
        </LandingConfigProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>
)
