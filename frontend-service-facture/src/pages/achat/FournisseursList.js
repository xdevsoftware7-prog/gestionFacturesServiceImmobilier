import React, { useEffect, useState } from 'react';
import api from '../../api/axiosConfig';

export default function FournisseursList() {
    const [fournisseurs,setFournisseurs] = useState([]);
    const [error,setError] = useState(null);

    useEffect(()=>{
        const fetchFournisseurs = async ()=>{
            try {
                const response = await api.get('/fournisseurs');
                setFournisseurs(response.data);
            } catch (error) {
                setError(error.response?.data?.message || "Erreur de connexion au serveur");
            }
        };

        fetchFournisseurs();
        
    },[]);
    if(error) return <div style={{ color:'red' }}>Erreur: {error}</div>
  return (
    <div>
        <h2>Liste des Fournisseurs</h2>
        <table border="1" cellPadding="10" style={{ width:'100%',borderCollapse:'collapse' }}>
            <thead>
                <tr>
                    <th>Nom</th>
                    <th>Prenom</th>
                    <th>Adresse</th>
                    <th>Ville</th>
                    <th>Pays</th>
                    <th>Distance Km</th>
                    <th>Frais Douane</th>
                </tr>
            </thead>
            <tbody>
                {fournisseurs.map(f=>(
                    <tr key={f.id}>
                        <td>{f.nom}</td>
                        <td>{f.prenom}</td>
                        <td>{f.adresse}</td>
                        <td>{f.ville}</td>
                        <td>{f.pays}</td>
                        <td>{f.distance_km}</td>
                        <td>{f.frais_douane}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
  )
}
