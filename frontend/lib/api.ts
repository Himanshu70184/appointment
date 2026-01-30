import axios from 'axios'
import Cookies from 'js-cookie'

// Smart API URL detection
// If accessing from network (not localhost), use network IP for API calls
const getAPIUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // If accessing via network IP, use same IP for API
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `http://${hostname}:5000`;
    }
  }
  // Default to localhost for local development
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
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
