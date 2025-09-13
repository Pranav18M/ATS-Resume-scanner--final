// scoring.js
const SYN_MAP = {
  js: ['javascript'],
  node: ['nodejs','node.js'],
  react: ['reactjs','react.js'],
  aws: ['amazon web services'],
  ml: ['machine learning'],
  ai: ['artificial intelligence']
};

const DEGREE_ORDER = { Diploma:1, Bachelors:2, Masters:3, PhD:4, '':0 };

function norm(text) {
  return text ? text.toLowerCase().replace(/[^a-z0-9+.# ]+/g, ' ') : '';
}

function expandSkill(skill) {
  const s = (skill || '').trim().toLowerCase();
  const variants = new Set([s]);
  for (const k of Object.keys(SYN_MAP)) {
    const vs = SYN_MAP[k];
    if (s === k || vs.includes(s)) {
      variants.add(k);
      vs.forEach(v => variants.add(v));
    }
  }
  return Array.from(variants);
}

function tokenize(text) {
  return norm(text).split(/\s+/).filter(Boolean);
}

function skillMatchScore(resume_text, required_skills) {
  const txt = norm(resume_text);
  let total = required_skills.length;
  if (total === 0) return 0;
  let hits = 0;
  const toks = tokenize(txt);
  for (const s of required_skills) {
    const variants = expandSkill(s);
    let found = variants.some(v => txt.includes(v));
    if (!found) {
      found = variants.some(v => toks.includes(v));
    }
    if (found) hits++;
  }
  return +(100.0 * (hits / total)).toFixed(2);
}

function educationMatchScore(resume_degree, min_degree) {
  if (!min_degree) return 100.0;
  const want = DEGREE_ORDER[min_degree] || 0;
  const have = DEGREE_ORDER[resume_degree] || 0;
  if (have <= 0) return 0.0;
  return have >= want ? 100.0 : 50.0;
}

function experienceScore(exp_years, min_required) {
  if (!exp_years || exp_years <= 0) return 0.0;
  if (!min_required) {
    return Math.min(100.0, exp_years * 15);
  }
  if (exp_years >= min_required) {
    return Math.min(100.0, 80 + (exp_years - min_required) * 5);
  }
  const pct = exp_years / Math.max(1, min_required);
  return Math.max(20.0, 100.0 * pct);
}

function atsFormatScore(text, images_count, tables_count, contact, sections) {
  let score = 100.0;
  score -= Math.min(30.0, images_count * 5.0);
  score -= Math.min(20.0, tables_count * 5.0);
  const good_sections = ['summary','skills','experience','education'].reduce((acc, k) => acc + (sections[k] ? 1 : 0), 0);
  score += good_sections * 2.5;
  if (!contact || !contact.email || !contact.phone) score -= 15;
  if (!text || text.trim().length < 400) score -= 25;
  score = Math.max(0, Math.min(100, score));
  return +score.toFixed(2);
}

function analyzeResumeBatch(extractedList, options) {
  const defaults = { weights: { skills:60, experience:20, education:10, ats:10 } };
  const weights = options.weights || defaults.weights;
  const reqSkills = options.required_skills || [];
  const min_degree = options.min_degree || '';
  const min_exp = options.min_experience_years || null;

  const results = extractedList.map((r, i) => {
    const txt = r.text || '';
    const sm = skillMatchScore(txt, reqSkills);
    const em = educationMatchScore(r.degree || '', min_degree);
    const ex = experienceScore(r.experience_years || 0, min_exp);
    const ats = atsFormatScore(txt, r.images_count || 0, r.tables_count || 0, r.contact || {}, r.sections || {});
    const total = ((sm * weights.skills) + (ex * weights.experience) + (em * weights.education) + (ats * weights.ats)) / (weights.skills + weights.experience + weights.education + weights.ats);
    return {
      rank: i+1,
      filename: r.filename || `resume_${i+1}`,
      candidateName: (r.contact && r.contact.name) || 'Unknown',
      email: (r.contact && r.contact.email) || '',
      phone: (r.contact && r.contact.phone) || '',
      degree: r.degree || '',
      experience_years: +(r.experience_years || 0).toFixed(1),
      skills_match: +sm.toFixed(2),
      education_match: +em.toFixed(2),
      experience_score: +ex.toFixed(2),
      ats_format_score: +ats.toFixed(2),
      total_score: +total.toFixed(2),
      weights
    };
  });

  results.sort((a,b) => b.total_score - a.total_score);
  results.forEach((r, idx) => r.rank = idx+1);
  return results;
}

module.exports = { analyzeResumeBatch };