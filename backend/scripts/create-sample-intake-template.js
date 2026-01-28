const IntakeFormTemplate = require('./models/IntakeFormTemplate');
const User = require('./models/User');
const mongoose = require('mongoose');
require('dotenv').config();

async function createSampleIntakeFormTemplate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ehr-system');
    console.log('Connected to MongoDB');

    // Find an admin user
    const admin = await User.findOne({ role_id: 1 });
    if (!admin) {
      console.error('No admin user found. Please create an admin first.');
      process.exit(1);
    }

    // Create a comprehensive sample intake form template
    const sampleTemplate = new IntakeFormTemplate({
      name: 'Comprehensive Medical Cannabis Intake Form',
      description: 'Complete medical intake form for medical cannabis consultation appointments',
      version: 1,
      isActive: true,
      isDefault: true,
      appointmentTypes: [], // Universal - works for all appointment types
      states: [], // Universal - works for all states
      sections: [
        // Section 1: Personal Information
        {
          sectionId: 'section-personal',
          title: 'Personal Information',
          description: 'Please provide your basic personal information',
          order: 0,
          fields: [
            {
              fieldId: 'dateOfBirth',
              fieldType: 'date',
              label: 'Date of Birth',
              placeholder: '',
              helpText: 'You must be 18 or older to apply',
              required: true,
              order: 0
            },
            {
              fieldId: 'gender',
              fieldType: 'radio',
              label: 'Gender',
              required: true,
              options: [
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' },
                { value: 'prefer-not-to-say', label: 'Prefer not to say' }
              ],
              order: 1
            },
            {
              fieldId: 'address',
              fieldType: 'textarea',
              label: 'Full Address',
              placeholder: 'Street address, City, State, ZIP',
              required: true,
              order: 2
            },
            {
              fieldId: 'emergencyContactName',
              fieldType: 'text',
              label: 'Emergency Contact Name',
              required: true,
              order: 3
            },
            {
              fieldId: 'emergencyContactPhone',
              fieldType: 'phone',
              label: 'Emergency Contact Phone',
              placeholder: '(555) 123-4567',
              required: true,
              order: 4
            }
          ]
        },

        // Section 2: Medical History
        {
          sectionId: 'section-medical-history',
          title: 'Medical History',
          description: 'Help us understand your medical background',
          order: 1,
          fields: [
            {
              fieldId: 'qualifyingConditions',
              fieldType: 'checkboxGroup',
              label: 'Do you suffer from any of the following conditions?',
              helpText: 'Select all that apply',
              required: true,
              options: [
                { value: 'chronic-pain', label: 'Chronic Pain' },
                { value: 'anxiety', label: 'Anxiety' },
                { value: 'ptsd', label: 'PTSD (Post-Traumatic Stress Disorder)' },
                { value: 'cancer', label: 'Cancer' },
                { value: 'epilepsy', label: 'Epilepsy/Seizures' },
                { value: 'glaucoma', label: 'Glaucoma' },
                { value: 'hiv-aids', label: 'HIV/AIDS' },
                { value: 'crohns', label: "Crohn's Disease" },
                { value: 'parkinsons', label: "Parkinson's Disease" },
                { value: 'multiple-sclerosis', label: 'Multiple Sclerosis' },
                { value: 'arthritis', label: 'Arthritis' },
                { value: 'migraine', label: 'Severe Migraines' },
                { value: 'fibromyalgia', label: 'Fibromyalgia' },
                { value: 'insomnia', label: 'Insomnia' },
                { value: 'other', label: 'Other (please specify below)' }
              ],
              order: 0
            },
            {
              fieldId: 'otherConditions',
              fieldType: 'textarea',
              label: 'Please describe any other medical conditions',
              placeholder: 'Describe any conditions not listed above...',
              required: false,
              order: 1
            },
            {
              fieldId: 'currentMedications',
              fieldType: 'textarea',
              label: 'Current Medications',
              placeholder: 'List all medications you are currently taking, including dosage',
              helpText: 'Include prescription and over-the-counter medications',
              required: true,
              order: 2
            },
            {
              fieldId: 'allergies',
              fieldType: 'textarea',
              label: 'Known Allergies',
              placeholder: 'List any known drug or food allergies',
              required: false,
              order: 3
            },
            {
              fieldId: 'previousSurgeries',
              fieldType: 'textarea',
              label: 'Previous Surgeries or Hospitalizations',
              placeholder: 'Include dates if possible',
              required: false,
              order: 4
            }
          ]
        },

        // Section 3: Cannabis Experience
        {
          sectionId: 'section-cannabis-experience',
          title: 'Cannabis Experience',
          description: 'Tell us about your experience with medical cannabis',
          order: 2,
          fields: [
            {
              fieldId: 'previousCannabisUse',
              fieldType: 'radio',
              label: 'Have you used cannabis before?',
              required: true,
              options: [
                { value: 'yes-medical', label: 'Yes, for medical purposes' },
                { value: 'yes-recreational', label: 'Yes, recreationally' },
                { value: 'yes-both', label: 'Yes, both medical and recreational' },
                { value: 'no', label: 'No, never' }
              ],
              order: 0
            },
            {
              fieldId: 'cannabisHelpful',
              fieldType: 'checkbox',
              label: 'Did cannabis help with your symptoms?',
              required: false,
              order: 1,
              conditionalLogic: {
                enabled: true,
                dependsOn: 'previousCannabisUse',
                condition: 'equals',
                value: 'yes-medical'
              }
            },
            {
              fieldId: 'reasonForSeeking',
              fieldType: 'textarea',
              label: 'Why are you seeking a medical cannabis recommendation?',
              placeholder: 'Explain your primary symptoms and how you hope medical cannabis will help',
              required: true,
              validation: {
                minLength: 50,
                errorMessage: 'Please provide at least 50 characters explaining your reason'
              },
              order: 2
            },
            {
              fieldId: 'preferredConsumptionMethod',
              fieldType: 'multiselect',
              label: 'Preferred Method(s) of Consumption',
              helpText: 'Hold Ctrl/Cmd to select multiple',
              required: false,
              options: [
                { value: 'smoking', label: 'Smoking' },
                { value: 'vaping', label: 'Vaping' },
                { value: 'edibles', label: 'Edibles' },
                { value: 'tinctures', label: 'Tinctures' },
                { value: 'topicals', label: 'Topicals' },
                { value: 'capsules', label: 'Capsules' },
                { value: 'not-sure', label: 'Not sure / Need guidance' }
              ],
              order: 3
            }
          ]
        },

        // Section 4: Lifestyle & Symptoms
        {
          sectionId: 'section-lifestyle',
          title: 'Lifestyle & Symptoms',
          description: 'Help us understand your daily life and symptoms',
          order: 3,
          fields: [
            {
              fieldId: 'symptomSeverity',
              fieldType: 'number',
              label: 'On a scale of 1-10, how would you rate your average daily pain/discomfort?',
              helpText: '1 = Minimal, 10 = Severe',
              required: true,
              validation: {
                min: 1,
                max: 10
              },
              order: 0
            },
            {
              fieldId: 'symptomsWorryLife',
              fieldType: 'checkbox',
              label: 'Do your symptoms significantly interfere with your daily life or work?',
              required: false,
              order: 1
            },
            {
              fieldId: 'symptomsImpact',
              fieldType: 'textarea',
              label: 'How do your symptoms affect your daily activities?',
              placeholder: 'Describe impact on work, sleep, social life, etc.',
              required: false,
              order: 2
            },
            {
              fieldId: 'smokingStatus',
              fieldType: 'radio',
              label: 'Do you currently smoke tobacco?',
              required: true,
              options: [
                { value: 'yes', label: 'Yes' },
                { value: 'no', label: 'No' },
                { value: 'former', label: 'Former smoker' }
              ],
              order: 3
            },
            {
              fieldId: 'alcoholUse',
              fieldType: 'radio',
              label: 'Do you consume alcohol?',
              required: true,
              options: [
                { value: 'never', label: 'Never' },
                { value: 'occasionally', label: 'Occasionally (1-2 times/week)' },
                { value: 'regularly', label: 'Regularly (3+ times/week)' },
                { value: 'daily', label: 'Daily' }
              ],
              order: 4
            }
          ]
        },

        // Section 5: Required Documents
        {
          sectionId: 'section-documents',
          title: 'Required Documents',
          description: 'Please upload the following documents',
          order: 4,
          fields: [
            {
              fieldId: 'governmentId',
              fieldType: 'file',
              label: 'Government-Issued Photo ID',
              helpText: 'Driver\'s License, Passport, or State ID',
              required: true,
              order: 0
            },
            {
              fieldId: 'medicalRecords',
              fieldType: 'file',
              label: 'Medical Records (Optional)',
              helpText: 'Upload any relevant medical records, prescriptions, or doctor\'s notes',
              required: false,
              order: 1
            },
            {
              fieldId: 'proofOfResidency',
              fieldType: 'file',
              label: 'Proof of Residency',
              helpText: 'Utility bill, lease agreement, or bank statement showing your current address',
              required: true,
              order: 2
            }
          ]
        },

        // Section 6: Certification & Consent
        {
          sectionId: 'section-certification',
          title: 'Certification & Consent',
          description: 'Please review and accept the following statements',
          order: 5,
          fields: [
            {
              fieldId: 'certifyTruth',
              fieldType: 'checkbox',
              label: 'I certify that all information provided is true and accurate to the best of my knowledge',
              required: true,
              order: 0
            },
            {
              fieldId: 'consentTelehealth',
              fieldType: 'checkbox',
              label: 'I consent to a telemedicine consultation with a licensed physician',
              required: true,
              order: 1
            },
            {
              fieldId: 'understandRecommendation',
              fieldType: 'checkbox',
              label: 'I understand that a physician recommendation does not guarantee approval of a medical cannabis card',
              required: true,
              order: 2
            },
            {
              fieldId: 'privacyPolicy',
              fieldType: 'checkbox',
              label: 'I have read and agree to the Privacy Policy and Terms of Service',
              required: true,
              order: 3
            },
            {
              fieldId: 'additionalComments',
              fieldType: 'textarea',
              label: 'Additional Comments or Questions (Optional)',
              placeholder: 'Is there anything else you would like your doctor to know?',
              required: false,
              order: 4
            }
          ]
        }
      ],
      settings: {
        allowSaveProgress: true,
        showProgressBar: true,
        submitButtonText: 'Submit Medical Intake Form',
        successMessage: 'Thank you! Your intake form has been submitted successfully. Your doctor will review it before your appointment.',
        pdfHeaderText: 'Medical Cannabis Intake Form',
        pdfFooterText: 'Confidential Medical Document - Patient Information Protected by HIPAA'
      },
      createdBy: admin._id,
      updatedBy: admin._id
    });

    await sampleTemplate.save();

    console.log('\n✅ Sample intake form template created successfully!');
    console.log('\nTemplate Details:');
    console.log(`  Name: ${sampleTemplate.name}`);
    console.log(`  Sections: ${sampleTemplate.sections.length}`);
    console.log(`  Total Fields: ${sampleTemplate.sections.reduce((acc, s) => acc + s.fields.length, 0)}`);
    console.log(`  ID: ${sampleTemplate._id}`);
    console.log('\nYou can now:');
    console.log('  1. View it at: http://localhost:3000/intake-forms');
    console.log('  2. Edit it in the Form Builder');
    console.log('  3. Patients will use this template when filling intake forms');

    process.exit(0);
  } catch (error) {
    console.error('Error creating sample template:', error);
    process.exit(1);
  }
}

createSampleIntakeFormTemplate();
