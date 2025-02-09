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

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://nurlanjalil.github.io",
        "http://localhost:8080",
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
    return {"message": "Welcome to Podcast Summarizer API", 
            "endpoints": {
                "/": "This help message",
                "/health": "Health check endpoint",
                "/upload-audio/": "Upload audio file for transcription and summary"
            }}

@app.post("/upload-audio/")
async def upload_audio(file: UploadFile):
    if not file:
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
            audio = AudioSegment.from_file(temp_path)
            wav_path = os.path.join(TEMP_DIR, f"{process_id}.wav")
            audio.export(wav_path, format="wav")
            os.remove(temp_path)  # Remove original file
            temp_path = wav_path
            logger.info("File conversion complete")

        # Transcribe with Whisper
        logger.info("Starting transcription with Whisper")
        with open(temp_path, "rb") as audio_file:
            transcript = openai.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file
            )
        logger.info("Transcription complete")

        # Generate summary with GPT
        logger.info("Generating summary with GPT")
        summary_response = openai.chat.completions.create(
            model="gpt-4",  # Fixed model name
            messages=[
                {"role": "system", "content": "You are a helpful assistant that creates concise summaries of transcribed audio content."},
                {"role": "user", "content": f"Please provide a concise summary of this transcript: {transcript.text}"}
            ]
        )
        
        summary = summary_response.choices[0].message.content
        logger.info("Summary generation complete")

        # Store results
        processing_files[process_id] = {
            "transcript": transcript.text,
            "summary": summary
        }

        # Cleanup
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
    return {"status": "healthy", "openai_api": "configured" if openai.api_key else "missing"} 