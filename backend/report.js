// report.js
const PDFDocument = require('pdfkit');
const getStream = require('get-stream');

async function buildReportBuffer(payload) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const stream = doc.pipe(require('stream').PassThrough());

  // Header
  doc.fontSize(18).text('ATS Resume Scanner Report', { align: 'left' });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Date: ${new Date().toLocaleDateString()}`);
  doc.moveDown(0.5);

  const jobRole = payload.job_role || '';
  const skills = (payload.required_skills || []).join(', ');
  const minDegree = payload.min_degree || '—';
  const minExp = payload.min_experience_years || '—';
  doc.fontSize(11).text(`Job Role: ${jobRole}`);
  doc.text(`Required Skills: ${skills}`);
  doc.text(`Min Degree: ${minDegree}    Min Experience: ${minExp}`);
  doc.moveDown(0.5);

  const weights = payload.weights || { skills: 60, experience: 20, education: 10, ats: 10 };
  doc.text(
    `Weights — Skills: ${weights.skills} | Experience: ${weights.experience} | Education: ${weights.education} | ATS: ${weights.ats}`
  );
  doc.moveDown(1);

  // Table configuration
  const results = payload.results || [];
  const startX = 40;
  let y = doc.y + 10;
  const rowHeight = 25;
  const colWidths = [30, 110, 120, 100, 70, 40, 50]; // same as in your image

  const headers = ['Rank', 'Candidate', 'Email', 'Phone', 'Degree', 'Exp', 'Total %'];

  // Draw table headers with borders
  let x = startX;
  doc.fontSize(9).font('Helvetica-Bold');
  headers.forEach((h, i) => {
    doc.rect(x, y, colWidths[i], rowHeight).stroke();
    doc.text(h, x + 3, y + 7, { width: colWidths[i] - 6, align: 'left' });
    x += colWidths[i];
  });

  y += rowHeight;
  doc.font('Helvetica');

  // Draw table rows
  for (const r of results.slice(0, 200)) {
    if (y > 720) {
      doc.addPage();
      y = 40;
    }
    x = startX;
    const rowValues = [
      r.rank || '-',
      r.candidateName || '-',
      r.email || '-',
      r.phone || '-',
      r.degree || '-',
      r.experience_years || '-',
      r.total_score || '-',
    ];
    rowValues.forEach((val, i) => {
      doc.rect(x, y, colWidths[i], rowHeight).stroke();
      doc.text(String(val), x + 3, y + 7, { width: colWidths[i] - 6, align: 'left' });
      x += colWidths[i];
    });
    y += rowHeight;
  }

  doc.end();
  const buffer = await getStream.buffer(stream);
  return buffer;
}

module.exports = { buildReportBuffer };
