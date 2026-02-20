/**
 * Generate a formatted XLSX spreadsheet from PSA Phase 2 prices.json
 *
 * Usage:
 *   npx tsx scripts/generate-prices-xlsx.ts
 *
 * Output:
 *   docs/psa-feb/prices.xlsx
 */

import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

const INPUT_FILE = path.join(__dirname, '../docs/psa-feb/prices.json');
const OUTPUT_FILE = path.join(__dirname, '../docs/psa-feb/prices.xlsx');

const COLORS = {
  headerBg: '1B2A4A',
  headerFont: 'FFFFFF',
  titleBg: '0D1B2A',
  titleFont: 'FFD700',
  greenBg: 'E8F5E9',
  redBg: 'FFEBEE',
  greenFont: '2E7D32',
  redFont: 'D32F2F',
  altRowBg: 'F5F7FA',
  borderColor: 'B0BEC5',
  gradeBg: 'FFF8E1',
  priceBg: 'E3F2FD',
  roiBg: 'F3E5F5',
  highConf: 'C8E6C9',
  medConf: 'FFF9C4',
  lowConf: 'FFCDD2',
};

interface GradeData {
  grade: number | null;
  average: number | null;
  median: number | null;
  count: number;
  confidence: string;
}

interface PriceEntry {
  no: number;
  name: string;
  cardNumber: string;
  set: string;
  printing: string;
  expectedGrade: number;
  justification: string;
  lower: GradeData;
  expected: GradeData;
  upper: GradeData;
  rawNmPrice: number | null;
  gradingCost: number;
  valueUplift: number | null;
  netRoi: number | null;
  roiPercent: number | null;
  isSelectedVariant: boolean;
  allPrintingsFound: string;
  tcgPlayerId: string;
}

function border(cell: ExcelJS.Cell): void {
  cell.border = {
    top: { style: 'thin', color: { argb: COLORS.borderColor } },
    bottom: { style: 'thin', color: { argb: COLORS.borderColor } },
    left: { style: 'thin', color: { argb: COLORS.borderColor } },
    right: { style: 'thin', color: { argb: COLORS.borderColor } },
  };
}

