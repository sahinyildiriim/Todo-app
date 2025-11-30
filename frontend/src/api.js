// api.js
import axios from "axios";

const api = axios.create({
  baseURL: "https://todo-app-production-6784.up.railway.app/",
});

// Token interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
