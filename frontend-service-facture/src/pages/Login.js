import React, { useState } from 'react';
import {useDispatch} from 'react-redux';
import {useNavigate} from 'react-router-dom';
import api from '../api/axiosConfig';
import {loginSuccess} from '../store/authSlice';

export default function Login() {
    const [email,setEmail] = useState("");
    const [password,setPassword] = useState("");
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const handleLogin = async (e)=>{
        e.preventDefault();
        try{
            const response = await api.post('auth/login',{email,password});
            console.log(response);
            const {token, user} = response.data;
            const {role,service} = user;
            // Remplissage de Redux et de localStorage
            dispatch(loginSuccess({token,role,service}));

            // Redirection selon les services
            if(role === 'admin') navigate('/admin');
            else if(service === 'achat') navigate("/achat");
            else navigate("/commercial");
        }catch(error){
            alert("Erreur d'authentification: ",error.response?.data?.message);
        }
    }
  return (
    <div style={{ padding:'50px', textAlign:'center' }}>
        <h2>Conncexion - Service Immobilier</h2>
        <form onSubmit={handleLogin}>
            <input type='email' onChange={(e)=>setEmail(e.target.value)} placeholder='Votre Email'/>
            <input type='password' onChange={(e)=>setPassword(e.target.value)} placeholder='Votre Mot de Passe'/>
            <button type='submit'>Se Connecter</button>
        </form>
    </div>
  )
}
