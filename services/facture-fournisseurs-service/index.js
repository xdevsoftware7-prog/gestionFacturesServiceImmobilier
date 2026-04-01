// --- CRUD FACTURE-FOURNISSEURS ---
const SERVICE_ACHAT = 'achat'; // le service achat est le service qui gère les factures des fournisseurs
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

const PORT = 3012; // Les fqctures-fournisseurs écoute sur le port 3012

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


// CREATE : Ajouter une facture fournisseur
app.post('/api/factures-fournisseurs', async (req, res) => {
    try {
        const { fournisseur_id, numero, date, montant_ht, tva, frais_douane, statut } = req.body;
        
        // Calcul automatique du TTC si non fourni
        const montant_ttc = parseFloat(montant_ht) * (1 + parseFloat(tva) / 100) + parseFloat(frais_douane || 0);

        const [result] = await pool.execute(
            `INSERT INTO factures_fournisseurs (fournisseur_id, numero, date, montant_ht, tva, frais_douane, montant_ttc, statut) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [fournisseur_id, numero, date, montant_ht, tva, frais_douane || 0, montant_ttc, statut || 'en attente']
        );

        res.status(201).json({ message: "Facture fournisseur créée", id: result.insertId, ttc: montant_ttc });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de la création", error: error.message });
    }
});

// READ : Liste les factures-forunisseurs avec le nom du fournisseur
app.get('/api/factures-fournisseurs', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT f.*, fr.nom as fournisseur_nom 
            FROM factures_fournisseurs f
            JOIN fournisseurs fr ON f.fournisseur_id = fr.id
            ORDER BY f.date DESC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: "Erreur de récupération" ,error:error.message});
    }
});

// UPDATE : Modifier le statut
app.put('/api/factures-fournisseurs/:id', async (req, res) => {
    try {
        const { statut } = req.body;
        const { id } = req.params;

        await pool.execute(
            `UPDATE factures_fournisseurs 
             SET statut = ? WHERE id = ?`,
            [statut, id]
        );
        res.json({ message: "Facture mise à jour" });
    } catch (error) {
        res.status(500).json({ message: "Erreur de modification" });
    }
});
// Modification des montants de facture-fournisseurs
app.put('/api/factures-fournisseurs/:id', async (req, res) => {
    try {
        const {frais_douane, montant_ht, tva } = req.body;
        const { id } = req.params;

        // Recalcul du TTC pour la mise à jour
        const montant_ttc = parseFloat(montant_ht) * (1 + parseFloat(tva) / 100) + parseFloat(frais_douane || 0);

        await pool.execute(
            `UPDATE factures_fournisseurs 
             SET frais_douane = ?, montant_ht = ?, tva = ?, montant_ttc = ? 
             WHERE id = ?`,
            [frais_douane, montant_ht, tva, montant_ttc, id]
        );
        res.json({ message: "Facture mise à jour" });
    } catch (error) {
        res.status(500).json({ message: "Erreur de modification" });
    }
});

// DELETE une facture-founisseurs
app.delete('/api/factures-fournisseurs/:id', async (req, res) => {
    try {
        await pool.execute('DELETE FROM factures_fournisseurs WHERE id = ?', [req.params.id]);
        res.json({ message: "Facture supprimée" });
    } catch (error) {
        res.status(500).json({ message: "Erreur de suppression" });
    }
});