function confidenceColor(conf: string): string {
  if (conf === 'high') return COLORS.highConf;
  if (conf === 'medium') return COLORS.medConf;
  return COLORS.lowConf;
}

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  const entries: PriceEntry[] = data.entries;
  console.log(`Loaded ${entries.length} price entries`);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'TCG Master - PSA Price Analyzer';
  wb.created = new Date();

  // ═══ Sheet 1: Prices & ROI ═══
  const ws = wb.addWorksheet('Prices & ROI', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 3 }],
    properties: { tabColor: { argb: '1B2A4A' } },
  });

  // Title
  ws.mergeCells('A1:V1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `PSA Submission — Graded Price Analysis & ROI  (${entries.length} entries, $${data.gradingCostPerCard}/card grading cost)`;
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: COLORS.titleFont } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(1).height = 36;

  ws.mergeCells('A2:V2');
  const subtitleCell = ws.getCell('A2');
  subtitleCell.value = `Generated: ${new Date(data.generatedAt).toLocaleString()} — Confidence: High (5+ sales), Medium (2-4), Low (0-1)`;
  subtitleCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: '666666' } };
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0F0F0' } };
  ws.getRow(2).height = 20;

  // Column definitions
  const cols = [
    { key: 'no', header: '#', width: 5 },
    { key: 'name', header: 'Card', width: 22 },
    { key: 'cardNumber', header: 'Card #', width: 9 },
    { key: 'set', header: 'Set', width: 24 },
    { key: 'grade', header: 'Grade', width: 7 },
    // Lower grade
    { key: 'lGrade', header: 'Lower\nGrade', width: 8 },
    { key: 'lAvg', header: 'Lower\nAvg', width: 10 },
    { key: 'lCount', header: 'Lower\n# Sales', width: 8 },
    { key: 'lConf', header: 'Lower\nConf', width: 8 },
    // Expected grade
    { key: 'eGrade', header: 'Exp\nGrade', width: 8 },
    { key: 'eAvg', header: 'Exp\nAvg', width: 10 },
    { key: 'eMed', header: 'Exp\nMedian', width: 10 },
    { key: 'eCount', header: 'Exp\n# Sales', width: 8 },
    { key: 'eConf', header: 'Exp\nConf', width: 8 },
    // Upper grade
    { key: 'uGrade', header: 'Upper\nGrade', width: 8 },
    { key: 'uAvg', header: 'Upper\nAvg', width: 10 },
    { key: 'uCount', header: 'Upper\n# Sales', width: 8 },
    { key: 'uConf', header: 'Upper\nConf', width: 8 },
    // ROI
    { key: 'rawNm', header: 'Raw NM\nPrice', width: 10 },
    { key: 'uplift', header: 'Value\nUplift', width: 10 },
    { key: 'netRoi', header: 'Net\nROI', width: 10 },
    { key: 'roiPct', header: 'ROI\n%', width: 8 },
  ];

  cols.forEach((col, i) => { ws.getColumn(i + 1).width = col.width; });

  // Header row
  const headerRow = ws.getRow(3);
  headerRow.height = 32;
  cols.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.headerFont } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    border(cell);
  });

  ws.autoFilter = { from: 'A3', to: 'V3' };

  // Data rows
  entries.forEach((e, idx) => {
    const row = ws.getRow(4 + idx);
    row.height = 22;
    const isZebra = idx % 2 === 1;

    const values: (string | number | null)[] = [
      e.no,
      e.name,
      e.cardNumber,
      e.set,
      `PSA ${e.expectedGrade}`,
      e.lower.grade ? `PSA ${e.lower.grade}` : '—',
      e.lower.average,
      e.lower.count,
      e.lower.confidence,
      `PSA ${e.expected.grade}`,
      e.expected.average,
      e.expected.median,
      e.expected.count,
      e.expected.confidence,
      e.upper.grade ? `PSA ${e.upper.grade}` : '—',
      e.upper.average,
      e.upper.count,
      e.upper.confidence,
      e.rawNmPrice,
      e.valueUplift,
      e.netRoi,
      e.roiPercent,
    ];

    values.forEach((val, i) => {
      const cell = row.getCell(i + 1);
      cell.value = val ?? '';
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = { vertical: 'middle' };

      // Number formatting
      if (i === 0) cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if ([6, 10, 11, 15, 18, 19, 20].includes(i) && typeof val === 'number') {
        cell.numFmt = '$#,##0.00';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
      if (i === 21 && typeof val === 'number') {
        cell.numFmt = '0.0"%"';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
      if ([4, 5, 9, 14].includes(i)) cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if ([7, 12, 16].includes(i)) cell.alignment = { horizontal: 'center', vertical: 'middle' };

      // Grade column styling
      if (i === 4) {
        cell.font = { name: 'Calibri', size: 10, bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.gradeBg } };
      }

      // Confidence coloring
      if (i === 8 && typeof val === 'string' && val !== 'N/A') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: confidenceColor(val) } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      if (i === 13 && typeof val === 'string' && val !== 'N/A') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: confidenceColor(val) } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      if (i === 17 && typeof val === 'string' && val !== 'N/A') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: confidenceColor(val) } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      // ROI coloring
      if (i === 20 && typeof val === 'number') {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: val >= 0 ? COLORS.greenFont : COLORS.redFont } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: val >= 0 ? COLORS.greenBg : COLORS.redBg } };
      }
      if (i === 21 && typeof val === 'number') {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: val >= 0 ? COLORS.greenFont : COLORS.redFont } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: val >= 0 ? COLORS.greenBg : COLORS.redBg } };
      }

      // Zebra
      if (isZebra && !(cell.fill as { fgColor?: unknown })?.fgColor) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.altRowBg } };
      }

      border(cell);
    });
  });

  // ═══ Sheet 2: ROI Summary ═══
  const roiWs = wb.addWorksheet('ROI Summary', {
    properties: { tabColor: { argb: '2E7D32' } },
  });

  roiWs.getColumn(1).width = 28;
  roiWs.getColumn(2).width = 14;

  roiWs.mergeCells('A1:B1');
  const roiTitle = roiWs.getCell('A1');
  roiTitle.value = 'ROI Summary';
  roiTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: COLORS.titleFont } };
  roiTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } };
  roiWs.getRow(1).height = 36;

  const withRoi = entries.filter((e) => e.netRoi !== null);
  const positiveRoi = withRoi.filter((e) => (e.netRoi ?? 0) > 0);
  const negativeRoi = withRoi.filter((e) => (e.netRoi ?? 0) <= 0);
  const totalRawValue = entries.reduce((sum, e) => sum + (e.rawNmPrice ?? 0), 0);
  const totalExpectedValue = withRoi.reduce((sum, e) => sum + (e.expected.average ?? 0), 0);
  const totalUplift = withRoi.reduce((sum, e) => sum + (e.valueUplift ?? 0), 0);
  const totalGradingCost = entries.length * 20;
  const totalNetRoi = totalUplift - totalGradingCost;
  const avgRoiPct = withRoi.length > 0
    ? withRoi.reduce((sum, e) => sum + (e.roiPercent ?? 0), 0) / withRoi.length
    : 0;

  // Top 10 positive ROI
  const topRoi = [...withRoi].sort((a, b) => (b.netRoi ?? 0) - (a.netRoi ?? 0)).slice(0, 10);
  // Bottom 5 negative ROI
  const bottomRoi = [...withRoi].sort((a, b) => (a.netRoi ?? 0) - (b.netRoi ?? 0)).slice(0, 5);

  const summaryRows: [string, string | number][] = [
    ['Total Entries', entries.length],
    ['Entries with ROI Data', withRoi.length],
    ['Positive ROI Cards', positiveRoi.length],
    ['Negative ROI Cards', negativeRoi.length],
    ['', ''],
    ['Total Raw NM Value', `$${totalRawValue.toFixed(2)}`],
    ['Total Graded Expected Value', `$${totalExpectedValue.toFixed(2)}`],
    ['Total Value Uplift', `$${totalUplift.toFixed(2)}`],
    ['Total Grading Cost', `$${totalGradingCost}`],
    ['Net Total ROI', `$${totalNetRoi.toFixed(2)}`],
    ['Average ROI %', `${avgRoiPct.toFixed(1)}%`],
  ];

  summaryRows.forEach(([label, value], i) => {
    const row = roiWs.getRow(3 + i);
    const lc = row.getCell(1);
    lc.value = label;
    lc.font = { name: 'Calibri', size: 11, bold: !!label };
    border(lc);
    const vc = row.getCell(2);
    vc.value = value;
    vc.font = { name: 'Calibri', size: 11 };
    vc.alignment = { horizontal: 'right' };
    border(vc);
  });

  // Top ROI table
  const topStart = 16;
  roiWs.getColumn(3).width = 10;
  roiWs.getColumn(4).width = 12;
  roiWs.getColumn(5).width = 10;

  roiWs.mergeCells(`A${topStart}:E${topStart}`);
  const topTitle = roiWs.getCell(`A${topStart}`);
  topTitle.value = 'Top 10 Best ROI Cards';
  topTitle.font = { name: 'Calibri', size: 12, bold: true, color: { argb: COLORS.headerFont } };
  topTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2E7D32' } };
  roiWs.getRow(topStart).height = 28;

  ['Card', 'Set', 'Grade', 'Net ROI', 'ROI %'].forEach((h, i) => {
    const cell = roiWs.getRow(topStart + 1).getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.headerFont } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    border(cell);
  });

  topRoi.forEach((e, i) => {
    const row = roiWs.getRow(topStart + 2 + i);
    [e.name, e.set, `PSA ${e.expectedGrade}`, e.netRoi, e.roiPercent].forEach((v, j) => {
      const cell = row.getCell(j + 1);
      cell.value = v ?? '';
      cell.font = { name: 'Calibri', size: 10 };
      if (j === 3 && typeof v === 'number') { cell.numFmt = '$#,##0.00'; cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.greenFont } }; }
      if (j === 4 && typeof v === 'number') { cell.numFmt = '0.0"%"'; cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.greenFont } }; }
      border(cell);
    });
  });

  // Bottom ROI table
  const botStart = topStart + 14;
  roiWs.mergeCells(`A${botStart}:E${botStart}`);
  const botTitle = roiWs.getCell(`A${botStart}`);
  botTitle.value = 'Bottom 5 Worst ROI Cards';
  botTitle.font = { name: 'Calibri', size: 12, bold: true, color: { argb: COLORS.headerFont } };
  botTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D32F2F' } };
  roiWs.getRow(botStart).height = 28;

  ['Card', 'Set', 'Grade', 'Net ROI', 'ROI %'].forEach((h, i) => {
    const cell = roiWs.getRow(botStart + 1).getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.headerFont } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    border(cell);
  });

  bottomRoi.forEach((e, i) => {
    const row = roiWs.getRow(botStart + 2 + i);
    [e.name, e.set, `PSA ${e.expectedGrade}`, e.netRoi, e.roiPercent].forEach((v, j) => {
      const cell = row.getCell(j + 1);
      cell.value = v ?? '';
      cell.font = { name: 'Calibri', size: 10 };
      if (j === 3 && typeof v === 'number') { cell.numFmt = '$#,##0.00'; cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.redFont } }; }
      if (j === 4 && typeof v === 'number') { cell.numFmt = '0.0"%"'; cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.redFont } }; }
      border(cell);
    });
  });

  // ═══ Write ═══
  await wb.xlsx.writeFile(OUTPUT_FILE);
  console.log(`\nXLSX written to: ${OUTPUT_FILE}`);
  console.log(`  Sheets: Prices & ROI, ROI Summary`);
  console.log(`  Entries: ${entries.length}`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
