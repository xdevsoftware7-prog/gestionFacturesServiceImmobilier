import { configureStore } from "@reduxjs/toolkit";
import authReducer from './authSlice';

const store = configureStore({
    reducer:{
        auth: authReducer // le nom auth a utiliser dans les useSelector
    }
});

export default store;