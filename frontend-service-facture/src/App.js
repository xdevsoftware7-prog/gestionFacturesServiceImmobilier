import { BrowserRouter, Routes, Route} from 'react-router-dom';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';
import LayoutAchat from './layouts/LayoutAchat';
import LayoutCommercial from './layouts/LayoutCommercial';
import LayoutAdmin from './layouts/LayoutAdmin';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/login' element={<Login/>} />
        <Route path='/unauthorized' element={<Unauthorized/>} />
        
        {/* Espace ADMIN */}
        <Route path='/admin' element =  {
          <ProtectedRoute allowedService="all"> <LayoutAdmin/> </ProtectedRoute>
         }>
          {/* Sous route admin */}
        </Route>

        {/* Espace Achat */}
        <Route path='/achat' element = {
          <ProtectedRoute allowedService="achat"><LayoutAchat/></ProtectedRoute>
        }>
          {/* Sous route Achat */}
          <Route path='/factures' element={<h2>liste des factures Fournisseurs</h2>}></Route>
          <Route path='/fournisseurs' element={<h2>Gestion des Fournisseurs</h2>}></Route>
        </Route>

        {/* Espace Commercial */}
        <Route path='/commercial' element={
          <ProtectedRoute allowedService="commercial"><LayoutCommercial/></ProtectedRoute>
        }>
          {/* Sous Routes commercial */}
          <Route path='/factures' element={<h2>liste des Factures Clients</h2>}></Route>
          <Route path='/clients' element={<h2>Gestion Clients</h2>}></Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
