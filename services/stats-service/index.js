const SERVICE_STATS = 'stats'; 
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const app = express();

app.use(express.json());
const cors = require('cors');
app.use(cors()); 

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

const PORT = 3015;

// Middleware de sécurité (Secret partagé avec la Gateway)
const checkInternalSecret = (req, res, next) => {
    if (req.headers['x-internal-secret'] !== process.env.GATEWAY_KEY) {
        return res.status(403).json({ message: "Accès direct interdit" });
    }
    next();
};
app.use(checkInternalSecret);

// Route principale du Dashboard
app.get('/api/stats/dashboard', async (req, res) => {
    try {
        // 1. Calcul des Revenus (Clients)
        const [revenus] = await pool.execute(`
            SELECT 
                SUM(montant_ttc) as total_ventes,
                SUM(CASE WHEN statut = 'payée' THEN montant_ttc ELSE 0 END) as total_encaisse,
                COUNT(*) as nb_factures_clients
            FROM factures_clients
        `);

        // 2. Calcul des Dépenses (Fournisseurs)
        const [depenses] = await pool.execute(`
            SELECT 
                SUM(montant_ttc) as total_achats,
                SUM(CASE WHEN statut = 'payée' THEN montant_ttc ELSE 0 END) as total_decaisse,
                COUNT(*) as nb_factures_fournisseurs
            FROM factures_fournisseurs
        `);

        // 3. Calcul du Reste à Payer Global (Dettes vs Créances)
        const [paiements_clients] = await pool.execute('SELECT SUM(montant) as total FROM paiements_clients');
        const [paiements_fournisseurs] = await pool.execute('SELECT SUM(montant) as total FROM paiements_fournisseurs');

        const creances_clients = (revenus[0].total_ventes || 0) - (paiements_clients[0].total || 0);
        const dettes_fournisseurs = (depenses[0].total_achats || 0) - (paiements_fournisseurs[0].total || 0);

        res.json({
            performance: {
                chiffre_affaires: revenus[0].total_ventes || 0,
                total_depenses: depenses[0].total_achats || 0,
                benefice_theorique: (revenus[0].total_ventes || 0) - (depenses[0].total_achats || 0)
            },
            tresorerie: {
                cash_reel: (paiements_clients[0].total || 0) - (paiements_fournisseurs[0].total || 0),
                a_recevoir: creances_clients,
                a_payer: dettes_fournisseurs
            },
            activite: {
                factures_clients: revenus[0].nb_factures_clients,
                factures_fournisseurs: depenses[0].nb_factures_fournisseurs
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur lors du calcul des statistiques" });
    }
});

app.listen(PORT, () => {
    console.log(`📊 Stats Service running on http://localhost:${PORT}`);
});