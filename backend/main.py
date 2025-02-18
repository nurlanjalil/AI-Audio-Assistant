from fastapi import FastAPI, UploadFile, HTTPException, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from openai import OpenAI
from pydub import AudioSegment
import os
from dotenv import load_dotenv
import tempfile
import uuid
import logging
import sys
from typing import Dict, Optional, List
import httpx
import numpy as np
from scipy import signal
from enum import Enum

# Configure detailed logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

# Set specific loggers to higher levels to reduce noise
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("openai").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("openai.http_client").setLevel(logging.WARNING)
logging.getLogger("openai.client").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()
logger.info("Environment variables loaded")

app = FastAPI(title="Azerbaijani Speech Recognition & Audio Summarizer API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)
logger.info("CORS configured")

# Configure OpenAI
try:
    http_client = httpx.Client(
        timeout=httpx.Timeout(60.0),
        follow_redirects=True
    )
    
    client = OpenAI(
        api_key=os.getenv('OPENAI_API_KEY'),
        http_client=http_client
    )
    logger.info("OpenAI API key configured successfully")
except Exception as e:
    logger.error(f"Error configuring OpenAI client: {str(e)}")
    logger.error(f"Environment: OPENAI_API_KEY={'*' * 5 if os.getenv('OPENAI_API_KEY') else 'Not Set'}")
    raise Exception(f"OpenAI API key configuration failed: {str(e)}")

# Temporary storage
TEMP_DIR = tempfile.gettempdir()
processing_files: Dict[str, dict] = {}
logger.info(f"Using temporary directory: {TEMP_DIR}")

class Language(Enum):
    """Supported languages for transcription and summarization."""
    AZERBAIJANI = "az"
    ENGLISH = "en"
    TURKISH = "tr"
    FRENCH = "fr"
    ARABIC = "ar"
    CHINESE = "zh"

# Language configuration
LANGUAGE_CONFIG = {
    Language.AZERBAIJANI: {
        "name": "Azərbaycan dili",
        "whisper_code": "az",
        "prompt": "This is Azerbaijani speech. Please transcribe accurately."
    },
    Language.ENGLISH: {
        "name": "English",
        "whisper_code": "en",
        "prompt": "This is English speech. Please transcribe accurately."
    },
    Language.TURKISH: {
        "name": "Türkçe",
        "whisper_code": "tr",
        "prompt": "This is Turkish speech. Please transcribe accurately."
    },
    Language.FRENCH: {
        "name": "Français",
        "whisper_code": "fr",
        "prompt": "This is French speech. Please transcribe accurately."
    },
    Language.ARABIC: {
        "name": "العربية",
        "whisper_code": "ar",
        "prompt": "This is Arabic speech. Please transcribe accurately."
    },
    Language.CHINESE: {
        "name": "中文",
        "whisper_code": "zh",
        "prompt": "This is Chinese speech. Please transcribe accurately."
    }
}

DEFAULT_LANGUAGE = Language.AZERBAIJANI

@app.get("/")
async def root():
    logger.info("Root endpoint accessed")
    return {
        "message": "Welcome to Azerbaijani Speech Recognition & Audio Summarizer API", 
        "endpoints": {
            "/": "This help message",
            "/health": "Health check endpoint",
            "/transcribe-azerbaijani/": "Convert Azerbaijani speech to text",
            "/summarize-audio/": "Transcribe and summarize audio content",
            "/transcribe-live/": "Convert live recorded Azerbaijani speech to text"
        }
    }

@app.get("/languages")
async def get_languages():
    """Get list of supported languages."""
    return {
        "languages": [
            {
                "code": lang.value,
                "name": LANGUAGE_CONFIG[lang]["name"]
            } for lang in Language
        ],
        "default": DEFAULT_LANGUAGE.value
    }

@app.post("/transcribe-azerbaijani/")
async def transcribe_azerbaijani(
    file: UploadFile = File(...),
    language: str = DEFAULT_LANGUAGE.value,
    live_recording: bool = False
):
    """
    Endpoint for speech-to-text conversion.
    Supports multiple languages with Azerbaijani as default.
    """
    try:
        # Validate language
        try:
            selected_language = Language(language)
        except ValueError:
            selected_language = DEFAULT_LANGUAGE
            logger.warning(f"Invalid language {language}, using default")

        # Process audio file
        temp_path = await save_audio_file(file)
        
        # Transcribe with Whisper
        raw_transcript = await transcribe_audio(
            temp_path, 
            LANGUAGE_CONFIG[selected_language]["whisper_code"]
        )
        
        # Correct the transcript
        corrected_transcript = await correct_transcript(
            raw_transcript, 
            selected_language
        )
        
        # Cleanup
        if os.path.exists(temp_path):
            os.remove(temp_path)
        
        return JSONResponse({
            "success": True,
            "transcript": corrected_transcript,
            "language": selected_language.value
        })
    except Exception as e:
        logger.error(f"Error in transcription: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Transcription error: {str(e)}")

@app.post("/summarize-audio/")
async def summarize_audio(file: UploadFile = File(...)):
    """
    Endpoint for audio transcription and summarization.
    """
    logger.info(f"Received summarization request: {file.filename}")
    
    try:
        # Process audio file
        temp_path = await save_audio_file(file)
        
        # Transcribe
        raw_transcript = await transcribe_audio(temp_path)
        
        # Correct the transcript
        corrected_transcript = await correct_transcript(raw_transcript)
        
        # Generate summary
        summary = await generate_summary(corrected_transcript)
        
        # Cleanup
        if os.path.exists(temp_path):
            os.remove(temp_path)
        
        return JSONResponse({
            "success": True,
            "transcript": corrected_transcript,
            "summary": summary
        })
    except Exception as e:
        logger.error(f"Error in summarization: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Summarization error: {str(e)}")

@app.post("/summarize/")
async def summarize_text(request: dict):
    """
    Endpoint for summarizing text directly.
    Expects a JSON payload with a 'text' field.
    """
    try:
        if not request.get('text'):
            raise HTTPException(status_code=400, detail="Text field is required")
            
        summary = await generate_summary(request['text'])
        
        return JSONResponse({
            "success": True,
            "summary": summary
        })
    except Exception as e:
        logger.error(f"Error in text summarization: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Summarization error: {str(e)}")

@app.post("/transcribe-live/")
async def transcribe_live(file: UploadFile = File(...)):
    """
    Endpoint specifically for live recorded Azerbaijani speech.
    Optimized for real-time audio processing.
    """
    return await transcribe_azerbaijani(file, live_recording=True)

async def enhance_audio(audio_segment: AudioSegment) -> AudioSegment:
    """
    Fast, lightweight audio enhancement optimized for voice.
    Uses efficient numpy operations for minimal processing overhead.
    """
    # Convert audio to numpy array for faster processing
    samples = np.array(audio_segment.get_array_of_samples())
    sample_rate = audio_segment.frame_rate

    # Normalize audio (fast operation)
    samples = samples / (np.max(np.abs(samples)) + 1e-7)
    
    # Apply a fast high-pass filter to reduce low-frequency noise
    # Using a lightweight Butterworth filter
    nyquist = sample_rate / 2
    cutoff = 80  # Hz
    b, a = signal.butter(2, cutoff/nyquist, btype='high')
    samples = signal.filtfilt(b, a, samples)
    
    # Fast dynamic range compression using numpy operations
    threshold = 0.3
    ratio = 0.6
    mask = np.abs(samples) > threshold
    samples[mask] = threshold + (np.abs(samples[mask]) - threshold) * ratio * np.sign(samples[mask])
    
    # Convert back to 16-bit PCM
    samples = np.int16(samples * 32767)
    
    # Create enhanced AudioSegment
    enhanced_audio = AudioSegment(
        samples.tobytes(), 
        frame_rate=sample_rate,
        sample_width=2,
        channels=1
    )
    
    return enhanced_audio

async def save_audio_file(file: UploadFile) -> str:
    """
    Save uploaded file and convert to WAV if necessary.
    """
    process_id = str(uuid.uuid4())
    temp_path = os.path.join(TEMP_DIR, f"{process_id}_{file.filename}")
    
    try:
        # Read file content
        content = await file.read()
        
        # Check file size (25MB limit)
        file_size_mb = len(content) / (1024 * 1024)  # Convert to MB
        if file_size_mb > 25:
            raise HTTPException(
                status_code=413,
                detail="Audio faylın həcmi 25MB-dan çox ola bilməz"
            )
            
        with open(temp_path, "wb") as buffer:
            buffer.write(content)
        
        # Load audio and check duration
        audio = AudioSegment.from_file(temp_path)
        duration_seconds = len(audio) / 1000  # Convert milliseconds to seconds
        
        if duration_seconds > 300:  # 5 minutes
            os.remove(temp_path)
            raise HTTPException(
                status_code=400,
                detail="Audio faylın uzunluğu 5 dəqiqədən çox ola bilməz"
            )
        
        # Convert to mono for consistent processing
        audio = audio.set_channels(1)
        
        # Enhance audio
        enhanced_audio = await enhance_audio(audio)
        
        # Save enhanced audio
        wav_path = os.path.join(TEMP_DIR, f"{process_id}.wav")
        enhanced_audio.export(wav_path, format="wav")
        
        # Cleanup original file if it's different from the WAV path
        if temp_path != wav_path:
            os.remove(temp_path)
            
        return wav_path
    except HTTPException:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        if "Maximum content size limit" in str(e):
            raise HTTPException(
                status_code=413,
                detail="Audio faylın həcmi 25MB-dan çox ola bilməz"
            )
        raise e

async def transcribe_audio(file_path: str, language_code: str) -> str:
    """
    Transcribe audio using Whisper API.
    Optimized for specified language.
    """
    try:
        with open(file_path, "rb") as audio_file:
            response = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="text",
                language=language_code,
                prompt=LANGUAGE_CONFIG[Language(language_code)]["prompt"]
            )
        
        logger.info("=== Raw Whisper Transcript ===")
        logger.info(response)
        return response

    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        raise e

