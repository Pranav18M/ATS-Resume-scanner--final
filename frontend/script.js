let uploadedFiles = [];
let processedResults = [];

// File upload handling
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileCount = document.getElementById('fileCount');

uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', handleDragOver);
uploadArea.addEventListener('drop', handleDrop);
uploadArea.addEventListener('dragenter', e => e.preventDefault());
uploadArea.addEventListener('dragleave', handleDragLeave);
fileInput.addEventListener('change', handleFileSelect);

function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}
function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}
function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files);
    processFileList(files);
}
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    processFileList(files);
}
function processFileList(files) {
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    const validFiles = files.filter(file => validTypes.includes(file.type));
    
    if (validFiles.length !== files.length) {
        showAlert('Some files were rejected. Only PDF and DOCX files are accepted.', 'error');
    }
    if (validFiles.length > 500) {
        showAlert('Maximum 500 files allowed. Only first 500 files will be processed.', 'error');
        validFiles.splice(500);
    }
    if (validFiles.length > 0) {
        uploadedFiles = validFiles;
        fileCount.textContent = validFiles.length;
        fileInfo.style.display = 'block';
        showAlert(`${validFiles.length} files ready for processing.`, 'success');
    }
}

function showAlert(message, type) {
    const alertEl = document.getElementById(type === 'error' ? 'errorAlert' : 'successAlert');
    alertEl.textContent = message;
    alertEl.style.display = 'block';
    setTimeout(() => { alertEl.style.display = 'none'; }, 5000);
}

// Call backend server
async function processResumes() {
  if (uploadedFiles.length === 0) {
    showAlert('Please upload resume files first.', 'error');
    return;
  }
  const jobRole = document.getElementById('jobRole').value.trim();
  const requiredSkills = document.getElementById('requiredSkills').value.trim();
  const minDegree = document.getElementById('minDegree').value;
  const minExp = document.getElementById('minExp').value.trim();
  if (!jobRole || !requiredSkills) {
    showAlert('Enter Job Role and Required Skills before analyzing.', 'error');
    return;
  }

  document.getElementById('processingSection').style.display = 'block';
  document.getElementById('processBtn').disabled = true;

  const form = new FormData();
  form.append('job_role', jobRole);
  form.append('required_skills', requiredSkills);
  form.append('min_degree', minDegree);
  if (minExp) form.append('min_experience_years', minExp);
  uploadedFiles.forEach(f => form.append('files', f));

  try {
    const res = await fetch('http://localhost:8000/api/analyze', { method: 'POST', body: form });
    if (!res.ok) throw new Error('Server error');
    const data = await res.json();
    processedResults = data.results;
    displayResults();
    showAlert(`Analysis complete! ${processedResults.length} candidates ranked.`, 'success');
  } catch (e) {
    showAlert('Failed to analyze. Is the Python server running?', 'error');
  } finally {
    document.getElementById('processingSection').style.display = 'none';
    document.getElementById('processBtn').disabled = false;
  }
}

function displayResults() {
    const tbody = document.getElementById('resultsBody');
    tbody.innerHTML = '';
    processedResults.forEach((c) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="rank">${c.rank}</td>
            <td><strong>${c.candidateName}</strong></td>
            <td>${c.email}</td>
            <td>${c.phone}</td>
            <td>${c.degree}</td>
            <td>${c.experience_years}</td>
            <td>${c.skills_match}%</td>
            <td>${c.education_match}%</td>
            <td>${c.experience_score}%</td>
            <td>${c.ats_format_score}%</td>
            <td><strong>${c.total_score}%</strong></td>
        `;
        tbody.appendChild(row);
    });
    document.getElementById('resultsSection').style.display = 'block';
}

async function downloadReport() {
  if (!processedResults || processedResults.length === 0) return;
  const payload = {
    job_role: document.getElementById('jobRole').value.trim(),
    required_skills: document.getElementById('requiredSkills').value.split(',').map(s=>s.trim()).filter(Boolean),
    min_degree: document.getElementById('minDegree').value,
    min_experience_years: document.getElementById('minExp').value || null,
    weights: processedResults[0]?.weights || {skills:60, experience:20, education:10, ats:10},
    results: processedResults
  };
  try {
    const res = await fetch('http://localhost:8000/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ATS_Resume_Report_${new Date().toISOString().slice(0,10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showAlert('PDF report downloaded successfully!', 'success');
  } catch (e) {
    showAlert('Failed to download report.', 'error');
  }
}