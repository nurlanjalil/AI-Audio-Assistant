from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import openai
from pydub import AudioSegment
import os
from dotenv import load_dotenv
import tempfile
import uuid
import logging
from typing import Dict

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = FastAPI(title="Podcast Summarizer API")

# Configure CORS - more permissive for testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Configure OpenAI
openai.api_key = os.getenv("OPENAI_API_KEY")
if not openai.api_key:
    logger.error("OpenAI API key not found!")
    raise Exception("OpenAI API key not configured")

# Temporary storage for processing files
TEMP_DIR = tempfile.gettempdir()
processing_files: Dict[str, dict] = {}

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
    
    if not file:
        logger.error("No file provided in request")
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    # Generate unique ID for this process
    process_id = str(uuid.uuid4())
    logger.info(f"Starting process {process_id} for file {file.filename}")
    
    try:
        # Save uploaded file temporarily
        temp_path = os.path.join(TEMP_DIR, f"{process_id}_{file.filename}")
        with open(temp_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        logger.info(f"File saved temporarily at {temp_path}")
        
        # Convert to WAV if needed
        if not file.filename.lower().endswith('.wav'):
            logger.info("Converting file to WAV format")
            try:
                audio = AudioSegment.from_file(temp_path)
                wav_path = os.path.join(TEMP_DIR, f"{process_id}.wav")
                audio.export(wav_path, format="wav")
                os.remove(temp_path)  # Remove original file
                temp_path = wav_path
                logger.info("File conversion complete")
            except Exception as e:
                logger.error(f"Error converting audio: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Error converting audio: {str(e)}")

        # Transcribe with Whisper
        logger.info("Starting transcription with Whisper")
        try:
            with open(temp_path, "rb") as audio_file:
                transcript = openai.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file
                )
            logger.info("Transcription complete")
        except Exception as e:
            logger.error(f"Error in transcription: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Transcription error: {str(e)}")

        # Generate summary with GPT
        logger.info("Generating summary with GPT")
        try:
            summary_response = openai.chat.completions.create(
                model="gpt-3.5-turbo",  # Using more widely available model
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that creates concise summaries of transcribed audio content."},
                    {"role": "user", "content": f"Please provide a concise summary of this transcript: {transcript.text}"}
                ]
            )
            summary = summary_response.choices[0].message.content
            logger.info("Summary generation complete")
        except Exception as e:
            logger.error(f"Error generating summary: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Summary generation error: {str(e)}")

        # Store results
        processing_files[process_id] = {
            "transcript": transcript.text,
            "summary": summary
        }

        # Cleanup
        if os.path.exists(temp_path):
            os.remove(temp_path)
            logger.info("Temporary files cleaned up")

        return JSONResponse({
            "message": "File processed successfully",
            "process_id": process_id,
            "transcript": transcript.text,
            "summary": summary
        })

    except Exception as e:
        logger.error(f"Error processing file: {str(e)}")
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
    api_status = "configured" if openai.api_key else "missing"
    logger.info(f"OpenAI API status: {api_status}")
    return {
        "status": "healthy",
        "openai_api": api_status,
        "temp_dir": TEMP_DIR,
        "environment": {
            "python_version": os.sys.version,
            "openai_key_set": bool(openai.api_key)
        }
    } 