import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

const ProtectedRoute = ({children, allowedService}) =>{
    const { isAuthenticated, userService, userRole } = useSelector((state)=>state.auth);

    // si user n'est pas connecter (token non valide,)
    if(!isAuthenticated){
        return <Navigate to="/login" />;
    }
    // si user est admin il passe partout
    if(userRole === 'admin'){
        return children;
    }
    // si user n'est pas admin ou n'appartient pas au service convenable
    if(userRole !== 'admin' && userService !== allowedService){
        return <Navigate to="/unauthorized" />;
    }
    return children;
}

export default ProtectedRoute;
