import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { MascotOverlay } from './components/MascotOverlay'
import './styles.css'

const view = window.location.hash.replace('#', '')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {view === 'mascot' ? <MascotOverlay /> : <App />}
  </React.StrictMode>
)
