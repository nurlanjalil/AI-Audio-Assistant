// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8000'
    : 'https://ai-podcast-summarizer.onrender.com';

// Base64 encoded upload icon (simple cloud upload icon)
const UPLOAD_ICON = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTMyIDEyVjQwTTMyIDEyTDIwIDI0TTMyIDEyTDQ0IDI0IiBzdHJva2U9IiM2NDc0OGIiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CjxwYXRoIGQ9Ik01NiAzNlY1Mkg4VjM2IiBzdHJva2U9IiM2NDc0OGIiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPg==`;

// Update image src directly with base64 data
document.getElementById('uploadIcon').src = UPLOAD_ICON;
document.getElementById('summaryUploadIcon').src = UPLOAD_ICON;

// Global variables
let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingStartTime = null;

// DOM Elements
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const methodButtons = document.querySelectorAll('.method-button');
const methodContents = document.querySelectorAll('.method-content');

const dropZone = document.getElementById('dropZone');
const summaryDropZone = document.getElementById('summaryDropZone');
const fileInput = document.getElementById('fileInput');
const summaryFileInput = document.getElementById('summaryFileInput');
const fileInfo = document.getElementById('fileInfo');
const summaryFileInfo = document.getElementById('summaryFileInfo');
const fileName = document.getElementById('fileName');
const summaryFileName = document.getElementById('summaryFileName');
const processButton = document.getElementById('processButton');
const summaryProcessButton = document.getElementById('summaryProcessButton');
const loadingContainer = document.getElementById('loadingContainer');
const resultContainer = document.getElementById('resultContainer');
const transcriptContent = document.getElementById('transcriptContent');
const summaryContent = document.getElementById('summaryContent');
const newFileButton = document.getElementById('newFileButton');
const summarySection = document.querySelector('.summary-section');

const startRecord = document.getElementById('startRecord');
const stopRecord = document.getElementById('stopRecord');
const recordIndicator = document.querySelector('.record-indicator');
const recordTime = document.querySelector('.record-time');
const recordPreview = document.querySelector('.record-preview');
const audioPreview = document.getElementById('audioPreview');

// Tab Handling
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tab = button.dataset.tab;
        
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        button.classList.add('active');
        document.getElementById(tab).classList.add('active');
        
        // Reset UI when switching tabs
        resetUI();
    });
});

// Method Selection Handling
methodButtons.forEach(button => {
    button.addEventListener('click', () => {
        const method = button.dataset.method;
        
        methodButtons.forEach(btn => btn.classList.remove('active'));
        methodContents.forEach(content => content.classList.remove('active'));
        
        button.classList.add('active');
        document.getElementById(`${method}-content`).classList.add('active');
        
        // Reset everything when switching methods
        fileInput.value = '';
        fileName.textContent = '';
        fileInfo.classList.add('hidden');
        dropZone.classList.remove('hidden');
        
        // Reset recording UI when switching
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            stopRecording();
        }
        startRecord.disabled = false;
        stopRecord.disabled = true;
        recordIndicator.classList.add('hidden');
        startRecord.classList.remove('recording');
        recordPreview.classList.add('hidden');
        audioPreview.src = '';
        clearInterval(recordingTimer);
        recordTime.textContent = '00:00';
        
        // Hide result container when switching methods
        resultContainer.classList.add('hidden');
        loadingContainer.classList.add('hidden');
    });
});

// Drag and Drop Handlers
[dropZone, summaryDropZone].forEach(zone => {
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
    });

    ['dragleave', 'dragend'].forEach(type => {
        zone.addEventListener(type, (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
        });
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        const isSummary = zone.id === 'summaryDropZone';
        handleFileSelection(files[0], isSummary);
    });
});

// File Input Handlers
fileInput.addEventListener('change', (e) => {
    handleFileSelection(e.target.files[0], false);
});

summaryFileInput.addEventListener('change', (e) => {
    handleFileSelection(e.target.files[0], true);
});

// Process Button Handlers
processButton.addEventListener('click', () => processAudioFile(false));
summaryProcessButton.addEventListener('click', () => processAudioFile(true));

// New File Button Handler
newFileButton.addEventListener('click', () => {
    resetUI();
    const activeTab = document.querySelector('.tab-button.active').dataset.tab;
    if (activeTab === 'speech-to-text') {
        document.getElementById('upload-content').classList.add('active');
        document.querySelector('[data-method="upload"]').classList.add('active');
        document.querySelector('[data-method="record"]').classList.remove('active');
        document.getElementById('record-content').classList.remove('active');
    }
});

// Recording Handlers
startRecord.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        startRecording(stream);
        
        startRecord.disabled = true;
        stopRecord.disabled = false;
        recordIndicator.classList.remove('hidden');
        startRecord.classList.add('recording');
        recordPreview.classList.add('hidden');
        
        recordingStartTime = Date.now();
        recordingTimer = setInterval(updateRecordingTime, 1000);
    } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Mikrofona çıxış xətası. Xahiş edirik mikrofon icazələrinin verildiyindən əmin olun.');
    }
});

stopRecord.addEventListener('click', () => {
    stopRecording();
    startRecord.disabled = false;
    stopRecord.disabled = true;
    recordIndicator.classList.add('hidden');
    startRecord.classList.remove('recording');
    clearInterval(recordingTimer);
    recordTime.textContent = '00:00';
});

// File Selection Handler
function handleFileSelection(file, isSummary) {
    if (!file) return;

    const validTypes = ['.mp3', '.wav', '.m4a'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

    if (!validTypes.includes(fileExtension)) {
        alert('Xahiş edirik düzgün audio fayl yükləyin (MP3, WAV və ya M4A)');
        return;
    }

    // Hide upload areas immediately after file selection
    if (isSummary) {
        summaryFileName.textContent = file.name;
        summaryFileInfo.classList.remove('hidden');
        summaryDropZone.classList.add('hidden');
    } else {
        fileName.textContent = file.name;
        fileInfo.classList.remove('hidden');
        dropZone.classList.add('hidden');
        document.querySelector('.method-selector').classList.add('hidden');
        document.getElementById('record-content').classList.add('hidden');
    }
}

// Process Audio File
async function processAudioFile(isSummary) {
    let file;
    
    // Check for recorded audio first
    if (audioChunks.length > 0) {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        file = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });
    } else {
        // If no recording, check for uploaded file
        file = isSummary ? summaryFileInput.files[0] : fileInput.files[0];
    }
    
    if (!file) {
        alert('Xahiş edirik əvvəlcə fayl seçin və ya səs yazın');
        return;
    }

    // Hide file info during processing
    if (isSummary) {
        summaryFileInfo.classList.add('hidden');
    } else {
        fileInfo.classList.add('hidden');
    }
    
    loadingContainer.classList.remove('hidden');
    resultContainer.classList.add('hidden');

    try {
        const formData = new FormData();
        formData.append('file', file);

        // Use the correct endpoints from the API
        const endpoint = isSummary ? '/summarize-audio/' : '/transcribe-azerbaijani/';
        
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Failed to process audio file');
        }

        const data = await response.json();

        // Display results
        transcriptContent.textContent = data.transcript;
        if (isSummary) {
            summaryContent.textContent = data.summary;
            summarySection.classList.remove('hidden');
        } else {
            summarySection.classList.add('hidden');
        }
        
        // Show results
        loadingContainer.classList.add('hidden');
        resultContainer.classList.remove('hidden');

    } catch (error) {
        console.error('Detailed error:', error);
        let errorMessage = error.message;
        if (error instanceof TypeError && error.message.includes('fetch')) {
            errorMessage = 'Serverə qoşulmaq mümkün olmadı. Xahiş edirik bir az sonra yenidən cəhd edin.';
        }
        alert(`Xəta: ${errorMessage}`);
        resetUI();
    }
}

// Recording Functions
function startRecording(stream) {
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.addEventListener('dataavailable', event => {
        audioChunks.push(event.data);
    });

    mediaRecorder.addEventListener('stop', async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const file = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });
        
        // Create audio preview
        const audioUrl = URL.createObjectURL(audioBlob);
        audioPreview.src = audioUrl;
        recordPreview.classList.remove('hidden');
        
        handleFileSelection(file, false);
        
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
    recordTime.textContent = `${minutes}:${seconds}`;
}

// Reset UI
function resetUI() {
    fileInput.value = '';
    summaryFileInput.value = '';
    fileName.textContent = '';
    summaryFileName.textContent = '';
    fileInfo.classList.add('hidden');
    summaryFileInfo.classList.add('hidden');
    loadingContainer.classList.add('hidden');
    resultContainer.classList.add('hidden');
    transcriptContent.textContent = '';
    summaryContent.textContent = '';
    
    // Show upload areas again
    dropZone.classList.remove('hidden');
    summaryDropZone.classList.remove('hidden');
    document.querySelector('.method-selector').classList.remove('hidden');
    
    // Reset recording UI
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        stopRecording();
    }
    startRecord.disabled = false;
    stopRecord.disabled = true;
    recordIndicator.classList.add('hidden');
    startRecord.classList.remove('recording');
    recordPreview.classList.add('hidden');
    audioPreview.src = '';
    clearInterval(recordingTimer);
    recordTime.textContent = '00:00';
}

// Copy Button Handlers
document.querySelectorAll('.copy-button').forEach(button => {
    button.addEventListener('click', () => {
        const targetId = button.dataset.target;
        const text = document.getElementById(targetId).textContent;
        
        navigator.clipboard.writeText(text).then(() => {
            const originalText = button.textContent;
            button.textContent = 'Kopyalandı!';
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
        });
    });
}); 