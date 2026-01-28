const os = require('os');

// Function to get local network IP
function getNetworkIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const networkIP = getNetworkIP();

console.log('\n');
console.log('═══════════════════════════════════════════════════');
console.log('  EHR System - Network Access Information');
console.log('═══════════════════════════════════════════════════');
console.log('');
console.log('  Your Network IP: ' + networkIP);
console.log('');
console.log('  Frontend URL:  http://' + networkIP + ':3000');
console.log('  Backend URL:   http://' + networkIP + ':5000');
console.log('');
console.log('═══════════════════════════════════════════════════');
console.log('  Share these URLs with your testing team!');
console.log('  They must be on the same WiFi/network.');
console.log('═══════════════════════════════════════════════════');
console.log('\n');
