// --- CRUD FOURNISSEURS ---
const SERVICE_ACHAT = 'achat'; // le service achat est le service qui gère les fournisseurs
require('dotenv').config();
const axios = require('axios');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const app = express();

app.use(express.json());

// Connexion MySQL
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user:process.env.DB_USER,
    password:process.env.DB_PASS,
    database:process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

const PORT = 3002; // La fournisseurs écoute sur le port 3002

const checkInternalSecret = (req, res, next) => {
    const secret = req.headers['x-internal-secret'];
    if (secret !== process.env.GATEWAY_KEY) {
        return res.status(403).json({ message: "Interdit : Accès direct non autorisé" });
    }
    next();
};

// Le pare feu: on autorise l'acces au micro service uniquement via gateway, l'acces directe est non autorise
app.use(checkInternalSecret);


// Coordonnées de votre entreprise (Exemple : Casablanca, Centre-ville)
const ENTREPRISE_COORDS = { lat: process.env.ENTP_LATITTUDE, lon: process.env.ENTP_LONGTITUDE };

async function getGeoDetails(adresse, ville, pays) {
    const query = `${adresse}, ${ville}, ${pays}`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    
    // Valeurs par défaut (Casablanca) au cas où l'API échoue
    const fallback = { 
        lat: process.env.ENTP_LATITTUDE, 
        lon: process.env.ENTP_LONGTITUDE, 
        distance_km: 0, 
        frais_douane: pays.toLowerCase() !== 'maroc' ? 150 : 0 
    };

    try {
        const response = await axios.get(url, { 
            headers: { 'User-Agent': 'GestionImmoApp/1.0' },
            timeout: 3000 // On n'attend pas plus de 3 secondes
        });

        if (response.data && response.data.length > 0) {
            // ... (votre logique Haversine ici) ...
            return { lat, lon, distance_km, frais_douane };
        }
        return fallback; // Adresse non trouvée je retourne l'adresse de l'entrp
    } catch (error) {
        console.warn("Géolocalisation échouée, utilisation du fallback.");
        return fallback; // API Nominatim hors ligne
    }
}



const authorizeService = (serviceRequis) => {
    return (req, res, next) => {
        // On récupère les infos injectées par la Gateway
        const userService = req.headers['x-user-service'];
        const userRole = req.headers['x-user-role'];

        if (userService !== serviceRequis && userRole !== 'admin') {
            return res.status(403).json({ message: "Accès refusé par le service" });
        }
        next();
    };
};


// 1. CREATE : Ajouter un fournisseur
app.post('/api/fournisseurs', authorizeService(SERVICE_ACHAT), async (req, res) => {
    try {
        const { nom, prenom, adresse, ville, pays } = req.body;
        
        if (!nom || !adresse || !ville || !pays) {
            return res.status(400).json({ message: "Les informations de localisation sont obligatoires" });
        }

        // Appel de la fonction de géolocalisation automatique
        const geo = await getGeoDetails(adresse, ville, pays);

        const [result] = await pool.execute(
            `INSERT INTO fournisseurs (nom, prenom, adresse, ville, pays, distance_km, frais_douane, latitude, longitude) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [nom, prenom, adresse, ville, pays, geo.distance_km, geo.frais_douane, geo.lat, geo.lon]
        );

        res.status(201).json({ 
            message: "Fournisseur créé avec succès", 
            id: result.insertId,
            details_geo: geo 
        });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de la création", error: error.message });
    }
});


// 2. READ : Liste de tous les fournisseurs
app.get('/api/fournisseurs', authorizeService(SERVICE_ACHAT), async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM fournisseurs ORDER BY id DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: "Erreur de récupération" ,error:error});
    }
});

// 3. READ : Un seul fournisseur par ID
app.get('/api/fournisseurs/:id', authorizeService(SERVICE_ACHAT), async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM fournisseurs WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: "Fournisseur non trouvé" });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: "Erreur" });
    }
});

// 4. UPDATE : Modifier un fournisseur
app.put('/api/fournisseurs/:id', authorizeService(SERVICE_ACHAT), authorizeService('achat'), async (req, res) => {
    try {
        const { nom, prenom, adresse,ville,pays,distance_km,frais_douane } = req.body;
        const id = req.params.id;

        await pool.execute(
            'UPDATE fournisseurs SET nom=?, prenom=?, adresse=?, ville=?, pays=?, distance_km=?, frais_douane=? WHERE id=?',
            [nom, prenom, adresse, ville, pays, distance_km, frais_douane,id]
        );

        res.json({ message: "Fournisseur mis à jour avec succès" });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de la modification" });
    }
});

// 5. DELETE : Supprimer un fournisseur (Réservé aux Admins ou service Achat)
app.delete('/api/fournisseurs/:id', authorizeService(SERVICE_ACHAT), authorizeService('achat', 'admin'), async (req, res) => {
    try {
        const [result] = await pool.execute('DELETE FROM fournisseurs WHERE id = ?', [req.params.id]);
        
        if (result.affectedRows === 0) return res.status(404).json({ message: "Fournisseur non trouvé" });
        
        res.json({ message: "Fournisseur supprimé" });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de la suppression" });
    }
});


app.listen(PORT, () => {
    console.log(`🚀 Api Fournisseur Prince running on http://localhost:${PORT}`);
});