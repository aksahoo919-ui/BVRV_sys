/**
 * reportService.js
 * PDF and Excel report generation using pdfkit and exceljs.
 *
 * Exports:
 *   generateReportCardPdf(data)  → Promise<Buffer>
 *   generateRankListPdf(data)    → Promise<Buffer>
 *   generateMarksMemo(data)      → Promise<Buffer>
 *   generateExcelReport(options) → Promise<Buffer>
 */
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

const INSTITUTION = process.env.INSTITUTION_NAME || 'BVRV Institution';
const ACCENT = '#1e3a5f';

// ── PDF helpers ───────────────────────────────────────────────────────────

function pdfHeader(doc, title, subtitle) {
  doc.rect(0, 0, doc.page.width, 60).fill(ACCENT);
  doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
     .text(INSTITUTION, 0, 12, { align: 'center', width: doc.page.width });
  doc.fontSize(11).font('Helvetica')
     .text(title, 0, 34, { align: 'center', width: doc.page.width });
  if (subtitle) {
    doc.fontSize(9).text(subtitle, 0, 48, { align: 'center', width: doc.page.width });
  }
  doc.fillColor('black').moveDown(0.5);
  doc.y = 70;
}

function pdfSectionTitle(doc, text) {
  doc.moveDown(0.4);
  doc.rect(40, doc.y, doc.page.width - 80, 16).fill('#e2e8f0');
  doc.fillColor('#1e293b').fontSize(9).font('Helvetica-Bold')
     .text(text, 44, doc.y + 3);
  doc.fillColor('black');
  doc.moveDown(0.3);
}

function pdfKeyValues(doc, pairs) {
  doc.fontSize(9).font('Helvetica');
  const col = (doc.page.width - 80) / 2;
  let i = 0;
  for (const [k, v] of pairs) {
    const x = 40 + (i % 2) * col;
    const y = i % 2 === 0 ? doc.y : doc.y;
    if (i % 2 === 0 && i > 0) doc.moveDown(0.25);
    doc.fillColor('#64748b').text(`${k}:`, x, doc.y, { width: 80, continued: true })
       .fillColor('black').text(` ${v ?? '—'}`, { width: col - 90 });
    if (i % 2 === 0) doc.moveUp(1); // stay on same line for next col
    i++;
  }
  if (i % 2 !== 0) doc.moveDown(0);
  doc.moveDown(0.5);
}

function pdfTable(doc, headers, rows, colWidths) {
  const pageW = doc.page.width - 80;
  const widths = colWidths || headers.map(() => pageW / headers.length);

  // Header
  doc.rect(40, doc.y, pageW, 16).fill(ACCENT);
  doc.fillColor('white').fontSize(8).font('Helvetica-Bold');
  let x = 40; const hy = doc.y + 4;
  headers.forEach((h, i) => {
    doc.text(h, x + 3, hy, { width: widths[i] - 6, lineBreak: false });
    x += widths[i];
  });
  doc.fillColor('black');
  doc.moveDown(0.3);

  // Rows
  doc.font('Helvetica').fontSize(8);
  rows.forEach((row, ri) => {
    if (doc.y > doc.page.height - 100) doc.addPage();
    const ry = doc.y;
    if (ri % 2 === 0) { doc.rect(40, ry - 1, pageW, 13).fill('#f8fafc'); doc.fillColor('black'); }
    x = 40;
    row.forEach((cell, ci) => {
      doc.text(String(cell ?? '—'), x + 3, ry, { width: widths[ci] - 6, lineBreak: false });
      x += widths[ci];
    });
    doc.moveDown(0.25);
  });
  doc.moveDown(0.5);
}

function pdfFooter(doc) {
  const y = doc.page.height - 35;
  doc.moveTo(40, y - 5).lineTo(doc.page.width - 40, y - 5).stroke('#cbd5e1');
  doc.fontSize(7).fillColor('#94a3b8')
     .text(`Generated on ${new Date().toLocaleString()} | ${INSTITUTION}`,
           40, y, { align: 'center', width: doc.page.width - 80 });
}

function buildPdf(fn) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    fn(doc);
    pdfFooter(doc);
    doc.end();
  });
}

// ── Public PDF generators ─────────────────────────────────────────────────

/**
 * generateReportCardPdf({ student, semester, marks, attendance, result, gradeBoundaries, gpaScale })
 *
 * marks: [{ subject_name, subject_code, credits, internal_scored, internal_max,
 *            exam_scored, exam_max, total_scored, total_max, grade }]
 * attendance: [{ subject_name, subject_code, attended, total_sessions, percentage }]
 * result: { gpa, cgpa, rank }
 */
