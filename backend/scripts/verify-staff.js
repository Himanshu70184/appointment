const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Staff = require('../models/Staff');

async function verifyStaffMigration() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ehr-system', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB\n');

    // Count staff users
    const staffUsersCount = await User.countDocuments({ role_id: 4 });
    console.log(`👥 Users with role_id=4 (staff): ${staffUsersCount}`);

    // Count staff records
    const staffRecordsCount = await Staff.countDocuments();
    console.log(`📁 Staff collection records: ${staffRecordsCount}\n`);

    // List all staff
    const staffRecords = await Staff.find()
      .populate('user_id', 'name email phone status')
      .sort({ createdAt: -1 });

    if (staffRecords.length > 0) {
      console.log('📋 Staff Records:\n');
      staffRecords.forEach((staff, index) => {
        console.log(`${index + 1}. ${staff.name}`);
        console.log(`   Email: ${staff.email}`);
        console.log(`   Department: ${staff.department}`);
        console.log(`   Status: ${staff.status}`);
        console.log(`   User ID: ${staff.user_id?._id || staff.user_id}`);
        console.log('');
      });
    } else {
      console.log('⚠️  No staff records found in staff collection');
      console.log('   Run: npm run migrate-staff\n');
    }

    // Check for staff users without staff records
    const staffUsers = await User.find({ role_id: 4 });
    const orphanedUsers = [];
    
    for (const user of staffUsers) {
      const staffRecord = await Staff.findOne({ user_id: user._id });
      if (!staffRecord) {
        orphanedUsers.push(user);
      }
    }

    if (orphanedUsers.length > 0) {
      console.log(`⚠️  Found ${orphanedUsers.length} staff users WITHOUT staff records:`);
      orphanedUsers.forEach(user => {
        console.log(`   - ${user.email}`);
      });
      console.log('\n   Run migration: npm run migrate-staff\n');
    } else if (staffUsersCount > 0) {
      console.log('✅ All staff users have corresponding staff records!\n');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
  } finally {
    await mongoose.connection.close();
  }
}

verifyStaffMigration();
