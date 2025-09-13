// server.js
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const { extractResume } = require('./parser_utils');
const { analyzeResumeBatch } = require('./scoring');
const { buildReportBuffer } = require('./report');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB per file
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.post('/api/analyze', upload.array('files', 500), async (req, res) => {
  try {
    const job_role = (req.body.job_role || '').trim();
    const required_skills_raw = req.body.required_skills || '';
    const min_degree = (req.body.min_degree || '').trim();
    const min_experience_years = req.body.min_experience_years ? parseInt(req.body.min_experience_years) : null;

    const required_skills = required_skills_raw.split(',').map(s => s.trim()).filter(Boolean);

    if (!job_role || required_skills.length === 0) {
      return res.status(400).json({ error: 'job_role and required_skills required' });
    }

    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    const extracted = [];
    for (const f of files) {
      try {
        const meta = await extractResume(f.buffer, f.originalname);
        meta.filename = f.originalname;
        extracted.push(meta);
      } catch (e) {
        extracted.push({
          filename: f.originalname,
          error: e.message,
          text: '',
          images_count: 0,
          tables_count: 0,
          contact: {},
          sections: {},
          degree: '',
          experience_years: 0
        });
      }
    }

    const results = analyzeResumeBatch(extracted, { job_role, required_skills, min_degree, min_experience_years });
    return res.json({ job_role, required_skills, min_degree, min_experience_years, count: results.length, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

app.post('/api/report', async (req, res) => {
  try {
    const payload = req.body;
    const buf = await buildReportBuffer(payload);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=ATS_Resume_Report_${new Date().toISOString().slice(0,10)}.pdf`);
    res.send(buf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to build report', detail: err.message });
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));