// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8000'
    : 'https://ai-podcast-summarizer.onrender.com';

// Base64 encoded upload icon (simple cloud upload icon)
const UPLOAD_ICON = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTMyIDEyVjQwTTMyIDEyTDIwIDI0TTMyIDEyTDQ0IDI0IiBzdHJva2U9IiM2NDc0OGIiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CjxwYXRoIGQ9Ik01NiAzNlY1Mkg4VjM2IiBzdHJva2U9IiM2NDc0OGIiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPg==`;

// Update image src directly with base64 data
document.getElementById('uploadIcon').src = UPLOAD_ICON;

// Global variables
let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingStartTime = null;
const MAX_RECORDING_TIME = 300; // 5 minutes in seconds
let currentLanguage = null; // Store current language

// Add variable for recorded file
let currentRecordedFile = null;

// DOM Elements
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const methodButtons = document.querySelectorAll('.method-button');
const methodContents = document.querySelectorAll('.method-content');

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const processButton = document.getElementById('processButton');
const loadingContainer = document.getElementById('loadingContainer');
const resultContainer = document.getElementById('resultContainer');
const transcriptContent = document.getElementById('transcriptContent');
const summaryContent = document.getElementById('summaryContent');
const generateSummaryButton = document.getElementById('generateSummaryButton');
const summarySection = document.getElementById('summarySection');
const newFileButton = document.getElementById('newFileButton');

const startRecord = document.getElementById('startRecord');
const stopRecord = document.getElementById('stopRecord');
const recordIndicator = document.querySelector('.record-indicator');
const recordTime = document.querySelector('.record-time');
const recordPreview = document.querySelector('.record-preview');
const audioPreview = document.getElementById('audioPreview');

const languageSelect = document.getElementById('languageSelect');

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
        
        // Remove active class from all method buttons
        methodButtons.forEach(btn => btn.classList.remove('active'));
        // Remove active class from all method contents
        methodContents.forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked button and its corresponding content
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
[dropZone].forEach(zone => {
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
        handleFileSelection(files[0]);
    });
});

// File Input Handlers
fileInput.addEventListener('change', (e) => {
    handleFileSelection(e.target.files[0]);
});

// Process Button Handlers
processButton.addEventListener('click', () => processAudioFile());

// New File Button Handler
newFileButton.addEventListener('click', () => {
    resetUI();
    const activeTab = document.querySelector('.tab-button.active').dataset.tab;
    if (activeTab === 'speech-to-text') {
        // Reset method buttons and contents
        methodButtons.forEach(btn => btn.classList.remove('active'));
        methodContents.forEach(content => content.classList.remove('active'));
        
        // Set upload as the default active method
        document.querySelector('[data-method="upload"]').classList.add('active');
        document.getElementById('upload-content').classList.add('active');
    }
});

// Recording Handlers
startRecord.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: 48000,
                sampleSize: 16,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                latency: 0,
                googEchoCancellation: true,
                googAutoGainControl: true,
                googNoiseSuppression: true,
                googHighpassFilter: true
            }
        });
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
function handleFileSelection(file) {
    if (!file) return;

    const validTypes = ['.mp3', '.wav', '.m4a'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

    if (!validTypes.includes(fileExtension)) {
        alert('Xahiş edirik düzgün audio fayl yükləyin (MP3, WAV və ya M4A)');
        return;
    }

    // Check file size (25MB = 25 * 1024 * 1024 bytes)
    if (file.size > 25 * 1024 * 1024) {
        alert('Audio faylın həcmi 25MB-dan çox ola bilməz');
        resetUI();
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
            updateUIAfterFileSelection(file);
        });

        audio.src = objectUrl;
    } else {
        updateUIAfterFileSelection(file);
    }
}

// Helper function to update UI after file selection
function updateUIAfterFileSelection(file) {
    fileName.textContent = file.name;
    fileInfo.classList.remove('hidden');
    dropZone.classList.add('hidden');
    document.querySelector('.method-selector').classList.add('hidden');
    document.getElementById('record-content').classList.add('hidden');
    processButton.classList.remove('hidden');
}

// Language Handling
async function loadLanguages() {
    try {
        const response = await fetch(`${API_BASE_URL}/languages`);
        const data = await response.json();
        
        // Clear existing options
        languageSelect.innerHTML = '';
        
        // Add language options
        data.languages.forEach(lang => {
            const option = document.createElement('option');
            option.value = lang.code;
            option.className = 'language-option';
            option.innerHTML = `${lang.flag} ${lang.name}`;
            languageSelect.appendChild(option);
        });
        
        // Set default language
        languageSelect.value = data.default;
        currentLanguage = data.default;
        
        // Update UI text based on selected language
        updateUILanguage(currentLanguage);
    } catch (error) {
        console.error('Error loading languages:', error);
        alert('Dil siyahısını yükləmək mümkün olmadı. Xahiş edirik səhifəni yeniləyin.');
    }
}

// Load languages when page loads
document.addEventListener('DOMContentLoaded', loadLanguages);

// Language selection handler
languageSelect.addEventListener('change', (e) => {
    currentLanguage = e.target.value;
    updateUILanguage(currentLanguage);
});

// Update UI text based on selected language
function updateUILanguage(language) {
    const translations = {
        az: {
            fileSelect: 'Fayl Seçin',
            dropText: 'Audio faylı buraya sürüşdürün və ya',
            supportedFormats: 'Dəstəklənən formatlar: MP3, WAV, M4A',
            durationWarning: '⚠️ Audio faylın uzunluğu 5 dəqiqədən çox olmamalıdır',
            invalidFile: 'Xahiş edirik düzgün audio fayl yükləyin (MP3, WAV və ya M4A)',
            fileTooLarge: 'Audio faylın həcmi 25MB-dan çox ola bilməz',
            fileTooLong: 'Audio faylın uzunluğu 5 dəqiqədən çox ola bilməz.',
            selectFile: 'Xahiş edirik əvvəlcə fayl seçin və ya səs yazın',
            processing: 'Mətniniz hazırlanır, zəhmət olmasa gözləyin..',
            transcribeFirst: 'Xahiş edirik əvvəlcə audio faylı mətnə çevirin',
            connectionError: 'Serverə qoşulmaq mümkün olmadı. Xahiş edirik bir az sonra yenidən cəhd edin.',
            summaryError: 'Xülasə yaratmaq mümkün olmadı. Xahiş edirik bir az sonra yenidən cəhd edin.'
        },
        en: {
            fileSelect: 'Select File',
            dropText: 'Drop audio file here or',
            supportedFormats: 'Supported formats: MP3, WAV, M4A',
            durationWarning: '⚠️ Audio file must not exceed 5 minutes',
            invalidFile: 'Please upload a valid audio file (MP3, WAV, or M4A)',
            fileTooLarge: 'Audio file size must not exceed 25MB',
            fileTooLong: 'Audio duration must not exceed 5 minutes',
            selectFile: 'Please select a file or record audio first',
            processing: 'Processing your text, please wait..',
            transcribeFirst: 'Please transcribe the audio file first',
            connectionError: 'Could not connect to server. Please try again later.',
            summaryError: 'Could not generate summary. Please try again later.'
        },
        tr: {
            fileSelect: 'Dosya Seç',
            dropText: 'Ses dosyasını buraya sürükleyin veya',
            supportedFormats: 'Desteklenen formatlar: MP3, WAV, M4A',
            durationWarning: '⚠️ Ses dosyası 5 dakikayı geçmemelidir',
            invalidFile: 'Lütfen geçerli bir ses dosyası yükleyin (MP3, WAV veya M4A)',
            fileTooLarge: 'Ses dosyası boyutu 25MB\'ı geçmemelidir',
            fileTooLong: 'Ses süresi 5 dakikayı geçmemelidir',
            selectFile: 'Lütfen önce bir dosya seçin veya ses kaydedin',
            processing: 'Metniniz işleniyor, lütfen bekleyin..',
            transcribeFirst: 'Lütfen önce ses dosyasını metne çevirin',
            connectionError: 'Sunucuya bağlanılamadı. Lütfen daha sonra tekrar deneyin.',
            summaryError: 'Özet oluşturulamadı. Lütfen daha sonra tekrar deneyin.'
        }
    };

    const t = translations[language] || translations.az;

    // Update UI elements
    document.querySelector('.upload-button').textContent = t.fileSelect;
    document.querySelector('.upload-content p').textContent = t.dropText;
    document.querySelector('.file-types').textContent = t.supportedFormats;
    document.querySelector('.duration-note').textContent = t.durationWarning;
}

// Process Audio File
async function processAudioFile() {
    let file = currentRecordedFile || fileInput.files[0];
    
    if (!file) {
        const message = translations[currentLanguage]?.selectFile || translations.az.selectFile;
        alert(message);
        return;
    }

    // Hide file info and show loading
    fileInfo.classList.add('hidden');
    processButton.classList.add('hidden');
    
    loadingContainer.classList.remove('hidden');
    resultContainer.classList.add('hidden');

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('language', currentLanguage);

        const response = await fetch(`${API_BASE_URL}/transcribe/`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Failed to process audio file');
        }

        const data = await response.json();

        // Update results display
        transcriptContent.textContent = data.transcript || '';
        
        // Ensure summary section is hidden when new transcript is loaded
        summarySection.classList.remove('visible');
        setTimeout(() => {
            summarySection.classList.add('hidden');
            summaryContent.textContent = '';
        }, 300);
        
        // Show results
        loadingContainer.classList.add('hidden');
        resultContainer.classList.remove('hidden');

    } catch (error) {
        console.error('Detailed error:', error);
        let errorMessage = error.message;
        
        // Get translated error messages
        const t = translations[currentLanguage] || translations.az;
        
        // Handle specific error cases
        if (error instanceof TypeError && error.message.includes('fetch')) {
            errorMessage = t.connectionError;
        } else if (errorMessage.includes('413') || errorMessage.includes('Maximum content size limit')) {
            errorMessage = t.fileTooLarge;
        } else if (errorMessage.includes('duration')) {
            errorMessage = t.fileTooLong;
        }
        
        alert(errorMessage);
        
        // Restore UI on error
        fileInfo.classList.remove('hidden');
        processButton.classList.remove('hidden');
        loadingContainer.classList.add('hidden');
    }
}

// Recording Functions
function startRecording(stream) {
    audioChunks = [];
    
    // Create an AudioContext for processing
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive'
    });
    const source = audioContext.createMediaStreamSource(stream);
    
    // Create and configure a high-pass filter
    const highPassFilter = audioContext.createBiquadFilter();
    highPassFilter.type = 'highpass';
    highPassFilter.frequency.value = 80; // Remove very low frequencies
    highPassFilter.Q.value = 0.7; // Gentle slope
    
    // Create and configure a low-pass filter
    const lowPassFilter = audioContext.createBiquadFilter();
    lowPassFilter.type = 'lowpass';
    lowPassFilter.frequency.value = 18000; // Remove very high frequencies
    lowPassFilter.Q.value = 0.7; // Gentle slope
    
    // Create compressor for dynamic range control
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    
    // Create gain node for volume control
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 1.2; // Slight volume boost
    
    // Connect the audio processing chain
    source.connect(highPassFilter);
    highPassFilter.connect(lowPassFilter);
    lowPassFilter.connect(compressor);
    compressor.connect(gainNode);
    
    // Create a destination node to capture the processed audio
    const destination = audioContext.createMediaStreamDestination();
    gainNode.connect(destination);
    
    // Initialize MediaRecorder with optimized settings
    mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000, // Higher bitrate for better quality
        bitsPerSecond: 128000 // Ensure consistent bitrate
    });

    mediaRecorder.addEventListener('dataavailable', event => {
        audioChunks.push(event.data);
    });

    mediaRecorder.addEventListener('stop', () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        currentRecordedFile = new File([audioBlob], 'recording.wav', { 
            type: 'audio/wav',
            lastModified: Date.now()
        });
        
        // Create audio preview with enhanced controls
        const audioUrl = URL.createObjectURL(audioBlob);
        audioPreview.src = audioUrl;
        audioPreview.controls = true;
        audioPreview.controlsList = "nodownload"; // Prevent download button
        recordPreview.classList.remove('hidden');
        
        // Stop all tracks and close audio context
        stream.getTracks().forEach(track => track.stop());
        audioContext.close();
    });

    // Start recording with smaller timeslices for more frequent updates
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

// Add Generate Summary Button Handler
generateSummaryButton.addEventListener('click', async () => {
    const transcript = transcriptContent.textContent;
    const t = translations[currentLanguage] || translations.az;

    if (!transcript) {
        alert(t.transcribeFirst);
        return;
    }

    try {
        loadingContainer.classList.remove('hidden');
        generateSummaryButton.disabled = true;
        summarySection.classList.remove('visible');
        summaryContent.innerHTML = ''; // Clear previous content

        const response = await fetch(`${API_BASE_URL}/summarize/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ 
                text: transcript,
                language: currentLanguage
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || data.message || 'Failed to generate summary');
        }

        if (!data.summary) {
            throw new Error('No summary data received from server');
        }
        
        // Show summary section with content
        summaryContent.textContent = data.summary;
        summarySection.classList.remove('hidden');
        setTimeout(() => {
            summarySection.classList.add('visible');
        }, 10);

    } catch (error) {
        console.error('Error generating summary:', error);
        summarySection.classList.remove('hidden');
        summaryContent.innerHTML = `
            <div class="summary-error">
                ${error.message === 'Failed to fetch' 
                    ? t.connectionError
                    : t.summaryError}
            </div>
        `;
        setTimeout(() => {
            summarySection.classList.add('visible');
        }, 10);
    } finally {
        loadingContainer.classList.add('hidden');
        generateSummaryButton.disabled = false;
    }
});

// Reset UI
function resetUI() {
    fileInput.value = '';
    fileName.textContent = '';
    fileInfo.classList.add('hidden');
    loadingContainer.classList.add('hidden');
    resultContainer.classList.add('hidden');
    transcriptContent.textContent = '';
    summaryContent.textContent = '';
    processButton.classList.add('hidden');
    
    // Show upload areas again
    dropZone.classList.remove('hidden');
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
    
    // Reset summary section
    summarySection.classList.remove('visible');
    setTimeout(() => {
        summarySection.classList.add('hidden');
        summaryContent.textContent = '';
    }, 300); // Match transition duration
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
        processAudioFile();
    });
}); 