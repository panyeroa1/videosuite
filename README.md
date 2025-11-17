# Eburon Media Suite

The Eburon Media Suite is a comprehensive web application designed to streamline media creation and management using AI-powered tools. It integrates various functionalities, including video creation, image editing, AI research assistance, and audio transcription, all powered by Google Gemini and Supabase.

## Architecture Overview

The application follows a client-server architecture:

*   **Frontend:** Built with React, providing a responsive and interactive user interface. It orchestrates calls to various backend services and client-side libraries.
*   **Backend Services (via `services/` directory):**
    *   `geminiService.ts`: Handles all AI interactions, communicating with Google Gemini for various generative tasks.
    *   `supabaseService.ts`: Manages data persistence, authentication, and file storage through Supabase.
*   **Client-side Media Processing:** Utilizes FFmpeg (via `@ffmpeg/ffmpeg` and `@ffmpeg/util`) for in-browser video and audio manipulation, reducing server load and improving responsiveness.
*   **Utility Functions (`utils/` directory):** Provides helper functions for audio processing, file handling, and image manipulation.

## Core Features and AI/Model Flow

The Eburon Media Suite is organized into several key tabs, each leveraging specific AI models and services:

### 1. Video Creator

This feature allows users to generate videos from scripts, complete with AI-generated scenes, narration, background music, and sound effects.

*   **Script Generation/Enhancement:**
    *   **Input:** User-provided topic or existing script.
    *   **Model:** Google Gemini (Large Language Model - LLM).
    *   **Flow:**
        *   `generateFullScript(topic)`: Generates a complete video script based on a given topic.
        *   `enhanceScript(script, systemPrompt)`: Refines and improves an existing script for better narrative flow and detail.
*   **Scene Generation (Images/Videos):**
    *   **Input:** Script prompts generated from the main script.
    *   **Models:**
        *   **AI Generated:** Google Gemini (Image Generation Model).
        *   **Pexels Photos/Videos:** Pexels API (for stock media).
    *   **Flow:**
        *   `generatePromptsFromScript(script)`: Extracts visual prompts from the narration script.
        *   `generateCinematicImage(prompt)`: Creates a cinematic image based on the prompt (for AI-generated scenes).
        *   `searchPexelsPhotos(prompt)` / `searchPexelsVideos(prompt)`: Fetches relevant photos or videos from Pexels.
*   **Narration Generation:**
    *   **Input:** Narration script and selected speaker voices.
    *   **Model:** Google Gemini (Text-to-Speech - TTS Model).
    *   **Flow:**
        *   `generateSpeech(script, speakerConfigs)`: Converts the script into spoken audio using specified voices.
*   **Audio Transcription (for uploaded narration):**
    *   **Input:** User-uploaded audio file.
    *   **Model:** Google Gemini (Speech-to-Text - STT Model).
    *   **Flow:**
        *   `transcribeAudio(base64Audio, mimeType)`: Transcribes spoken audio into text. The resulting transcript can then be enhanced by the LLM.
*   **Background Music/Sound Effects Generation:**
    *   **Input:** Textual prompt describing desired music or sound effect.
    *   **Model:** Google Gemini (Audio Generation Model).
    *   **Flow:**
        *   `generateInstrumentalAudio(prompt)`: Creates instrumental audio or sound effects based on the prompt.
*   **Thumbnail Generation:**
    *   **Input:** Narration script (for title) and a base image (first scene or uploaded).
    *   **Models:** Google Gemini (LLM for title generation) and client-side image processing.
    *   **Flow:**
        *   `generateVideoTitle(script)`: Generates a catchy video title.
        *   `overlayTextOnImage(imageUrl, title)`: Overlays the generated title onto a chosen image.
*   **Video Rendering:**
    *   **Input:** Generated scenes (images/videos), narration audio, background music, sound effects.
    *   **Tool:** FFmpeg (client-side library).
    *   **Flow:** Combines all media assets and audio tracks into a final video file.
*   **File Storage:**
    *   **Input:** Generated audio and video files.
    *   **Service:** Supabase Storage.
    *   **Flow:** `uploadAudioFile(file, type)` and `uploadVideoFile(blob, filename, isPublic, description)` store media assets.

### 2. Image Studio (ImageEditor)

This component is designed for image manipulation and enhancement.

*   **Input:** User-uploaded images.
*   **Models/Tools:** Likely uses client-side image processing libraries (e.g., HTML Canvas, JavaScript image APIs) and potentially AI models for advanced effects or enhancements (e.g., style transfer, upscaling, object removal) via `geminiService.ts`.

### 3. AI Research (ResearchAssistant)

Provides an AI-powered assistant for research tasks.

*   **Input:** User queries or topics.
*   **Model:** Google Gemini (LLM).
*   **Flow:** Interacts with the LLM to retrieve information, summarize content, answer questions, or generate insights.

### 4. Audio Transcriber (AudioTranscriber)

Dedicated tool for transcribing audio.

*   **Input:** User-uploaded audio files.
*   **Model:** Google Gemini (Speech-to-Text - STT Model).
*   **Flow:** Uses `transcribeAudio` from `geminiService.ts` to convert speech to text.

## Technologies Used

*   **Frontend:** React, TypeScript, Tailwind CSS
*   **AI Integration:** Google Gemini API
*   **Backend/Database/Storage:** Supabase
*   **Media Processing:** FFmpeg (client-side)
*   **Package Management:** npm

This architecture allows for a modular and scalable media suite, leveraging the power of generative AI for creative content generation and efficient media processing.
