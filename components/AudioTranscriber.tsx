

import React, { useState, useRef } from 'react';
import { transcribeAudio } from '../services/geminiService';
import { fileToBase64 } from '../utils/file';
import { MicrophoneIcon, StopIcon } from './Icons';
import { Spinner } from './Spinner';

export const AudioTranscriber: React.FC = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const handleStartRecording = async () => {
        setError(null);
        setTranscript('');
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorderRef.current = new MediaRecorder(stream);
                
                audioChunksRef.current = [];
                mediaRecorderRef.current.addEventListener("dataavailable", event => {
                    audioChunksRef.current.push(event.data);
                });

                mediaRecorderRef.current.addEventListener("stop", async () => {
                    setIsLoading(true);
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    
                    const audioFile = new File([audioBlob], "recording.webm", {
                        type: audioBlob.type,
                        lastModified: Date.now(),
                    });

                    try {
                        const { base64, mimeType } = await fileToBase64(audioFile);
                        const result = await transcribeAudio(base64, mimeType);
                        setTranscript(result);
                    } catch (err) {
                        setError(err instanceof Error ? err.message : 'Transcription failed.');
                    } finally {
                        setIsLoading(false);
                        // Clean up stream tracks
                        stream.getTracks().forEach(track => track.stop());
                    }
                });

                mediaRecorderRef.current.start();
                setIsRecording(true);
            } catch (err) {
                setError("Microphone access denied. Please allow microphone access in your browser settings.");
                console.error("Error accessing microphone:", err);
            }
        } else {
            setError("Your browser does not support audio recording.");
        }
    };
    
    const handleStopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleCopy = () => {
        if (transcript) {
            navigator.clipboard.writeText(transcript);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-surface p-6 rounded-lg shadow-soft space-y-4 text-center">
                <h2 className="text-2xl font-bold text-main font-display">Live Audio Transcription</h2>
                <p className="text-text-muted">Record your voice using your microphone and get a live transcription powered by AI.</p>
                
                <div className="flex justify-center py-4">
                    <button
                        onClick={isRecording ? handleStopRecording : handleStartRecording}
                        className={`flex items-center justify-center gap-3 w-48 h-16 rounded-full font-bold text-lg transition-all duration-300 focus:outline-none focus:ring-4 ${
                            isRecording 
                            ? 'bg-error hover:bg-red-700 focus:ring-red-400 text-white' 
                            : 'bg-primary hover:bg-opacity-80 focus:ring-primary/50 text-[#050509]'
                        }`}
                        disabled={isLoading}
                    >
                        {isRecording ? (
                            <>
                                <StopIcon className="w-6 h-6" />
                                <span>Stop Recording</span>
                            </>
                        ) : (
                            <>
                                <MicrophoneIcon className="w-6 h-6" />
                                <span>Start Recording</span>
                            </>
                        )}
                    </button>
                </div>
                {isRecording && (
                    <div className="flex items-center justify-center gap-2 text-primary animate-pulse">
                        <div className="w-3 h-3 bg-primary rounded-full"></div>
                        <span>Recording...</span>
                    </div>
                )}
            </div>

            {error && <div className="bg-error/10 border border-error text-error px-4 py-3 rounded-lg" role="alert">{error}</div>}

            <div className="bg-surface p-6 rounded-lg shadow-soft min-h-[200px] relative">
                <h3 className="text-xl font-bold text-main mb-4">Transcript</h3>
                {isLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <Spinner message="Transcribing audio..." />
                    </div>
                ) : (
                    transcript ? (
                        <>
                            <textarea
                                readOnly
                                value={transcript}
                                className="w-full h-48 bg-bg border-border-strong border rounded-md p-3 text-main whitespace-pre-wrap"
                                placeholder="Your transcript will appear here..."
                            />
                            <button
                                onClick={handleCopy}
                                className="absolute top-4 right-4 bg-surface-alt hover:bg-primary/10 text-main font-semibold py-2 px-4 rounded-lg transition"
                            >
                                Copy Text
                            </button>
                        </>
                    ) : (
                        <p className="text-text-subtle text-center pt-8">Your transcript will appear here once you stop recording.</p>
                    )
                )}
            </div>
        </div>
    );
};