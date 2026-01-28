const os = require('os');
const { spawn } = require('child_process');

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
const port = process.env.PORT || 3000;

console.log('\n');
console.log('═══════════════════════════════════════════════════');
console.log('  EHR System Frontend - Development Server');
console.log('═══════════════════════════════════════════════════');
console.log('');
console.log('  📱 Local:      http://localhost:' + port);
console.log('  🌐 Network:    http://' + networkIP + ':' + port);
console.log('');
console.log('═══════════════════════════════════════════════════');
console.log('  Share the Network URL with your testing team!');
console.log('  Make sure they are on the same WiFi network.');
console.log('═══════════════════════════════════════════════════');
console.log('\n');

// Start Next.js dev server
const next = spawn('next', ['dev', '-H', '0.0.0.0', '-p', port], {
  stdio: 'inherit',
  shell: true
});

next.on('close', (code) => {
  process.exit(code);
});

// Handle termination
process.on('SIGINT', () => {
  next.kill('SIGINT');
  process.exit();
});

process.on('SIGTERM', () => {
  next.kill('SIGTERM');
  process.exit();
});
