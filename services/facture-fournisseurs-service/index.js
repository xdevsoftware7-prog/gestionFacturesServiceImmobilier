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


// Generation de numero facture automatiquement sous forme: 'FAC-FOUR-2026-0001'
const generateInvoiceNumber = async (type) => {
    const table = type === 'fournisseur' ? 'factures_fournisseurs' : 'factures_clients';
    const prefix = type === 'fournisseur' ? 'FAC-FOUR' : 'FAC-CLI';
    const year = new Date().getFullYear();

    // On cherche le dernier numéro pour l'année en cours
    const [rows] = await pool.execute(
        `SELECT numero FROM ${table} WHERE numero LIKE ? ORDER BY id DESC LIMIT 1`,
        [`${prefix}-${year}-%`]
    );

    let nextNumber = 1;
    if (rows.length > 0) {
        // On extrait le dernier nombre (ex: de "FAC-FOUR-2026-0005" on tire 5)
        const lastNumero = rows[0].numero;
        const lastCount = parseInt(lastNumero.split('-').pop());
        nextNumber = lastCount + 1;
    }

    // On formate avec des zéros au début (ex: 0001, 0002...)
    const formattedNumber = String(nextNumber).padStart(4, '0');
    return `${prefix}-${year}-${formattedNumber}`;
};