async def generate_summary(transcript: str, language: str = DEFAULT_LANGUAGE.value) -> str:
    """
    Generate a summary of the transcribed text using GPT-4o.
    Now supports multiple languages.
    """
    try:
        # Get language enum
        try:
            selected_language = Language(language)
        except ValueError:
            selected_language = DEFAULT_LANGUAGE

        # Language-specific instructions
        language_instructions = {
            Language.AZERBAIJANI: "Generate a concise and accurate summary in Azerbaijani.",
            Language.ENGLISH: "Generate a concise and accurate summary in English.",
            Language.TURKISH: "Generate a concise and accurate summary in Turkish.",
            Language.FRENCH: "Generate a concise and accurate summary in French.",
            Language.ARABIC: "Generate a concise and accurate summary in Arabic.",
            Language.CHINESE: "Generate a concise and accurate summary in Chinese."
        }

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system", 
                    "content": f"""You are an expert in {LANGUAGE_CONFIG[selected_language]['name']} and summarization.
                                Your task is to:
                                - {language_instructions.get(selected_language, language_instructions[DEFAULT_LANGUAGE])}
                                - Maintain key terminology and cultural context.
                                - Keep the summary in the target language, preserving the core meaning.
                                
                                Guidelines:
                                - Use clear and natural language appropriate for the target language.
                                - Keep the summary brief but informative.
                                - Avoid unnecessary repetition.
                                
                                Return ONLY the summary in the target language, without additional explanations."""
                },
                {
                    "role": "user", 
                    "content": f"Provide a concise summary of this text:\n\n{transcript}"
                }
            ],
            temperature=0.5,
            max_tokens=300
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Error generating summary: {str(e)}", exc_info=True)
        raise e

