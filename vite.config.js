import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base '/reserva-express/': este proyecto se despliega como su propio
// deployment de Vercel, pero solo se expone al publico via un rewrite desde
// reservaestadio.com que preserva el prefijo /reserva-express/* (proxy, ver
// vercel.json de asadores-panel-master). Con base '/', los assets del build
// (JS/CSS) se referenciarian como /assets/... y el navegador los pediria
// contra la RAIZ de reservaestadio.com (donde no existen) en vez de contra
// este deployment. El propio vercel.json de este proyecto le quita el
// prefijo antes de servir el archivo fisico (ver rewrite de /assets/:path*).
//
// https://vite.dev/config/
export default defineConfig({
  base: '/reserva-express/',
  plugins: [react()],
})
