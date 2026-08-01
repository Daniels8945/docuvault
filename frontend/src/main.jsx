import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import { ThemeProvider } from './lib/ThemeContext.jsx'
import { AuthProvider } from './lib/AuthContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--c-surface)',
              color: 'var(--c-text)',
              border: '1px solid var(--c-border)',
              fontSize: 13,
              borderRadius: 10,
            },
            success: { iconTheme: { primary: '#22c55e', secondary: 'var(--c-surface)' } },
            error:   { iconTheme: { primary: 'var(--c-danger)', secondary: 'var(--c-surface)' } },
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
