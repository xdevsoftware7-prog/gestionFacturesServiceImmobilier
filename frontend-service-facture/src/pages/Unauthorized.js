import React from 'react';
import { Link } from 'react-router-dom';

export default function Unauthorized() {
  return (
    <div style={{ textAlign:'center',color:'red',marginTop:'100px' }}>
        <h1>Acces Refuse</h1>
        <p>Vous n'avez pas les permissions nécessaires pour voir cette page</p>
        {/* Il faut que je creer une page d'acceuil et puis rediriger user */}
        <Link to="/login">Se Connceter</Link> 
    </div>
  )
}
