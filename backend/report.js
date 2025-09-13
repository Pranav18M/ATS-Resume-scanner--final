// report.js
const PDFDocument = require('pdfkit');
const getStream = require('get-stream');

async function buildReportBuffer(payload) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const stream = doc.pipe(require('stream').PassThrough());

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

  const weights = payload.weights || { skills:60, experience:20, education:10, ats:10 };
  doc.text(`Weights — Skills: ${weights.skills} | Experience: ${weights.experience} | Education: ${weights.education} | ATS: ${weights.ats}`);
  doc.moveDown(0.5);

  const results = payload.results || [];
  // table header
  const tableTop = doc.y + 10;
  const colWidths = [30, 110, 120, 80, 60, 50, 50];
  // We'll draw a simple table by columns: Rank | Name | Email | Phone | Degree | Exp | Total
  doc.fontSize(9).text('Rank', 40, tableTop);
  doc.text('Candidate', 40 + 30, tableTop);
  doc.text('Email', 40 + 140, tableTop);
  doc.text('Phone', 40 + 260, tableTop);
  doc.text('Degree', 40 + 360, tableTop);
  doc.text('Exp', 40 + 420, tableTop);
  doc.text('Total %', 40 + 460, tableTop);
  doc.moveDown(0.5);
  let y = tableTop + 18;

  for (const r of results.slice(0, 200)) {
    if (y > 720) {
      doc.addPage();
      y = 40;
    }
    doc.fontSize(9).text(r.rank.toString(), 40, y);
    doc.text(r.candidateName, 40 + 30, y, { width: 100 });
    doc.text(r.email || '-', 40 + 140, y, { width: 110 });
    doc.text(r.phone || '-', 40 + 260, y, { width: 90 });
    doc.text(r.degree || '-', 40 + 360, y, { width: 60 });
    doc.text(String(r.experience_years || '-'), 40 + 420, y, { width: 40 });
    doc.text(String(r.total_score || '-'), 40 + 460, y, { width: 40 });
    y += 18;
  }

  doc.end();
  const buffer = await getStream.buffer(stream);
  return buffer;
}

module.exports = { buildReportBuffer }