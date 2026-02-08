/**
 * Generate a formatted XLSX spreadsheet from PSA Phase 1 mapping.json
 *
 * Usage:
 *   npx tsx scripts/generate-mapping-xlsx.ts
 *
 * Output:
 *   docs/psa-feb/mapping.xlsx
 */

import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

const INPUT_FILE = path.join(__dirname, '../docs/psa-feb/mapping.json');
const OUTPUT_FILE = path.join(__dirname, '../docs/psa-feb/mapping.xlsx');

// ─── Color Palette ──────────────────────────────────────────────────────────

const COLORS = {
  headerBg: '1B2A4A',       // Dark navy
  headerFont: 'FFFFFF',     // White
  subHeaderBg: '2D4A7A',    // Medium navy
  subHeaderFont: 'FFFFFF',
  matchedBg: 'E8F5E9',      // Light green
  noMatchBg: 'FFEBEE',      // Light red
  selectedBg: 'C8E6C9',     // Green highlight
  warningBg: 'FFF3E0',      // Light orange
  borderColor: 'B0BEC5',    // Grey border
  altRowBg: 'F5F7FA',       // Zebra stripe
  priceBg: 'E3F2FD',        // Light blue for price columns
  gradeBg: 'FFF8E1',        // Light yellow for grade
  titleBg: '0D1B2A',        // Very dark navy for title row
  titleFont: 'FFD700',      // Gold for title text
};

interface MappingFile {
  generatedAt: string;
  totalCards: number;
  matchedCards: number;
  noMatchCards: number;
  cards: Array<{
    no: number;
    name: string;
    cardNumber: string;
    expectedGrade: string;
    justification: string;
    searchQuery: string;
    matches: Array<{
      tcgPlayerId: string;
      name: string;
      setName: string;
      cardNumber: string;
      printing: string;
      marketPrice: number | null;
      selected: boolean;
    }>;
  }>;
}

function applyThinBorder(cell: ExcelJS.Cell): void {
  cell.border = {
    top: { style: 'thin', color: { argb: COLORS.borderColor } },
    bottom: { style: 'thin', color: { argb: COLORS.borderColor } },
    left: { style: 'thin', color: { argb: COLORS.borderColor } },
    right: { style: 'thin', color: { argb: COLORS.borderColor } },
  };
}

