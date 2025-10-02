let uploadedFiles = [];
let processedResults = [];

// Splash Screen Animation
window.addEventListener('load', () => {
    const splashScreen = document.getElementById('splashScreen');
    const mainContent = document.getElementById('mainContent');
    
    // Hide splash screen after 3 seconds
    setTimeout(() => {
        splashScreen.style.display = 'none';
        document.body.style.overflow = 'auto';
    }, 3000);
});

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
        fileInfo.style.display = 'flex'; // Changed from 'block' to 'flex'
        showAlert(`${validFiles.length} files ready for processing.`, 'success');
    }
}

function showAlert(message, type) {
    const alertEl = document.getElementById(type === 'error' ? 'errorAlert' : 'successAlert');
    alertEl.textContent = message;
    alertEl.style.display = 'flex'; // Changed from 'block' to 'flex'
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

    // Show processing section with animation
    const processingSection = document.getElementById('processingSection');
    processingSection.style.display = 'block';
    document.getElementById('processBtn').disabled = true;
    
    // Animate progress bar
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;
        progressFill.style.width = progress + '%';
        progressText.textContent = `Processing: ${Math.floor(progress)}%`;
    }, 500);

    const form = new FormData();
    form.append('job_role', jobRole);
    form.append('required_skills', requiredSkills);
    form.append('min_degree', minDegree);
    if (minExp) form.append('min_experience_years', minExp);
    uploadedFiles.forEach(f => form.append('files', f));

    try {
        const res = await fetch('http://localhost:8000/api/analyze', { 
            method: 'POST', 
            body: form 
        });
        
        if (!res.ok) throw new Error('Server error');
        
        const data = await res.json();
        processedResults = data.results;
        
        // Complete progress animation
        clearInterval(progressInterval);
        progressFill.style.width = '100%';
        progressText.textContent = 'Processing: 100%';
        
        setTimeout(() => {
            displayResults();
            showAlert(`Analysis complete! ${processedResults.length} candidates ranked.`, 'success');
        }, 500);
        
    } catch (e) {
        clearInterval(progressInterval);
        showAlert('Failed to analyze. Is the Python server running?', 'error');
        console.error('Error:', e);
    } finally {
        setTimeout(() => {
            processingSection.style.display = 'none';
            document.getElementById('processBtn').disabled = false;
            progressFill.style.width = '0%';
            progressText.textContent = 'Processing: 0%';
        }, 1000);
    }
}

function displayResults() {
    const tbody = document.getElementById('resultsBody');
    tbody.innerHTML = '';
    
    processedResults.forEach((c, index) => {
        const row = document.createElement('tr');
        
        // Add animation delay for staggered effect
        row.style.animation = `fadeInUp 0.4s ease-out ${index * 0.05}s both`;
        
        // Determine score color classes
        const getScoreClass = (score) => {
            if (score >= 80) return 'score-excellent';
            if (score >= 60) return 'score-good';
            return 'score-poor';
        };
        
        row.innerHTML = `
            <td class="rank">#${c.rank}</td>
            <td><strong>${c.candidateName || 'N/A'}</strong></td>
            <td>${c.email || 'N/A'}</td>
            <td>${c.phone || 'N/A'}</td>
            <td>${c.degree || 'N/A'}</td>
            <td>${c.experience_years || '0'}</td>
            <td class="${getScoreClass(c.skills_match)}">${c.skills_match}%</td>
            <td class="${getScoreClass(c.education_match)}">${c.education_match}%</td>
            <td class="${getScoreClass(c.experience_score)}">${c.experience_score}%</td>
            <td class="${getScoreClass(c.ats_format_score)}">${c.ats_format_score}%</td>
            <td><strong class="${getScoreClass(c.total_score)}">${c.total_score}%</strong></td>
        `;
        tbody.appendChild(row);
    });
    
    // Show results section with animation
    const resultsSection = document.getElementById('resultsSection');
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function downloadReport() {
    if (!processedResults || processedResults.length === 0) {
        showAlert('No results to download. Please analyze resumes first.', 'error');
        return;
    }
    
    const payload = {
        job_role: document.getElementById('jobRole').value.trim(),
        required_skills: document.getElementById('requiredSkills').value.split(',').map(s => s.trim()).filter(Boolean),
        min_degree: document.getElementById('minDegree').value,
        min_experience_years: document.getElementById('minExp').value || null,
        weights: processedResults[0]?.weights || { skills: 60, experience: 20, education: 10, ats: 10 },
        results: processedResults
    };
    
    try {
        const res = await fetch('http://localhost:8000/api/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) throw new Error('Failed to generate report');
        
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ATS_Resume_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        
        showAlert('PDF report downloaded successfully!', 'success');
    } catch (e) {
        showAlert('Failed to download report. Please try again.', 'error');
        console.error('Download error:', e);
    }
}

// Add smooth scroll behavior
document.addEventListener('DOMContentLoaded', () => {
    // Add fade-in animation to feature cards on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    document.querySelectorAll('.feature-card').forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });
}); 
