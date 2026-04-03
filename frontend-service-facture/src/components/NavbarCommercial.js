import React from 'react'
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { logout } from '../store/authSlice';


function NavbarCommercial() {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const handleLogout = ()=>{
        dispatch(logout());
        navigate('/login');
    }

  return (
   <nav style={{ background:'#27ae60', color:'white', padding:'10px',display:'flex', justifyContent:'space-between' }}>
    <div style={{ display:'flex', gap:'20px', alignItems:'center' }}>
        <span style={{ fontWeight:'bold', fontSize:'1.2rem', borderRight:"1px solid white", paddingRight:'15px' }}>
            Espace-Commercial  (Client)
        </span>
        <Link to="/commercial" style={{color:'white', marginRight:'10px' }}>Dashboard</Link>
        <Link to="/commercial/factures" style={{color:'white', marginRight:'10px' }}>Factures</Link>
        <Link to="/commercial/clients" style={{color:'white' }}>Clients</Link>
    </div>
    <button onClick={handleLogout} style={{ background:'#e74c3c', color:'white' }}>Déconnexion</button>
    </nav>
  )
}

export default NavbarCommercial