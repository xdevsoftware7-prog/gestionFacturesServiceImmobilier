import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix pour les icônes Leaflet
delete L.Icon.Default.prototype._getIconUrl;

const defaultIcon = L.icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Composant pour gérer le mouvement de la caméra
function ChangeView({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center && center[0] && center[1]) {
            map.setView(center, 12, { animate: true });
        }
    }, [center, map]);
    
    return null; // Indispensable pour un composant React
}

export default function FournisseursMap({ fournisseurs, activeCoords }) {
    // Position par défaut sur Settat/Casablanca
    const defaultCenter = [33.0, -7.6];

    return (
        <div style={{ 
            height: '400px', 
            width: '100%', 
            marginBottom: '20px', 
            borderRadius: '10px', 
            overflow: 'hidden', 
            border: '1px solid #ccc',
            zIndex: 0 // Important pour ne pas passer au-dessus des menus
        }}>
            <MapContainer center={defaultCenter} zoom={5} style={{ height: '100%', width: '100%' }}>
                <TileLayer 
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                
                <ChangeView center={activeCoords} />

                {fournisseurs.map((f) => {
                    // Correction de la faute de frappe : longitude (sans le T)
                    const lat = parseFloat(f.latitude);
                    const lng = parseFloat(f.longitude);

                    if (!isNaN(lat) && !isNaN(lng)) {
                        return (
                            <Marker key={f.id} position={[lat, lng]} icon={defaultIcon}>
                                <Popup>
                                    <div style={{ textAlign: 'center' }}>
                                        <strong style={{ color: '#2c3e50' }}>{f.nom} {f.prenom}</strong><br/>
                                        <span style={{ color: '#7f8c8d' }}>{f.ville}, {f.pays}</span><br/>
                                        <div style={{ marginTop: '5px', fontWeight: 'bold', color: '#27ae60' }}>
                                            {f.distance_km} km
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    }
                    return null;
                })}
            </MapContainer>
        </div>
    );
}