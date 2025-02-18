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
from typing import Dict, Optional
import httpx

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

@app.post("/transcribe-azerbaijani/")
async def transcribe_azerbaijani(
    file: UploadFile = File(...),
    live_recording: bool = False
):
    """
    Endpoint for Azerbaijani speech-to-text conversion.
    Supports both uploaded files and live recordings.
    """
    try:
        # Process audio file
        temp_path = await save_audio_file(file)
        
        # Transcribe with Whisper
        raw_transcript = await transcribe_audio(temp_path, "azerbaijani")
        
        # Correct the transcript
        corrected_transcript = await correct_transcript(raw_transcript)
        
        # Cleanup
        if os.path.exists(temp_path):
            os.remove(temp_path)
        
        return JSONResponse({
            "success": True,
            "transcript": corrected_transcript,
            "language": "azerbaijani"
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
        
        # Check audio duration
        audio = AudioSegment.from_file(temp_path)
        duration_seconds = len(audio) / 1000  # Convert milliseconds to seconds
        
        if duration_seconds > 300:  # 5 minutes
            os.remove(temp_path)
            raise HTTPException(
                status_code=400,
                detail="Audio faylın uzunluğu 5 dəqiqədən çox ola bilməz"
            )
        
        # Convert to WAV if needed
        if not file.filename.lower().endswith('.wav'):
            wav_path = os.path.join(TEMP_DIR, f"{process_id}.wav")
            audio.export(wav_path, format="wav")
            os.remove(temp_path)
            temp_path = wav_path
            
        return temp_path
    except HTTPException:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        # Check if it's a file size error from OpenAI
        if "Maximum content size limit" in str(e):
            raise HTTPException(
                status_code=413,
                detail="Audio faylın həcmi 25MB-dan çox ola bilməz"
            )
        raise e

async def transcribe_audio(file_path: str, language: Optional[str] = None) -> str:
    """
    Transcribe audio using Whisper API.
    Optimized for Azerbaijani when specified.
    """
    try:
        with open(file_path, "rb") as audio_file:
            response = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="text",
                language="az" if language == "azerbaijani" else language,
                prompt="This is Azerbaijani speech. Please transcribe accurately."
            )
        
        logger.info("=== Raw Whisper Transcript ===")
        logger.info(response)
        return response

    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        raise e

async def generate_summary(transcript: str) -> str:
    """
    Generate a summary of the transcribed text using GPT-4o.
    """
    try:
        response = client.chat.completions.create(
            model="gpt-4o",  # Updated to use GPT-4o for better performance
            messages=[
                {
                    "role": "system", 
                    "content": """You are an expert in Azerbaijani language and summarization.
                                Your task is to:
                                - Generate a concise and accurate summary of the transcribed text.
                                - Maintain key terminology and cultural context.
                                - Keep the summary in Azerbaijani, preserving the core meaning.
                                
                                Guidelines:
                                - Use clear and natural Azerbaijani language.
                                - Keep the summary brief but informative.
                                - Avoid unnecessary repetition.
                                
                                Return ONLY the summary in Azerbaijani, without additional explanations."""
                },
                {
                    "role": "user", 
                    "content": f"Provide a concise summary of this text in Azerbaijani:\n\n{transcript}"
                }
            ],
            temperature=0.5,  # Lowered temperature for more precise summaries
            max_tokens=300
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Error generating summary: {str(e)}", exc_info=True)
        raise e


async def correct_transcript(transcript: str) -> str:
    """
    Correct the transcribed text using GPT-4o to fix any voice-to-text errors and improve formatting.
    """
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": """You are an expert in Azerbaijani language, phonetics, and natural speech processing.
                    Your task is to correct errors in a voice-to-text transcript while keeping the spoken structure intact.

                    **Key Instructions:**
                    1. Fix any misinterpretations caused by phonetic errors.
                    2. Correct grammar, punctuation, and word usage **without changing the speaker's word choices whenever possible**.
                    3. **Preserve all spoken words, including filler words, unless they are clearly incorrect.**
                    4. Replace incorrect words with **phonetically similar and contextually relevant** alternatives **only when necessary**.
                    5. Apply proper capitalization, sentence structure, and paragraph formatting.
                    6. Break long sentences into shorter, more readable ones while maintaining the speaker's intent.
                    7. Ensure the final text flows naturally and reads as authentic Azerbaijani speech.

                    **Guidelines:**
                    - Do **not** remove or replace words unless they are transcription errors or grammatically incorrect.
                    - Apply correct Azerbaijani punctuation and spacing.
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
        
        # Log specific corrections if there were changes
        if corrected_text != transcript:
            # Find and log specific word corrections
            raw_words = transcript.split()
            corrected_words = corrected_text.split()
            
            # Log word-level corrections
            for i in range(min(len(raw_words), len(corrected_words))):
                if raw_words[i] != corrected_words[i]:
                    logger.info(f"Word correction: '{raw_words[i]}' → '{corrected_words[i]}'")
            
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