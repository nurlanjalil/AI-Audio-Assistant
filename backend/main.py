from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import openai
from pydub import AudioSegment
import os
from dotenv import load_dotenv
import tempfile
import uuid
from typing import Dict

# Load environment variables
load_dotenv()

app = FastAPI(title="Podcast Summarizer API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with actual frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure OpenAI
openai.api_key = os.getenv("OPENAI_API_KEY")

# Temporary storage for processing files
TEMP_DIR = tempfile.gettempdir()
processing_files: Dict[str, dict] = {}

@app.post("/upload-audio/")
async def upload_audio(file: UploadFile):
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    # Generate unique ID for this process
    process_id = str(uuid.uuid4())
    
    try:
        # Save uploaded file temporarily
        temp_path = os.path.join(TEMP_DIR, f"{process_id}_{file.filename}")
        with open(temp_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Convert to WAV if needed
        if not file.filename.lower().endswith('.wav'):
            audio = AudioSegment.from_file(temp_path)
            wav_path = os.path.join(TEMP_DIR, f"{process_id}.wav")
            audio.export(wav_path, format="wav")
            os.remove(temp_path)  # Remove original file
            temp_path = wav_path

        # Transcribe with Whisper
        with open(temp_path, "rb") as audio_file:
            transcript = openai.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file
            )

        # Generate summary with GPT
        summary_response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that creates concise summaries of transcribed audio content."},
                {"role": "user", "content": f"Please provide a concise summary of this transcript: {transcript.text}"}
            ]
        )
        
        summary = summary_response.choices[0].message.content

        # Store results
        processing_files[process_id] = {
            "transcript": transcript.text,
            "summary": summary
        }

        # Cleanup
        os.remove(temp_path)

        return JSONResponse({
            "message": "File processed successfully",
            "process_id": process_id,
            "transcript": transcript.text,
            "summary": summary
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/summary/{process_id}")
async def get_summary(process_id: str):
    if process_id not in processing_files:
        raise HTTPException(status_code=404, detail="Process ID not found")
    
    return JSONResponse(processing_files[process_id])

@app.get("/health")
async def health_check():
    return {"status": "healthy"} 