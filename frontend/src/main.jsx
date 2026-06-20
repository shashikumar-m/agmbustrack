import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import SplashScreen from './SplashScreen.jsx'

function Root() {
  const [splashDone, setSplashDone] = useState(false);
  return splashDone ? <App /> : <SplashScreen onDone={() => setSplashDone(true)} />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