// CREATE : Ajouter une facture fournisseur
app.post('/api/factures-fournisseurs', async (req, res) => {
    try {
        const { fournisseur_id, date, montant_ht, tva, frais_douane, statut } = req.body;
        const numero = await generateInvoiceNumber('fournisseur');
        // Calcul automatique du TTC si non fourni
        const montant_ttc = parseFloat(montant_ht) * (1 + parseFloat(tva) / 100) + parseFloat(frais_douane || 0);

        const [result] = await pool.execute(
            `INSERT INTO factures_fournisseurs (fournisseur_id, numero, date, montant_ht, tva, frais_douane, montant_ttc, statut) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [fournisseur_id, numero, date, montant_ht, tva, frais_douane || 0, montant_ttc, statut || 'en attente']
        );

        res.status(201).json({ message: "Facture fournisseur créée", id: result.insertId, numero: numero, ttc: montant_ttc });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de la création", error: error.message });
    }
});

// READ : Lister les factures-fournisseurs avec filtres (statut, fournisseur_id, numero)
app.get('/api/factures-fournisseurs', async (req, res) => {
    try {
        const { statut, fournisseur_id, numero } = req.query;
        let query = `
            SELECT f.*, fr.nom as fournisseur_nom, fr.prenom as fournisseur_prenom 
            FROM factures_fournisseurs f
            JOIN fournisseurs fr ON f.fournisseur_id = fr.id
            WHERE 1=1`; // Le "1=1" facilite l'ajout dynamique de conditions AND
        
        const params = [];

        if (statut) {
            query += ` AND f.statut = ?`;
            params.push(statut);
        }
        if (fournisseur_id) {
            query += ` AND f.fournisseur_id = ?`;
            params.push(fournisseur_id);
        }
        if (numero) {
            query += ` AND f.numero LIKE ?`;
            params.push(`%${numero}%`);
        }

        query += ` ORDER BY f.date DESC`;

        const [rows] = await pool.execute(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: "Erreur de récupération", error: error.message });
    }
});

// Modification des montants de facture-fournisseurs ou de statut
// et depend sur la valeur de statut, on effectue des transcations surla table paiment-fournisseur

app.put('/api/factures-fournisseurs/:id', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { statut, frais_douane, montant_ht, tva, montant_paye } = req.body; // montant_paye est optionnel ici
        const { id } = req.params;

        // Recalcul du TTC
        const montant_ttc = parseFloat(montant_ht) * (1 + parseFloat(tva) / 100) + parseFloat(frais_douane || 0);

        // 1. Mise à jour de la facture
        await connection.execute(
            `UPDATE factures_fournisseurs 
             SET statut = ?, frais_douane = ?, montant_ht = ?, tva = ?, montant_ttc = ? 
             WHERE id = ?`,
            [statut, frais_douane, montant_ht, tva, montant_ttc, id]
        );

        // 2. Gestion des paiements selon le statut
        if (statut === 'payée') {
            // Si on force 'payée', on crée un paiement pour le montant TOTAL restant
            const [payments] = await connection.execute('SELECT SUM(montant) as total FROM paiements_fournisseurs WHERE facture_id = ?', [id]);
            const deja_paye = payments[0].total || 0;
            const reste_a_payer = montant_ttc - deja_paye;

            if (reste_a_payer > 0) {
                await connection.execute(
                    `INSERT INTO paiements_fournisseurs (facture_id, date, montant, mode_paiement) VALUES (?, NOW(), ?, ?)`,
                    [id, reste_a_payer, 'Virement']
                );
            }
        } 
        else if (statut === 'partiellement payée' && montant_paye > 0) {
            // On ajoute juste le nouveau versement
            await connection.execute(
                `INSERT INTO paiements_fournisseurs (facture_id, date, montant, mode_paiement) VALUES (?, NOW(), ?, ?)`,
                [id, montant_paye, 'Virement']
            );
        }
        else if (statut === 'annulée') {
            await connection.execute('DELETE FROM paiements_fournisseurs WHERE facture_id = ?', [id]);
        }

        await connection.commit();
        res.json({ message: "Statut mis à jour avec gestion des paiements partiels" });

    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: "Erreur de modification" });
    } finally {
        connection.release();
    }
});

// GET : Historique des paiements d'une facture spécifique
app.get('/api/factures-fournisseurs/:id/paiements', async (req, res) => {
    try {
        const { id } = req.params;

        // On récupère d'abord les infos de la facture pour le contexte
        const [facture] = await pool.execute(
            'SELECT numero, montant_ttc, statut FROM factures_fournisseurs WHERE id = ?', 
            [id]
        );

        if (facture.length === 0) {
            return res.status(404).json({ message: "Facture non trouvée" });
        }

        // On récupère tous les paiements liés à cet ID
        const [paiements] = await pool.execute(
            `SELECT id, date, montant, mode_paiement 
             FROM paiements_fournisseurs 
             WHERE facture_id = ? 
             ORDER BY date DESC`, 
            [id]
        );

        // Calcul du total déjà payé
        const total_paye = paiements.reduce((sum, p) => sum + parseFloat(p.montant), 0);

        res.json({
            facture_numero: facture[0].numero,
            montant_total_a_payer: facture[0].montant_ttc,
            statut_actuel: facture[0].statut,
            total_deja_paye: total_paye.toFixed(2),
            reste_a_recouvrer: (facture[0].montant_ttc - total_paye).toFixed(2),
            historique: paiements
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur lors de la récupération de l'historique" });
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


// DELETE : Supprimer un paiement spécifique
app.delete('/api/paiements-fournisseurs/:paiement_id', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { paiement_id } = req.params;

        // 1. Récupérer l'ID de la facture liée avant de supprimer le paiement
        const [paiement] = await connection.execute(
            'SELECT facture_id FROM paiements_fournisseurs WHERE id = ?', 
            [paiement_id]
        );

        if (paiement.length === 0) {
            return res.status(404).json({ message: "Paiement non trouvé" });
        }

        const facture_id = paiement[0].facture_id;

        // 2. Supprimer le paiement
        await connection.execute('DELETE FROM paiements_fournisseurs WHERE id = ?', [paiement_id]);

        // 3. Recalculer le nouveau statut de la facture
        const [totalPaiements] = await connection.execute(
            'SELECT SUM(montant) as total FROM paiements_fournisseurs WHERE facture_id = ?', 
            [facture_id]
        );
        const [factureInfo] = await connection.execute(
            'SELECT montant_ttc FROM factures_fournisseurs WHERE id = ?', 
            [facture_id]
        );

        const deja_paye = totalPaiements[0].total || 0;
        const ttc = factureInfo[0].montant_ttc;
        
        let nouveauStatut = 'en attente';
        if (deja_paye > 0 && deja_paye < ttc) {
            nouveauStatut = 'partiellement payée';
        } else if (deja_paye >= ttc) {
            nouveauStatut = 'payée';
        }

        // 4. Mettre à jour la facture avec le nouveau statut
        await connection.execute(
            'UPDATE factures_fournisseurs SET statut = ? WHERE id = ?',
            [nouveauStatut, facture_id]
        );

        await connection.commit();
        res.json({ message: "Paiement supprimé et statut facture actualisé", nouveauStatut });

    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: "Erreur lors de la suppression du paiement" });
    } finally {
        connection.release();
    }
});


app.listen(PORT, () => {
    console.log(`api Facture-Fournisseur running on http://localhost:${PORT}`);
});