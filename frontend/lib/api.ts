import axios from 'axios'
import Cookies from 'js-cookie'

// Smart API URL detection
// Handles local development, network access, and production deployment
const getAPIUrl = () => {
  // For server-side rendering, use environment variable
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  }

  const hostname = window.location.hostname;
  const protocol = window.location.protocol; // 'http:' or 'https:'
  
  // Production deployment (Vercel, Netlify, etc.)
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // Local development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  
  // Network access (use same protocol as frontend and port 5000)
  return `${protocol}//${hostname}:5000`;
};

const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests and dynamically set baseURL
api.interceptors.request.use((config) => {
  // Dynamically set baseURL based on current hostname
  const apiUrl = getAPIUrl();
  config.baseURL = apiUrl;
  
  const token = Cookies.get('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove('token', { path: '/' })
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
