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
const MAX_RECORDING_TIME = 300; // 5 minutes in seconds

// Add new global variables for summary recording
let summaryMediaRecorder = null;
let summaryAudioChunks = [];
let summaryRecordingTimer = null;
let summaryRecordingStartTime = null;

// Add new global variables for recorded files
let currentRecordedFile = null;
let currentSummaryRecordedFile = null;

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

// Add new DOM elements
const summaryMethodButtons = document.querySelectorAll('#summarizer .method-button');
const summaryMethodContents = document.querySelectorAll('#summarizer .method-content');
const summaryStartRecord = document.getElementById('summaryStartRecord');
const summaryStopRecord = document.getElementById('summaryStopRecord');
const summaryRecordTime = document.querySelector('.summary-record-time');
const summaryRecordIndicator = document.querySelector('#summary-record-content .record-indicator');
const summaryRecordPreview = document.querySelector('#summary-record-content .record-preview');
const summaryAudioPreview = document.getElementById('summaryAudioPreview');

// Text-to-Speech Elements
const ttsInput = document.getElementById('ttsInput');
const ttsGenerateButton = document.getElementById('ttsGenerateButton');
const ttsResult = document.getElementById('ttsResult');
const ttsAudio = document.getElementById('ttsAudio');
const ttsNewButton = document.getElementById('ttsNewButton');

// Tab Handling
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tab = button.dataset.tab;
        
        // Show coming soon message for summarization tab
        if (tab === 'audio-summary') {
            alert('Audio xülasə funksiyası tezliklə əlavə olunacaq! 🚀');
            return;
        }
        
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
        processButton.classList.add('hidden');
        
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

    // Only check duration for uploaded files, not for recordings
    if (!file.name.startsWith('recording.wav')) {
        const audio = new Audio();
        const objectUrl = URL.createObjectURL(file);
        
        audio.addEventListener('loadedmetadata', () => {
            URL.revokeObjectURL(objectUrl);
            
            if (audio.duration > 300) {
                alert('Audio faylın uzunluğu 5 dəqiqədən çox ola bilməz.');
                resetUI();
                return;
            }

            // Continue with file selection if duration is valid
            updateUIAfterFileSelection(file, isSummary);
        });

        audio.src = objectUrl;
    } else {
        updateUIAfterFileSelection(file, isSummary);
    }
}

// Helper function to update UI after file selection
function updateUIAfterFileSelection(file, isSummary) {
    if (isSummary) {
        summaryFileName.textContent = file.name;
        summaryFileInfo.classList.remove('hidden');
        summaryDropZone.querySelector('.upload-content').classList.add('hidden');
        summaryProcessButton.classList.remove('hidden');
    } else {
        fileName.textContent = file.name;
        fileInfo.classList.remove('hidden');
        dropZone.classList.add('hidden');
        document.querySelector('.method-selector').classList.add('hidden');
        document.getElementById('record-content').classList.add('hidden');
        processButton.classList.remove('hidden');
    }
}

// Process Audio File
async function processAudioFile(isSummary) {
    let file;
    
    if (isSummary) {
        file = currentSummaryRecordedFile || summaryFileInput.files[0];
    } else {
        file = currentRecordedFile || fileInput.files[0];
    }
    
    if (!file) {
        alert('Xahiş edirik əvvəlcə fayl seçin və ya səs yazın');
        return;
    }

    // Hide file info and show loading
    if (isSummary) {
        summaryFileInfo.classList.add('hidden');
        summaryProcessButton.classList.add('hidden');
    } else {
        fileInfo.classList.add('hidden');
        processButton.classList.add('hidden');
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
        if (isSummary) {
            transcriptContent.textContent = data.transcript || '';
            summaryContent.textContent = data.summary || '';
            summarySection.classList.remove('hidden');
        } else {
            transcriptContent.textContent = data.transcript || '';
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
        
        // Restore UI on error
        if (isSummary) {
            summaryFileInfo.classList.remove('hidden');
            summaryProcessButton.classList.remove('hidden');
        } else {
            fileInfo.classList.remove('hidden');
            processButton.classList.remove('hidden');
        }
        loadingContainer.classList.add('hidden');
    }
}

// Recording Functions
function startRecording(stream) {
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.addEventListener('dataavailable', event => {
        audioChunks.push(event.data);
    });

    mediaRecorder.addEventListener('stop', () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        currentRecordedFile = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });
        
        // Create audio preview
        const audioUrl = URL.createObjectURL(audioBlob);
        audioPreview.src = audioUrl;
        recordPreview.classList.remove('hidden');
        
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
    });

    mediaRecorder.start(100);
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

    // Auto-stop recording after 5 minutes
    if (elapsed >= MAX_RECORDING_TIME) {
        stopRecord.click();
        alert('Maksimum yazılma müddəti 5 dəqiqədir.');
    }
}

