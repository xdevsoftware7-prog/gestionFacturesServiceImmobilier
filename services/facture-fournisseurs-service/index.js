// --- CRUD FACTURE-FOURNISSEURS ---
const SERVICE_ACHAT = 'achat'; // le service achat est le service qui gère les factures des fournisseurs
require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const app = express();
const PDFDocument = require('pdfkit');
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

// READ : Lister les factures-clients avec filtres avancés (Statut, ID, Numéro, Dates)
app.get('/api/factures-fournisseurs', async (req, res) => {
    try {
        const { statut, fournisseur_id, numero, date_debut, date_fin  } = req.query;
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

        if (date_debut && date_fin) {
            query += ` AND f.date BETWEEN ? AND ?`;
            params.push(date_debut); // Format attendu YYYY-MM-DD
            params.push(date_fin);   // Format attendu YYYY-MM-DD
        } else if (date_debut) {
            // Optionnel : permettre de filtrer à partir d'une date seulement
            query += ` AND f.date >= ?`;
            params.push(date_debut);
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




// Generation de pdf pour une facture fournisseur spécifique
// Palette de couleurs

const COLORS = {
  black:       '#000000',
  darkText:    '#131921',   // Noir Amazon
  bodyText:    '#333333',
  muted:       '#555555',
  lightMuted:  '#767676',
  border:      '#CCCCCC',
  lightBorder: '#E7E7E7',
  tableHead:   '#F0F2F2',   // Gris tableau Amazon
  accent:      '#FF9900',   // Orange Amazon
  accentDark:  '#C45500',
  white:       '#FFFFFF',
  linkBlue:    '#007185',   // Bleu lien Amazon
  paid:        '#067D62',
  unpaid:      '#B12704',
};

app.get('/api/factures-fournisseurs/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.execute(`
      SELECT f.*, fr.nom as fournisseur_nom, fr.adresse as fournisseur_adresse 
      FROM factures_fournisseurs f
      JOIN fournisseurs fr ON f.fournisseur_id = fr.id
      WHERE f.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Facture introuvable" });
    }

    const facture = rows[0];

    const doc = new PDFDocument({
      margin: 0,
      size: 'A4',
      info: {
        Title: `Facture Fournisseur ${facture.numero}`,
        Author: 'SERVICE IMMOBILIER S.A.',
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=facture_${facture.numero}.pdf`);
    doc.pipe(res);

    const W       = 595.28;
    const H       = 841.89;
    const MARGIN  = 40;
    const RIGHT   = W - MARGIN;
    const CW      = W - MARGIN * 2;

    // ─── FOND BLANC TOTAL ─────────────────────────────────────────────────────
    doc.rect(0, 0, W, H).fill(COLORS.white);

    // ─── BARRE ORANGE AMAZON (top) ────────────────────────────────────────────
    doc.rect(0, 0, W, 4).fill(COLORS.accent);

    // ─── EN-TÊTE : LOGO + TITRE ───────────────────────────────────────────────
    const headerY = 20;

    // Logo texte style Amazon
    doc.fillColor(COLORS.darkText)
       .font('Helvetica-Bold')
       .fontSize(26)
       .text('service', MARGIN, headerY, { continued: true })
       .fillColor(COLORS.accent)
       .text('immobilier');

    // Flèche orange style Amazon (sourire)
    doc.fillColor(COLORS.accent)
       .font('Helvetica')
       .fontSize(8)
       .text('▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔', MARGIN + 2, headerY + 26, { characterSpacing: -1 });

    // Sous-titre entreprise
    doc.fillColor(COLORS.lightMuted)
       .font('Helvetica')
       .fontSize(8)
       .text(`S-A ${process.env.SERVICE_ADRESSE}  | ${process.env.SERVICE_MAIL} `, MARGIN, headerY + 38);

    // Bloc "FACTURE FOURNISSEUR" à droite
    doc.fillColor(COLORS.darkText)
       .font('Helvetica-Bold')
       .fontSize(18)
       .text('FACTURE FOURNISSEUR', 0, headerY + 8, { width: RIGHT, align: 'right' });

    doc.fillColor(COLORS.lightMuted)
       .font('Helvetica')
       .fontSize(9)
       .text(`N° ${facture.numero}`, 0, headerY + 32, { width: RIGHT, align: 'right' });

    // ─── LIGNE DE SÉPARATION ──────────────────────────────────────────────────
    const sepY = 80;
    doc.rect(MARGIN, sepY, CW, 1).fill(COLORS.border);

    // ─── BLOC INFOS : ÉMETTEUR | DESTINATAIRE | DÉTAILS ──────────────────────
    const infoY = 95;

    // Colonne 1 — Émetteur
    doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(8)
       .text('VENDU PAR', MARGIN, infoY);
    doc.fillColor(COLORS.darkText).font('Helvetica-Bold').fontSize(9)
       .text('SERVICE IMMOBILIER S.A.', MARGIN, infoY + 13);
    doc.fillColor(COLORS.bodyText).font('Helvetica').fontSize(8)
       .text('Casablanca, Maroc', MARGIN, infoY + 25)
    //    .text('RC: 123456  |  ICE: 001234567000089', MARGIN, infoY + 36)
    //    .text('IF: 12345678  |  TVA: MA123456', MARGIN, infoY + 47);

    // Colonne 2 — Fournisseur
    const col2X = MARGIN + 175;
    doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(8)
       .text('FOURNISSEUR', col2X, infoY);
    doc.fillColor(COLORS.darkText).font('Helvetica-Bold').fontSize(9)
       .text(facture.fournisseur_nom || 'N/A', col2X, infoY + 13);
    doc.fillColor(COLORS.bodyText).font('Helvetica').fontSize(8)
       .text(facture.fournisseur_adresse || 'Adresse non renseignée', col2X, infoY + 25, { width: 165 });

    // Colonne 3 — Détails facture
    const col3X = MARGIN + 375;

    const dateEmission = new Date(facture.date).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric'
    });

    const isPaid   = facture.statut?.toLowerCase() === 'payé';
    const statutColor = isPaid ? COLORS.paid : COLORS.unpaid;

    const detailRows = [
      { label: 'Date de facture',  value: dateEmission },
      { label: 'N° commande',      value: facture.numero },
      { label: 'Statut',           value: facture.statut?.toUpperCase() || 'N/A', color: statutColor },
    ];

    detailRows.forEach((row, i) => {
      const rowY = infoY + i * 18;
      doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
         .text(row.label + ' :', col3X, rowY, { width: 90 });
      doc.fillColor(row.color || COLORS.darkText).font('Helvetica-Bold').fontSize(8)
         .text(row.value, col3X + 92, rowY, { width: 83, align: 'right' });
    });

    // ─── 2ème LIGNE DE SÉPARATION ─────────────────────────────────────────────
    const sep2Y = infoY + 70;
    doc.rect(MARGIN, sep2Y, CW, 1).fill(COLORS.border);

    // ─── TABLEAU PRINCIPAL ────────────────────────────────────────────────────
    const tableY   = sep2Y + 14;
    const colW     = { desc: 240, qty: 50, pu: 90, tva: 70, total: 65 };
    const colX     = {
      desc:  MARGIN,
      qty:   MARGIN + colW.desc,
      pu:    MARGIN + colW.desc + colW.qty,
      tva:   MARGIN + colW.desc + colW.qty + colW.pu,
      total: MARGIN + colW.desc + colW.qty + colW.pu + colW.tva,
    };

    // En-tête tableau — fond gris Amazon
    const thH = 26;
    doc.rect(MARGIN, tableY, CW, thH).fill(COLORS.tableHead);
    doc.rect(MARGIN, tableY, CW, thH).strokeColor(COLORS.border).lineWidth(0.5).stroke();

    const thY = tableY + 8;
    const thStyle = () => doc.fillColor(COLORS.darkText).font('Helvetica-Bold').fontSize(8);

    thStyle().text('DESCRIPTION', colX.desc + 6, thY);
    thStyle().text('', colX.qty, thY, { width: colW.qty, align: 'center' });
    thStyle().text('PRIX UNITAIRE', colX.pu, thY, { width: colW.pu, align: 'right' });
    thStyle().text(`TVA (${facture.tva}%)`, colX.tva, thY, { width: colW.tva, align: 'right' });
    thStyle().text('MONTANT', colX.total, thY, { width: colW.total - 6, align: 'right' });

    // Séparateurs verticaux de l'en-tête
    [colX.qty, colX.pu, colX.tva, colX.total].forEach(x => {
      doc.moveTo(x, tableY).lineTo(x, tableY + thH)
         .strokeColor(COLORS.border).lineWidth(0.5).stroke();
    });

    // ─── LIGNES DE DONNÉES ────────────────────────────────────────────────────
    const montant_tva   = (parseFloat(facture.montant_ht) * parseFloat(facture.tva)) / 100;
    const montant_total = parseFloat(facture.montant_ttc);

    const items = [
      {
        desc:  'Montant Hors Taxe (HT)',
        ref:   'HT-BASE',
        pu:    parseFloat(facture.montant_ht),
        tva:   0,
        total: parseFloat(facture.montant_ht),
      },
      {
        desc:  `TVA sur montant HT`,
        ref:   `TAUX-${facture.tva}%`,
        pu:    montant_tva,
        tva:   montant_tva,
        total: montant_tva,
      },
      {
        desc:  'Frais de Douane',
        ref:   'DOUANE',
        pu:    parseFloat(facture.frais_douane),
        tva:   0,
        total: parseFloat(facture.frais_douane),
      },
    ];

    const rowH = 38;
    items.forEach((item, i) => {
      const rowY = tableY + thH + i * rowH;

      // Fond blanc / très léger alternance
      doc.rect(MARGIN, rowY, CW, rowH)
         .fill(i % 2 === 0 ? COLORS.white : '#FAFAFA');

      // Bordure basse
      doc.rect(MARGIN, rowY, CW, rowH)
         .strokeColor(COLORS.lightBorder).lineWidth(0.5).stroke();

      // Séparateurs verticaux
      [colX.qty, colX.pu, colX.tva, colX.total].forEach(x => {
        doc.moveTo(x, rowY).lineTo(x, rowY + rowH)
           .strokeColor(COLORS.lightBorder).lineWidth(0.5).stroke();
      });

      const textY = rowY + 8;

      // Description
      doc.fillColor(COLORS.darkText).font('Helvetica-Bold').fontSize(9)
         .text(item.desc, colX.desc + 6, textY, { width: colW.desc - 10 });
      doc.fillColor(COLORS.linkBlue).font('Helvetica').fontSize(7.5)
         .text(`Réf : ${item.ref}`, colX.desc + 6, textY + 14);

      // Qté
    //   doc.fillColor(COLORS.bodyText).font('Helvetica').fontSize(9)
    //      .text(`${item.qty}`, colX.qty, textY + 5, { width: colW.qty, align: 'center' });

      // Prix unitaire
      doc.fillColor(COLORS.bodyText).font('Helvetica').fontSize(9)
         .text(`${item.pu.toFixed(2)} MAD`, colX.pu, textY + 5, { width: colW.pu - 6, align: 'right' });

      // TVA
      doc.fillColor(COLORS.bodyText).font('Helvetica').fontSize(9)
         .text(item.tva > 0 ? `${item.tva.toFixed(2)} MAD` : '—', colX.tva, textY + 5, { width: colW.tva - 6, align: 'right' });

      // Total
      doc.fillColor(COLORS.darkText).font('Helvetica-Bold').fontSize(9)
         .text(`${item.total.toFixed(2)} MAD`, colX.total, textY + 5, { width: colW.total - 8, align: 'right' });
    });

    // ─── BLOC TOTAUX (style Amazon — aligné à droite) ─────────────────────────
    const totalsStartY = tableY + thH + items.length * rowH + 16;
    const totalsX      = W - MARGIN - 220;
    const totalsW      = 220;

    const formatLine = (label, value, y, bold = false, big = false, color = COLORS.bodyText) => {
      doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9)
         .text(label, totalsX, y, { width: 130 });
      doc.fillColor(color)
         .font(bold ? 'Helvetica-Bold' : 'Helvetica')
         .fontSize(big ? 12 : 9)
         .text(`${value} MAD`, totalsX + 130, y, { width: 90, align: 'right' });
    };

    let ty = totalsStartY;
    formatLine('Sous-total HT :',     `${parseFloat(facture.montant_ht).toFixed(2)}`, ty);
    ty += 16;
    formatLine(`TVA (${facture.tva}%) :`, `${montant_tva.toFixed(2)}`, ty);
    ty += 16;
    formatLine('Frais de douane :',   `${parseFloat(facture.frais_douane).toFixed(2)}`, ty);

    // Ligne séparation avant total
    ty += 22;
    doc.rect(totalsX, ty, totalsW, 0.8).fill(COLORS.border);
    ty += 10;

    // Total TTC — style Amazon (gras, orange)
    doc.fillColor(COLORS.darkText).font('Helvetica-Bold').fontSize(11)
       .text('Total TTC :', totalsX, ty, { width: 130 });
    doc.fillColor(COLORS.accentDark).font('Helvetica-Bold').fontSize(14)
       .text(`${montant_total.toFixed(2)} MAD`, totalsX + 130, ty - 2, { width: 90, align: 'right' });

    // ─── BLOC STATUT PAIEMENT (badge Amazon) ─────────────────────────────────
    ty += 32;
    const badgeW   = 160;
    const badgeH   = 26;
    const badgeBgC = isPaid ? '#E7F4E4' : '#FEF0E7';
    const badgeBrC = isPaid ? COLORS.paid : COLORS.unpaid;

    doc.rect(totalsX, ty, badgeW, badgeH)
       .fill(badgeBgC).strokeColor(badgeBrC).lineWidth(1).stroke();

    const badgeLabel = isPaid ? '✓  PAIEMENT REÇU' : '⚠  EN ATTENTE DE PAIEMENT';
    doc.fillColor(badgeBrC).font('Helvetica-Bold').fontSize(8)
       .text(badgeLabel, totalsX, ty + 8, { width: badgeW, align: 'center' });

    // ─── SECTION NOTES / CONDITIONS ───────────────────────────────────────────
    const notesY = totalsStartY;
    const notesW = totalsX - MARGIN - 20;

    doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(8)
       .text('CONDITIONS DE PAIEMENT', MARGIN, notesY);
    doc.rect(MARGIN, notesY + 12, notesW, 0.5).fill(COLORS.lightBorder);

    doc.fillColor(COLORS.bodyText).font('Helvetica').fontSize(8).lineGap(3)
       .text(
         'Paiement à réception de facture.\nToute somme non réglée à l\'échéance entraîne des pénalités de retard au taux de 1,0% par mois.\nEn cas de litige, le tribunal de commerce de Casablanca est seul compétent.',
         MARGIN, notesY + 20, { width: notesW }
       );

    doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(8)
       .text('COORDONNÉES Agence', MARGIN, notesY + 74);
    doc.rect(MARGIN, notesY + 86, notesW, 0.5).fill(COLORS.lightBorder);
    doc.fillColor(COLORS.bodyText).font('Helvetica').fontSize(8).lineGap(3)
       .text(`Service: ${process.env.SERVICE_ACHAT}\nAdresse : ${process.env.SERVICE_ADRESSE}\nIBAN : MA64 007 780 0001234567890123 45\nSWIFT : BCMAMAMC`, MARGIN, notesY + 93);

    // ─── PIED DE PAGE ─────────────────────────────────────────────────────────
    const footerY = H - 48;
    doc.rect(MARGIN, footerY, CW, 0.5).fill(COLORS.border);

    doc.fillColor(COLORS.lightMuted).font('Helvetica').fontSize(7.5)
       .text(
         'SERVICE IMMOBILIER S.A.  —  RC : 123456  |  ICE : 001234567000089  |  IF : 12345678',
         MARGIN, footerY + 8, { width: CW, align: 'center' }
       );
    doc.fillColor(COLORS.lightMuted).font('Helvetica').fontSize(7.5)
       .text(
         'Ce document est une facture officielle générée automatiquement. Conservez-le pour vos archives.',
         MARGIN, footerY + 20, { width: CW, align: 'center' }
       );

    // Numéro de page
    doc.fillColor(COLORS.lightMuted).font('Helvetica').fontSize(7)
       .text('Page 1 / 1', MARGIN, footerY + 33, { width: CW, align: 'right' });

    doc.end();

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de la génération du PDF" });
  }
});

app.listen(PORT, () => {
    console.log(`api Facture-Fournisseur running on http://localhost:${PORT}`);
});