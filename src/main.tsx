import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@appica/ui-react/providers/theme-provider'
import { App } from './app/App'
import './index.css'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Missing #root element')

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider themes={['light', 'dark']} storageKey="pairany-theme" disableTransitionOnChange>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
