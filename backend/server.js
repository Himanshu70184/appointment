const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { requestLogger, errorHandler, createLogger } = require('./utils/logger');
require('dotenv').config();

const app = express();
const logger = createLogger('Server');

// Security middleware
app.use(helmet());

// CORS configuration - Allow both localhost and network access
const corsOptions = {
  origin: function (origin, callback) {
    // Log origin for debugging
    console.log('CORS request from origin:', origin);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost and any IP address on port 3000
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      process.env.FRONTEND_URL
    ];
    
    // Also allow any origin from the local network (e.g., http://192.168.x.x:3000)
    if (origin.match(/^http:\/\/(localhost|127\.0\.0\.1|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):3000$/)) {
      console.log('✅ CORS allowed for:', origin);
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      console.log('✅ CORS allowed for:', origin);
      callback(null, true);
    } else {
      console.log('✅ CORS allowed (development mode) for:', origin);
      callback(null, true); // For development, allow all origins
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Request logging (only in development or if LOG_ALL=true)
if (process.env.NODE_ENV === 'development' || process.env.LOG_ALL === 'true') {
  app.use(requestLogger);
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // limit each IP to 5000 requests per windowMs
  skip: (req) => {
    const path = req.path || '';
    return path.startsWith('/auth/login') || path.startsWith('/auth/verify-2fa');
  }
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploads
app.use('/uploads', express.static('uploads'));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ehr-system', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('MongoDB connected successfully');
  logger.info('MongoDB connection established');
})
.catch(err => {
  console.error('MongoDB connection error:', err);
  logger.error('MongoDB connection failed', { error: err.message });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/doctors', require('./routes/doctors'));
app.use('/api/doctor-portal', require('./routes/doctor-portal'));
app.use('/api/patient-portal', require('./routes/patient-portal'));
app.use('/api/states', require('./routes/states'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/appointment-types', require('./routes/appointmentTypes'));
app.use('/api/doctors', require('./routes/doctor-availability'));
app.use('/api/doctor-availability', require('./routes/doctor-availability'));
app.use('/api/intake-form-templates', require('./routes/intake-form-templates'));
app.use('/api/intake-form-submissions', require('./routes/intake-form-submissions'));
app.use('/api/test-email', require('./routes/test-email'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'EHR System API is running' });
});

// Error handling middleware - must be last
app.use(errorHandler);

// Handle 404
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // Listen on all network interfaces

// Get local network IP
const os = require('os');
function getNetworkIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

app.listen(PORT, HOST, () => {
  const networkIP = getNetworkIP();
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  EHR System Backend API - Running');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  📱 Local:    http://localhost:${PORT}`);
  console.log(`  🌐 Network:  http://${networkIP}:${PORT}`);
  console.log('═══════════════════════════════════════════════════\n');
  logger.info(`Server started on ${HOST}:${PORT} (Network: ${networkIP}:${PORT})`);
});
