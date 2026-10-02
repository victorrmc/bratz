import { createRoot } from 'react-dom/client'
import { lazy, StrictMode, Suspense } from 'react'
import '@fontsource/fredoka/latin-500.css'
import '@fontsource/fredoka/latin-600.css'
import '@fontsource/fredoka/latin-700.css'
import '@fontsource/nunito/latin-500.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-800.css'
import './ui/styles.css'
import App from './App'

const DevView = lazy(() => import('./three/DevView'))
const dev = import.meta.env.DEV && new URLSearchParams(location.search).has('cam')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {dev ? (
      <Suspense fallback={null}>
        <DevView />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
