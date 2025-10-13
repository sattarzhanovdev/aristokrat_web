import React from 'react'
import c from './navbar.module.scss'
import { LuLock } from 'react-icons/lu'
import { BiUser } from 'react-icons/bi'
import { useNavigate } from 'react-router-dom'

const Navbar = () => {
  const Navigate = useNavigate()

  return (
    <div className={c.navbar}>
      <div className={c.container}>
        <div className={c.block} onClick={() => Navigate('/profile')}>
          <BiUser />
        </div>
        <div className={c.block} onClick={() => Navigate('/admin')}>
          <LuLock />
        </div>
      </div>
    </div>
  )
}

export default Navbar