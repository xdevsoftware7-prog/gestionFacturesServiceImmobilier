import React from 'react'
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { logout } from '../store/authSlice';


function NavbarAchat() {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const handleLogout = ()=>{
        dispatch(logout());
        navigate('/login');
    }

  return (
   <nav style={{ background:'#2c3e50', color:'white', padding:'10px',display:'flex', justifyContent:'space-between' }}>
    <div style={{ display:'flex', gap:'20px', alignItems:'center' }}>
        <span style={{ fontWeight:'bold', fontSize:'1.2rem', borderRight:"1px solid white", paddingRight:'15px' }}>
            Espace-Achat  (Founisseur)
        </span>
        <Link to="/achat" style={{color:'white', marginRight:'10px' }}>Dashboard</Link>
        <Link to="/achat/factures" style={{color:'white', marginRight:'10px' }}>Factures</Link>
        <Link to="/achat/fournisseurs" style={{color:'white' }}>Fournisseurs</Link>
    </div>
    <button onClick={handleLogout} style={{ background:'#e74c3c', color:'white' }}>Déconnexion</button>
    </nav>
  )
}

export default NavbarAchat