// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter  } from 'react-router-dom'
import App from './App'
import './index.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter >
      <App />
    </HashRouter >
  </React.StrictMode>
)