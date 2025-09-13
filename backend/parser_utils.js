// parser_utils.js
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const CONTACT_EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const CONTACT_PHONE_RE = /\+?\d[\d\s().-]{7,}\d/;

const DEGREE_PATTERNS = [
  { rx: /\b(ph\.?d|doctorate)\b/i, label: 'PhD' },
  { rx: /\b(m\.?tech|m\.?sc|masters?|post\s*graduate|pg)\b/i, label: 'Masters' },
  { rx: /\b(b\.?tech|b\.?e\.|b\.?sc|bachelors?)\b/i, label: 'Bachelors' },
  { rx: /\b(diploma)\b/i, label: 'Diploma' }
];

const DATE_RANGE_RE = /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}\s*(?:-|to|–|—)\s*(?:present|current|\d{4})/ig;
const YEARS_EXPLICIT_RE = /(\d+)(?:\+)?\s+years?/ig;

async function extractTextFromPDF(buffer) {
  const data = await pdfParse(buffer);
  const text = data.text || '';
  // crude image count heuristic: search for /Subtype /Image in raw PDF bytes
  const raw = buffer.toString('latin1');
  const imgMatches = raw.match(/\/Subtype\s*\/Image/ig);
  const images_count = imgMatches ? imgMatches.length : 0;
  // tables detection is hard; set 0
  const tables_count = 0;
  return { text, images_count, tables_count };
}

async function extractTextFromDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value || '';
  // mammoth does not expose image count easily
  const images_count = 0;
  const tables_count = 0;
  return { text, images_count, tables_count };
}

function parseContact(text) {
  const emailMatch = text.match(CONTACT_EMAIL_RE);
  const phoneMatch = text.match(CONTACT_PHONE_RE);
  let name = null;
  // heuristic: first non-empty line without digits and not an email/phone
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (!/\d/.test(line) && !CONTACT_EMAIL_RE.test(line) && !CONTACT_PHONE_RE.test(line) && line.split(' ').length <= 5) {
      name = line;
      break;
    }
  }
  return { name: name || 'Unknown', email: emailMatch ? emailMatch[0] : '', phone: phoneMatch ? phoneMatch[0] : '' };
}

function detectSections(text) {
  const lowered = text.toLowerCase();
  const headings = ['education','experience','work experience','professional experience','skills','technical skills','projects','certifications','summary'];
  const sections = {};
  for (const h of headings) {
    if (lowered.includes(h)) sections[h] = true;
  }
  return sections;
}

function highestDegree(text) {
  for (const p of DEGREE_PATTERNS) {
    if (p.rx.test(text)) return p.label;
  }
  return '';
}

function extractExperienceYears(text) {
  let years = 0;
  // explicit "X years"
  const explicit = [];
  let m;
  while ((m = YEARS_EXPLICIT_RE.exec(text)) !== null) {
    explicit.push(parseFloat(m[1]));
  }
  if (explicit.length) years = Math.max(...explicit);
  // date ranges heuristic
  const ranges = text.match(DATE_RANGE_RE);
  if (ranges && ranges.length > 0) {
    years = Math.max(years, ranges.length); // crude
  }
  return years;
}

async function extractResume(buffer, filename) {
  const lower = filename.toLowerCase();
  let meta;
  if (lower.endsWith('.pdf')) {
    meta = await extractTextFromPDF(buffer);
  } else if (lower.endsWith('.docx')) {
    meta = await extractTextFromDocx(buffer);
  } else {
    throw new Error('Unsupported file type: ' + filename);
  }
  const text = meta.text || '';
  const contact = parseContact(text);
  const sections = detectSections(text);
  const degree = highestDegree(text);
  const exp_years = extractExperienceYears(text);

  return {
    text,
    images_count: meta.images_count || 0,
    tables_count: meta.tables_count || 0,
    contact,
    sections,
    degree,
    experience_years: exp_years
  };
}

module.exports = { extractResume };