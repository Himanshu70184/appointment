const mongoose = require('mongoose');
const MedicalCard = require('../models/MedicalCard');
const State = require('../models/State');
const Coupon = require('../models/Coupon');
require('dotenv').config();

const createPatientTestData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ehr-system');
    console.log('Connected to MongoDB');

    // Create Medical Cards if they don't exist
    const existingCards = await MedicalCard.find();
    if (existingCards.length === 0) {
      const medicalCards = [
        {
          name: 'Initial Medical Card',
          description: 'First-time medical marijuana card application',
          price: 150,
          validityMonths: 12,
          isActive: true
        },
        {
          name: 'Renewal Medical Card',
          description: 'Annual renewal of medical marijuana card',
          price: 100,
          validityMonths: 12,
          isActive: true
        },
        {
          name: 'Minor Medical Card',
          description: 'Medical card for patients under 18 (requires guardian)',
          price: 175,
          validityMonths: 12,
          isActive: true
        }
      ];

      await MedicalCard.insertMany(medicalCards);
      console.log('✓ Created medical cards');
    } else {
      console.log('✓ Medical cards already exist');
    }

    // Create States if they don't exist
    const existingStates = await State.find();
    if (existingStates.length === 0) {
      const states = [
        {
          code: 'CA',
          name: 'California',
          region: 'West',
          medicalCardPrice: 150,
          isActive: true
        },
        {
          code: 'NY',
          name: 'New York',
          region: 'Northeast',
          medicalCardPrice: 175,
          isActive: true
        },
        {
          code: 'FL',
          name: 'Florida',
          region: 'Southeast',
          medicalCardPrice: 125,
          isActive: true
        },
        {
          code: 'TX',
          name: 'Texas',
          region: 'South',
          medicalCardPrice: 140,
          isActive: true
        }
      ];

      await State.insertMany(states);
      console.log('✓ Created states');
    } else {
      console.log('✓ States already exist');
    }

    // Create Test Coupons
    const existingCoupons = await Coupon.find();
    if (existingCoupons.length === 0) {
      const coupons = [
        {
          code: 'SAVE10',
          discountType: 'percentage',
          discountValue: 10,
          validFrom: new Date(),
          validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
          usageLimit: 100,
          usedCount: 0,
          isActive: true,
          description: '10% off all services'
        },
        {
          code: 'WELCOME25',
          discountType: 'fixed',
          discountValue: 25,
          validFrom: new Date(),
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          usageLimit: 50,
          usedCount: 0,
          isActive: true,
          description: '$25 off for new patients'
        },
        {
          code: 'NEWYEAR2026',
          discountType: 'percentage',
          discountValue: 15,
          validFrom: new Date(),
          validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
          usageLimit: 200,
          usedCount: 0,
          isActive: true,
          description: '15% New Year discount'
        }
      ];

      await Coupon.insertMany(coupons);
      console.log('✓ Created test coupons');
    } else {
      console.log('✓ Coupons already exist');
    }

    console.log('\n=================================');
    console.log('Patient Portal Test Data Created!');
    console.log('=================================\n');

    console.log('Test Coupon Codes:');
    const allCoupons = await Coupon.find({ isActive: true });
    allCoupons.forEach(coupon => {
      console.log(`  - ${coupon.code}: ${coupon.description}`);
    });

    console.log('\nMedical Cards:');
    const allCards = await MedicalCard.find({ isActive: true });
    allCards.forEach(card => {
      console.log(`  - ${card.name}: $${card.price}`);
    });

    console.log('\nActive States:');
    const allStates = await State.find({ isActive: true });
    allStates.forEach(state => {
      console.log(`  - ${state.code}: ${state.name}`);
    });

    console.log('\n✅ Setup complete! You can now test the patient booking flow.\n');
    console.log('Next steps:');
    console.log('1. Ensure doctors are created with availability');
    console.log('2. Navigate to http://localhost:3000/patient/book');
    console.log('3. Test the complete booking workflow\n');

  } catch (error) {
    console.error('Error creating test data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

createPatientTestData();
