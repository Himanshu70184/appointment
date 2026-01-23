/**
 * Script to create test data for the EHR System
 * Run with: node scripts/create-test-data.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const MedicalCard = require('../models/MedicalCard');
const Doctor = require('../models/Doctor');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ehr-system';

async function createTestData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing test data (optional - comment out if you want to keep data)
    // await User.deleteMany({ email: { $in: ['admin@test.com', 'doctor@test.com', 'patient@test.com'] } });
    // await MedicalCard.deleteMany({});
    // await Doctor.deleteMany({});

    // Create Medical Card Types
    console.log('Creating medical card types...');
    const medicalCards = await MedicalCard.insertMany([
      {
        name: 'Standard Medical Card',
        description: 'Standard 12-month medical marijuana card',
        price: 150,
        duration: 12,
        states: ['CA', 'NY', 'FL', 'TX', 'CO'],
        isActive: true,
      },
      {
        name: 'Premium Medical Card',
        description: 'Premium 24-month medical marijuana card',
        price: 250,
        duration: 24,
        states: ['CA', 'NY', 'FL', 'TX', 'CO'],
        isActive: true,
      },
      {
        name: 'Basic Medical Card',
        description: 'Basic 6-month medical marijuana card',
        price: 99,
        duration: 6,
        states: ['CA', 'NY', 'FL'],
        isActive: true,
      },
    ]);
    console.log(`✓ Created ${medicalCards.length} medical card types`);

    // Create Admin User
    console.log('Creating admin user...');
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await User.findOneAndUpdate(
      { email: 'admin@test.com' },
      {
        name: 'Admin User',
        email: 'admin@test.com',
        phone: '555-0001',
        state: 'CA',
        password: adminPassword,
        role_id: 1, // Admin
        status: 'active',
        emailVerified: true,
      },
      { upsert: true, new: true }
    );
    console.log(`✓ Admin user created: admin@test.com / admin123`);

    // Create Doctor User
    console.log('Creating doctor user...');
    const doctorPassword = await bcrypt.hash('doctor123', 10);
    const doctorUser = await User.findOneAndUpdate(
      { email: 'doctor@test.com' },
      {
        name: 'Dr. Jane Smith',
        email: 'doctor@test.com',
        phone: '555-0002',
        state: 'CA',
        password: doctorPassword,
        role_id: 2, // Doctor
        status: 'active',
        emailVerified: true,
      },
      { upsert: true, new: true }
    );

    // Create Doctor Profile
    const doctor = await Doctor.findOneAndUpdate(
      { user_id: doctorUser._id },
      {
        user_id: doctorUser._id,
        licenseNumber: 'MD123456',
        specialties: ['General Practice', 'Medical Marijuana'],
        states: ['CA', 'NY', 'FL'],
        pricing: new Map([
          ['CA', 150],
          ['NY', 175],
          ['FL', 160],
        ]),
        availability: [
          {
            dayOfWeek: 1, // Monday
            startTime: '09:00',
            endTime: '17:00',
            timezone: 'America/Los_Angeles',
          },
          {
            dayOfWeek: 2, // Tuesday
            startTime: '09:00',
            endTime: '17:00',
            timezone: 'America/Los_Angeles',
          },
          {
            dayOfWeek: 3, // Wednesday
            startTime: '09:00',
            endTime: '17:00',
            timezone: 'America/Los_Angeles',
          },
          {
            dayOfWeek: 4, // Thursday
            startTime: '09:00',
            endTime: '17:00',
            timezone: 'America/Los_Angeles',
          },
          {
            dayOfWeek: 5, // Friday
            startTime: '09:00',
            endTime: '17:00',
            timezone: 'America/Los_Angeles',
          },
        ],
        isActive: true,
      },
      { upsert: true, new: true }
    );
    console.log(`✓ Doctor user created: doctor@test.com / doctor123`);

    // Create Patient User
    console.log('Creating patient user...');
    const patientPassword = await bcrypt.hash('patient123', 10);
    const patient = await User.findOneAndUpdate(
      { email: 'patient@test.com' },
      {
        name: 'John Doe',
        email: 'patient@test.com',
        phone: '555-0003',
        state: 'CA',
        password: patientPassword,
        role_id: 3, // Patient
        status: 'active',
        emailVerified: true,
      },
      { upsert: true, new: true }
    );
    console.log(`✓ Patient user created: patient@test.com / patient123`);

    // Create Staff User
    console.log('Creating staff user...');
    const staffPassword = await bcrypt.hash('staff123', 10);
    const staff = await User.findOneAndUpdate(
      { email: 'staff@test.com' },
      {
        name: 'Staff Member',
        email: 'staff@test.com',
        phone: '555-0004',
        state: 'CA',
        password: staffPassword,
        role_id: 4, // Staff
        status: 'active',
        emailVerified: true,
      },
      { upsert: true, new: true }
    );
    console.log(`✓ Staff user created: staff@test.com / staff123`);

    console.log('\n✅ Test data created successfully!');
    console.log('\n📋 Test Accounts:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin:  admin@test.com    / admin123');
    console.log('Doctor: doctor@test.com   / doctor123');
    console.log('Patient: patient@test.com / patient123');
    console.log('Staff:  staff@test.com    / staff123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('Error creating test data:', error);
    process.exit(1);
  }
}

createTestData();
