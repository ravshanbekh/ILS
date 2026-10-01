import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initTheme } from './theme/theme'

// index.html'dagi inline script allaqachon data-theme'ni qo'ygan (chaqnashning
// oldini olish uchun). Bu yerda shu holat modul holati bilan moslanadi.
initTheme();

// iOS Safari `:active` holatini faqat sahifada touchstart tinglovchisi
// bo'lsagina ko'rsatadi. Usiz index.css 9-bo'limdagi "bosilish" effekti
// iPhone'da umuman ishlamaydi. Bo'sh, passive — scroll'ni sekinlashtirmaydi.
document.addEventListener('touchstart', () => {}, { passive: true });

// Rasmlar yuklanganda yumshoq ochilsin (index.css: img.ios-img-in).
// `load` hodisasi yuqoriga ko'tarilmaydi, shuning uchun capture fazasida
// bitta global tinglovchi — har bir <img> komponentiga tegish shart emas.
// Klass faqat yuklanganda qo'shiladi: rasm hech qachon ko'rinmay qolmaydi.
document.addEventListener(
  'load',
  (e) => {
    const el = e.target;
    if (el instanceof HTMLImageElement) el.classList.add('ios-img-in');
  },
  true,
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