async def correct_transcript(transcript: str, language: Language) -> str:
    """
    Correct the transcribed text using GPT-4o to fix any voice-to-text errors and improve formatting.
    Now supports multiple languages.
    """
    try:
        # Language-specific system prompts
        language_prompts = {
            Language.AZERBAIJANI: "You are an expert in Azerbaijani language, phonetics, and natural speech processing.",
            Language.ENGLISH: "You are an expert in English language, phonetics, and natural speech processing.",
            Language.TURKISH: "You are an expert in Turkish language, phonetics, and natural speech processing.",
            Language.FRENCH: "You are an expert in French language, phonetics, and natural speech processing.",
            Language.ARABIC: "You are an expert in Arabic language, phonetics, and natural speech processing.",
            Language.CHINESE: "You are an expert in Chinese language, phonetics, and natural speech processing."
        }

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": f"""{language_prompts.get(language, language_prompts[DEFAULT_LANGUAGE])}
                    Your task is to correct errors in a voice-to-text transcript while keeping the spoken structure intact.

                    **Key Instructions:**
                    1. Fix any misinterpretations caused by phonetic errors.
                    2. Correct grammar, punctuation, and word usage **without changing the speaker's word choices whenever possible**.
                    3. **Preserve all spoken words, including filler words, unless they are clearly incorrect.**
                    4. Replace incorrect words with **phonetically similar and contextually relevant** alternatives **only when necessary**.
                    5. Apply proper capitalization, sentence structure, and paragraph formatting.
                    6. Break long sentences into shorter, more readable ones while maintaining the speaker's intent.
                    7. Ensure the final text flows naturally and reads as authentic speech in the target language.

                    **Guidelines:**
                    - Do **not** remove or replace words unless they are transcription errors or grammatically incorrect.
                    - Apply correct punctuation and spacing for the target language.
                    - Avoid changing the original tone or intent of the text.
                    - When in doubt, prioritize grammatical accuracy while preserving the original wording.

                    Return only the corrected transcript with proper formatting. No explanations."""
                },
                {
                    "role": "user", 
                    "content": f"Correct and format this voice-to-text transcription:\n\n{transcript}"
                }
            ],
            temperature=0.3,
            max_tokens=2000
        )
        
        corrected_text = response.choices[0].message.content.strip()
        
        # Always log raw and corrected versions
        logger.info("Raw transcript: " + transcript)
        logger.info("Corrected transcript: " + corrected_text)
        
        return corrected_text
        
    except Exception as e:
        logger.error(f"Correction error: {str(e)}")
        raise e

@app.get("/health")
async def health_check():
    """
    Enhanced health check endpoint.
    """
    logger.info("Health check endpoint accessed")
    return {
        "status": "healthy",
        "openai_api": "configured" if client.api_key else "missing",
        "features": {
            "azerbaijani_transcription": True,
            "audio_summarization": True,
            "live_recording": True
        },
        "environment": {
            "python_version": sys.version,
            "temp_dir_writable": os.access(TEMP_DIR, os.W_OK)
        }
    } 