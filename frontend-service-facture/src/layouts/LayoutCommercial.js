import React from 'react';
import { Outlet, Link } from 'react-router-dom';

export default function LayoutCommercial() {
  return (
    <div>
        <nav style={{ background:'#27ae60',color:'white',padding:'10px' }}>
            <h3>ESPACE COMMERCIAL (Clients) </h3>
            <Link to="/commercial/factures" style={{ color:'white',marginRight:'10px' }}>Ventes</Link>
            <Link to="/commercial/clients" style={{ color:'white' }}>Clients</Link>
        </nav>
        <div style={{ padding:'20px' }}>
            <Outlet/>
        </div>
    </div>
  )
}
