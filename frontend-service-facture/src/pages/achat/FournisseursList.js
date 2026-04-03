import React, { useEffect, useState } from 'react';
import api from '../../api/axiosConfig';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

export default function FournisseursList() {
    const [fournisseurs,setFournisseurs] = useState([]);
    const [error,setError] = useState(null);
    const [loading,setLoading] = useState(true);

    
    const fetchFournisseurs = async ()=>{
            try {
                setLoading(true);
                const response = await api.get('/fournisseurs');
                setFournisseurs(response.data);
            } catch (error) {
                setError(error.response?.data?.message || "Erreur de connexion au serveur");
            }finally{
                setLoading(false);
            }
        };

    
    useEffect(()=>{
        fetchFournisseurs();
        
    },[]);


    const handleSupprimer = async (id)=>{
        if(!window.confirm("Êtes vous sûr  de vouloire supprimer ce founisseur? ")){
            return;
        }

        try {
            const response = await api.delete(`/fournisseurs/${id}`);
            // Mise à jour de UI
            setFournisseurs(fournisseurs.filter(f => f.id !== id));

            toast.success(response.data.message || "Fournisseur supprimé avec succès");
        } catch (error) {
            toast.error("Erreur vient lors suppression: " + (error.response?.data?.message || error.message));
        }
    };





    if(loading) return <p style={{ display:'flex', justifyContent:'center' }}>Chargement des fournisseurs ....</p>

    if(error) return <div style={{ color:'red' }}>Erreur: {error}</div>
  
return (
    <div style={{ padding:'20px' }}>
        <h2>Liste des Fournisseurs</h2>
        <Link to="/achat/fournisseur/nouveau">Ajouter Un nouveau Fournisseur</Link>
        <table border="1" cellPadding="10" style={{ width:'100%',borderCollapse:'collapse',textAlign:'left' }}>
            <thead style={{ backgroundColor:'#f4f4f4' }}>
                <tr>
                    <th>Nom</th>
                    <th>Prenom</th>
                    <th>Adresse</th>
                    <th>Ville</th>
                    <th>Pays</th>
                    <th>Distance Km</th>
                    <th>Frais Douane</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {fournisseurs.length === 0 ? (<tr><td colSpan="8" style={{ textAlign:'center' }}>Aucun Founisseur</td></tr>):(fournisseurs.map(f=>(
                    <tr key={f.id}>
                        <td>{f.nom}</td>
                        <td>{f.prenom}</td>
                        <td>{f.adresse}</td>
                        <td>{f.ville}</td>
                        <td>{f.pays}</td>
                        <td>{f.distance_km}</td>
                        <td>{f.frais_douane}</td>
                        <td>
                            <Link to={`/achat/`}>
                            <button style={{ background:'#27ae60',color:'white',border:'none',padding:'5px 10px',marginRight:'5px',borderRadius:'4px',cursor:'pointer' }}>Modifier</button>
                            </Link>
                            <button onClick={()=>handleSupprimer(f.id)} style={{ background:'#e74c3c',color:'white',border:'none',padding:'5px 10px', borderRadius:'4px',cursor:'pointer' }}>Supprimer</button>
                        </td>
                    </tr>
                )))}
                
            </tbody>
        </table>
    </div>
  )
}
