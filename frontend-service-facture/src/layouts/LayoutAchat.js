import React from 'react'
import { Outlet, Link } from 'react-router-dom';


export default function LayoutAchat() {
  return (
    <div>
        <nav style={{ background:'#2c3e50', color:'white', padding:'10px' }}>
            <h3>Espace Achat (Fournisseurs)</h3>
            <link to="/achat/factures" style={{color:'white', marginRight:'10px' }}>Factures</link>
            <link to="/achat/fournisseurs" style={{color:'white' }}>Fournisseurs</link>
        </nav>
        <div style={{ padding:'20px' }}>
            <Outlet/>
        </div>
    </div>
  )
}
