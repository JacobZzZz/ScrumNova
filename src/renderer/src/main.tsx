import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { QuickCaptureApp } from './components/QuickCaptureApp'

const isQuickCapture = window.location.hash === '#quick-capture'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isQuickCapture ? <QuickCaptureApp /> : <App />}</StrictMode>
)
