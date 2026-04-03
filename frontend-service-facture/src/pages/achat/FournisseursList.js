import React, { useEffect, useState } from 'react';
import api from '../../api/axiosConfig';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import FournisseursMap from '../../components/FournisseursMap';

export default function FournisseursList() {
    const [fournisseurs,setFournisseurs] = useState([]);
    const [currentPage,setCurrentPage] = useState(1);
    const [totalPages,setTotalPages] = useState(1);
    const [limit,setLimit] = useState(5);
    const [error,setError] = useState(null);
    const [loading,setLoading] = useState(true);
    const [activeCoords, setActiveCoords] = useState(null);

    
    const fetchFournisseurs = async (page,currentLimit)=>{
            try {
                setLoading(true);
                const response = await api.get(`/fournisseurs?page=${page}&limit=${currentLimit}`);
                console.log(response);
                setFournisseurs(response.data.data);
                setTotalPages(response.data.pagination.totalPages);
            } catch (error) {
                setError(error.response?.data?.message || "Erreur de connexion au serveur");
            }finally{
                setLoading(false);
            }
        };

    
    useEffect(()=>{
        fetchFournisseurs(currentPage,limit);
        
    },[currentPage,limit]);


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
        {loading ? <p>Chargement ...</p> : (<>
            {fournisseurs.length !== 0 ? <FournisseursMap fournisseurs={fournisseurs} activeCoords={activeCoords}></FournisseursMap> : ""}
            <div style={{ marginTop:'15px',display:'flex', alignItems:'center',gap:'10px' }}>
                <label htmlFor='limit-select'>Afficher: </label>
                <select id='limit-select' value={limit} onChange={(e)=>{
                    setLimit(parseInt(e.target.value));
                    setCurrentPage(1);
                }}
                style={{ padding:'5px',borderRight:'4px' }}
                >
                    <option value={5}>5 lignes</option>
                    <option value={10}>10 lignes</option>
                    <option value={20}>20 lignes</option>
                    <option value={50}>50 lignes</option>
                </select>
                <span>Fournisseurs par page</span>
            </div>
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
                            <button
                                onClick={(e)=>setActiveCoords([f.latitude,f.longitude])}
                                style={{ background: '#3498db', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', marginRight: '5px' }}
                            >
                                Voir
                            </button>
                            <Link to={`/achat/fournisseur/modifier/${f.id}`}>
                            <button style={{ background:'#27ae60',color:'white',border:'none',padding:'5px 10px',marginRight:'5px',borderRadius:'4px',cursor:'pointer' }}>Modifier</button>
                            </Link>
                            <button onClick={()=>handleSupprimer(f.id)} style={{ background:'#e74c3c',color:'white',border:'none',padding:'5px 10px', borderRadius:'4px',cursor:'pointer' }}>Supprimer</button>
                        </td>
                    </tr>
                )))}
                
            </tbody>
        </table>
        {/* Pagination */}
        <div style={{ marginTop:'20px', display:'flex', gap:'10px', alignItems:'center', }}>
            <button disabled = {currentPage === 1}
            onClick={()=>setCurrentPage(prev => prev - 1)}
            >Précédent</button>
            <span>Page {currentPage} sur {totalPages}</span>
            <button disabled={currentPage === totalPages} 
                onClick={()=>setCurrentPage(prev=>prev+1)}
            >Suivant</button>
        </div>
        </>)}
    </div>
  )
}
