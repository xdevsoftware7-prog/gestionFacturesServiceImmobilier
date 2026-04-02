import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import NavbarAdmin from '../components/NavbarAdmin';

export default function LayoutAdmin() {
  return (
    <>
      <NavbarAdmin/>
      <div style={{ textAlign:'center',marginTop:'100px' }}>
        <p>Bienvenu Mr Ayoub</p>
        <p>Les stats vont arriver plus tot</p>
        <div style={{ padding:'20px' }}>
          <Outlet/>
        </div>
      </div>
    </>
    
  )
}
