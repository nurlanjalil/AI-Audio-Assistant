# AI-Powered Podcast Summarizer

A web application that automatically transcribes and summarizes audio content using OpenAI's Whisper and GPT APIs.

## 🎯 Overview

This application allows users to upload audio files (MP3/WAV/M4A) and receive an AI-generated summary of the content. The system:
- Transcribes speech using OpenAI's Whisper API
- Summarizes the transcript using OpenAI's GPT API
- Presents results in a user-friendly web interface

## 🏗️ Architecture

The application follows a two-tier architecture:

- **Frontend**: HTML/CSS/JavaScript application hosted on GitHub Pages
- **Backend**: FastAPI server hosted on Oracle Cloud VM

### System Flow
1. User uploads audio file through the web interface
2. Backend processes the file:
   - Converts audio to required format
   - Transcribes using Whisper API
   - Summarizes using GPT API
3. Summary is displayed to the user

## 🛠️ Tech Stack

| Component      | Technology                    | Hosting                |
|---------------|-------------------------------|------------------------|
| Frontend      | HTML, CSS, JavaScript         | GitHub Pages          |
| Backend       | FastAPI (Python), Uvicorn     | Oracle Cloud VM       |
| Transcription | OpenAI Whisper API            | OpenAI API (External) |
| Summarization | OpenAI GPT-4 API              | OpenAI API (External) |
| File Handling | Python pydub                  | Temporary VM Storage  |

## 🔌 API Endpoints

### Upload Audio
```http
POST /upload-audio/
Content-Type: multipart/form-data
Body: { file: audio.mp3 }
```

Response:
```json
{
  "message": "File received",
  "transcript": "Hello, this is a test podcast...",
  "summary": "A short podcast discussing AI trends."
}
```

### Fetch Summary
```http
GET /summary/{file_id}
```

Response:
```json
{
  "summary": "This podcast talks about AI advancements."
}
```

## 🚀 Features

- ✅ Support for multiple audio formats (MP3/WAV/M4A)
- ✅ Automatic audio format conversion
- ✅ Secure API implementation (no exposed API keys)
- ✅ Temporary file storage with auto-cleanup
- ✅ Real-time processing status updates
- ✅ User-friendly interface with loading indicators

## 💻 Development Setup

1. Clone the repository
2. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Set up environment variables:
   ```bash
   OPENAI_API_KEY=your_api_key
   ```
4. Run the backend server:
   ```bash
   uvicorn main:app --reload
   ```
5. Open the frontend `index.html` in a browser

## 🔐 Security Features

- OpenAI API keys stored securely on backend
- Temporary file storage with automatic cleanup
- No sensitive data exposed to frontend
- Secure API endpoints

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## ⚡ Performance Considerations

- Audio files are processed in chunks for better memory management
- Temporary files are automatically cleaned up
- Efficient API calls to minimize OpenAI API usage

## 📞 Support

For support, please open an issue in the GitHub repository. 