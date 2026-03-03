import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// StrictMode removed: Cesium/Resium does not support React 18 strict mode's
// double-mount behavior, which destroys the Cesium Viewer on initial render.
createRoot(document.getElementById('root')!).render(
  <App />
)
