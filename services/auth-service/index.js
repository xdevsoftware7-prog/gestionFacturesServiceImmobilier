require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const app = express();

app.use(express.json());

const cors = require('cors');
app.use(cors()); 

// Connexion MySQL
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user:process.env.DB_USER,
    password:process.env.DB_PASS,
    database:process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});



const checkInternalSecret = (req, res, next) => {
    const secret = req.headers['x-internal-secret'];
    if (secret !== process.env.GATEWAY_KEY) {
        return res.status(403).json({ message: "Interdit : Accès direct non autorisé login" });
    }
    next();
};

// Le pare feu: on autorise l'acces au micro service uniquement via gateway, l'acces directe est non autorise
app.use(checkInternalSecret);


// Middleware de vérification du token
const verifyToken = async (req, res, next) => { 
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'Accès non autorisé : Token manquant' });
    }
    
    try {
        // -- Vérification Blacklist ---
        const [blacklisted] = await pool.execute(
            'SELECT id FROM token_blacklist WHERE token = ?',
            [token]
        );

        if (blacklisted.length > 0) {
            return res.status(401).json({ message: 'Session expirée' });
        }
        // --------------------------------------

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Token invalide ou expiré' });
    }
};


// Middleware pour vérifier le service/rôle
const authorizeService = (serviceRequis,role='admin') => {
    return (req, res, next) => {
        if (req.user.service !== serviceRequis && (req.user.role !== role && req.user.role !=='admin')) {
            return res.status(403).json({ 
                message: `Accès refusé : réservé au service ${serviceRequis}` 
            });
        }
        next();
    };
};




app.get('/api/auth/verify', verifyToken, (req, res) => {
    // Si le middleware verifyToken passe, c'est que le token est valide
    res.json({
        valid: true,
        user: req.user // Contient id, email, role, service (venant du token)
    });
});

app.get('/api/auth/serviceCheck',verifyToken,authorizeService('achat','commercial'),(req,res)=>{
     // Si le middleware authorizeService passe, c'est que le token est valide
    res.json({
        valid: true,
        user: req.user // Contient id, email, role, service (venant du token)
    });
});


// EndPoint de login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Validation basique
        if (!email || !password) {
            return res.status(400).json({ message: 'Veuillez remplir tous les champs' });
        }

        // 2. Recherche de l'utilisateur
        const [users] = await pool.execute(
            'SELECT * FROM utilisateurs WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
        }

        const user = users[0];

        // 3. Vérification du mot de passe
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
        }

        // 4. Génération du JWT (Assurez-vous que JWT_SECRET est défini dans votre .env)
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                role: user.role,
                service: user.service 
            },
            process.env.JWT_SECRET, // Utilisation de la variable d'environnement
            { expiresIn: '24h' }
        );

        // 5. Réponse structurée
        res.status(200).json({ 
            success: true,
            token, 
            user: { 
                id: user.id, 
                nom: user.nom,
                prenom: user.prenom,
                email: user.email, 
                role: user.role,
                service: user.service 
            } 
        });

    } catch (error) {
        console.error("Erreur Login:", error);
        res.status(500).json({ message: "Une erreur interne est survenue" });
    }
});

// Endpoint de register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { nom, prenom, email, password, role, service } = req.body;

        // 1. Vérification : l'utilisateur existe-t-il déjà ?
        const [existingUser] = await pool.execute(
            'SELECT id FROM utilisateurs WHERE email = ?', 
            [email]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({ message: "Cet email est déjà utilisé." });
        }

        // 2. Sécurité : Hachage du mot de passe
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Insertion dans la base de données
        const [result] = await pool.execute(
            'INSERT INTO utilisateurs (nom, prenom, email, password, role, service) VALUES (?, ?, ?, ?, ?, ?)',
            [nom, prenom, email, hashedPassword, role, service]
        );

        // 4. Réponse de succès
        res.status(201).json({ 
            message: "Utilisateur créé avec succès",
            userId: result.insertId 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur lors de l'enregistrement." });
    }
});


// Endpoint de logout
app.post('/api/auth/logout', verifyToken, async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(400).json({ message: "Aucun token fourni" });
        }

        // On récupère la date d'expiration du token pour savoir combien de temps le garder en blacklist
        const decoded = jwt.decode(token);
        const expiryDate = new Date(decoded.exp * 1000);

        // Ajouter le token à la liste noire
        await pool.execute(
            'INSERT INTO token_blacklist (token, expire_at) VALUES (?, ?)',
            [token, expiryDate]
        );

        res.json({ success: true, message: "Déconnexion réussie" });

    } catch (error) {
        console.error("Erreur Logout:", error);
        res.status(500).json({ message: "Erreur lors de la déconnexion" });
    }
});







app.listen(3001, () => {
    console.log('Auth service running on port 3001');
});