// --- CRUD CLIENT ---
const SERVICE_COMMERCIAL = 'commercial'; // le service commercial est le service qui gère les clients
require('dotenv').config();
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

const PORT = 3003; // Les clients écoute sur le port 3003

const checkInternalSecret = (req, res, next) => {
    const secret = req.headers['x-internal-secret'];
    if (secret !== process.env.GATEWAY_KEY) {
        return res.status(403).json({ message: "Interdit : Accès direct non autorisé" });
    }
    next();
};

// Le pare feu: on autorise l'acces au micro service uniquement via gateway, l'acces directe est non autorise
app.use(checkInternalSecret);

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


// 1. CREATE : Ajouter un client
app.post('/api/clients', authorizeService(SERVICE_COMMERCIAL), async (req, res) => {
    try {
        const { nom, prenom, adresse,ville,pays,distance_km,frais_douane } = req.body;
        
        if (!nom) return res.status(400).json({ message: "Le nom du client est obligatoire" });

        const [result] = await pool.execute(
            'INSERT INTO clients (nom, prenom, adresse, ville,pays,distance_km,frais_douane) VALUES (?,?, ?, ?, ?, ?, ?)',
            [nom, prenom, adresse, ville,pays,distance_km,frais_douane]
        );

        res.status(201).json({ message: "client créé", id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de la création", error: error.message });
    }
});

// 2. READ : Liste de tous les clients
app.get('/api/clients', authorizeService(SERVICE_COMMERCIAL), async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM clients ORDER BY id DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: "Erreur de récupération" ,error:error});
    }
});

// 3. READ : Un seul client par ID
app.get('/api/clients/:id', authorizeService(SERVICE_COMMERCIAL), async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM clients WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: "client non trouvé" });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: "Erreur" });
    }
});

// 4. UPDATE : Modifier un client
app.put('/api/clients/:id', authorizeService(SERVICE_COMMERCIAL), authorizeService('achat'), async (req, res) => {
    try {
        const { nom, prenom, adresse,ville,pays,distance_km,frais_douane } = req.body;
        const id = req.params.id;

        await pool.execute(
            'UPDATE clients SET nom=?, prenom=?, adresse=?, ville=?, pays=?, distance_km=?, frais_douane=? WHERE id=?',
            [nom, prenom, adresse, ville, pays, distance_km, frais_douane,id]
        );

        res.json({ message: "client mis à jour avec succès" });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de la modification" });
    }
});

// 5. DELETE : Supprimer un client (Réservé aux Admins ou service Achat)
app.delete('/api/clients/:id', authorizeService(SERVICE_COMMERCIAL), authorizeService('achat', 'admin'), async (req, res) => {
    try {
        const [result] = await pool.execute('DELETE FROM clients WHERE id = ?', [req.params.id]);
        
        if (result.affectedRows === 0) return res.status(404).json({ message: "client non trouvé" });
        
        res.json({ message: "client supprimé" });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de la suppression" });
    }
});


app.listen(PORT, () => {
    console.log(`🚀 Api client Prince running on http://localhost:${PORT}`);
});