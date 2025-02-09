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

    // Just update the UI, the file is already in fileInput for direct uploads
    // or will be handled by the drop event for drag and drop
    fileName.textContent = file.name;
    fileInfo.classList.remove('hidden');
}

// Process Audio File
async function processAudioFile() {
    // Get file either from fileInput or stored file
    const file = fileInput.files[0];
    if (!file) {
        alert('Please select a file first');
        return;
    }

    // Show loading state
    fileInfo.classList.add('hidden');
    loadingContainer.classList.remove('hidden');
    resultContainer.classList.add('hidden');

    try {
        console.log('Starting file upload...', file.name);
        const formData = new FormData();
        formData.append('file', file);

        console.log('Sending request to:', `${API_BASE_URL}/upload-audio/`);
        const response = await fetch(`${API_BASE_URL}/upload-audio/`, {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json',
            }
        });

        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);

        if (!response.ok) {
            throw new Error(data.detail || 'Failed to process audio file');
        }

        // Display results
        transcriptContent.textContent = data.transcript;
        summaryContent.textContent = data.summary;
        
        // Show results
        loadingContainer.classList.add('hidden');
        resultContainer.classList.remove('hidden');

    } catch (error) {
        console.error('Detailed error:', error);
        let errorMessage = error.message;
        if (error instanceof TypeError && error.message.includes('fetch')) {
            errorMessage = 'Cannot connect to the server. Please try again later.';
        }
        alert(`Error: ${errorMessage}`);
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