// Add method button handlers for summary tab
summaryMethodButtons.forEach(button => {
    button.addEventListener('click', () => {
        const method = button.dataset.method;
        
        summaryMethodButtons.forEach(btn => btn.classList.remove('active'));
        summaryMethodContents.forEach(content => content.classList.remove('active'));
        
        button.classList.add('active');
        document.getElementById(`${method}-content`).classList.add('active');
        
        // Reset UI when switching methods
        resetSummaryUI();
    });
});

// Add recording handlers for summary tab
summaryStartRecord.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        startSummaryRecording(stream);
        
        summaryStartRecord.disabled = true;
        summaryStopRecord.disabled = false;
        summaryRecordIndicator.classList.remove('hidden');
        summaryStartRecord.classList.add('recording');
        summaryRecordPreview.classList.add('hidden');
        summaryProcessButton.classList.add('hidden');
        
        summaryRecordingStartTime = Date.now();
        summaryRecordingTimer = setInterval(updateSummaryRecordingTime, 1000);
    } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Mikrofona çıxış xətası. Xahiş edirik mikrofon icazələrinin verildiyindən əmin olun.');
    }
});

summaryStopRecord.addEventListener('click', () => {
    stopSummaryRecording();
    summaryStartRecord.disabled = false;
    summaryStopRecord.disabled = true;
    summaryRecordIndicator.classList.add('hidden');
    summaryStartRecord.classList.remove('recording');
    clearInterval(summaryRecordingTimer);
    summaryRecordTime.textContent = '00:00';
});

// Add recording functions for summary tab
function startSummaryRecording(stream) {
    summaryAudioChunks = [];
    summaryMediaRecorder = new MediaRecorder(stream);

    summaryMediaRecorder.addEventListener('dataavailable', event => {
        summaryAudioChunks.push(event.data);
    });

    summaryMediaRecorder.addEventListener('stop', () => {
        const audioBlob = new Blob(summaryAudioChunks, { type: 'audio/wav' });
        currentSummaryRecordedFile = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });
        
        const audioUrl = URL.createObjectURL(audioBlob);
        summaryAudioPreview.src = audioUrl;
        summaryRecordPreview.classList.remove('hidden');
        
        stream.getTracks().forEach(track => track.stop());
    });

    summaryMediaRecorder.start(100);
}

function stopSummaryRecording() {
    if (summaryMediaRecorder && summaryMediaRecorder.state !== 'inactive') {
        summaryMediaRecorder.stop();
    }
}

