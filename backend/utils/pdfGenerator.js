const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generate PDF from intake form submission
 * @param {Object} submission - IntakeFormSubmission document
 * @param {Object} template - IntakeFormTemplate document
 * @param {Object} appointment - Appointment document
 * @param {Object} patient - User document
 * @returns {Promise<string>} - Path to generated PDF file
 */
async function generateIntakeFormPDF(submission, template, appointment, patient) {
  return new Promise(async (resolve, reject) => {
    try {
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(__dirname, '../uploads/intake-pdfs');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Generate unique filename
      const filename = `intake-${submission._id}-${Date.now()}.pdf`;
      const filepath = path.join(uploadsDir, filename);

      // Create PDF document
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(filepath);

      doc.pipe(stream);

      // Helper function to add page header
      const addHeader = () => {
        doc.fontSize(20).font('Helvetica-Bold').text(
          template.settings?.pdfHeaderText || 'Medical Intake Form',
          { align: 'center' }
        );
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').fillColor('#666666').text(
          `Submitted: ${new Date(submission.submittedAt || submission.createdAt).toLocaleString()}`,
          { align: 'center' }
        );
        doc.moveDown(1);
        doc.strokeColor('#cccccc').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(1);
        doc.fillColor('#000000');
      };

      // Add first page header
      addHeader();

      // Patient Information Section
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#2563eb').text('Patient Information');
      doc.moveDown(0.5);
      
      doc.fontSize(11).font('Helvetica').fillColor('#000000');
      doc.text(`Name: ${patient.name || 'N/A'}`);
      doc.text(`Email: ${patient.email || 'N/A'}`);
      doc.text(`Phone: ${patient.phone || 'N/A'}`);
      if (appointment.appointmentType) {
        doc.text(`Appointment Type: ${appointment.appointmentType.name || 'N/A'}`);
      }
      if (appointment.scheduledDate) {
        doc.text(`Appointment Date: ${new Date(appointment.scheduledDate).toLocaleDateString()}`);
      }
      doc.moveDown(1.5);

      // Form Sections
      template.sections.forEach((section, sectionIndex) => {
        // Check if we need a new page
        if (doc.y > 700) {
          doc.addPage();
          addHeader();
        }

        // Section Header
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#2563eb').text(section.title);
        if (section.description) {
          doc.fontSize(10).font('Helvetica').fillColor('#666666').text(section.description);
        }
        doc.moveDown(0.5);

        // Section Fields
        section.fields.forEach((field) => {
          // Find corresponding submission data
          const submissionField = submission.formData.find(f => f.fieldId === field.fieldId);
          
          if (!submissionField) return;

          // Check for page break
          if (doc.y > 720) {
            doc.addPage();
            addHeader();
          }

          // Field Label
          doc.fontSize(11).font('Helvetica-Bold').fillColor('#374151').text(field.label);
          doc.moveDown(0.2);

          // Field Value
          doc.fontSize(10).font('Helvetica').fillColor('#000000');

          let valueText = '';

          switch (field.fieldType) {
            case 'text':
            case 'email':
            case 'phone':
            case 'number':
            case 'date':
            case 'textarea':
              valueText = submissionField.value || 'Not provided';
              break;

            case 'checkbox':
              valueText = submissionField.value ? '☑ Yes' : '☐ No';
              break;

            case 'radio':
            case 'select':
              valueText = submissionField.value || 'Not selected';
              break;

            case 'checkboxGroup':
            case 'multiselect':
              if (Array.isArray(submissionField.value)) {
                valueText = submissionField.value.length > 0 
                  ? submissionField.value.join(', ') 
                  : 'None selected';
              } else {
                valueText = 'None selected';
              }
              break;

            case 'file':
              if (submissionField.fileUrls && submissionField.fileUrls.length > 0) {
                valueText = `${submissionField.fileUrls.length} file(s) uploaded`;
                submissionField.fileUrls.forEach((url, index) => {
                  doc.text(`  ${index + 1}. ${path.basename(url)}`);
                });
              } else {
                valueText = 'No files uploaded';
              }
              break;

            default:
              valueText = String(submissionField.value || 'N/A');
          }

          if (field.fieldType !== 'file') {
            // Wrap long text
            const options = { width: 495, align: 'left' };
            doc.text(valueText, options);
          }

          doc.moveDown(0.8);
        });

        doc.moveDown(0.5);

        // Add separator between sections (except last one)
        if (sectionIndex < template.sections.length - 1) {
          doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
          doc.moveDown(1);
        }
      });

      // Footer Section
      if (doc.y > 700) {
        doc.addPage();
        addHeader();
      }

      doc.moveDown(2);
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#374151').text('Certification');
      doc.fontSize(10).font('Helvetica').fillColor('#000000');
      doc.text(
        'I certify that the information provided above is true and accurate to the best of my knowledge.',
        { width: 495 }
      );
      doc.moveDown(0.5);
      doc.text(`Digital Signature: ${patient.name}`);
      doc.text(`Date: ${new Date(submission.submittedAt || submission.createdAt).toLocaleString()}`);
      doc.text(`IP Address: ${submission.ipAddress || 'N/A'}`);

      // Footer on every page
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor('#999999');
        
        // Footer text
        const footerText = template.settings?.pdfFooterText || 
          `Intake Form Submission #${submission._id} | Confidential Medical Document`;
        doc.text(
          footerText,
          50,
          doc.page.height - 50,
          { align: 'center', width: 495 }
        );

        // Page number
        doc.text(
          `Page ${i + 1} of ${range.count}`,
          50,
          doc.page.height - 35,
          { align: 'center', width: 495 }
        );
      }

      // Finalize PDF
      doc.end();

      stream.on('finish', () => {
        const relativePath = `/uploads/intake-pdfs/${filename}`;
        resolve(relativePath);
      });

      stream.on('error', (error) => {
        reject(error);
      });

    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateIntakeFormPDF
};