export function generateReportCardPdf(data) {
  const { student, semester, marks, attendance, result } = data;
  const semLabel = `Semester ${semester?.number ?? ''} — ${semester?.year ?? ''}`;

  return buildPdf(doc => {
    pdfHeader(doc, 'Report Card', semLabel);

    // Student info
    doc.x = 40;
    pdfSectionTitle(doc, 'STUDENT INFORMATION');
    pdfKeyValues(doc, [
      ['Name',       student?.name],
      ['Roll No',    student?.roll_number ?? '—'],
      ['Email',      student?.email],
      ['Department', student?.department ?? '—'],
      ['Course',     student?.course ?? '—'],
      ['Semester',   semLabel],
    ]);

    // Marks table
    pdfSectionTitle(doc, 'MARKS');
    const pageW = doc.page.width - 80;
    pdfTable(doc,
      ['Subject', 'Cr', 'Int', 'Int Max', 'Exam', 'Exam Max', 'Total%', 'Grade'],
      (marks || []).map(m => [
        m.subject_name, m.credits ?? 3,
        m.internal_scored ?? '—', m.internal_max ?? '—',
        m.exam_scored ?? '—',     m.exam_max ?? '—',
        m.total_pct != null ? `${m.total_pct}%` : '—',
        m.grade ?? '—',
      ]),
      [pageW * 0.25, pageW * 0.05, pageW * 0.08, pageW * 0.09,
       pageW * 0.08, pageW * 0.09, pageW * 0.09, pageW * 0.08]
    );

    // Attendance
    pdfSectionTitle(doc, 'ATTENDANCE SUMMARY');
    pdfTable(doc,
      ['Subject', 'Attended', 'Total', 'Percentage', 'Status'],
      (attendance || []).map(a => [
        a.subject_name, a.attended, a.total_sessions,
        `${a.percentage ?? 0}%`,
        (a.percentage ?? 0) >= 75 ? 'OK' : 'SHORT',
      ]),
      [pageW * 0.40, pageW * 0.15, pageW * 0.15, pageW * 0.15, pageW * 0.15]
    );

    // Result summary
    if (result?.gpa != null) {
      pdfSectionTitle(doc, 'RESULT SUMMARY');
      doc.x = 40;
      pdfKeyValues(doc, [
        ['GPA',  result.gpa],
        ['CGPA', result.cgpa],
        ['Rank', result.rank ?? '—'],
      ]);
    }
  });
}

/**
 * generateRankListPdf({ semesterLabel, rows })
 * rows: [{ rank, roll_number, name, gpa, cgpa, attendance_pct }]
 */
export function generateRankListPdf({ semesterLabel, rows }) {
  return buildPdf(doc => {
    pdfHeader(doc, 'Rank List', semesterLabel);
    doc.x = 40;
    const pageW = doc.page.width - 80;
    pdfTable(doc,
      ['Rank', 'Roll No', 'Name', 'GPA', 'CGPA', 'Attendance%'],
      (rows || []).map(r => [r.rank, r.roll_number ?? '—', r.name, r.gpa, r.cgpa, r.attendance_pct ?? '—']),
      [pageW*0.08, pageW*0.15, pageW*0.35, pageW*0.12, pageW*0.12, pageW*0.18]
    );
  });
}

/**
 * generateMarksMemo({ student, semester, marks })
 * marks: [{ subject_code, subject_name, assessment_type, scored_marks, max_marks }]
 */
export function generateMarksMemo({ student, semester, marks }) {
  const semLabel = `Semester ${semester?.number ?? ''} — ${semester?.year ?? ''}`;
  return buildPdf(doc => {
    pdfHeader(doc, 'Marks Memorandum', semLabel);
    doc.x = 40;
    pdfSectionTitle(doc, 'STUDENT');
    pdfKeyValues(doc, [['Name', student?.name], ['Roll No', student?.roll_number ?? '—']]);
    pdfSectionTitle(doc, 'MARKS BREAKDOWN');
    const pageW = doc.page.width - 80;
    pdfTable(doc,
      ['Code', 'Subject', 'Assessment', 'Scored', 'Max', '%'],
      (marks || []).map(m => [
        m.subject_code, m.subject_name, m.assessment_type,
        m.scored_marks, m.max_marks,
        m.max_marks > 0 ? `${Math.round(m.scored_marks / m.max_marks * 100)}%` : '—',
      ]),
      [pageW*0.12, pageW*0.30, pageW*0.18, pageW*0.13, pageW*0.12, pageW*0.15]
    );
  });
}

// ── Excel generator ───────────────────────────────────────────────────────

/**
 * generateExcelReport({ sheetName, headers, rows, title })
 * headers: string[]
 * rows: any[][]
 * Returns Promise<Buffer>
 */
export async function generateExcelReport({ sheetName = 'Report', headers, rows, title }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = INSTITUTION;
  wb.created = new Date();

  const ws = wb.addWorksheet(sheetName.slice(0, 31));

  // Title row
  if (title) {
    ws.addRow([title]);
    const titleRow = ws.lastRow;
    titleRow.font = { bold: true, size: 14 };
    ws.mergeCells(`A1:${String.fromCharCode(64 + headers.length)}1`);
    titleRow.getCell(1).alignment = { horizontal: 'center' };
    ws.addRow([]); // spacer
  }

  // Header row
  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 20;

  // Data rows
  for (let ri = 0; ri < rows.length; ri++) {
    const row = ws.addRow(rows[ri].map(c => c ?? ''));
    if (ri % 2 === 0) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }
    row.alignment = { vertical: 'middle' };
  }

  // Auto-fit column widths
  ws.columns.forEach((col, i) => {
    const header  = headers[i] ?? '';
    const maxData = rows.reduce((max, r) => Math.max(max, String(r[i] ?? '').length), 0);
    col.width = Math.min(Math.max(header.length, maxData) + 4, 45);
  });

  // Border for the whole table
  const dataStart = title ? 3 : 1;
  const dataEnd   = ws.lastRow.number;
  for (let r = dataStart; r <= dataEnd; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= headers.length; c++) {
      row.getCell(c).border = {
        top:    { style: 'thin', color: { argb: 'FFe2e8f0' } },
        left:   { style: 'thin', color: { argb: 'FFe2e8f0' } },
        bottom: { style: 'thin', color: { argb: 'FFe2e8f0' } },
        right:  { style: 'thin', color: { argb: 'FFe2e8f0' } },
      };
    }
  }

  // Freeze header row
  ws.views = [{ state: 'frozen', ySplit: dataStart }];

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
