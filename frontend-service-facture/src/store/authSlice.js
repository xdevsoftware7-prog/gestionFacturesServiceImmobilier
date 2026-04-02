import {createSlice} from '@reduxjs/toolkit';

const initialState = {
    token : localStorage.getItem('token') || null,
    userRole : localStorage.getItem("role") || null,
    userService : localStorage.getItem('service') || null,
    isAuthenticated : !!localStorage.getItem('token')
}

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers:{
        loginSuccess: (state,action)=>{
            state.token = action.payload.token;
            state.userRole = action.payload.role;
            state.userService = action.payload.service;
            state.isAuthenticated = true;

            // Sauvgarde local pour persistance après actuqlisation
            localStorage.setItem('token',action.payload.token);
            localStorage.setItem('role',action.payload.role);
            localStorage.setItem('service',action.payload.service);
        },
        logout: (state)=>{
            state.token = null;
            state.userRole = null;
            state.userService = null;
            state.isAuthenticated = false;
            localStorage.clear();
        }
    }
});

export const{ loginSuccess, logout } = authSlice.actions;
export default authSlice.reducer;