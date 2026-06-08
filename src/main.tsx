import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// i18n init runs on import — must be imported before any component that uses
// useTranslation(), otherwise the first render misses the locale.
import './i18n'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
