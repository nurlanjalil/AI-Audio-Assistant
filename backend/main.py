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
import json
from time import sleep

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
    client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
    logger.info("OpenAI API key configured successfully")
    
    # Create assistants for different tasks
    transcript_corrector = client.beta.assistants.create(
        name="Azerbaijani Transcript Corrector",
        instructions="""You are an expert in Azerbaijani language, phonetics, and natural speech processing.
        Your task is to correct errors in a voice-to-text transcript while keeping the spoken structure intact.

        Key Instructions:
        1. Fix any misinterpretations caused by phonetic errors
        2. Correct grammar, punctuation, and word usage without changing the speaker's word choices whenever possible
        3. Preserve all spoken words, including filler words, unless they are clearly incorrect
        4. Replace incorrect words with phonetically similar and contextually relevant alternatives only when necessary
        5. Apply proper capitalization, sentence structure, and paragraph formatting
        6. Break long sentences into shorter, more readable ones while maintaining the speaker's intent
        7. Ensure the final text flows naturally and reads as authentic Azerbaijani speech

        Return only the corrected transcript with proper formatting. No explanations.""",
        model="gpt-4o"
    )
    
    summarizer = client.beta.assistants.create(
        name="Azerbaijani Content Summarizer",
        instructions="""You are an expert in Azerbaijani language and summarization.
        Your task is to generate concise and accurate summaries of transcribed text while:
        - Maintaining key terminology and cultural context
        - Keeping the summary in Azerbaijani, preserving the core meaning
        - Using clear and natural Azerbaijani language
        - Keeping the summary brief but informative
        - Avoiding unnecessary repetition
        
        Return ONLY the summary in Azerbaijani, without additional explanations.""",
        model="gpt-4o"
    )
    
    logger.info("OpenAI Assistants created successfully")
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
        raw_transcript = await transcribe_audio(temp_path, "azerbaijani")
        
        # Correct the transcript using GPT-4o
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
        return response

    except Exception as e:
        logger.error(f"Error in transcription: {str(e)}", exc_info=True)
        raise e

async def generate_summary(transcript: str) -> str:
    """
    Generate a summary of the transcribed text using OpenAI Assistant.
    """
    try:
        # Create a thread
        thread = client.beta.threads.create()
        
        # Add message to thread
        client.beta.threads.messages.create(
            thread_id=thread.id,
            role="user",
            content=f"Please provide a concise summary of this text in Azerbaijani:\n\n{transcript}"
        )
        
        # Run the assistant
        run = client.beta.threads.runs.create(
            thread_id=thread.id,
            assistant_id=summarizer.id
        )
        
        # Wait for completion
        while True:
            run_status = client.beta.threads.runs.retrieve(
                thread_id=thread.id,
                run_id=run.id
            )
            if run_status.status == 'completed':
                break
            elif run_status.status in ['failed', 'cancelled', 'expired']:
                raise Exception(f"Assistant run failed with status: {run_status.status}")
            sleep(1)
        
        # Get the response
        messages = client.beta.threads.messages.list(thread_id=thread.id)
        assistant_message = next(msg for msg in messages if msg.role == "assistant")
        return assistant_message.content[0].text.value
        
    except Exception as e:
        logger.error(f"Error generating summary: {str(e)}", exc_info=True)
        raise e

async def correct_transcript(transcript: str) -> str:
    """
    Correct the transcribed text using OpenAI Assistant to fix any voice-to-text errors and improve formatting.
    """
    try:
        # Create a thread
        thread = client.beta.threads.create()
        
        # Add message to thread
        client.beta.threads.messages.create(
            thread_id=thread.id,
            role="user",
            content=f"Please correct this voice-to-text transcription:\n\n{transcript}"
        )
        
        # Run the assistant
        run = client.beta.threads.runs.create(
            thread_id=thread.id,
            assistant_id=transcript_corrector.id
        )
        
        # Wait for completion
        while True:
            run_status = client.beta.threads.runs.retrieve(
                thread_id=thread.id,
                run_id=run.id
            )
            if run_status.status == 'completed':
                break
            elif run_status.status in ['failed', 'cancelled', 'expired']:
                raise Exception(f"Assistant run failed with status: {run_status.status}")
            sleep(1)
        
        # Get the response
        messages = client.beta.threads.messages.list(thread_id=thread.id)
        assistant_message = next(msg for msg in messages if msg.role == "assistant")
        return assistant_message.content[0].text.value
        
    except Exception as e:
        logger.error(f"Error correcting transcript: {str(e)}", exc_info=True)
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