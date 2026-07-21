import React from 'react'
import c from './navbar.module.scss'
import { LuLock, LuHouse } from 'react-icons/lu'
import { BiUser } from 'react-icons/bi'
import { useNavigate, useLocation } from 'react-router-dom'
import logo from '../../images/logo.svg'

const Navbar = () => {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  let isAdmin = false
  try {
    isAdmin = JSON.parse(localStorage.getItem('user'))?.role === 'admin'
  } catch {}

  const isActive = (p) => pathname === p

  return (
    <nav className={c.navbar}>
      <div className={c.container}>
        <button
          className={c.brand}
          onClick={() => navigate('/')}
          aria-label="На главную"
        >
          <span className={c.brandLogo}>
            <img src={logo} alt="Amanat City" />
          </span>
        </button>

        <div className={c.actions}>
          {pathname !== '/' && (
            <button
              className={c.block}
              onClick={() => navigate('/')}
              aria-label="Главная"
            >
              <LuHouse />
            </button>
          )}

          <button
            className={`${c.block} ${isActive('/profile') ? c.active : ''}`}
            onClick={() => navigate('/profile')}
            aria-label="Профиль"
          >
            <BiUser />
          </button>

          {isAdmin && (
            <button
              className={`${c.block} ${isActive('/admin') ? c.active : ''}`}
              onClick={() => navigate('/admin')}
              aria-label="Панель администратора"
            >
              <LuLock />
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar
