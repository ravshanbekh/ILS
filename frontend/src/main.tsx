import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const savedTheme = localStorage.getItem('theme');
if (!savedTheme) {
  localStorage.setItem('theme', 'light');
  document.documentElement.classList.add('light');
} else if (savedTheme === 'light') {
  document.documentElement.classList.add('light');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
