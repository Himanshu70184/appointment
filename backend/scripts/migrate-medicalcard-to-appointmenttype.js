/**
 * Data Migration Script
 * Migrate MedicalCard data to AppointmentType model
 * Run: node scripts/migrate-medicalcard-to-appointmenttype.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const MedicalCard = require('../models/MedicalCard');
const AppointmentType = require('../models/AppointmentType');
const Appointment = require('../models/Appointment');

const migrateData = async () => {
  try {
    console.log('🔄 Starting migration from MedicalCard to AppointmentType...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ehr-system');
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Migrate MedicalCard to AppointmentType
    console.log('📋 Step 1: Migrating MedicalCard records to AppointmentType...');
    const medicalCards = await MedicalCard.find();
    console.log(`Found ${medicalCards.length} MedicalCard records\n`);

    const migrationMap = new Map(); // Map old MedicalCard _id to new AppointmentType _id

    for (const card of medicalCards) {
      // Check if appointment type already exists
      let appointmentType = await AppointmentType.findOne({ name: card.name });

      if (!appointmentType) {
        appointmentType = new AppointmentType({
          name: card.name,
          description: card.description || `Medical card for ${card.name}`,
          price: card.price,
          duration: 30, // Default appointment duration (15-30 min standard)
          cardValidityMonths: card.duration || 12, // MedicalCard duration was in months
          states: card.states || [], // MedicalCard had states array
          isActive: card.isActive !== undefined ? card.isActive : true,
          createdAt: card.createdAt,
          updatedAt: card.updatedAt
        });

        await appointmentType.save();
        console.log(`  ✓ Created AppointmentType: ${appointmentType.name} (ID: ${appointmentType._id})`);
      } else {
        console.log(`  ⚠ AppointmentType already exists: ${appointmentType.name} (ID: ${appointmentType._id})`);
      }

      migrationMap.set(card._id.toString(), appointmentType._id);
    }

    console.log(`\n✅ Migrated ${migrationMap.size} MedicalCard records to AppointmentType\n`);

    // Step 2: Update Appointment references
    console.log('📋 Step 2: Updating Appointment references...');
    const appointments = await Appointment.find({ medicalCardType: { $exists: true } });
    console.log(`Found ${appointments.length} Appointments with medicalCardType references\n`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const appointment of appointments) {
      try {
        const oldMedicalCardId = appointment.medicalCardType?.toString();
        const newAppointmentTypeId = migrationMap.get(oldMedicalCardId);

        if (newAppointmentTypeId) {
          // Update appointmentType field (now ObjectId instead of String)
          appointment.appointmentType = newAppointmentTypeId;
          
          // Remove old medicalCardType field
          appointment.medicalCardType = undefined;
          
          await appointment.save();
          updatedCount++;
          
          if (updatedCount % 10 === 0) {
            console.log(`  ⏳ Updated ${updatedCount} appointments...`);
          }
        } else {
          console.log(`  ⚠ Warning: No mapping found for MedicalCard ${oldMedicalCardId} in Appointment ${appointment._id}`);
          errorCount++;
        }
      } catch (error) {
        console.error(`  ✗ Error updating Appointment ${appointment._id}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n✅ Updated ${updatedCount} Appointment references`);
    if (errorCount > 0) {
      console.log(`⚠ ${errorCount} appointments had errors or warnings\n`);
    }

    // Step 3: Summary
    console.log('\n📊 Migration Summary:');
    console.log('═'.repeat(50));
    console.log(`MedicalCards migrated:     ${migrationMap.size}`);
    console.log(`Appointments updated:      ${updatedCount}`);
    console.log(`Errors/Warnings:           ${errorCount}`);
    console.log('═'.repeat(50));

    console.log('\n✅ Migration completed successfully!');
    console.log('\n⚠️  Next steps:');
    console.log('1. Verify data in AppointmentType collection');
    console.log('2. Test booking flow with new AppointmentType');
    console.log('3. Once verified, run cleanup script to remove MedicalCard collection');
    console.log('4. Remove backend/models/MedicalCard.js and backend/routes/medcards.js');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed\n');
  }
};

// Run migration
migrateData();
