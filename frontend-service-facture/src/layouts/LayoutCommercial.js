import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import NavbarCommercial from '../components/NavbarCommercial';

export default function LayoutCommercial() {
  return (
    <div>
        <NavbarCommercial/>
        <div style={{ padding:'20px' }}>
            <Outlet/>
        </div>
    </div>
  )
}
