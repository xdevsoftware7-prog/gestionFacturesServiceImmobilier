require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000; // La Gateway écoute sur le port 3000

// --- MIDDLEWARE D'AUTHENTIFICATION CENTRALISÉ ---
const gatewayAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Authentification requise par la Gateway' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Injection des infos utilisateur dans les Headers pour les microservices
        // On préfixe par 'x-user-' pour respecter les conventions
        req.headers['x-user-id'] = decoded.id;
        req.headers['x-user-role'] = decoded.role;
        req.headers['x-user-service'] = decoded.service;
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Token invalide' });
    }
};

// --- CONFIGURATION DES ROUTES (PROXY) ---

// 1. Route publique : Auth (Login/Register) - Pas de gatewayAuth ici !
app.use('/auth', createProxyMiddleware({
    target: 'http://localhost:3001',
    changeOrigin: true,
    pathRewrite: {
        // On remplace le début de la chaîne (^) par /api/auth
        '^/': '/api/auth/',
    },
    onProxyReq:(proxyReq,req,res)=>{
        proxyReq.setHeader('x-internal-secret', process.env.GATEWAY_KEY);  
    }
}));

// 2. Route sécurisée : Fournisseurs
app.use('/fournisseurs', gatewayAuth, createProxyMiddleware({
    target: 'http://localhost:3002', // Votre futur service Fournisseurs
    changeOrigin: true,
    pathRewrite: {
        '^/': '/api/fournisseurs/',
    },
    onProxyReq: (proxyReq, req, res) => {
        // On s'assure que les headers injectés sont bien transmis au microservice
        proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
        proxyReq.setHeader('x-user-role', req.headers['x-user-role']);
        proxyReq.setHeader('x-user-service', req.headers['x-user-service']);
        proxyReq.setHeader('x-internal-secret', process.env.GATEWAY_KEY);  
    }
}));

app.use('/clients', gatewayAuth, createProxyMiddleware({
    target: 'http://localhost:3003', // Votre futur service clients
    changeOrigin: true,
    pathRewrite: {
        '^/': '/api/clients/',
    },
    onProxyReq: (proxyReq, req, res) => {
        // On s'assure que les headers injectés sont bien transmis au microservice
        proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
        proxyReq.setHeader('x-user-role', req.headers['x-user-role']);
        proxyReq.setHeader('x-user-service', req.headers['x-user-service']);
        proxyReq.setHeader('x-internal-secret', process.env.GATEWAY_KEY);
    }
}));



app.use('/achat', gatewayAuth, createProxyMiddleware({
    target: 'http://localhost:3012', // Votre futur service clients
    changeOrigin: true,
    pathRewrite: {
        '^/': '/api/',
    },
    onProxyReq: (proxyReq, req, res) => {
        // On s'assure que les headers injectés sont bien transmis au microservice
        proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
        proxyReq.setHeader('x-user-role', req.headers['x-user-role']);
        proxyReq.setHeader('x-user-service', req.headers['x-user-service']);
         proxyReq.setHeader('x-internal-secret', process.env.GATEWAY_KEY);
    }
}));


app.use('/commercial', gatewayAuth, createProxyMiddleware({
    target: 'http://localhost:3013', // Votre futur service clients
    changeOrigin: true,
    pathRewrite: {
        '^/': '/api/',
    },
    onProxyReq: (proxyReq, req, res) => {
        // On s'assure que les headers injectés sont bien transmis au microservice
        proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
        proxyReq.setHeader('x-user-role', req.headers['x-user-role']);
        proxyReq.setHeader('x-user-service', req.headers['x-user-service']);
        // On ajout un cle secret pour eliminer les acces directe aux differents micro services
        // On autorise uniquement l'acces via Gateway
        proxyReq.setHeader('x-internal-secret', process.env.GATEWAY_KEY); 
    }
}));

app.listen(PORT, () => {
    console.log(`🚀 API Gateway Prince running on http://localhost:${PORT}`);
});