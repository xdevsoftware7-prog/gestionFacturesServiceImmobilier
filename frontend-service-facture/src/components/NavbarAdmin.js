import React from 'react'
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { logout } from '../store/authSlice';


function NavbarAdmin() {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const handleLogout = ()=>{
        dispatch(logout());
        navigate('/login');
    }

  return (
   <nav style={{ background:'#7c4b8b', color:'white', padding:'10px',display:'flex', justifyContent:'space-between' }}>
    <div style={{ display:'flex', gap:'20px', alignItems:'center' }}>
        <span style={{ fontWeight:'bold', fontSize:'1.2rem', borderRight:"1px solid white", paddingRight:'15px' }}>
            Espace-Admin
        </span>
        <Link to="/admin" style={{color:'white', marginRight:'10px' }}>Dashboard</Link>
        <Link to="/admin/fournisseur-stats" style={{color:'white', marginRight:'10px' }}>Fournisseurs Stats</Link>
        <Link to="/admin/clients-stats" style={{color:'white' }}>Clients Stats</Link>
    </div>
    <button onClick={handleLogout} style={{ background:'#e74c3c', color:'white' }}>Déconnexion</button>
    </nav>
  )
}

export default NavbarAdmin