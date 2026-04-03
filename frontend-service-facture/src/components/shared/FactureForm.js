import React, { useEffect, useState } from 'react';
import api from '../../api/axiosConfig';
import toast from 'react-hot-toast';

const today = new Date().toISOString().split('T')[0];

export default function FactureForm({type}) {
    //   styles
    const inputGroupStyle = {marginBottom: '15px'};
    const inputStyle = {width: '100%', padding:'8px', marginTop:'5px', boxSizing:'border-box', borderRadius:'4px', border:'1px solid #ccc'};

    const [tiers,setTiers] = useState([]); // liste des fournisseurs ou clients
    const endpoint = type === 'fournisseurs' ? "/fournisseurs?all=true" : "/clients?all=true";

    const [loading,setLoading] = useState(true);
    const [error,setError] = useState(null);
    const [formData,setFormData] = useState({tier_id :'', date: today, montant_ht:'', tva:20, frais_douane:0, statut:'en attente',montant_ttc:''});
    const [paysTier, setPaysTier] = useState("");

    useEffect(()=>{
        const fetchFournisseurOrClients = async()=>{
            try {
                setLoading(true);
                const response = await api.get(endpoint);
                setTiers(response.data.data);
            } catch (error) {
                setLoading(false);
                 setError(error.response?.data?.message || "Erreur de connexion au serveur");
                 toast.error(error.response?.data?.message || "Erreur de connexion");
            }finally{
                setLoading(false);
            }
        
        }
        fetchFournisseurOrClients();
    },[endpoint]);

    const handleChange = (e)=>{
        const {name,value} = e.target;
        // convertir les champs en float
        let newValue = value;
        if(name === 'montant_ht' || name === 'tva' || name === 'frais_douane'){
            newValue = parseFloat(value);
        }
        setFormData({...formData,[name]: newValue});
    }

    const handleTierChange = (e)=>{
        const selectedId = e.target.value;
        const [selectedTier] = tiers.filter(t=> t.id === parseInt(selectedId));
        let autoDoaune  = 0;
        let paysValue = '';

        if(selectedTier){
            console.log(selectedTier);
            paysValue = selectedTier.pays.toLowerCase().trim();
            const isEtranger =  paysValue !== 'maroc';
            autoDoaune = isEtranger ? 150 : 0;
            setPaysTier(paysValue)
        }
        setFormData({
            ...formData,
            tier_id:selectedId,
            frais_douane:autoDoaune
        });
    }
    
    const handleSubmit = async (e)=>{
        e.preventDefault();
        // validation
        if(!formData.tier_id){
            toast.error("Veuillez sélectionner un "+ (type === 'fournisseurs'? 'fournisseurs':'client'));
            return;
        }
        if(!formData.montant_ht || formData.montant_ht <= 0){
            toast.error("Le montant HT doit être supérieur à 0");
            return;
        }

        try {
            const data = {
                ...formData,
                [type === "fournisseurs" ? "fournisseur_id":"client_id"]:parseInt(formData.tier_id)
            }
            const targetUrl = type === 'fournisseurs' ? "/achat/factures-fournisseurs": "/commercial/factures-clients";
            const response = await api.post(targetUrl,data);
            toast.success(response.message || "Facture enregistrée avec succès");
            // Rénitialiser le formulaire après succès
            setFormData({
                tier_id:'',date:today,montant_ht:'',tva:20,frais_douane:0,statut:'en attente'
            });
        } catch (error) {
            toast.error("Erreur : " + (error.response?.data?.message || error.message));
            console.log("error lor envoie facture: ",error);
        }

    }

    if(error && !loading){
        return(
            <div style={{ maxWidth:'600px',margin:'20px auto',padding:'20px',textAlign:'center' }}>
                <p style={{ color:'red' }}>{error}</p>
                <button onClick={()=> window.location.reload()}>Réssayer</button>
            </div>
        );
    }
  return (
    <div style={{ maxWidth:'600px',margin:'20px auto', padding:'20px', border:"1px solid #ddd", borderRadius:'8px'  }}>
        <h2>Facture {type === 'fournisseurs' ? "Fournisseur": "Client"}</h2>
        <form onSubmit={handleSubmit} >
            <div style={inputGroupStyle}>
                <label>{type === 'fournisseurs' ? 'Founisseur':'Client'}</label>
                <select name='tier_id' value={formData.tier_id} onChange={(e)=>handleTierChange(e)} required style={inputStyle}>
                    <option>-----Sélectionner------</option>
                    {tiers.map((t)=>(
                        <option key={t.id} value={t.id}>{t.nom} {t.prenom}</option>
                    ))}
                </select>
            </div>
            <div style={inputGroupStyle}>
                <label>Date</label>
                <input type='date' name='date' value={formData.date} onChange={handleChange} required style={inputStyle} />
            </div>
            <div style={inputGroupStyle}>
                <label>Montant Hors Taxe</label>
                <input type='number' name='montant_ht' value={formData.montant_ht} onChange={handleChange} required style={inputStyle} />
            </div>
            <div style={inputGroupStyle}>
                <label>TVA</label>
                <input type='number' name='tva' value={formData.tva} onChange={handleChange} required style={inputStyle} />
            </div>
            <div style={inputGroupStyle}>
                <label>Frais Douane</label>
                <input type='number' name='frais_douane' value={formData.frais_douane} onChange={handleChange} style={inputStyle}/>
            </div>
            <div style={inputGroupStyle}>
                <label>Statut</label>
                <select name='statut' value={formData.statut} onChange={handleChange} style={inputStyle}>
                    <option value="en attente">En Attente</option>
                    <option value="partiellement payée">Partiellement Payée</option>
                    <option value="payée">Payée</option>
                    <option value="annulée">Annulée</option>
                </select>
            </div>
            <div style={inputGroupStyle}>
                <label>Montant TTC</label>
                <input type='number' name='montant_ttc' value={formData.montant_ttc} readOnly style={inputStyle}/>
            </div>
            <button type='submit' disabled = {loading} 
            style={{ 
                width:'100%', padding:'12px', background: loading ? '#ccc':'#2c3e50', color:'white',border:'none',borderRadius:'4px',cursor: loading ? 'not-allowed': 'pointer', fontSize:'1rem'
             }}>
               Ajouter Facture
            </button>
            
        </form>
    </div>
  )
}
