const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const fs = require('fs');

/**
 * Parse CSV file to JSON array
 * @param {Buffer|string} csvData - CSV data (buffer or string)
 * @param {Object} options - Parser options
 * @returns {Array} - Parsed data
 */
const parseCSV = (csvData, options = {}) => {
  try {
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: true,
      ...options
    });
    
    return records;
  } catch (error) {
    throw new Error(`CSV parsing error: ${error.message}`);
  }
};

/**
 * Convert JSON array to CSV string
 * @param {Array} data - Array of objects
 * @param {Object} options - Stringify options
 * @returns {string} - CSV string
 */
const toCSV = (data, options = {}) => {
  try {
    const csv = stringify(data, {
      header: true,
      ...options
    });
    
    return csv;
  } catch (error) {
    throw new Error(`CSV generation error: ${error.message}`);
  }
};

/**
 * Read CSV file and parse to JSON
 * @param {string} filePath - Path to CSV file
 * @returns {Promise<Array>} - Parsed data
 */
const readCSVFile = async (filePath) => {
  try {
    const csvData = fs.readFileSync(filePath, 'utf-8');
    return parseCSV(csvData);
  } catch (error) {
    throw new Error(`Error reading CSV file: ${error.message}`);
  }
};

/**
 * Write JSON array to CSV file
 * @param {string} filePath - Output file path
 * @param {Array} data - Data to write
 * @returns {Promise<void>}
 */
const writeCSVFile = async (filePath, data) => {
  try {
    const csv = toCSV(data);
    fs.writeFileSync(filePath, csv, 'utf-8');
  } catch (error) {
    throw new Error(`Error writing CSV file: ${error.message}`);
  }
};

/**
 * Validate CSV data against schema
 * @param {Array} data - Parsed CSV data
 * @param {Object} schema - Validation schema
 * @returns {Object} - { valid: boolean, errors: Array }
 */
const validateCSVData = (data, schema) => {
  const errors = [];
  
  data.forEach((row, index) => {
    const rowNumber = index + 2; // Account for header row
    
    Object.keys(schema).forEach(field => {
      const rules = schema[field];
      
      // Required field check
      if (rules.required && !row[field]) {
        errors.push(`Row ${rowNumber}: ${field} is required`);
      }
      
      // Type check
      if (row[field] && rules.type) {
        const value = row[field];
        switch (rules.type) {
          case 'string':
            if (typeof value !== 'string') {
              errors.push(`Row ${rowNumber}: ${field} must be a string`);
            }
            break;
          case 'number':
            if (isNaN(Number(value))) {
              errors.push(`Row ${rowNumber}: ${field} must be a number`);
            }
            break;
          case 'boolean':
            if (!['true', 'false', '1', '0', true, false].includes(value)) {
              errors.push(`Row ${rowNumber}: ${field} must be a boolean`);
            }
            break;
        }
      }
      
      // Min length check
      if (row[field] && rules.minLength && row[field].length < rules.minLength) {
        errors.push(`Row ${rowNumber}: ${field} must be at least ${rules.minLength} characters`);
      }
      
      // Max length check
      if (row[field] && rules.maxLength && row[field].length > rules.maxLength) {
        errors.push(`Row ${rowNumber}: ${field} must be at most ${rules.maxLength} characters`);
      }
      
      // Min value check
      if (row[field] && rules.min !== undefined && Number(row[field]) < rules.min) {
        errors.push(`Row ${rowNumber}: ${field} must be at least ${rules.min}`);
      }
      
      // Max value check
      if (row[field] && rules.max !== undefined && Number(row[field]) > rules.max) {
        errors.push(`Row ${rowNumber}: ${field} must be at most ${rules.max}`);
      }
      
      // Enum check
      if (row[field] && rules.enum && !rules.enum.includes(row[field])) {
        errors.push(`Row ${rowNumber}: ${field} must be one of: ${rules.enum.join(', ')}`);
      }
      
      // Pattern check
      if (row[field] && rules.pattern && !rules.pattern.test(row[field])) {
        errors.push(`Row ${rowNumber}: ${field} format is invalid`);
      }
    });
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Transform CSV row for database insertion
 * @param {Object} row - CSV row
 * @param {Function} transformer - Transform function
 * @returns {Object} - Transformed row
 */
const transformRow = (row, transformer) => {
  if (typeof transformer === 'function') {
    return transformer(row);
  }
  return row;
};

/**
 * Process CSV upload for a model
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} - Processing result
 */
const processCSVUpload = async ({
  file,
  model,
  schema,
  transformer,
  userId,
  skipDuplicates = true,
  uniqueField = 'code'
}) => {
  try {
    // Parse CSV
    const data = parseCSV(file.buffer.toString('utf-8'));
    
    if (data.length === 0) {
      return {
        success: false,
        message: 'CSV file is empty',
        imported: 0,
        skipped: 0,
        errors: []
      };
    }
    
    // Validate data
    const validation = validateCSVData(data, schema);
    if (!validation.valid) {
      return {
        success: false,
        message: 'Validation failed',
        imported: 0,
        skipped: 0,
        errors: validation.errors
      };
    }
    
    let imported = 0;
    let skipped = 0;
    const errors = [];
    
    // Process each row
    for (const row of data) {
      try {
        // Transform row if transformer provided
        const transformedRow = transformer ? transformRow(row, transformer) : row;
        
        // Add audit fields
        transformedRow.createdBy = userId;
        transformedRow.updatedBy = userId;
        
        // Check for duplicates
        if (skipDuplicates && uniqueField) {
          const existing = await model.findOne({ [uniqueField]: transformedRow[uniqueField] });
          if (existing) {
            skipped++;
            continue;
          }
        }
        
        // Create document
        await model.create(transformedRow);
        imported++;
      } catch (error) {
        errors.push(`Row error: ${error.message}`);
        skipped++;
      }
    }
    
    return {
      success: true,
      message: `Import completed: ${imported} imported, ${skipped} skipped`,
      imported,
      skipped,
      errors
    };
  } catch (error) {
    return {
      success: false,
      message: `Import failed: ${error.message}`,
      imported: 0,
      skipped: 0,
      errors: [error.message]
    };
  }
};

module.exports = {
  parseCSV,
  toCSV,
  readCSVFile,
  writeCSVFile,
  validateCSVData,
  transformRow,
  processCSVUpload
};
