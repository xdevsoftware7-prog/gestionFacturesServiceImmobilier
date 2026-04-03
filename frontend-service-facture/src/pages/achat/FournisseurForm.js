import React, { useEffect, useState } from 'react';
import api from '../../api/axiosConfig';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';



export default function FournisseurForm() {
//   styles
const inputGroupStyle = {marginBottom: '15px'};
const inputStyle = {width: '100%', padding:'8px', marginTop:'5px', boxSizing:'border-box', borderRadius:'4px', border:'1px solid #ccc'};

    const navigate = useNavigate();
    const [loading,setLoading] = useState(false);
    const [formData,setFormData] = useState({
        nom:'',prenom:'',adresse:"",ville:"",pays:'Maroc'
    });
    const {id} = useParams();
    const isEditMode = Boolean(id);


    useEffect(()=>{
        if(isEditMode){
            const fetchFournisseur = async ()=>{
                try {
                    const response = await api.get(`/fournisseurs/${id}`);
                    setFormData(response.data);
                } catch (error) {
                    toast.error("Impossible de charger les infos Fournisseur");
                    navigate("/achat/fournisseurs");
                }
            }
            fetchFournisseur();
        }
    },[id,isEditMode,navigate]);

    const handleChange = (e) =>{
        setFormData({...formData, [e.target.name]: e.target.value});
    }

    const handleSubmit = async (e)=>{
        e.preventDefault();
        setLoading(true);
        try {
            if(isEditMode){
                const response = await api.put(`/fournisseurs/${id}`,formData);
                toast.success(response.data.message || "Founisseur mis à jour avec succès ");
            }else{
                const response = await api.post('/fournisseurs',formData);
                toast.success(response.data.message || "Founisseur ajouté avec succès ");

            }
            // redirection après 1.5s vers la liste des founisseurs
            setTimeout(()=>navigate("/achat/fournisseurs"),1500);
        } catch (error) {
            const msg = error.response?.data?.message || "Erreur lors  "+(isEditMode ? "de Modification" : "d'Ajout");
            console.log(error);
            toast.error(msg);
        }finally{
            setLoading(false);
        }
    }



  return (
    
    <div style={{ maxWidth:'600px',margin:'20px auto', padding:'20px', border:"1px solid #ddd", borderRadius:'8px'  }}>
        <h2>{isEditMode ? "Modifier" : "Ajouter Un Nouveau"} Founisseur</h2>
        <form onSubmit={handleSubmit} >
            <div style={inputGroupStyle}>
                <label>Nom</label>
                <input type='text' name='nom' value={formData.nom} onChange={handleChange} required style={inputStyle} />
            </div>
            <div style={inputGroupStyle}>
                <label>Prénom</label>
                <input type='text' name='prenom' value={formData.prenom} onChange={handleChange} required style={inputStyle} />
            </div>
            <div style={inputGroupStyle}>
                <label>Adresse</label>
                <input type='text' name='adresse' value={formData.adresse} onChange={handleChange} required style={inputStyle} />
            </div>
            <div style={inputGroupStyle}>
                <label>Ville</label>
                <input type='text' name='ville' value={formData.ville} onChange={handleChange} required style={inputStyle} />
            </div>
            <div style={inputGroupStyle}>
                <label>Pays</label>
                <select name='pays' value={formData.pays} onChange={handleChange} style={inputStyle}>
                    <option value="Maroc">Maroc</option>
                    <option value="France">France</option>
                    <option value="Espagne">Espagne</option>
                    <option value="Maroc">Autre (Étranger)</option>
                </select>
            </div>
            <button type='submit' disabled = {loading} 
            style={{ 
                width:'100%', padding:'12px', background: loading ? '#ccc':'#2c3e50', color:'white',border:'none',borderRadius:'4px',cursor: loading ? 'not-allowed': 'pointer', fontSize:'1rem'
             }}>
                {loading ? 'Calcul  de la position en cours....': (isEditMode ? "Modifier Fournisseur": "Enregistrer le Fournisseur")}
            </button>
            
        </form>
    </div>
  )

}
