// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8000'
    : 'https://ai-podcast-summarizer.onrender.com';

// For assets, use relative paths when deployed to GitHub Pages
const ASSETS_BASE_URL = window.location.hostname === 'localhost' 
    ? '' 
    : '/AI-Podcast-Summarizer';

// Update image src to work both locally and on GitHub Pages
document.getElementById('uploadIcon').src = `${ASSETS_BASE_URL}/upload-icon.svg`;

// Global variables
let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingStartTime = null;

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

// Tab handling
document.addEventListener('DOMContentLoaded', () => {
    // Tab handling
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tab = button.dataset.tab;
            
            // Update active states
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            button.classList.add('active');
            document.getElementById(`${tab}-content`).classList.add('active');
        });
    });

    // Method selection handling
    const methodButtons = document.querySelectorAll('.method-btn');
    const methodContents = document.querySelectorAll('.method-content');
    
    methodButtons.forEach(button => {
        button.addEventListener('click', () => {
            const method = button.dataset.method;
            
            methodButtons.forEach(btn => btn.classList.remove('active'));
            methodContents.forEach(content => content.classList.remove('active'));
            
            button.classList.add('active');
            document.getElementById(`${method}-content`).classList.add('active');
        });
    });

    // File upload handling
    setupDropZone('file-input', handleAzerbaijaniTranscription);
    setupDropZone('summary-file-input', handleAudioSummarization);

    // Recording handling
    setupRecording();

    // Copy button handling
    setupCopyButtons();
});

function setupDropZone(inputId, handleFunction) {
    const fileInput = document.getElementById(inputId);
    const dropZone = fileInput.closest('.drop-zone');
    const fileInfo = dropZone.nextElementSibling;
    const fileNameSpan = fileInfo?.querySelector('.selected-file-name');
    const processButton = fileInfo?.querySelector('.process-button');

    dropZone.addEventListener('click', () => fileInput.click());
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    ['dragleave', 'dragend'].forEach(type => {
        dropZone.addEventListener(type, () => dropZone.classList.remove('dragover'));
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('audio/')) {
            showFileInfo(file, fileInfo, fileNameSpan);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) {
            showFileInfo(fileInput.files[0], fileInfo, fileNameSpan);
        }
    });

    if (processButton) {
        processButton.addEventListener('click', () => {
            const file = fileInput.files[0];
            if (file) {
                handleFunction(file);
            }
        });
    }
}

function showFileInfo(file, fileInfo, fileNameSpan) {
    if (fileNameSpan) {
        fileNameSpan.textContent = file.name;
    }
    if (fileInfo) {
        fileInfo.classList.remove('hidden');
    }
}

async function handleAzerbaijaniTranscription(file) {
    try {
        // Show loading indicator
        const loadingIndicator = document.querySelector('.loading-indicator');
        const resultContainer = document.querySelector('.result-container');
        loadingIndicator.classList.remove('hidden');
        resultContainer.classList.add('hidden');

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/transcribe-azerbaijani/', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Transcription failed');

        const data = await response.json();
        document.getElementById('transcription-result').textContent = data.transcript;
        
        // Hide loading, show results
        loadingIndicator.classList.add('hidden');
        resultContainer.classList.remove('hidden');
    } catch (error) {
        console.error('Error:', error);
        alert('Error processing the audio file. Please try again.');
        document.querySelector('.loading-indicator').classList.add('hidden');
    }
}

async function handleAudioSummarization(file) {
    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/summarize-audio/', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Summarization failed');

        const data = await response.json();
        document.getElementById('summary-transcription').textContent = data.transcript;
        document.getElementById('summary-result').textContent = data.summary;
    } catch (error) {
        console.error('Error:', error);
        alert('Error processing the audio file. Please try again.');
    }
}

function setupRecording() {
    const startButton = document.getElementById('start-record');
    const stopButton = document.getElementById('stop-record');
    const recordingTime = document.querySelector('.recording-time');

    startButton.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            startRecording(stream);
            
            startButton.disabled = true;
            stopButton.disabled = false;
            document.querySelector('.recording-dot').classList.add('recording');
            
            // Start timer
            recordingStartTime = Date.now();
            recordingTimer = setInterval(updateRecordingTime, 1000);
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Error accessing microphone. Please ensure microphone permissions are granted.');
        }
    });

    stopButton.addEventListener('click', () => {
        stopRecording();
        startButton.disabled = false;
        stopButton.disabled = true;
        document.querySelector('.recording-dot').classList.remove('recording');
        clearInterval(recordingTimer);
        recordingTime.textContent = '00:00';
    });
}

function startRecording(stream) {
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.addEventListener('dataavailable', event => {
        audioChunks.push(event.data);
    });

    mediaRecorder.addEventListener('stop', async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const recordingFileInfo = document.querySelector('#record-content .file-info');
        recordingFileInfo.classList.remove('hidden');
        
        const processButton = recordingFileInfo.querySelector('.process-button');
        processButton.onclick = () => handleAzerbaijaniTranscription(audioBlob);
        
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
    });

    mediaRecorder.start();
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
}

function updateRecordingTime() {
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = (elapsed % 60).toString().padStart(2, '0');
    document.querySelector('.recording-time').textContent = `${minutes}:${seconds}`;
}

function setupCopyButtons() {
    document.querySelectorAll('.copy-btn').forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.target;
            const text = document.getElementById(targetId).textContent;
            
            navigator.clipboard.writeText(text).then(() => {
                const originalText = button.textContent;
                button.textContent = 'Copied!';
                setTimeout(() => {
                    button.textContent = originalText;
                }, 2000);
            });
        });
    });
} 