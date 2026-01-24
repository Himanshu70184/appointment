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
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Request logging (only in development or if LOG_ALL=true)
if (process.env.NODE_ENV === 'development' || process.env.LOG_ALL === 'true') {
  app.use(requestLogger);
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // limit each IP to 1000 requests per windowMs
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
app.use('/api/medcards', require('./routes/medcards'));
app.use('/api/doctors', require('./routes/doctors'));
app.use('/api/doctor-portal', require('./routes/doctor-portal'));
app.use('/api/patient-portal', require('./routes/patient-portal'));
app.use('/api/states', require('./routes/states'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/appointment-types', require('./routes/appointmentTypes'));

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
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  logger.info(`Server started on port ${PORT}`);
});
