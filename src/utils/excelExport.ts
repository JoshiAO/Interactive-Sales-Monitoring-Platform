import * as XLSX from 'xlsx-js-style';

export const exportSalesToExcel = (salesmen: any[], _teams: string[], fileName: string = 'Sales_Performance.xlsx') => {
  const wb = XLSX.utils.book_new();

  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "1E3A8A" } }, // Dark blue
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: 'thin', color: { rgb: "000000" } },
      bottom: { style: 'thin', color: { rgb: "000000" } },
      left: { style: 'thin', color: { rgb: "000000" } },
      right: { style: 'thin', color: { rgb: "000000" } }
    }
  };

  const cellStyle = {
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: 'thin', color: { rgb: "CCCCCC" } },
      bottom: { style: 'thin', color: { rgb: "CCCCCC" } },
      left: { style: 'thin', color: { rgb: "CCCCCC" } },
      right: { style: 'thin', color: { rgb: "CCCCCC" } }
    }
  };

  const numberStyle = {
    ...cellStyle,
    numFmt: '#,##0.00'
  };

  const percentageStyle = {
    ...cellStyle,
    numFmt: '0.0%'
  };

  // Group salesmen by team
  const salesmenByTeam: Record<string, any[]> = {};
  salesmen.forEach(s => {
    const teamName = s.team || 'Unassigned';
    if (!salesmenByTeam[teamName]) salesmenByTeam[teamName] = [];
    salesmenByTeam[teamName].push(s);
  });

  Object.keys(salesmenByTeam).forEach(teamName => {
    const teamSalesmen = salesmenByTeam[teamName];
    
    // Sort by Salesman ID ascending
    teamSalesmen.sort((a, b) => (a.id || '').localeCompare(b.id || ''));

    // Prepare data
    const wsData: any[][] = [];
    
    // Headers
    wsData.push([
      'Salesman ID', 'Name', 'Type', 
      'STT Target', 'STT Actual', 'STT %',
      'UBA Target', 'UBA Actual', 'UBA %'
    ]);

    teamSalesmen.forEach(s => {
      const sttPct = s.target > 0 ? (s.mtdSales / s.target) : 0;
      const ubaPct = s.ubaTarget > 0 ? (s.uba / s.ubaTarget) : 0;

      wsData.push([
        s.id,
        s.name,
        s.type,
        s.target || 0,
        s.mtdSales || 0,
        sttPct,
        s.ubaTarget || 0,
        s.uba || 0,
        ubaPct
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Apply styles to headers
    for (let C = 0; C < 9; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!ws[cellAddress]) continue;
      ws[cellAddress].s = headerStyle;
    }

    // Apply styles to data rows
    for (let R = 1; R <= teamSalesmen.length; ++R) {
      for (let C = 0; C < 9; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellAddress]) continue;

        if (C === 3 || C === 4) {
          ws[cellAddress].s = numberStyle;
        } else if (C === 5 || C === 8) {
          ws[cellAddress].s = percentageStyle;
        } else {
          ws[cellAddress].s = cellStyle;
        }
      }
    }

    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // ID
      { wch: 25 }, // Name
      { wch: 15 }, // Type
      { wch: 15 }, // STT Target
      { wch: 15 }, // STT Actual
      { wch: 10 }, // STT %
      { wch: 15 }, // UBA Target
      { wch: 15 }, // UBA Actual
      { wch: 10 }, // UBA %
    ];

    // Add sheet to workbook (sheet names max 31 chars)
    XLSX.utils.book_append_sheet(wb, ws, teamName.substring(0, 31));
  });

  // If no salesmen exist, create an empty sheet
  if (Object.keys(salesmenByTeam).length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([['No Data Available']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Empty');
  }

  XLSX.writeFile(wb, fileName);
};


export const exportVd30ToExcel = (salesmen: any[], refVd30Items: any[], _teams: string[], fileName: string = 'VD30_Performance.xlsx') => {
  const wb = XLSX.utils.book_new();

  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "047857" } }, // Emerald green
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: "000000" } },
      bottom: { style: 'thin', color: { rgb: "000000" } },
      left: { style: 'thin', color: { rgb: "000000" } },
      right: { style: 'thin', color: { rgb: "000000" } }
    }
  };

  const cellStyle = {
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: 'thin', color: { rgb: "CCCCCC" } },
      bottom: { style: 'thin', color: { rgb: "CCCCCC" } },
      left: { style: 'thin', color: { rgb: "CCCCCC" } },
      right: { style: 'thin', color: { rgb: "CCCCCC" } }
    }
  };

  const percentageStyle = {
    ...cellStyle,
    numFmt: '0.0%'
  };

  // Group salesmen by team
  const salesmenByTeam: Record<string, any[]> = {};
  salesmen.forEach(s => {
    const teamName = s.team || 'Unassigned';
    if (!salesmenByTeam[teamName]) salesmenByTeam[teamName] = [];
    salesmenByTeam[teamName].push(s);
  });

  // Collect all unique VD30 items from refVd30Items
  const allVd30Items = Array.from(new Set(refVd30Items.map(item => item.vd30_code))).filter(Boolean).sort();

  Object.keys(salesmenByTeam).forEach(teamName => {
    const teamSalesmen = salesmenByTeam[teamName];
    
    // Sort by Salesman ID ascending
    teamSalesmen.sort((a, b) => (a.id || '').localeCompare(b.id || ''));

    const wsData: any[][] = [];
    
    const merges: any[] = [];
    
    // Two rows of headers
    const headerRow1: string[] = ['Salesman ID', 'Name', 'Type', 'VD30 Target', 'VD30 Actual', 'VD30 %'];
    const headerRow2: string[] = ['', '', '', '', '', ''];
    
    // Setup merges for the first 6 columns (vertical merge)
    for (let c = 0; c < 6; c++) {
      merges.push({ s: { r: 0, c: c }, e: { r: 1, c: c } });
    }

    allVd30Items.forEach((itemCode, index) => {
      // Parent header (Row 1)
      headerRow1.push(itemCode);
      headerRow1.push(''); // Empty cell for the merge
      
      // Child headers (Row 2)
      headerRow2.push('Target');
      headerRow2.push('Actual');
      
      // Horizontal merge for the parent cell in Row 1
      const startCol = 6 + (index * 2);
      merges.push({ s: { r: 0, c: startCol }, e: { r: 0, c: startCol + 1 } });
    });

    wsData.push(headerRow1);
    wsData.push(headerRow2);

    teamSalesmen.forEach(s => {
      const vd30Pct = s.vd30Target > 0 ? (s.vd30 / s.vd30Target) : 0;

      const row = [
        s.id,
        s.name,
        s.type,
        s.vd30Target || 0,
        s.vd30 || 0,
        vd30Pct
      ];

      allVd30Items.forEach(itemCode => {
        const target = (s.vd30TargetMap && s.vd30TargetMap[itemCode]) || 0;
        // The actual map in useDashboardData is stored by base code, so we strip any _ suffix if needed, 
        // but typically it's just the itemCode or the prefix. Let's use the itemCode exactly, or prefix if that fails.
        const baseCode = itemCode.split('_')[0];
        const actual = (s.vd30ActualMap && (s.vd30ActualMap[baseCode] || s.vd30ActualMap[itemCode])) || 0;
        
        row.push(target);
        row.push(actual);
      });

      wsData.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Apply styles to headers (both rows)
    const totalCols = 6 + (allVd30Items.length * 2);
    for (let R = 0; R < 2; R++) {
      for (let C = 0; C < totalCols; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellAddress]) continue;
        ws[cellAddress].s = headerStyle;
      }
    }

    // Apply styles to data rows
    for (let R = 2; R < teamSalesmen.length + 2; ++R) {
      for (let C = 0; C < totalCols; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellAddress]) continue;

        if (C === 5) { // VD30 %
          ws[cellAddress].s = percentageStyle;
        } else {
          ws[cellAddress].s = cellStyle;
        }
      }
    }

    // Set column widths
    const cols = [
      { wch: 15 }, // ID
      { wch: 25 }, // Name
      { wch: 15 }, // Type
      { wch: 15 }, // VD30 Target
      { wch: 15 }, // VD30 Actual
      { wch: 10 }, // VD30 %
    ];

    allVd30Items.forEach(() => {
      cols.push({ wch: 12 }); // Target
      cols.push({ wch: 12 }); // Actual
    });

    ws['!cols'] = cols;
    ws['!merges'] = merges;

    XLSX.utils.book_append_sheet(wb, ws, teamName.substring(0, 31));
  });

  if (Object.keys(salesmenByTeam).length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([['No Data Available']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Empty');
  }

  XLSX.writeFile(wb, fileName);
};
