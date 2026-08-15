import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthContext.tsx'
import { FavoritesProvider } from './auth/FavoritesContext.tsx'
import { RecentObjectsProvider } from './auth/RecentObjectsContext.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <FavoritesProvider>
        <RecentObjectsProvider>
          <App />
        </RecentObjectsProvider>
      </FavoritesProvider>
    </AuthProvider>
  </React.StrictMode>,
)
