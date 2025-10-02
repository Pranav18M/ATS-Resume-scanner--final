// server.js
const express = require('express');
const multer = require('multer');
const cors = require('cors');

const { extractResume } = require('./parser_utils');
const { analyzeResumeBatch } = require('./scoring');
const { buildReportBuffer } = require('./report');

// ---------- CONFIG ----------

// Multer setup: memory storage, max 20MB per file
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

const app = express();

// CORS setup
app.use(cors({
  origin: '*', // you can restrict to your frontend URL
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// JSON body parser
app.use(express.json({ limit: '50mb' }));

// ---------- ROUTES ----------

// Health check / root route
app.get('/', (req, res) => {
  res.send({ status: 'OK', message: 'ATS Resume Scanner Backend is running' });
});

// Analyze resumes
app.post('/api/analyze', upload.array('files', 500), async (req, res) => {
  try {
    const job_role = (req.body.job_role || '').trim();
    const required_skills = (req.body.required_skills || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const min_degree = (req.body.min_degree || '').trim();
    const min_experience_years = req.body.min_experience_years
      ? parseInt(req.body.min_experience_years)
      : null;

    // Validation
    if (!job_role || required_skills.length === 0) {
      return res.status(400).json({ error: 'job_role and required_skills are required' });
    }

    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log(`📂 Received ${files.length} resumes for analysis`);

    // Extract resumes
    const extracted = [];
    for (const f of files) {
      try {
        const meta = await extractResume(f.buffer, f.originalname);
        meta.filename = f.originalname;
        extracted.push(meta);
      } catch (e) {
        console.error(`❌ Failed to parse ${f.originalname}: ${e.message}`);
        extracted.push({
          filename: f.originalname,
          error: e.message,
          text: '',
          images_count: 0,
          tables_count: 0,
          contact: {},
          sections: {},
          degree: '',
          experience_years: 0,
          summary: ''
        });
      }
    }

    // Analyze
    const results = analyzeResumeBatch(extracted, {
      job_role,
      required_skills,
      min_degree,
      min_experience_years
    });

    console.log(`✅ Analysis complete: ${results.length} candidates processed`);

    res.json({
      job_role,
      required_skills,
      min_degree,
      min_experience_years,
      count: results.length,
      results
    });

  } catch (err) {
    console.error('🔥 Error in /api/analyze:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// Generate PDF report
app.post('/api/report', async (req, res) => {
  try {
    const payload = req.body;

    console.log('📝 Generating PDF report...');
    const buf = await buildReportBuffer(payload);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=ATS_Resume_Report_${new Date().toISOString().slice(0, 10)}.pdf`
    );

    res.send(buf);
    console.log('📄 Report generated successfully');

  } catch (err) {
    console.error('🔥 Error in /api/report:', err);
    res.status(500).json({ error: 'Failed to build report', detail: err.message });
  }
});

// ---------- SERVER START ----------

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`🚀 ATS Resume Scanner backend running on port ${PORT}`);
  console.log(`👉 API Endpoints:`);
  console.log(`   GET / -> Health check`);
  console.log(`   POST /api/analyze -> Upload resumes`);
  console.log(`   POST /api/report -> Generate PDF report`);
});