async function main() {
  // Read mapping data
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Input file not found: ${INPUT_FILE}`);
    console.error('Run Phase 1 first: npx tsx scripts/psa-price-fetch.ts phase1');
    process.exit(1);
  }

  const data: MappingFile = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  console.log(`Loaded ${data.totalCards} cards from mapping.json`);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'TCG Master - PSA Submission Analyzer';
  wb.created = new Date();

  // ═══ Sheet 1: Card Mapping (Main Review Sheet) ═══
  const ws = wb.addWorksheet('Card Mapping', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 3 }],
    properties: { defaultColWidth: 14, tabColor: { argb: '1B2A4A' } },
  });

  // Title row
  ws.mergeCells('A1:L1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `PSA Submission — Card Mapping Review  (${data.matchedCards} matched / ${data.noMatchCards} no match / ${data.totalCards} total)`;
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: COLORS.titleFont } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(1).height = 36;

  // Subtitle with generation date
  ws.mergeCells('A2:L2');
  const subtitleCell = ws.getCell('A2');
  subtitleCell.value = `Generated: ${new Date(data.generatedAt).toLocaleString()} — Review matches below, mark corrections in "Review" column`;
  subtitleCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: '666666' } };
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0F0F0' } };
  ws.getRow(2).height = 20;

  // Column definitions
  const columns = [
    { key: 'no', header: '#', width: 5 },
    { key: 'name', header: 'Card Name', width: 22 },
    { key: 'cardNumber', header: 'Card #', width: 10 },
    { key: 'expectedGrade', header: 'Expected\nGrade', width: 10 },
    { key: 'matchedName', header: 'Matched Name', width: 28 },
    { key: 'matchedSet', header: 'Set', width: 26 },
    { key: 'matchedNumber', header: 'Match #', width: 10 },
    { key: 'printing', header: 'Printing', width: 16 },
    { key: 'marketPrice', header: 'Market\nPrice', width: 12 },
    { key: 'tcgPlayerId', header: 'TCGPlayer\nID', width: 12 },
    { key: 'status', header: 'Status', width: 12 },
    { key: 'review', header: 'Review\nNotes', width: 22 },
  ];

  // Set column widths
  columns.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width;
  });

  // Header row (row 3)
  const headerRow = ws.getRow(3);
  headerRow.height = 32;
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.headerFont } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    applyThinBorder(cell);
  });

  // Enable autoFilter
  ws.autoFilter = { from: 'A3', to: 'L3' };

  // Data rows
  let rowIdx = 4;
  for (const card of data.cards) {
    const selected = card.matches.find((m) => m.selected);
    const isNoMatch = card.matches.length === 0;
    const hasSelected = !!selected;
    const isZebra = (rowIdx - 4) % 2 === 1;

    const row = ws.getRow(rowIdx);
    row.height = 22;

    // Values
    const values = [
      card.no,
      card.name,
      card.cardNumber,
      card.expectedGrade,
      selected?.name || (isNoMatch ? '—' : 'No selection'),
      selected?.setName || '',
      selected?.cardNumber || '',
      selected?.printing || '',
      selected?.marketPrice ?? '',
      selected?.tcgPlayerId || '',
      isNoMatch ? 'NO MATCH' : hasSelected ? 'Matched' : 'Review',
      '',
    ];

    values.forEach((val, i) => {
      const cell = row.getCell(i + 1);
      cell.value = val as string | number;
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = { vertical: 'middle', wrapText: i === 4 || i === 5 };

      // Column-specific formatting
      if (i === 0) cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (i === 3) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { name: 'Calibri', size: 11, bold: true };
      }
      if (i === 8 && typeof val === 'number') {
        cell.numFmt = '$#,##0.00';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
      if (i === 9) cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (i === 10) cell.alignment = { horizontal: 'center', vertical: 'middle' };

      // Row coloring
      let bgColor: string | null = null;
      if (isNoMatch) {
        bgColor = COLORS.noMatchBg;
      } else if (!hasSelected) {
        bgColor = COLORS.warningBg;
      } else if (isZebra) {
        bgColor = COLORS.altRowBg;
      }

      // Special column highlights
      if (i === 3 && bgColor === null) bgColor = COLORS.gradeBg;
      if (i === 8 && typeof val === 'number' && bgColor === null) bgColor = COLORS.priceBg;

      if (bgColor) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      }

      // Status column styling
      if (i === 10) {
        if (val === 'NO MATCH') {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'D32F2F' } };
        } else if (val === 'Matched') {
          cell.font = { name: 'Calibri', size: 10, color: { argb: '2E7D32' } };
        } else {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'E65100' } };
        }
      }

      applyThinBorder(cell);
    });

    rowIdx++;
  }

  // ═══ Sheet 2: Summary Stats ═══
  const summaryWs = wb.addWorksheet('Summary', {
    properties: { tabColor: { argb: '2E7D32' } },
  });

  summaryWs.getColumn(1).width = 28;
  summaryWs.getColumn(2).width = 14;
  summaryWs.getColumn(3).width = 30;

  // Title
  summaryWs.mergeCells('A1:C1');
  const sumTitle = summaryWs.getCell('A1');
  sumTitle.value = 'PSA Submission — Summary';
  sumTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: COLORS.titleFont } };
  sumTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } };
  sumTitle.alignment = { vertical: 'middle' };
  summaryWs.getRow(1).height = 36;

  const summaryData: [string, string | number][] = [
    ['Total Cards', data.totalCards],
    ['Matched', data.matchedCards],
    ['No Match', data.noMatchCards],
    ['Match Rate', `${((data.matchedCards / data.totalCards) * 100).toFixed(1)}%`],
    ['Generated', new Date(data.generatedAt).toLocaleString()],
  ];

  summaryData.forEach(([label, value], i) => {
    const row = summaryWs.getRow(i + 3);
    const labelCell = row.getCell(1);
    labelCell.value = label;
    labelCell.font = { name: 'Calibri', size: 11, bold: true };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'ECEFF1' } };
    applyThinBorder(labelCell);

    const valueCell = row.getCell(2);
    valueCell.value = value;
    valueCell.font = { name: 'Calibri', size: 11 };
    valueCell.alignment = { horizontal: 'center' };
    applyThinBorder(valueCell);
  });

  // Set breakdown by set
  const setCounts: Record<string, { count: number; totalValue: number }> = {};
  for (const card of data.cards) {
    const selected = card.matches.find((m) => m.selected);
    const setName = selected?.setName || 'Unmatched';
    if (!setCounts[setName]) setCounts[setName] = { count: 0, totalValue: 0 };
    setCounts[setName].count++;
    setCounts[setName].totalValue += selected?.marketPrice ?? 0;
  }

  const setEntries = Object.entries(setCounts).sort((a, b) => b[1].count - a[1].count);

  const setStartRow = 10;
  summaryWs.mergeCells(`A${setStartRow}:C${setStartRow}`);
  const setTitle = summaryWs.getCell(`A${setStartRow}`);
  setTitle.value = 'Breakdown by Set';
  setTitle.font = { name: 'Calibri', size: 12, bold: true, color: { argb: COLORS.headerFont } };
  setTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.subHeaderBg } };
  summaryWs.getRow(setStartRow).height = 28;

  const setHeaderRow = summaryWs.getRow(setStartRow + 1);
  ['Set Name', 'Cards', 'Total Market Value'].forEach((h, i) => {
    const cell = setHeaderRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.headerFont } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    cell.alignment = { horizontal: i === 0 ? 'left' : 'center' };
    applyThinBorder(cell);
  });

  setEntries.forEach(([setName, info], i) => {
    const row = summaryWs.getRow(setStartRow + 2 + i);
    const nameCell = row.getCell(1);
    nameCell.value = setName;
    nameCell.font = { name: 'Calibri', size: 10 };
    if (setName === 'Unmatched') nameCell.font = { name: 'Calibri', size: 10, color: { argb: 'D32F2F' } };
    applyThinBorder(nameCell);

    const countCell = row.getCell(2);
    countCell.value = info.count;
    countCell.alignment = { horizontal: 'center' };
    countCell.font = { name: 'Calibri', size: 10 };
    applyThinBorder(countCell);

    const valueCell = row.getCell(3);
    valueCell.value = info.totalValue;
    valueCell.numFmt = '$#,##0.00';
    valueCell.alignment = { horizontal: 'right' };
    valueCell.font = { name: 'Calibri', size: 10 };
    applyThinBorder(valueCell);

    if (i % 2 === 1) {
      [nameCell, countCell, valueCell].forEach((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.altRowBg } };
      });
    }
  });

  // ═══ Sheet 3: Grade Distribution ═══
  const gradeWs = wb.addWorksheet('Grade Distribution', {
    properties: { tabColor: { argb: 'FF6F00' } },
  });

  gradeWs.getColumn(1).width = 18;
  gradeWs.getColumn(2).width = 10;
  gradeWs.getColumn(3).width = 16;
  gradeWs.getColumn(4).width = 20;

  gradeWs.mergeCells('A1:D1');
  const gradeTitle = gradeWs.getCell('A1');
  gradeTitle.value = 'Expected Grade Distribution';
  gradeTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: COLORS.titleFont } };
  gradeTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } };
  gradeWs.getRow(1).height = 36;

  const gradeCounts: Record<string, { count: number; avgPrice: number; prices: number[] }> = {};
  for (const card of data.cards) {
    const grade = card.expectedGrade;
    const selected = card.matches.find((m) => m.selected);
    const price = selected?.marketPrice ?? 0;
    if (!gradeCounts[grade]) gradeCounts[grade] = { count: 0, avgPrice: 0, prices: [] };
    gradeCounts[grade].count++;
    if (price > 0) gradeCounts[grade].prices.push(price);
  }
  for (const g of Object.values(gradeCounts)) {
    g.avgPrice = g.prices.length > 0 ? g.prices.reduce((a, b) => a + b, 0) / g.prices.length : 0;
  }

  const gradeHeaderRow = gradeWs.getRow(3);
  ['Expected Grade', 'Count', 'Avg Market Price', 'Grade Breakdown'].forEach((h, i) => {
    const cell = gradeHeaderRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.headerFont } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    cell.alignment = { horizontal: i === 0 ? 'left' : 'center' };
    applyThinBorder(cell);
  });

  // Sort grades: split grades first, then numeric descending
  const sortedGrades = Object.entries(gradeCounts).sort((a, b) => {
    const aNum = parseFloat(a[0]);
    const bNum = parseFloat(b[0]);
    if (isNaN(aNum) && isNaN(bNum)) return a[0].localeCompare(b[0]);
    if (isNaN(aNum)) return 1;
    if (isNaN(bNum)) return -1;
    return bNum - aNum;
  });

  sortedGrades.forEach(([grade, info], i) => {
    const row = gradeWs.getRow(4 + i);
    const gCell = row.getCell(1);
    gCell.value = `PSA ${grade}`;
    gCell.font = { name: 'Calibri', size: 11, bold: true };
    gCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.gradeBg } };
    applyThinBorder(gCell);

    const cCell = row.getCell(2);
    cCell.value = info.count;
    cCell.alignment = { horizontal: 'center' };
    cCell.font = { name: 'Calibri', size: 11 };
    applyThinBorder(cCell);

    const pCell = row.getCell(3);
    pCell.value = info.avgPrice;
    pCell.numFmt = '$#,##0.00';
    pCell.alignment = { horizontal: 'right' };
    pCell.font = { name: 'Calibri', size: 11 };
    applyThinBorder(pCell);

    // Simple bar chart using Unicode blocks
    const maxCount = Math.max(...Object.values(gradeCounts).map((g) => g.count));
    const barLength = Math.round((info.count / maxCount) * 20);
    const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
    const barCell = row.getCell(4);
    barCell.value = `${bar} ${info.count}`;
    barCell.font = { name: 'Consolas', size: 9, color: { argb: '1565C0' } };
    applyThinBorder(barCell);
  });

  // ═══ Sheet 4: Justifications (for grading reference) ═══
  const justWs = wb.addWorksheet('Justifications', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }],
    properties: { tabColor: { argb: '7B1FA2' } },
  });

  justWs.getColumn(1).width = 5;
  justWs.getColumn(2).width = 22;
  justWs.getColumn(3).width = 10;
  justWs.getColumn(4).width = 10;
  justWs.getColumn(5).width = 60;
  justWs.getColumn(6).width = 12;

  justWs.mergeCells('A1:F1');
  const justTitle = justWs.getCell('A1');
  justTitle.value = 'Grading Justifications & Condition Notes';
  justTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: COLORS.titleFont } };
  justTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } };
  justWs.getRow(1).height = 36;

  const justHeaders = ['#', 'Card Name', 'Card #', 'Grade', 'Justification / Condition Notes', 'Market Price'];
  const justHeaderRow = justWs.getRow(2);
  justHeaders.forEach((h, i) => {
    const cell = justHeaderRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.headerFont } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    applyThinBorder(cell);
  });
  justHeaderRow.height = 26;

  justWs.autoFilter = { from: 'A2', to: 'F2' };

  data.cards.forEach((card, idx) => {
    const row = justWs.getRow(3 + idx);
    const selected = card.matches.find((m) => m.selected);
    row.height = 28;

    const vals = [card.no, card.name, card.cardNumber, card.expectedGrade, card.justification, selected?.marketPrice ?? ''];
    vals.forEach((val, i) => {
      const cell = row.getCell(i + 1);
      cell.value = val as string | number;
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = { vertical: 'middle', wrapText: i === 4 };
      if (i === 0) cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (i === 3) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { name: 'Calibri', size: 11, bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.gradeBg } };
      }
      if (i === 5 && typeof val === 'number') {
        cell.numFmt = '$#,##0.00';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
      if (idx % 2 === 1 && i !== 3) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.altRowBg } };
      }
      applyThinBorder(cell);
    });
  });

  // ═══ Write file ═══
  await wb.xlsx.writeFile(OUTPUT_FILE);
  console.log(`\nXLSX written to: ${OUTPUT_FILE}`);
  console.log(`  Sheets: Card Mapping, Summary, Grade Distribution, Justifications`);
  console.log(`  Rows: ${data.cards.length} cards`);
}

main().catch((err) => {
  console.error('Failed to generate XLSX:', err);
  process.exit(1);
});
