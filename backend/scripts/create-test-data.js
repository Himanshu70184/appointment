/**
 * Script to create test data for the EHR System
 * Run with: node scripts/create-test-data.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AppointmentType = require('../models/AppointmentType');
const Doctor = require('../models/Doctor');
const State = require('../models/State');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ehr-system';

async function createTestData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing test data (optional - comment out if you want to keep data)
    // await User.deleteMany({ email: { $in: ['admin@test.com', 'doctor@test.com', 'patient@test.com'] } });
    // await AppointmentType.deleteMany({});
    // await Doctor.deleteMany({});

    // Create States if they don't exist
    console.log('Creating/Updating states...');
    const stateData = [
      { code: 'CA', name: 'California', abbreviation: 'CA', region: 'West', isActive: true },
      { code: 'NY', name: 'New York', abbreviation: 'NY', region: 'Northeast', isActive: true },
      { code: 'FL', name: 'Florida', abbreviation: 'FL', region: 'South', isActive: true },
      { code: 'TX', name: 'Texas', abbreviation: 'TX', region: 'South', isActive: true },
      { code: 'CO', name: 'Colorado', abbreviation: 'CO', region: 'West', isActive: true },
    ];
    
    for (const state of stateData) {
      await State.findOneAndUpdate(
        { code: state.code },
        state,
        { upsert: true, new: true }
      );
    }
    console.log(`✓ Created/Updated ${stateData.length} states`);

    // Create Appointment Types
    console.log('Creating appointment types...');
    const appointmentTypes = [];
    
    const standardType = await AppointmentType.findOneAndUpdate(
      { name: 'Standard Medical Card' },
      {
        name: 'Standard Medical Card',
        description: 'Standard 12-month medical marijuana card',
        duration: 30,
        isActive: true,
        pricing: {
          CA: 150,
          NY: 175,
          FL: 160,
          TX: 140,
          CO: 155
        }
      },
      { upsert: true, new: true }
    );
    appointmentTypes.push(standardType);

    const premiumType = await AppointmentType.findOneAndUpdate(
      { name: 'Premium Medical Card' },
      {
        name: 'Premium Medical Card',
        description: 'Premium 24-month medical marijuana card',
        duration: 45,
        isActive: true,
        pricing: {
          CA: 250,
          NY: 275,
          FL: 260,
          TX: 240,
          CO: 255
        }
      },
      { upsert: true, new: true }
    );
    appointmentTypes.push(premiumType);

    const basicType = await AppointmentType.findOneAndUpdate(
      { name: 'Basic Medical Card' },
      {
        name: 'Basic Medical Card',
        description: 'Basic 6-month medical marijuana card',
        duration: 15,
        isActive: true,
        pricing: {
          CA: 99,
          NY: 110,
          FL: 105
        }
      },
      { upsert: true, new: true }
    );
    appointmentTypes.push(basicType);

    console.log(`✓ Created ${appointmentTypes.length} appointment types`);

    // Create Admin User
    console.log('Creating admin user...');
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await User.findOneAndUpdate(
      { email: 'himanshukumar.codexmattrix@gmail.com' },
      {
        name: 'Admin User',
        email: 'himanshukumar.codexmattrix@gmail.com',
        phone: '555-0001',
        state: 'CA',
        password: adminPassword,
        role_id: 1, // Admin
        status: 'active',
        emailVerified: true,
        twoFactorEnabled: true
      },
      { upsert: true, new: true }
    );
    console.log(`✓ Admin user created: himanshukumar.codexmattrix@gmail.com / admin123`);

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
        twoFactorEnabled: true
      },
      { upsert: true, new: true }
    );
    console.log(`✓ Staff user created: staff@test.com / staff123`);

    console.log('\n✅ Test data created successfully!');
    console.log('\n📋 Test Accounts:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin:  himanshukumar.codexmattrix@gmail.com / admin123');
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
