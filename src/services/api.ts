import axios from "axios";

export const api = axios.create({
    baseURL:"/api" //  OU "http://localhost:3000/api"
})