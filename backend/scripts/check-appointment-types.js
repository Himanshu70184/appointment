const mongoose = require('mongoose');
require('dotenv').config();
const AppointmentType = require('../models/AppointmentType');

async function checkAppointmentTypes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database\n');

    const types = await AppointmentType.find({});
    
    console.log(`Total Appointment Types: ${types.length}\n`);
    console.log('Appointment Types in Database:');
    console.log('='.repeat(80));
    
    types.forEach((t, index) => {
      console.log(`${index + 1}. ${t.name}`);
      console.log(`   States: ${t.states && t.states.length > 0 ? t.states.join(', ') : '[] (All states)'}`);
      console.log(`   Price: $${t.price}`);
      console.log(`   Duration: ${t.duration} min`);
      console.log(`   Active: ${t.isActive}`);
      console.log(`   ID: ${t._id}`);
      console.log('-'.repeat(80));
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAppointmentTypes();
