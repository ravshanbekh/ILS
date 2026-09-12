import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initTheme } from './theme/theme'

// index.html'dagi inline script allaqachon data-theme'ni qo'ygan (chaqnashning
// oldini olish uchun). Bu yerda shu holat modul holati bilan moslanadi.
initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
