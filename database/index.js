const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',      
    password: '',      
    database: 'gestionFacturesImmobilier' 
};

async function createDatabase() {
    try {
        const connection = await mysql.createConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password
        });

        // 1. Création de la base de données
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
        console.log(`Base de données "${dbConfig.database}" vérifiée/créée.`);
        await connection.changeUser({ database: dbConfig.database });

        // 2. Définition des tables
        const tables = [
            `CREATE TABLE IF NOT EXISTS fournisseurs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nom VARCHAR(100) NOT NULL,
                prenom VARCHAR(100),
                adresse TEXT,
                ville VARCHAR(100),
                pays VARCHAR(100),
                distance_km DECIMAL(10,2),
                frais_douane DECIMAL(10,2)
            )`,
            `CREATE TABLE IF NOT EXISTS clients (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nom VARCHAR(100) NOT NULL,
                prenom VARCHAR(100),
                adresse TEXT,
                ville VARCHAR(100),
                pays VARCHAR(100),
                distance_km DECIMAL(10,2),
                frais_douane DECIMAL(10,2)
            )`,
            `CREATE TABLE IF NOT EXISTS factures_fournisseurs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                fournisseur_id INT,
                numero VARCHAR(50) UNIQUE,
                date DATE,
                montant_ht DECIMAL(15,2),
                tva DECIMAL(5,2),
                frais_douane DECIMAL(10,2),
                montant_ttc DECIMAL(15,2),
                statut ENUM('en attente', 'payée', 'annulée') DEFAULT 'en attente',
                FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS factures_clients (
                id INT AUTO_INCREMENT PRIMARY KEY,
                client_id INT,
                numero VARCHAR(50) UNIQUE,
                date DATE,
                montant_ht DECIMAL(15,2),
                tva DECIMAL(5,2),
                frais_douane DECIMAL(10,2),
                montant_ttc DECIMAL(15,2),
                statut ENUM('en attente', 'payée', 'annulée') DEFAULT 'en attente',
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS paiements_fournisseurs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                facture_id INT,
                date DATE,
                montant DECIMAL(15,2),
                mode_paiement VARCHAR(50),
                FOREIGN KEY (facture_id) REFERENCES factures_fournisseurs(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS paiements_clients (
                id INT AUTO_INCREMENT PRIMARY KEY,
                facture_id INT,
                date DATE,
                montant DECIMAL(15,2),
                mode_paiement VARCHAR(50),
                FOREIGN KEY (facture_id) REFERENCES factures_clients(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS utilisateurs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nom VARCHAR(100),
                prenom VARCHAR(100),
                email VARCHAR(150) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50),
                service VARCHAR(50)
            )`,
            `CREATE TABLE IF NOT EXISTS token_blacklist (
                id INT AUTO_INCREMENT PRIMARY KEY,
                token TEXT NOT NULL,
                expire_at DATETIME NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        // 3. Exécution de la création des tables
        for (const sql of tables) {
            await connection.query(sql);
        }

        console.log("Toutes les tables ont été créées avec succès.");
        await connection.end();

    } catch (error) {
        console.error("Erreur lors de la création de la base :", error);
    }
}

createDatabase();