/**
 * exportUtils.js — PDF and Excel export helpers
 * Used by admin report-card, rank-list, marks-memo endpoints.
 */
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';

/**
 * buildPdf(title, sections) → Promise<Buffer>
 *
 * sections is an array of objects:
 *   { heading?: string, keyValues?: [string, string][], headers?: string[], rows?: any[][] }
 */
export function buildPdf(title, sections) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Title ──────────────────────────────────────────────────────────────
    doc.fontSize(18).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
    doc.moveDown(0.8);

    for (const section of sections) {
      // Section heading
      if (section.heading) {
        doc.fontSize(12).font('Helvetica-Bold').text(section.heading);
        doc.moveDown(0.4);
      }

      // Key-value pairs (e.g. student info)
      if (section.keyValues) {
        doc.fontSize(10).font('Helvetica');
        for (const [k, v] of section.keyValues) {
          doc.text(`${k}:  ${v ?? '—'}`);
        }
        doc.moveDown(0.6);
      }

      // Table
      if (section.headers && section.rows) {
        const pageWidth = doc.page.width - 80;
        const colCount  = section.headers.length;
        const colW      = pageWidth / colCount;

        // Header row background
        doc.rect(40, doc.y, pageWidth, 16).fill('#334155');
        doc.fillColor('white').fontSize(8).font('Helvetica-Bold');
        let hx = 40;
        const hy = doc.y + 3;
        for (const h of section.headers) {
          doc.text(h, hx + 3, hy, { width: colW - 6, lineBreak: false });
          hx += colW;
        }
        doc.fillColor('black');
        doc.moveDown(0.3);

        // Data rows
        doc.font('Helvetica').fontSize(8);
        let rowIdx = 0;
        for (const row of section.rows) {
          const rowY = doc.y;
          if (rowIdx % 2 === 0) {
            doc.rect(40, rowY - 2, pageWidth, 14).fill('#f8fafc');
            doc.fillColor('black');
          }
          let rx = 40;
          for (const cell of row) {
            doc.text(String(cell ?? '—'), rx + 3, rowY, { width: colW - 6, lineBreak: false });
            rx += colW;
          }
          doc.moveDown(0.3);
          rowIdx++;
          // New page if near bottom
          if (doc.y > doc.page.height - 80) {
            doc.addPage();
          }
        }
        doc.moveDown(0.8);
      }
    }

    // Footer
    doc.fontSize(8).fillColor('#64748b').text(
      `Generated on ${new Date().toLocaleString()}`,
      40, doc.page.height - 50, { align: 'center' }
    );

    doc.end();
  });
}

/**
 * buildXlsx(sheetName, headers, rows) → Buffer
 * headers: string[]
 * rows: any[][]
 */
export function buildXlsx(sheetName, headers, rows) {
  const data = [headers, ...rows.map(r => r.map(c => c ?? ''))];
  const ws   = XLSX.utils.aoa_to_sheet(data);

  // Bold the header row
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[addr]) continue;
    ws[addr].s = { font: { bold: true } };
  }

  // Auto-width columns (rough estimate)
  const colWidths = headers.map((h, ci) => {
    const max = Math.max(h.length, ...rows.map(r => String(r[ci] ?? '').length));
    return { wch: Math.min(max + 2, 40) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
