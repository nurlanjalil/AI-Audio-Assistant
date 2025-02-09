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
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
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
    logger.info(f"Received Azerbaijani transcription request: {file.filename}")
    logger.debug(f"Live recording: {live_recording}")
    
    try:
        # Process audio file
        temp_path = await save_audio_file(file)
        
        # Transcribe with Whisper (optimized for Azerbaijani)
        transcript = await transcribe_audio(temp_path, "azerbaijani")
        
        # Cleanup
        if os.path.exists(temp_path):
            os.remove(temp_path)
        
        return JSONResponse({
            "success": True,
            "transcript": transcript,
            "language": "azerbaijani"
        })
    except Exception as e:
        logger.error(f"Error in Azerbaijani transcription: {str(e)}", exc_info=True)
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
        transcript = await transcribe_audio(temp_path)
        
        # Generate summary
        summary = await generate_summary(transcript)
        
        # Cleanup
        if os.path.exists(temp_path):
            os.remove(temp_path)
        
        return JSONResponse({
            "success": True,
            "transcript": transcript,
            "summary": summary
        })
    except Exception as e:
        logger.error(f"Error in summarization: {str(e)}", exc_info=True)
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
        content = await file.read()
        with open(temp_path, "wb") as buffer:
            buffer.write(content)
        
        # Convert to WAV if needed
        if not file.filename.lower().endswith('.wav'):
            audio = AudioSegment.from_file(temp_path)
            wav_path = os.path.join(TEMP_DIR, f"{process_id}.wav")
            audio.export(wav_path, format="wav")
            os.remove(temp_path)
            temp_path = wav_path
            
        return temp_path
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
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
        return response

    except Exception as e:
        logger.error(f"Error in transcription: {str(e)}", exc_info=True)
        raise e

async def generate_summary(transcript: str) -> str:
    """
    Generate a summary of the transcribed text using Claude 4.0 Mini model.
    """
    try:
        response = client.chat.completions.create(
            model="gpt-4",  # Using GPT-4 for better Azerbaijani language understanding
            messages=[
                {
                    "role": "system", 
                    "content": """You are an expert in Azerbaijani language and summarization.
                                Create concise, accurate summaries of transcribed content.
                                If the text is in Azerbaijani, maintain key terminology and cultural context."""
                },
                {
                    "role": "user", 
                    "content": f"Please provide a concise summary of this transcript, preserving any important Azerbaijani context: {transcript}"
                }
            ],
            temperature=0.7,
            max_tokens=300
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Error generating summary: {str(e)}", exc_info=True)
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