function updateSummaryRecordingTime() {
    const elapsed = Math.floor((Date.now() - summaryRecordingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = (elapsed % 60).toString().padStart(2, '0');
    summaryRecordTime.textContent = `${minutes}:${seconds}`;

    if (elapsed >= MAX_RECORDING_TIME) {
        summaryStopRecord.click();
        alert('Maksimum yazılma müddəti 5 dəqiqədir.');
    }
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
    processButton.classList.add('hidden');
    summaryProcessButton.classList.add('hidden');
    
    // Show upload areas again
    dropZone.classList.remove('hidden');
    summaryDropZone.querySelector('.upload-content').classList.remove('hidden');
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
    
    // Reset summary recording UI
    if (summaryMediaRecorder && summaryMediaRecorder.state !== 'inactive') {
        stopSummaryRecording();
    }
    summaryStartRecord.disabled = false;
    summaryStopRecord.disabled = true;
    summaryRecordIndicator.classList.add('hidden');
    summaryStartRecord.classList.remove('recording');
    summaryRecordPreview.classList.add('hidden');
    summaryAudioPreview.src = '';
    clearInterval(summaryRecordingTimer);
    summaryRecordTime.textContent = '00:00';
    
    // Clear recorded files
    currentRecordedFile = null;
    currentSummaryRecordedFile = null;
    
    // Reset TTS UI
    if (ttsInput) {
        ttsInput.value = '';
        ttsInput.disabled = false;
        ttsResult.classList.add('hidden');
        ttsAudio.src = '';
    }
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

// Add click handlers for the new preview process buttons
document.querySelectorAll('.preview-process-button').forEach(button => {
    button.addEventListener('click', () => {
        const isSummary = button.closest('#summarizer') !== null;
        processAudioFile(isSummary);
    });
});

// Text-to-Speech Handlers
ttsGenerateButton.addEventListener('click', async () => {
    const text = ttsInput.value.trim();
    
    if (!text) {
        alert('Zəhmət olmasa mətn daxil edin.');
        return;
    }
    
    try {
        // Show loading state
        ttsGenerateButton.disabled = true;
        loadingContainer.classList.remove('hidden');
        loadingContainer.querySelector('p').textContent = 'Səs yaradılır, zəhmət olmasa gözləyin..';
        
        // Create form data
        const formData = new FormData();
        formData.append('text', text);
        
        // Make API request with form data
        const response = await fetch(`${API_BASE_URL}/text-to-speech/`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || 'Səs yaratma xətası');
        }
        
        // Get audio blob and create URL
        const audioBlob = await response.blob();
        if (audioBlob.size === 0) {
            throw new Error('Boş audio faylı yaradıldı');
        }
        
        // Get filename from response headers
        const contentDisposition = response.headers.get('Content-Disposition');
        const filename = contentDisposition ? 
            contentDisposition.split('filename=')[1].replace(/['"]/g, '') : 
            'audio.mp3';
        
        // Revoke previous URL if exists
        if (ttsAudio.src) {
            URL.revokeObjectURL(ttsAudio.src);
        }
        
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Update audio player
        ttsAudio.src = audioUrl;
        
        // Show result
        ttsResult.classList.remove('hidden');
        ttsInput.disabled = true;
        
        // Create download button if it doesn't exist
        let downloadButton = document.getElementById('ttsDownloadButton');
        if (!downloadButton) {
            downloadButton = document.createElement('button');
            downloadButton.id = 'ttsDownloadButton';
            downloadButton.className = 'download-button';
            downloadButton.innerHTML = 'Yüklə <span class="download-icon">⬇️</span>';
            ttsResult.querySelector('.tts-audio-player').appendChild(downloadButton);
        }
        
        // Update download button
        downloadButton.onclick = () => {
            const a = document.createElement('a');
            a.href = audioUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };
        
        // Add event listener for successful audio load
        ttsAudio.onloadeddata = () => {
            loadingContainer.classList.add('hidden');
            ttsGenerateButton.disabled = false;
        };
        
        // Add error handler for audio loading
        ttsAudio.onerror = () => {
            throw new Error('Audio faylı yüklənə bilmədi');
        };
        
    } catch (error) {
        console.error('TTS Error:', error);
        alert(`Səs yaratma zamanı xəta baş verdi: ${error.message}`);
        
        // Reset UI on error
        ttsInput.disabled = false;
        ttsResult.classList.add('hidden');
        if (ttsAudio.src) {
            URL.revokeObjectURL(ttsAudio.src);
            ttsAudio.src = '';
        }
    } finally {
        // Hide loading state
        loadingContainer.classList.add('hidden');
        ttsGenerateButton.disabled = false;
    }
});

ttsNewButton.addEventListener('click', () => {
    // Reset UI for new TTS
    ttsInput.value = '';
    ttsInput.disabled = false;
    ttsResult.classList.add('hidden');
    ttsAudio.src = '';
}); 