from fastapi import FastAPI, UploadFile, HTTPException
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
from typing import Dict
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

app = FastAPI(title="Podcast Summarizer API")

# Configure CORS - more permissive for testing
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
    # Create a custom HTTP client with proper timeout and proxy handling
    http_client = httpx.Client(
        timeout=httpx.Timeout(60.0),
        follow_redirects=True
    )
    
    # Initialize OpenAI client with the custom HTTP client
    client = OpenAI(
        api_key=os.getenv('OPENAI_API_KEY'),
        http_client=http_client
    )
    
    # Test the client with a simple request
    models = client.models.list()
    logger.info("OpenAI API key configured successfully")
except Exception as e:
    logger.error(f"Error configuring OpenAI client: {str(e)}")
    logger.error(f"Environment: OPENAI_API_KEY={'*' * 5 if os.getenv('OPENAI_API_KEY') else 'Not Set'}")
    raise Exception(f"OpenAI API key configuration failed: {str(e)}")

# Temporary storage for processing files
TEMP_DIR = tempfile.gettempdir()
processing_files: Dict[str, dict] = {}
logger.info(f"Using temporary directory: {TEMP_DIR}")

@app.get("/")
async def root():
    logger.info("Root endpoint accessed")
    return {"message": "Welcome to Podcast Summarizer API", 
            "endpoints": {
                "/": "This help message",
                "/health": "Health check endpoint",
                "/upload-audio/": "Upload audio file for transcription and summary"
            }}

@app.post("/upload-audio/")
async def upload_audio(file: UploadFile):
    logger.info(f"Received file upload request: {file.filename}")
    logger.debug(f"File content type: {file.content_type}")
    logger.debug(f"File size: {file.size if hasattr(file, 'size') else 'unknown'}")
    
    if not file:
        logger.error("No file provided in request")
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    # Generate unique ID for this process
    process_id = str(uuid.uuid4())
    logger.info(f"Starting process {process_id} for file {file.filename}")
    
    try:
        # Save uploaded file temporarily
        temp_path = os.path.join(TEMP_DIR, f"{process_id}_{file.filename}")
        logger.debug(f"Saving file to temporary path: {temp_path}")
        
        content = await file.read()
        logger.debug(f"Read file content, size: {len(content)} bytes")
        
        with open(temp_path, "wb") as buffer:
            buffer.write(content)
        logger.info(f"File saved temporarily at {temp_path}")
        
        # Check if file exists and is readable
        if not os.path.exists(temp_path):
            logger.error(f"File not found after saving: {temp_path}")
            raise HTTPException(status_code=500, detail="File saving failed")
        
        file_size = os.path.getsize(temp_path)
        logger.debug(f"Saved file size: {file_size} bytes")
        
        # Convert to WAV if needed
        if not file.filename.lower().endswith('.wav'):
            logger.info(f"Converting file from {file.filename.split('.')[-1]} to WAV format")
            try:
                audio = AudioSegment.from_file(temp_path)
                logger.debug(f"Original audio duration: {len(audio)/1000}s")
                wav_path = os.path.join(TEMP_DIR, f"{process_id}.wav")
                audio.export(wav_path, format="wav")
                os.remove(temp_path)  # Remove original file
                temp_path = wav_path
                logger.info("File conversion complete")
                logger.debug(f"WAV file size: {os.path.getsize(temp_path)} bytes")
            except Exception as e:
                logger.error(f"Error converting audio: {str(e)}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"Error converting audio: {str(e)}")

        # Transcribe with Whisper
        logger.info("Starting transcription with Whisper")
        try:
            with open(temp_path, "rb") as audio_file:
                transcript = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="text"
                )
            logger.info("Transcription complete")
            logger.debug(f"Transcript length: {len(transcript)} characters")
        except Exception as e:
            logger.error(f"Error in transcription: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Transcription error: {str(e)}")

        # Generate summary with GPT
        logger.info("Generating summary with GPT")
        try:
            summary_response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that creates concise summaries of transcribed audio content."},
                    {"role": "user", "content": f"Please provide a concise summary of this transcript: {transcript}"}
                ]
            )
            summary = summary_response.choices[0].message.content
            logger.info("Summary generation complete")
            logger.debug(f"Summary length: {len(summary)} characters")
        except Exception as e:
            logger.error(f"Error generating summary: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Summary generation error: {str(e)}")

        # Store results
        processing_files[process_id] = {
            "transcript": transcript,
            "summary": summary
        }

        # Cleanup
        if os.path.exists(temp_path):
            os.remove(temp_path)
            logger.info("Temporary files cleaned up")

        logger.info(f"Process {process_id} completed successfully")
        return JSONResponse({
            "message": "File processed successfully",
            "process_id": process_id,
            "transcript": transcript,
            "summary": summary
        })

    except Exception as e:
        logger.error(f"Error processing file: {str(e)}", exc_info=True)
        # Clean up temp file if it exists
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/summary/{process_id}")
async def get_summary(process_id: str):
    if process_id not in processing_files:
        raise HTTPException(status_code=404, detail="Process ID not found")
    
    return JSONResponse(processing_files[process_id])

@app.get("/health")
async def health_check():
    logger.info("Health check endpoint accessed")
    api_status = "configured" if client.api_key else "missing"
    logger.info(f"OpenAI API status: {api_status}")
    
    # Check temp directory
    temp_dir_writable = os.access(TEMP_DIR, os.W_OK)
    logger.debug(f"Temp directory writable: {temp_dir_writable}")
    
    return {
        "status": "healthy",
        "openai_api": api_status,
        "temp_dir": {
            "path": TEMP_DIR,
            "writable": temp_dir_writable,
            "free_space": os.statvfs(TEMP_DIR).f_bavail * os.statvfs(TEMP_DIR).f_frsize
        },
        "environment": {
            "python_version": sys.version,
            "openai_key_set": bool(client.api_key),
            "temp_dir_writable": temp_dir_writable
        }
    } 