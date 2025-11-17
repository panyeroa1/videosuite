import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import type { GeolocationCoordinates, PexelsPhotoSearchResponse, PexelsVideoSearchResponse } from '../types';
import { PROMPT_GENERATOR_SYSTEM_PROMPT, SCRIPT_GENERATOR_SYSTEM_PROMPT, THUMBNAIL_TITLE_PROMPT } from "../constants";

const getAiClient = () => {
    // API key is automatically injected by the environment
    if (!process.env.API_KEY) {
        // In a real app, you might want to handle this more gracefully.
        // For this context, we assume the key is always present.
        console.warn("API_KEY environment variable not set.");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateCinematicImage = async (prompt: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                {
                    text: prompt,
                },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            const base64ImageBytes: string = part.inlineData.data;
            return `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
        }
    }

    throw new Error("Image generation failed or returned no images.");
};


export const editImage = async (base64Image: string, mimeType: string, prompt: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                {
                    inlineData: {
                        data: base64Image,
                        mimeType: mimeType,
                    },
                },
                {
                    text: prompt,
                },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            const base64ImageBytes: string = part.inlineData.data;
            return `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
        }
    }
    throw new Error("Image editing failed or returned no image.");
};

export const analyzeImage = async (base64Image: string, mimeType: string, prompt: string): Promise<string> => {
    const ai = getAiClient();
    const imagePart = {
        inlineData: {
            mimeType,
            data: base64Image,
        },
    };
    const textPart = {
        text: prompt,
    };
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
    });
    return response.text;
};


export const groundedSearch = async (prompt: string): Promise<GenerateContentResponse> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            tools: [{ googleSearch: {} }],
        },
    });
    return response;
};

export const groundedMapsSearch = async (prompt: string, location: GeolocationCoordinates): Promise<GenerateContentResponse> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            tools: [{ googleMaps: {} }],
            toolConfig: {
                retrievalConfig: {
                    latLng: {
                        latitude: location.latitude,
                        longitude: location.longitude,
                    }
                }
            }
        },
    });
    return response;
};

export const quickResponse = async (prompt: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        // FIX: Use the correct model name for gemini flash lite according to the guidelines.
        model: 'gemini-flash-lite-latest',
        contents: prompt,
    });
    return response.text;
};

export const enhanceScript = async (script: string, systemInstruction: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: script,
        config: {
            systemInstruction: systemInstruction,
        },
    });
    return response.text;
};

export const generateFullScript = async (topic: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: topic,
        config: {
            systemInstruction: SCRIPT_GENERATOR_SYSTEM_PROMPT,
        },
    });
    return response.text;
};

export const generateVideoTitle = async (script: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: script,
        config: {
            systemInstruction: THUMBNAIL_TITLE_PROMPT,
        },
    });
    return response.text.trim();
};

export const generatePromptsFromScript = async (script: string): Promise<string[]> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: script,
        config: {
            systemInstruction: PROMPT_GENERATOR_SYSTEM_PROMPT,
            responseMimeType: "application/json",
        },
    });

    try {
        let jsonText = response.text.trim();
        // Handle cases where the model wraps the JSON in markdown code fences
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.substring(7, jsonText.length - 3).trim();
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.substring(3, jsonText.length - 3).trim();
        }

        const prompts = JSON.parse(jsonText);
        if (Array.isArray(prompts) && prompts.every(p => typeof p === 'string')) {
            return prompts;
        }
        throw new Error("Parsed JSON is not an array of strings.");
    } catch (e) {
        console.error("Failed to parse prompts from script response:", response.text, e);
        throw new Error("AI failed to generate valid scene prompts in the expected format. Please try again or adjust your script.");
    }
};

export const generateSpeech = async (
    text: string,
    speakers: { speaker?: string; voiceName: string }[]
): Promise<string> => {
    const ai = getAiClient();

    let speechConfig;

    if (speakers.length > 1) {
        // Multi-speaker
        speechConfig = {
            multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: speakers.map(({ speaker, voiceName }) => {
                    if (!speaker) {
                        // This should be handled by the calling component, but as a safeguard:
                        throw new Error("Speaker name is required for each speaker in multi-speaker TTS.");
                    }
                    return {
                        speaker,
                        voiceConfig: { prebuiltVoiceConfig: { voiceName } }
                    };
                })
            }
        };
    } else {
        // Single speaker
        speechConfig = {
            voiceConfig: {
                prebuiltVoiceConfig: { voiceName: speakers[0].voiceName },
            },
        };
    }

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig,
        },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("Text-to-speech generation failed.");
    }
    return base64Audio;
};

export const generateInstrumentalAudio = async (prompt: string): Promise<string> => {
    const ai = getAiClient();
    // NOTE: This uses the TTS model as a stand-in for a true music generation model
    // like Lyra 2, as it's the only available audio generation API.
    // The prompt is slightly modified to make the TTS output a description of the desired sound.
    const ttsPrompt = `A soundscape of: ${prompt}`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: ttsPrompt }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    // Using a neutral voice for describing the sound
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("AI audio generation failed to produce an audio track.");
    }
    return base64Audio;
};

export const transcribeAudio = async (base64Audio: string, mimeType: string): Promise<string> => {
    const ai = getAiClient();
    const audioPart = {
        inlineData: {
            mimeType,
            data: base64Audio,
        },
    };
    const textPart = {
        text: "Transcribe this audio recording accurately. Identify and label each distinct speaker (e.g., Speaker 1:, Speaker 2:). Also, listen for and include non-verbal sounds and environmental sound effects as tags in square brackets (e.g., [soft laugh], [car horn honks], [door closes]). If only one person is speaking, do not add speaker labels.",
    };
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [audioPart, textPart] },
    });
    return response.text;
};


// --- Pexels Service ---
const PEXELS_API_KEY = 'nBvOe5WN77FK6c1ezUKdtTRtLFXSQqDsquQNbjnUByka645MXuEaEIKT';
const PEXELS_API_BASE = 'https://api.pexels.com/v1';

const pexelsFetch = async (endpoint: string) => {
    if (!PEXELS_API_KEY) {
        throw new Error("Pexels API key is not configured.");
    }
    const response = await fetch(`${PEXELS_API_BASE}${endpoint}`, {
        headers: {
            Authorization: PEXELS_API_KEY
        }
    });
    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Pexels API Error:", errorBody);
        throw new Error(`Pexels API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
};

export const searchPexelsPhotos = async (query: string): Promise<PexelsPhotoSearchResponse> => {
    return pexelsFetch(`/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`);
};

export const searchPexelsVideos = async (query: string): Promise<PexelsVideoSearchResponse> => {
    return pexelsFetch(`/videos/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`);
};