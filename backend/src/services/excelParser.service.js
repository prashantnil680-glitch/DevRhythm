const XLSX = require('xlsx');

async function parseExcelFile(buffer, filename) {
  const ext = filename.split('.').pop().toLowerCase();
  
  // Handle JSON files
  if (ext === 'json') {
    const content = buffer.toString('utf8');
    let data;
    try {
      data = JSON.parse(content);
    } catch (err) {
      throw new Error(
        'Invalid JSON format. Please provide a valid JSON array of objects.\n' +
        'Example:\n' +
        '[\n' +
        '  { "title": "Two Sum", "platformQuestionId": "two-sum" },\n' +
        '  { "title": "3Sum" },\n' +
        '  { "platformQuestionId": "four-sum" }\n' +
        ']\n' +
        'Each object must contain at least "title" or "platformQuestionId".'
      );
    }
    let rows = [];
    if (Array.isArray(data)) {
      rows = data;
    } else if (data.data && Array.isArray(data.data)) {
      rows = data.data;
    } else {
      throw new Error(
        'JSON must contain an array of questions. Example:\n' +
        '[\n' +
        '  { "title": "Two Sum" },\n' +
        '  { "platformQuestionId": "three-sum" }\n' +
        ']'
      );
    }
    
    const normalized = [];
    for (const row of rows) {
      let title = null;
      let platformQuestionId = null;
      for (const [key, value] of Object.entries(row)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey === 'title' || lowerKey === 'question' || lowerKey === 'problem') {
          title = value ? String(value).trim() : null;
        } else if (lowerKey === 'platformquestionid' || lowerKey === 'questionid' || lowerKey === 'slug') {
          platformQuestionId = value ? String(value).trim() : null;
        }
      }
      if (!title && !platformQuestionId) {
        // If no specific field, try to use the first string value as title
        for (const val of Object.values(row)) {
          if (typeof val === 'string' && val.trim()) {
            title = val.trim();
            break;
          }
        }
      }
      if (title || platformQuestionId) {
        normalized.push({ title, platformQuestionId });
      }
    }
    if (normalized.length === 0) {
      throw new Error(
        'No valid question data found in JSON. Each object must contain "title" or "platformQuestionId".\n' +
        'Example: { "title": "Two Sum" } or { "platformQuestionId": "two-sum" }'
      );
    }
    return normalized;
  }
  
  // Handle Excel/CSV files
  let workbook;
  let sheetName;
  if (ext === 'csv') {
    workbook = XLSX.read(buffer, { type: 'buffer', raw: true });
    sheetName = workbook.SheetNames[0];
  } else if (ext === 'xlsx' || ext === 'xls') {
    workbook = XLSX.read(buffer, { type: 'buffer' });
    sheetName = workbook.SheetNames[0];
  } else {
    throw new Error(
      'Unsupported file format. Please upload .xlsx, .xls, .csv, or .json.\n' +
      'For Excel/CSV, include columns: "title" or "platformQuestionId".\n' +
      'For JSON, provide an array of objects with "title" and/or "platformQuestionId".'
    );
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (!rows || rows.length === 0) {
    throw new Error('No data rows found in the file. Ensure the first row contains column headers.');
  }

  const normalized = [];
  for (const row of rows) {
    let title = null;
    let platformQuestionId = null;
    for (const [key, value] of Object.entries(row)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'title' || lowerKey === 'question' || lowerKey === 'problem') {
        title = value ? String(value).trim() : null;
      } else if (lowerKey === 'platformquestionid' || lowerKey === 'questionid' || lowerKey === 'slug') {
        platformQuestionId = value ? String(value).trim() : null;
      }
    }
    if (!title) {
      for (const value of Object.values(row)) {
        if (typeof value === 'string' && value.trim().length > 0) {
          title = value.trim();
          break;
        }
      }
    }
    if (title || platformQuestionId) {
      normalized.push({ title, platformQuestionId });
    }
  }

  if (normalized.length === 0) {
    throw new Error(
      'No valid question data found. Your file must contain a column named "title" or "platformQuestionId".\n' +
      'Example Excel columns:\n' +
      '| title        | platformQuestionId |\n' +
      '| Two Sum      | two-sum            |\n' +
      '| 3Sum         | 3sum               |'
    );
  }
  return normalized;
}

module.exports = { parseExcelFile };