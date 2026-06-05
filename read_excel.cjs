const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const files = [
  'assets/sample files/KENEA Net Invoiced_June 3, 2026.xlsx',
  'assets/sample files/KENEA CML_June 3, 2026.xlsx',
  'assets/sample files/VD30 Target.xlsx',
  'assets/sample files/Salesman Target STT and UBA.xlsx',
  'assets/sample files/Category Reference.xlsx',
  'assets/sample files/Customer Class.xlsx',
  'assets/sample files/Geo Hierarchy Data.xlsx',
  'assets/sample files/VD30 Reference.xlsx'
];

const results = {};

for (const file of files) {
  try {
    const workbook = xlsx.readFile(file);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    const headers = data[0];
    const sample = data[1];
    results[path.basename(file)] = { headers, sample };
  } catch (e) {
    results[path.basename(file)] = { error: e.message };
  }
}

fs.writeFileSync('excel_structure.json', JSON.stringify(results, null, 2));
