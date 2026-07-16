import * as XLSX from 'xlsx-js-style';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Salesman {
  id: string;
  name: string;
  type?: string;
}

export const exportMcp = (salesmen: Salesman[], allCustomers: any[], fileNamePrefix = 'MCP Export') => {
  const wb = XLSX.utils.book_new();

  salesmen.forEach(salesman => {
    // Filter customers for this salesman
    const salesmanCustomers = allCustomers.filter(c => c.salesmanId === salesman.id);

    // Create a new worksheet
    const ws = XLSX.utils.aoa_to_sheet([[]]);
    const sheetData: any[] = []; // We will manually place cells into this 2D array

    // Helper to write to sheetData
    const writeCell = (row: number, col: number, value: any, style: any = null) => {
      if (!sheetData[row]) sheetData[row] = [];
      sheetData[row][col] = { v: value, t: typeof value === 'number' ? 'n' : 's', s: style };
    };

    let maxTopRow = 0;

    // We have two rows of blocks: W1&W3 (Top), W2&W4 (Bottom)
    const weekConfigs = [
      { id: 'W1&W3', label: 'Week 1 & 3', rowOffset: 0 },
      { id: 'W2&W4', label: 'Week 2 & 4', rowOffset: 0 } // rowOffset will be updated later
    ];

    weekConfigs.forEach((weekConfig, weekIndex) => {
      // If bottom row, we start exactly at Row 59 to match user's custom Print Area
      if (weekIndex === 1) {
        weekConfig.rowOffset = maxTopRow + 6;
      }

      DAYS.forEach((day, dayIndex) => {
        const colOffset = dayIndex * 13; // 12 columns + 1 padding column
        const baseRow = weekConfig.rowOffset;

        // Determine customers for this block
        const blockCustomers = salesmanCustomers.filter(c => {
          const cDay = (c.coverageDay || '').toUpperCase();
          const dayTarget = day.toUpperCase();
          const isDayMatch = cDay === dayTarget || dayTarget.startsWith(cDay.substring(0, 3)) || cDay.includes(dayTarget);
          if (!isDayMatch) return false;

          const cWeek = (c.wklyCoverage || '').toUpperCase();
          const isW1W3 = (cWeek.includes('1') && cWeek.includes('3')) || cWeek.includes('W1&W3');
          const isW2W4 = (cWeek.includes('2') && cWeek.includes('4')) || cWeek.includes('W2&W4');
          const isWkly = cWeek.includes('WKLY') || cWeek.includes('WEEKLY') || cWeek === 'W' || cWeek === 'WEEK';

          if (weekConfig.id === 'W1&W3') return isW1W3 || isWkly;
          if (weekConfig.id === 'W2&W4') return isW2W4 || isWkly;
          return false;
        });

        // 1. Draw Block Header
        const headerStyle = { font: { bold: true, sz: 12 } };
        const labelStyle = { font: { color: { rgb: "FF888888" }, sz: 10 } };
        const valueStyle = { font: { bold: true, sz: 10 } };
        const rightLabelStyle = { font: { color: { rgb: "FF888888" }, sz: 10 }, alignment: { horizontal: 'right' } };

        writeCell(baseRow, colOffset, 'Master Coverage Plan', headerStyle);
        
        // Put labels in Col 0 (spills to Col 1). Values in Col 2 (spills to Col 3).
        // Put right-aligned labels in Col 4 (Barangay - wide). Values in Col 5 (Town/City - wide).
        writeCell(baseRow + 1, colOffset, 'Salesman Name:', labelStyle);
        writeCell(baseRow + 1, colOffset + 2, salesman.name, valueStyle);
        writeCell(baseRow + 1, colOffset + 4, 'Day:', rightLabelStyle);
        writeCell(baseRow + 1, colOffset + 5, day, { font: { bold: true, sz: 12 }, alignment: { horizontal: 'left' } });

        writeCell(baseRow + 2, colOffset, 'Salesman Code:', labelStyle);
        writeCell(baseRow + 2, colOffset + 2, salesman.id, valueStyle);
        writeCell(baseRow + 2, colOffset + 4, 'Planned:', rightLabelStyle);
        writeCell(baseRow + 2, colOffset + 5, blockCustomers.length, { font: { sz: 10 }, alignment: { horizontal: 'left' } });

        writeCell(baseRow + 3, colOffset, 'Service Model:', labelStyle);
        writeCell(baseRow + 3, colOffset + 2, salesman.type || '', valueStyle);
        writeCell(baseRow + 3, colOffset + 4, 'Week:', rightLabelStyle);
        writeCell(baseRow + 3, colOffset + 5, weekConfig.label, { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: "FFF2C94C" } }, alignment: { horizontal: 'center' }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } });

        writeCell(baseRow + 4, colOffset, 'Supervisor Name:', labelStyle);
        writeCell(baseRow + 4, colOffset + 2, (salesman as any).supervisor || '', valueStyle);

        // 2. Draw Table Headers
        const tableHeaders = ['Seq', 'Account Code', 'Account Name', 'CustClass', 'No., Bldg., Street,\nBarangay', 'Town/City', 'Wk1', 'Wk2', 'Wk3', 'Wk4', 'Terms', 'Month Target'];
        const thStyle = {
          font: { bold: true, sz: 10, color: { rgb: "FFFFFFFF" } },
          fill: { fgColor: { rgb: "FF808080" } }, // Dark Gray background
          border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
        };
        const thYellowStyle = { ...thStyle, fill: { fgColor: { rgb: "FFF2C94C" } }, font: { bold: true, sz: 10, color: { rgb: "FF000000" } } };

        tableHeaders.forEach((th, idx) => {
          const style = th.startsWith('Wk') || th === 'Month Target' ? thYellowStyle : thStyle;
          writeCell(baseRow + 6, colOffset + idx, th, style);
        });

        // 3. Draw Customer Rows (Always 45 minimum)
        let currentRow = baseRow + 7;
        const cellBorder = { top: { style: 'thin', color: { rgb: "FFAAAAAA" } }, bottom: { style: 'thin', color: { rgb: "FFAAAAAA" } }, left: { style: 'thin', color: { rgb: "FFAAAAAA" } }, right: { style: 'thin', color: { rgb: "FFAAAAAA" } } };
        
        const rowCount = Math.max(45, blockCustomers.length);

        for (let i = 0; i < rowCount; i++) {
          const c = blockCustomers[i];
          const seq = i + 1;
          const isOverCapacity = seq > 45;
          const bgFill = isOverCapacity ? { fgColor: { rgb: "FFFFCCCC" } } : null; // Light Red if > 45

          const baseCellStyle = bgFill ? { border: cellBorder, fill: bgFill, font: { sz: 9 }, alignment: { wrapText: false, shrinkToFit: true } } : { border: cellBorder, font: { sz: 9 }, alignment: { wrapText: false, shrinkToFit: true } };
          const centerCellStyle = { ...baseCellStyle, alignment: { horizontal: 'center', wrapText: false, shrinkToFit: true } };

          if (c) {
            const cWeek = (c.wklyCoverage || '').toUpperCase();
            const isWkly = cWeek.includes('WKLY') || cWeek.includes('WEEKLY') || cWeek === 'W' || cWeek === 'WEEK';

            let w1 = '', w2 = '', w3 = '', w4 = '';
            if (weekConfig.id === 'W1&W3') {
              w1 = '1'; w3 = '1';
            } else if (weekConfig.id === 'W2&W4') {
              w2 = '1'; w4 = '1';
            }
            if (isWkly) {
              w1 = '1'; w2 = '1'; w3 = '1'; w4 = '1';
            }

            const customerClass = c.customerClass || c.customerGroup || '';

            writeCell(currentRow, colOffset + 0, seq, centerCellStyle);
            writeCell(currentRow, colOffset + 1, c.customerCode || c.id, baseCellStyle);
            writeCell(currentRow, colOffset + 2, c.name, baseCellStyle);
            writeCell(currentRow, colOffset + 3, customerClass, baseCellStyle);
            writeCell(currentRow, colOffset + 4, c.barangay, baseCellStyle);
            writeCell(currentRow, colOffset + 5, c.city, baseCellStyle);
            writeCell(currentRow, colOffset + 6, w1, centerCellStyle);
            writeCell(currentRow, colOffset + 7, w2, centerCellStyle);
            writeCell(currentRow, colOffset + 8, w3, centerCellStyle);
            writeCell(currentRow, colOffset + 9, w4, centerCellStyle);
            writeCell(currentRow, colOffset + 10, c.paymentTerms || c.terms || '', centerCellStyle);
            writeCell(currentRow, colOffset + 11, '', baseCellStyle);
          } else {
            // Draw empty row with borders
            for (let col = 0; col < 12; col++) {
              writeCell(currentRow, colOffset + col, col === 0 ? seq : '', col === 0 || (col >= 6 && col <= 10) ? centerCellStyle : baseCellStyle);
            }
          }
          currentRow++;
        }

        // Add Footer text
        writeCell(currentRow, colOffset, "XCM/OPM-Actual, SEC-10 calls; BTDT/EXT-40 calls; Max of 45 calls per day only to ensure visit to all planned customers for the day.", { font: { sz: 6, italic: true } });
        currentRow++;

        // 4. Update maxTopRow tracking
        if (weekIndex === 0 && currentRow > maxTopRow) {
          maxTopRow = currentRow;
        }
      });
    });

    // Add horizontal page break between top row of blocks and bottom row of blocks
    ws['!breaks'] = [{ type: 0, id: maxTopRow + 2, max: 1048575, min: 0 }];

    // Populate worksheet object
    for (let r = 0; r < sheetData.length; r++) {
      if (!sheetData[r]) continue;
      for (let c = 0; c < sheetData[r].length; c++) {
        if (!sheetData[r][c]) continue;
        const cellRef = XLSX.utils.encode_cell({ r, c });
        ws[cellRef] = sheetData[r][c];
      }
    }
    
    // Set Sheet dimensions
    if (sheetData.length > 0) {
      ws['!ref'] = XLSX.utils.encode_range({
        s: { c: 0, r: 0 },
        e: { c: 6 * 13, r: sheetData.length }
      });
    }

    // Set Column Widths (for each block)
    const colWidths: { wch: number }[] = [];
    for (let i = 0; i < 6; i++) {
      colWidths.push({ wch: 4 });   // Seq
      colWidths.push({ wch: 11 });  // Account Code
      colWidths.push({ wch: 18 });  // Account Name (reduced)
      colWidths.push({ wch: 5 });   // CustClass
      colWidths.push({ wch: 14 });  // Barangay (100px)
      colWidths.push({ wch: 14 });  // Town/City (100px)
      colWidths.push({ wch: 4 });   // Wk1 (30px)
      colWidths.push({ wch: 4 });   // Wk2 (30px)
      colWidths.push({ wch: 4 });   // Wk3 (30px)
      colWidths.push({ wch: 4 });   // Wk4 (30px)
      colWidths.push({ wch: 5 });   // Terms (40px)
      colWidths.push({ wch: 6 });   // Month Target (40px)
      // 1 Padding Column
      colWidths.push({ wch: 2 });   // Padding
    }
    ws['!cols'] = colWidths;

    // Add Default Print Settings (Letter size, Portrait, Narrow Margins)
    // CRITICAL: DO NOT use fitToWidth because it shrinks the massive grid into 1 page!
    ws['!pageSetup'] = { paperSize: 1, orientation: 'portrait' };
    ws['!margins'] = { left: 0.25, right: 0.25, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 };

    // Determine sheet name
    let sheetName = `MCP ${salesman.id}`;
    if (sheetName.length > 31) sheetName = sheetName.substring(0, 31);

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const finalFileName = `${fileNamePrefix}.xlsx`;
  XLSX.writeFile(wb, finalFileName);
};
