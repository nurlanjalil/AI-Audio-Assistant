// API Configuration
const API_BASE_URL = 'https://ai-podcast-summarizer.onrender.com'; // Your Render URL

// For assets, use relative paths when deployed to GitHub Pages
const ASSETS_BASE_URL = window.location.hostname === 'localhost' 
    ? '' 
    : '/AI-Podcast-Summarizer';

// Update image src to work both locally and on GitHub Pages
document.getElementById('uploadIcon').src = `${ASSETS_BASE_URL}/upload-icon.svg`;

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const processButton = document.getElementById('processButton');
const loadingContainer = document.getElementById('loadingContainer');
const resultContainer = document.getElementById('resultContainer');
const transcriptContent = document.getElementById('transcriptContent');
const summaryContent = document.getElementById('summaryContent');
const newFileButton = document.getElementById('newFileButton');

// Drag and Drop Handlers
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

['dragleave', 'dragend'].forEach(type => {
    dropZone.addEventListener(type, (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
    });
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    handleFileSelection(files[0]);
});

// File Input Handler
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    handleFileSelection(file);
});

// Process Button Handler
processButton.addEventListener('click', processAudioFile);

// New File Button Handler
newFileButton.addEventListener('click', resetUI);

// File Selection Handler
function handleFileSelection(file) {
    if (!file) return;

    const validTypes = ['.mp3', '.wav', '.m4a'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

    if (!validTypes.includes(fileExtension)) {
        alert('Please upload a valid audio file (MP3, WAV, or M4A)');
        return;
    }

    fileName.textContent = file.name;
    fileInfo.classList.remove('hidden');
    fileInput.files = new DataTransfer().files;
    fileInput.files = new DataTransfer().files;
    fileInput.files.add(file);
}

// Process Audio File
async function processAudioFile() {
    const file = fileInput.files[0];
    if (!file) return;

    // Show loading state
    fileInfo.classList.add('hidden');
    loadingContainer.classList.remove('hidden');
    resultContainer.classList.add('hidden');

    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE_URL}/upload-audio/`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Failed to process audio file');
        }

        const data = await response.json();
        
        // Display results
        transcriptContent.textContent = data.transcript;
        summaryContent.textContent = data.summary;
        
        // Show results
        loadingContainer.classList.add('hidden');
        resultContainer.classList.remove('hidden');

    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while processing the audio file. Please try again.');
        resetUI();
    }
}

// Reset UI
function resetUI() {
    fileInput.value = '';
    fileName.textContent = '';
    fileInfo.classList.add('hidden');
    loadingContainer.classList.add('hidden');
    resultContainer.classList.add('hidden');
    transcriptContent.textContent = '';
    summaryContent.textContent = '';
} 