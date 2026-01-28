// Test API URL Detection
// Run this in browser console to verify correct API URL is being used

console.log('Current hostname:', window.location.hostname);
console.log('Expected API URL:', 
  window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? `http://${window.location.hostname}:5000`
    : 'http://localhost:5000'
);
