const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Staff = require('../models/Staff');

async function migrateStaffToCollection() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ehr-system', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB');

    // Find all users with role_id = 4 (staff)
    const staffUsers = await User.find({ role_id: 4 });
    
    console.log(`\n📊 Found ${staffUsers.length} staff users in users collection`);

    if (staffUsers.length === 0) {
      console.log('ℹ️  No staff users found to migrate');
      process.exit(0);
    }

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of staffUsers) {
      try {
        // Check if staff record already exists
        const existingStaff = await Staff.findOne({ 
          $or: [
            { user_id: user._id },
            { email: user.email }
          ]
        });

        if (existingStaff) {
          console.log(`⏭️  Skipping ${user.email} - already exists in staff collection`);
          skipped++;
          continue;
        }

        // Create new staff record
        const staff = new Staff({
          user_id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          department: 'Support', // Default department
          designation: 'Staff Member', // Default designation
          permissions: {
            canManageAppointments: true,
            canManagePatients: true,
            canManageLeads: true,
            canManageTasks: true,
            canViewReports: false,
            canManageDoctors: false
          },
          status: user.status || 'active',
          joinDate: user.createdAt || new Date(),
          notes: 'Migrated from users collection'
        });

        await staff.save();
        console.log(`✅ Created staff record for ${user.email}`);
        created++;

      } catch (error) {
        console.error(`❌ Error creating staff record for ${user.email}:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Created: ${created}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📝 Total: ${staffUsers.length}`);

    console.log('\n✅ Migration completed successfully!');
    console.log('\nℹ️  Note: User records remain in users collection for authentication');
    console.log('   Staff data is now in the dedicated staff collection');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

// Run migration
console.log('🚀 Starting staff migration...\n');
migrateStaffToCollection();
