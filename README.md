# AI Podcast Summarizer 🎙️

Convert your audio content into text and get AI-powered summaries instantly.

## Features ✨

- Audio file upload (MP3, WAV, M4A)
- Automatic speech-to-text transcription
- AI-powered content summarization
- Simple and intuitive interface
- Drag-and-drop support

## Try It Out 🚀

Visit: [AI Podcast Summarizer](https://nurlanjalil.github.io/AI-Podcast-Summarizer)

## How to Use 📝

1. Open the web application
2. Upload your audio file by:
   - Dragging and dropping it into the upload area
   - Clicking "Choose File" to select from your device
3. Click "Process Audio"
4. Wait for processing (this may take a few moments)
5. View your transcript and summary

## Supported Formats 📁

- MP3
- WAV
- M4A

## Technologies Used 🛠️

- OpenAI Whisper API for transcription
- GPT-4 for summarization
- FastAPI backend
- Vanilla JavaScript frontend

## Local Development 💻

1. Clone the repository
```bash
git clone https://github.com/nurlanjalil/AI-Podcast-Summarizer.git
```

2. Install dependencies
```bash
pip install -r requirements.txt
```

3. Set up environment variables
```bash
cp .env.example .env
# Add your OpenAI API key to .env file
```

4. Run the backend
```bash
cd backend
uvicorn main:app --reload
```

5. Open `index.html` in your browser

## License 📄

MIT License - feel free to use this project however you'd like! 