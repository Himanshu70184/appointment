/**
 * Cleanup Script
 * Remove MedicalCard collection after successful migration
 * Run ONLY after verifying migration was successful
 * Run: node scripts/cleanup-medicalcard.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askConfirmation = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase() === 'yes');
    });
  });
};

const cleanup = async () => {
  try {
    console.log('\n⚠️  CLEANUP SCRIPT - Remove MedicalCard Collection');
    console.log('═'.repeat(60));
    console.log('This script will PERMANENTLY DELETE the MedicalCard collection.');
    console.log('Make sure you have:');
    console.log('  1. Run the migration script successfully');
    console.log('  2. Verified all data in AppointmentType collection');
    console.log('  3. Tested the booking flow');
    console.log('  4. Backed up your database');
    console.log('═'.repeat(60));

    const confirmed = await askConfirmation('\nType "yes" to proceed with cleanup: ');

    if (!confirmed) {
      console.log('\n❌ Cleanup cancelled');
      rl.close();
      process.exit(0);
    }

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ehr-system');
    console.log('\n✅ Connected to MongoDB\n');

    // Check if MedicalCard collection exists
    const collections = await mongoose.connection.db.listCollections().toArray();
    const hasMedicalCards = collections.some(col => col.name === 'medicalcards');

    if (!hasMedicalCards) {
      console.log('ℹ️  MedicalCard collection does not exist. Nothing to clean up.');
      rl.close();
      await mongoose.connection.close();
      return;
    }

    // Count documents before deletion
    const MedicalCard = mongoose.model('MedicalCard', new mongoose.Schema({}, { strict: false }));
    const count = await MedicalCard.countDocuments();
    
    console.log(`📊 Found ${count} documents in MedicalCard collection`);

    const finalConfirm = await askConfirmation(`\nDelete ${count} documents? Type "yes" to confirm: `);

    if (!finalConfirm) {
      console.log('\n❌ Cleanup cancelled');
      rl.close();
      await mongoose.connection.close();
      process.exit(0);
    }

    // Drop the collection
    console.log('\n🗑️  Dropping MedicalCard collection...');
    await mongoose.connection.db.dropCollection('medicalcards');
    console.log('✅ MedicalCard collection deleted successfully');

    console.log('\n📋 Next manual steps:');
    console.log('  1. Delete backend/models/MedicalCard.js');
    console.log('  2. Delete backend/routes/medcards.js');
    console.log('  3. Remove medcards route from backend/server.js');
    console.log('  4. Restart your backend server');

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    console.error(error.stack);
  } finally {
    rl.close();
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed\n');
  }
};

cleanup();
