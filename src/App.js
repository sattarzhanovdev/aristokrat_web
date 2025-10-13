import React from 'react'
import axios from 'axios'
import { MainRoutes } from './routes';
import './App.scss'
import { Components } from './components';
import { useNavigate } from 'react-router-dom';

axios.defaults.baseURL = 'https://aristokratamanat.pythonanywhere.com'

function App() {
  const Navigate = useNavigate()
  const path = window.location.pathname
  React.useEffect(() => {
    const accessToken = localStorage.getItem('accessToken')
    if(!accessToken) Navigate('/login')
  }, [path])
  return (
    <div>
      <Components.Navbar />
      <MainRoutes />
    </div>
  )
}

export default App