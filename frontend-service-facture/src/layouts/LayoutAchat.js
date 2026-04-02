import React from 'react'
import { Outlet, Link } from 'react-router-dom';
import NavbarAchat from '../components/NavbarAchat';


export default function LayoutAchat() {
  return (
    <div>
        <NavbarAchat/>
        <div style={{ padding:'20px' }}>
            <Outlet/>
        </div>
    </div>
  )
}
