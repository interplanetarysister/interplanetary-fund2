import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { installPlatformErrorReporting } from '@/lib/platformErrorReporter'
installPlatformErrorReporting()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
