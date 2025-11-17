import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateCinematicImage, generateSpeech, enhanceScript, generatePromptsFromScript, searchPexelsPhotos, searchPexelsVideos, generateVideoTitle, transcribeAudio, generateInstrumentalAudio, generateFullScript } from '../services/geminiService';
import { uploadAudioFile, listAudioFiles, uploadVideoFile, AudioAsset } from '../services/supabaseService';
import { STYLE_PROMPT_ADDITION, SCRIPT_ENHANCER_SYSTEM_PROMPT, TTS_VOICES } from '../constants';
import { createAudioBlobUrl, createAudioFileFromBase64 } from '../utils/audio';
import { fileToBase64 } from '../utils/file';
import { overlayTextOnImage } from '../utils/image';
import { Spinner } from './Spinner';
import { PlayIcon, PauseIcon, SparklesIcon, FilmIcon, SpeakerWaveIcon, WandIcon, XCircleIcon, ArrowUpTrayIcon, RocketLaunchIcon } from './Icons';
import { samplePrompts } from '../data/samplePrompts';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

type MediaItem = {
    type: 'image' | 'video';
    url: string;
    thumbnailUrl?: string;
    duration?: number; // Duration in seconds for video clips
};

type MediaSource = 'ai' | 'pexels_photo' | 'pexels_video';

export const VideoCreator: React.FC = () => {
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [narrationScript, setNarrationScript] = useState('A majestic lion surveying its kingdom from a rocky outcrop at sunrise, warm golden light catching its mane.');
    
    type Speaker = { id: number; name: string; voice: string };
    const [speakers, setSpeakers] = useState<Speaker[]>([
        { id: Date.now(), name: 'Speaker 1', voice: 'Aoede' }
    ]);

    const [narrationUrl, setNarrationUrl] = useState<string | null>(null);
    const [bgMusicUrl, setBgMusicUrl] = useState<string | null>('');
    const [sfxUrl, setSfxUrl] = useState<string | null>('');
    
    const [bgMusicSamples, setBgMusicSamples] = useState<AudioAsset[]>([{ name: 'None', path: '' }]);
    const [sfxSamples, setSfxSamples] = useState<AudioAsset[]>([{ name: 'None', path: '' }]);
    
    const [mediaSource, setMediaSource] = useState<MediaSource>('ai');
    const [isPexelsKeyMissing, setIsPexelsKeyMissing] = useState(false);
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

    const [narrationVolume, setNarrationVolume] = useState(1);
    const [bgMusicVolume, setBgMusicVolume] = useState(0.5);
    const [sfxVolume, setSfxVolume] = useState(0.8);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const [isPlayingNarration, setIsPlayingNarration] = useState(false);
    const [isPlayingBgMusic, setIsPlayingBgMusic] = useState(false);
    const [isPlayingSfx, setIsPlayingSfx] = useState(false);

    const [selectedSample, setSelectedSample] = useState('');
    const [ffmpeg, setFFmpeg] = useState<FFmpeg | null>(null);
    const [ffmpegLoading, setFFmpegLoading] = useState(false);
    const [ffmpegProgress, setFFmpegProgress] = useState(0);

    const narrationRef = useRef<HTMLAudioElement>(null);
    const bgMusicRef = useRef<HTMLAudioElement>(null);
    const sfxRef = useRef<HTMLAudioElement>(null);
    const intervalRef = useRef<number | null>(null);
    
    // FIX: Moved AdvancedAudioControl inside VideoCreator to fix scoping issues.
    const AdvancedAudioControl: React.FC<{
        title: string;
        type: 'bgm' | 'sfx';
        audioUrl: string | null;
        onUrlChange: (url: string) => void;
        volume: number;
        onVolumeChange: (volume: number) => void;
        samples: AudioAsset[];
        isPlaying: boolean;
        onTogglePlay: () => void;
        onGenerate: (prompt: string, type: 'bgm' | 'sfx') => Promise<void>;
        onUpload: (file: File, type: 'bgm' | 'sfx') => Promise<void>;
        disabled: boolean;
    }> = ({ title, type, audioUrl, onUrlChange, volume, onVolumeChange, samples, isPlaying, onTogglePlay, onGenerate, onUpload, disabled }) => {
        const [prompt, setPrompt] = useState('');
        const fileInputRef = useRef<HTMLInputElement>(null);
    
        const handleGenerateClick = async () => {
            if (prompt) {
                await onGenerate(prompt, type);
                setPrompt('');
            }
        };
        
        const handleUploadClick = () => {
            fileInputRef.current?.click();
        };
    
        const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (file) {
                await onUpload(file, type);
                // Reset file input to allow uploading the same file again
                if(fileInputRef.current) fileInputRef.current.value = '';
            }
        };
    
        return (
            <div className="space-y-3">
                <label className="block text-md font-semibold text-main">{title}</label>
                <select
                    value={audioUrl || ''}
                    onChange={e => onUrlChange(e.target.value)}
                    className="w-full p-2.5 bg-bg border border-border-strong rounded-lg focus:ring-2 focus:ring-primary/50 focus:outline-none appearance-none pr-8 select-arrow-bg"
                    disabled={disabled}
                    aria-label={`Select ${title} sample`}
                >
                    {samples.map((sample, index) => <option key={sample.path || `none-${type}-${index}`} value={sample.path}>{sample.name}</option>)}
                </select>
                {audioUrl && (
                    <div className="flex items-center gap-3">
                        <button onClick={onTogglePlay} className="p-2 rounded-full hover:bg-surface-alt transition-colors" aria-label={`Play or pause ${title}`} disabled={disabled}>
                            {isPlaying ? <PauseIcon className="w-5 h-5 text-text-main" /> : <PlayIcon className="w-5 h-5 text-text-main" />}
                        </button>
                        <SpeakerWaveIcon className="w-5 h-5 text-text-muted" />
                        <input
                            type="range" min="0" max="1" step="0.05"
                            value={volume}
                            onChange={e => onVolumeChange(parseFloat(e.target.value))}
                            className="w-full h-2 bg-bg rounded-lg appearance-none cursor-pointer range-thumb:bg-primary"
                            aria-label={`${title} volume`}
                        />
                    </div>
                )}
                <div className="mt-2 p-3 bg-bg rounded-lg border border-border-strong space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={type === 'bgm' ? 'e.g., Lofi hip hop beat' : 'e.g., Cinematic whoosh'}
                            className="flex-grow w-full p-2 bg-surface border border-border-strong rounded-md focus:ring-2 focus:ring-primary/50 focus:outline-none text-sm"
                            disabled={disabled}
                            aria-label={`Generate ${title} prompt`}
                        />
                        <button
                            onClick={handleGenerateClick}
                            className="text-sm flex-shrink-0 bg-surface-alt hover:bg-primary/10 text-main font-semibold py-2 px-3 rounded-md transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!prompt.trim() || disabled}
                        >
                            Generate AI
                        </button>
                    </div>
                     <div className="relative flex items-center py-1">
                        <div className="flex-grow border-t border-divider"></div>
                        <span className="flex-shrink mx-2 text-xs text-text-subtle">OR</span>
                        <div className="flex-grow border-t border-divider"></div>
                    </div>
                    <input type="file" accept="audio/*" ref={fileInputRef} onChange={handleFileSelected} className="hidden" aria-label={`Upload ${title} file`} />
                    <button
                        onClick={handleUploadClick}
                        className="w-full text-sm bg-surface-alt hover:bg-primary/10 text-main font-semibold py-2 px-4 rounded-md transition duration-300 disabled:opacity-50"
                        disabled={disabled}
                    >
                        Upload File
                    </button>
                </div>
            </div>
        );
    };

    useEffect(() => {
        // Pexels API key is now handled by the service layer.
        // This component no longer needs to check for its existence.
        // The API call will fail gracefully if the key is invalid.
        setIsPexelsKeyMissing(false);
    }, [mediaSource]);
    
    useEffect(() => {
        const fetchAudioAssets = async () => {
            try {
                const [bgm, sfx] = await Promise.all([
                    listAudioFiles('bgm'),
                    listAudioFiles('sfx')
                ]);
                setBgMusicSamples(prev => [{ name: 'None', path: '' }, ...bgm]);
                setSfxSamples(prev => [{ name: 'None', path: '' }, ...sfx]);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to load audio library from database.';
                // Avoid showing auth errors if supabase is not configured
                if (!message.toLowerCase().includes('rls') && !message.toLowerCase().includes('jwt')) {
                     setError(message);
                }
                console.warn(message);
            }
        };
        fetchAudioAssets();
    }, []);

    const clearAnimation = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const playAll = () => {
        narrationRef.current?.play().catch(console.error);
        bgMusicRef.current?.play().catch(console.error);
        sfxRef.current?.play().catch(console.error);
    }

    const pauseAll = () => {
        narrationRef.current?.pause();
        bgMusicRef.current?.pause();
        sfxRef.current?.pause();
    }
    
    useEffect(() => {
        if (isPlaying && mediaItems.length > 0) {
            playAll();
            intervalRef.current = window.setInterval(() => {
                setCurrentMediaIndex(prevIndex => {
                    const nextIndex = prevIndex + 1;
                    if (nextIndex >= mediaItems.length) {
                        setIsPlaying(false);
                        return 0;
                    }
                    return nextIndex;
                });
            }, 5000);
        } else {
            pauseAll();
            clearAnimation();
        }

        return () => clearAnimation();
    }, [isPlaying, mediaItems.length, clearAnimation]);
    
    useEffect(() => { if (narrationRef.current) narrationRef.current.volume = narrationVolume; }, [narrationVolume]);
    useEffect(() => { if (bgMusicRef.current) bgMusicRef.current.volume = bgMusicVolume; }, [bgMusicVolume]);
    useEffect(() => { if (sfxRef.current) sfxRef.current.volume = sfxVolume; }, [sfxVolume]);

    // Effects to stop preview playback when the source URL changes
    useEffect(() => {
        narrationRef.current?.pause();
        setIsPlayingNarration(false);
    }, [narrationUrl]);

    useEffect(() => {
        bgMusicRef.current?.pause();
        setIsPlayingBgMusic(false);
    }, [bgMusicUrl]);
    
    useEffect(() => {
        sfxRef.current?.pause();
        setIsPlayingSfx(false);
    }, [sfxUrl]);

    useEffect(() => {
        const loadFFmpeg = async () => {
            setFFmpegLoading(true);
            const ffmpegInstance = new FFmpeg();
            ffmpegInstance.on('log', ({ message }) => console.log(message));
            ffmpegInstance.on('progress', ({ progress }) => setFFmpegProgress(progress));
            
            const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd';
            await ffmpegInstance.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
            });
            setFFmpeg(ffmpegInstance);
            setFFmpegLoading(false);
        };

        if (!ffmpeg && !ffmpegLoading) {
            loadFFmpeg();
        }
    }, [ffmpeg, ffmpegLoading]);

    const handleGenerateFullRender = async () => {
        if (!ffmpeg) {
            setError("FFmpeg is not loaded yet. Please wait.");
            return;
        }
        if (!narrationScript.trim() || mediaItems.length === 0 || !narrationUrl) {
            setError("Please ensure script, scenes, and narration are generated.");
            return;
        }

        setIsLoading(true);
        setLoadingMessage("Starting full video render...");
        setError(null);

        try {
            // 1. Ensure narration is available as a file
            const narrationResponse = await fetch(narrationUrl);
            const narrationBlob = await narrationResponse.blob();
            const narrationArrayBuffer = await narrationBlob.arrayBuffer();
            const narrationUint8 = new Uint8Array(narrationArrayBuffer);
            ffmpeg.writeFile('narration.mp3', narrationUint8);

            // 2. Prepare media items (images/videos)
            const imageFiles: string[] = [];
            const videoFiles: string[] = [];
            const imageDurations: number[] = []; // Duration for each image in seconds

            for (let i = 0; i < mediaItems.length; i++) {
                const item = mediaItems[i];
                const fileName = `input_${i}.${item.type === 'image' ? 'png' : 'mp4'}`;
                
                setLoadingMessage(`Downloading scene ${i + 1}/${mediaItems.length}...`);
                const response = await fetch(item.url);
                const blob = await response.blob();
                const arrayBuffer = await blob.arrayBuffer();
                const uint8 = new Uint8Array(arrayBuffer);
                
                ffmpeg.writeFile(fileName, uint8);

                if (item.type === 'image') {
                    imageFiles.push(fileName);
                    imageDurations.push(5); // Default 5 seconds per image
                } else {
                    videoFiles.push(fileName);
                    // For videos, we'd ideally get the actual duration. For now, assume a default.
                    // A more robust solution would involve FFmpeg probing the video for duration.
                    imageDurations.push(item.duration || 5); 
                }
            }

            // 3. Combine images/videos into a single video stream
            setLoadingMessage("Compositing scenes...");
            const concatInput = imageFiles.map(f => `file '${f}'`).join('\n');
            ffmpeg.writeFile('concat.txt', new TextEncoder().encode(concatInput));

            await ffmpeg.exec([
                '-f', 'concat',
                '-safe', '0',
                '-i', 'concat.txt',
                '-vsync', 'vfr',
                '-pix_fmt', 'yuv420p',
                'temp_video.mp4'
            ]);

            // 4. Mix audio (narration, bgm, sfx)
            setLoadingMessage("Mixing audio tracks...");
            const audioInputs = ['-i', 'narration.mp3'];
            const audioFilters: string[] = [];

            if (bgMusicUrl) {
                const bgmResponse = await fetch(bgMusicUrl);
                const bgmBlob = await bgmResponse.blob();
                const bgmArrayBuffer = await bgmBlob.arrayBuffer();
                ffmpeg.writeFile('bgm.mp3', new Uint8Array(bgmArrayBuffer));
                audioInputs.push('-i', 'bgm.mp3');
                audioFilters.push(`[1:a]volume=${bgMusicVolume}[bgm]`);
            }
            if (sfxUrl) {
                const sfxResponse = await fetch(sfxUrl);
                const sfxBlob = await sfxResponse.blob();
                const sfxArrayBuffer = await sfxBlob.arrayBuffer();
                ffmpeg.writeFile('sfx.mp3', new Uint8Array(sfxArrayBuffer));
                audioInputs.push('-i', 'sfx.mp3');
                audioFilters.push(`[2:a]volume=${sfxVolume}[sfx]`);
            }

            let audioMixCommand = '';
            if (audioFilters.length > 0) {
                audioMixCommand = `-filter_complex "[0:a]volume=${narrationVolume}[nar];${audioFilters.join(';')}[nar][bgm][sfx]amix=inputs=${1 + (bgMusicUrl ? 1 : 0) + (sfxUrl ? 1 : 0)}:duration=longest[a]"`;
            } else {
                audioMixCommand = `-filter_complex "[0:a]volume=${narrationVolume}[a]"`;
            }

            await ffmpeg.exec([
                ...audioInputs,
                '-i', 'temp_video.mp4',
                audioMixCommand,
                '-map', '0:v', // Map video from temp_video.mp4
                '-map', '[a]', // Map mixed audio
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '23',
                '-c:a', 'aac',
                '-b:a', '192k',
                'output.mp4'
            ]);

            // 5. Read the output video and make it downloadable
            setLoadingMessage("Finalizing video...");
            const data = await ffmpeg.readFile('output.mp4');
            let videoBlob: Blob;
            if (typeof data === 'string') {
                // Convert string to Uint8Array (assuming UTF-8 encoding for the string content)
                const encoder = new TextEncoder();
                videoBlob = new Blob([encoder.encode(data)], { type: 'video/mp4' });
            } else if (data instanceof Uint8Array) {
                // Create a new Uint8Array from the existing one to ensure it's backed by a standard ArrayBuffer.
                // This effectively copies the data into a new, non-shared ArrayBuffer if it was shared.
                const newUint8Array = new Uint8Array(data);
                videoBlob = new Blob([newUint8Array], { type: 'video/mp4' });
            } else {
                throw new Error("FFmpeg returned unexpected data type for video.");
            }
            const videoUrl = URL.createObjectURL(videoBlob);

            // 6. Upload to Supabase
            setLoadingMessage("Uploading video to Supabase...");
            const supabaseVideoUrl = await uploadVideoFile(videoBlob, 'output.mp4', true, narrationScript);

            setLoadingMessage("Video render complete!");
            alert(`Video generated and uploaded to Supabase! You can download it from: ${videoUrl}`); // For testing
            window.open(supabaseVideoUrl, '_blank'); // Open in new tab for download

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            setError(`Video rendering failed: ${errorMessage}`);
            console.error("FFmpeg error:", err);
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
            setFFmpegProgress(0);
        }
    };

    const handlePreviewToggle = (type: 'narration' | 'bgm' | 'sfx') => {
        if (isPlaying) {
            setIsPlaying(false);
        }

        const toggles = {
            narration: { ref: narrationRef, isPlaying: isPlayingNarration, setIsPlaying: setIsPlayingNarration, loop: false },
            bgm: { ref: bgMusicRef, isPlaying: isPlayingBgMusic, setIsPlaying: setIsPlayingBgMusic, loop: true },
            sfx: { ref: sfxRef, isPlaying: isPlayingSfx, setIsPlaying: setIsPlayingSfx, loop: true },
        };

        const current = toggles[type];
        
        (Object.keys(toggles) as Array<keyof typeof toggles>).forEach(key => {
            if (key !== type && toggles[key].isPlaying) {
                toggles[key].ref.current?.pause();
                toggles[key].setIsPlaying(false);
            }
        });
        
        if (current.isPlaying) {
            current.ref.current?.pause();
            current.setIsPlaying(false);
        } else {
            if (current.ref.current) {
                current.ref.current.loop = current.loop;
                current.ref.current.currentTime = 0;
                current.ref.current.play().catch(console.error);
                current.setIsPlaying(true);
            }
        }
    };

    const updateSpeakersFromScript = (script: string) => {
        const speakerRegex = /^([a-zA-Z0-9_]+):/gm;
        const matches = script.match(speakerRegex);
        
        if (matches) {
            const uniqueSpeakers = [...new Set(matches.map(s => s.slice(0, -1)))];
            
            if (uniqueSpeakers.length > 0) {
                const newSpeakers = uniqueSpeakers.map((name, index) => {
                    const existingSpeaker = speakers.find(s => s.name === name);
                    const defaultVoice = TTS_VOICES[index % TTS_VOICES.length];
                    return {
                        id: Date.now() + index,
                        name: name,
                        voice: existingSpeaker?.voice || defaultVoice,
                    };
                });
                setSpeakers(newSpeakers);
            } else if (speakers.length > 1) {
                setSpeakers([{ id: Date.now(), name: 'Speaker 1', voice: 'Aoede' }]);
            }
        } else if (speakers.length > 1) {
            setSpeakers([{ id: Date.now(), name: 'Speaker 1', voice: 'Aoede' }]);
        }
    };


    const handleGenerateScenesFromScript = async () => {
        if (!narrationScript.trim()) {
            setError("Script cannot be empty to generate scenes.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setMediaItems([]);
        setCurrentMediaIndex(0);
        setIsPlaying(false);
        setThumbnailUrl(null);

        try {
            setLoadingMessage("AI is analyzing your script to create scene prompts...");
            const prompts = await generatePromptsFromScript(narrationScript);

            if (!prompts || prompts.length === 0) {
                throw new Error("The AI could not generate any scenes from the script. Try making it more descriptive.");
            }

            const generatedMedia: MediaItem[] = [];
            const totalMedia = prompts.length;
            
            const delayBetweenRequests = mediaSource === 'ai' ? 12 * 1000 : 3.5 * 1000;

            for (let i = 0; i < totalMedia; i++) {
                const remaining = totalMedia - (i);
                const remainingTime = Math.ceil((remaining * delayBetweenRequests) / (1000 * 60));
                
                let loadingText = `Generating scene ${i + 1}/${totalMedia}...`;
                if(mediaSource !== 'ai') loadingText = `Searching Pexels for scene ${i + 1}/${totalMedia}...`

                setLoadingMessage(
                    `${loadingText}\n(Pacing requests to avoid API rate limits. Approx. ${remainingTime} min remaining)`
                );

                let newItem: MediaItem | null = null;
                
                switch (mediaSource) {
                    case 'ai':
                        const fullPrompt = `${prompts[i]} ${STYLE_PROMPT_ADDITION}`;
                        const imageUrl = await generateCinematicImage(fullPrompt);
                        newItem = { type: 'image', url: imageUrl };
                        break;
                    
                    case 'pexels_photo':
                        const photoResponse = await searchPexelsPhotos(prompts[i]);
                        if (photoResponse.photos && photoResponse.photos.length > 0) {
                            const photo = photoResponse.photos[0];
                            newItem = { type: 'image', url: photo.src.large2x };
                        }
                        break;
                        
                    case 'pexels_video':
                        const videoResponse = await searchPexelsVideos(prompts[i]);
                        if (videoResponse.videos && videoResponse.videos.length > 0) {
                            const video = videoResponse.videos[0];
                            const videoFile = video.video_files.find(f => f.quality === 'hd') || video.video_files[0];
                            const thumbnail = video.video_pictures[0]?.picture;
                            if (videoFile) {
                                newItem = { type: 'video', url: videoFile.link, thumbnailUrl: thumbnail };
                            }
                        }
                        break;
                }

                if (newItem) {
                    generatedMedia.push(newItem);
                    setMediaItems([...generatedMedia]);
                } else {
                    console.warn(`Could not find media for prompt: "${prompts[i]}"`);
                }

                if (i < totalMedia - 1) {
                    await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
                setError('API rate limit exceeded. This can happen on the free tier. Please wait a minute and try again, or check your billing details. The generation process has been stopped.');
            } else {
                setError(errorMessage);
            }
            console.error(err);
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };

    const handleEnhanceScript = async () => {
        if (!narrationScript.trim()) {
            setError("Script is empty. Please write something to enhance.");
            return;
        }
        setIsLoading(true);
        setLoadingMessage("Enhancing script with AI...");
        setError(null);
        try {
            const enhanced = await enhanceScript(narrationScript, SCRIPT_ENHANCER_SYSTEM_PROMPT);
            setNarrationScript(enhanced);
            updateSpeakersFromScript(enhanced);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to enhance script.');
            console.error(err);
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };
    
    const handleGenerateScriptFromTopic = async () => {
        if (!narrationScript.trim()) {
            setError("Script topic cannot be empty.");
            return;
        }
        setIsLoading(true);
        setLoadingMessage("AI is writing your script...");
        setError(null);
        try {
            const fullScript = await generateFullScript(narrationScript);
            setNarrationScript(fullScript);
            updateSpeakersFromScript(fullScript);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate script.');
            console.error(err);
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };
    
    const handleGenerateThumbnail = async () => {
        if (mediaItems.length === 0) {
            setError("Please generate scenes first to create a thumbnail.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            setLoadingMessage("AI is crafting a viral title...");
            const title = await generateVideoTitle(narrationScript);
    
            setLoadingMessage("Applying title to thumbnail...");
            const baseImageUrl = mediaItems[0].thumbnailUrl || mediaItems[0].url;
            const finalThumbnail = await overlayTextOnImage(baseImageUrl, title);
            
            setThumbnailUrl(finalThumbnail);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate thumbnail.');
            console.error(err);
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };

    const handleThumbnailUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setError(null);
            try {
                const { base64, mimeType } = await fileToBase64(file);
                const dataUrl = `data:${mimeType};base64,${base64}`;
                setThumbnailUrl(dataUrl);
            } catch (err)
                {
                setError("Failed to load custom thumbnail.");
                console.error(err);
            }
        }
    };

    const handleSpeakerUpdate = (id: number, field: 'name' | 'voice', value: string) => {
        setSpeakers(speakers.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const addSpeaker = () => {
        const defaultVoiceSequence = ['Aoede', 'Orus', 'Kore', 'Charon'];
        const nextIndex = speakers.length;
        let nextVoice: string;

        const usedVoices = new Set(speakers.map(s => s.voice));

        if (nextIndex < defaultVoiceSequence.length && !usedVoices.has(defaultVoiceSequence[nextIndex])) {
            nextVoice = defaultVoiceSequence[nextIndex];
        } else {
            const availableVoices = TTS_VOICES.filter(v => !usedVoices.has(v));
            nextVoice = availableVoices.length > 0 ? availableVoices[0] : TTS_VOICES[nextIndex % TTS_VOICES.length];
        }

        const newSpeaker = {
            id: Date.now(),
            name: `Speaker ${nextIndex + 1}`,
            voice: nextVoice,
        };
        setSpeakers([...speakers, newSpeaker]);
    };

    const removeSpeaker = (id: number) => {
        setSpeakers(speakers.filter(s => s.id !== id));
    };

    const handleGenerateNarration = async () => {
        if (!narrationScript.trim()) {
            setError("Narration script cannot be empty.");
            return;
        }
        setIsLoading(true);
        setLoadingMessage("Generating AI narration...");
        setError(null);
        try {
            const speakerConfigs = speakers.length === 1
                ? [{ voiceName: speakers[0].voice }]
                : speakers.map(s => ({ speaker: s.name, voiceName: s.voice }));

            const base64Audio = await generateSpeech(narrationScript, speakerConfigs);
            const blobUrl = await createAudioBlobUrl(base64Audio);
            setNarrationUrl(blobUrl);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate narration.');
            console.error(err);
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };
    
    const handleGenerateAudio = async (prompt: string, type: 'bgm' | 'sfx') => {
        if (!prompt.trim()) return;
        setIsLoading(true);
        setLoadingMessage(`AI is generating ${type === 'bgm' ? 'music' : 'sound effect'}...`);
        setError(null);
        try {
            const base64 = await generateInstrumentalAudio(prompt);
            const cleanPrompt = prompt.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 30);
            const file = await createAudioFileFromBase64(base64, `${cleanPrompt}.wav`);
            const publicUrl = await uploadAudioFile(file, type, true, prompt);
            
            if (type === 'bgm') {
                setBgMusicSamples(prev => [{ name: file.name, path: publicUrl }, ...prev.filter(s => s.path !== '')]);
                setBgMusicUrl(publicUrl);
            } else {
                setSfxSamples(prev => [{ name: file.name, path: publicUrl }, ...prev.filter(s => s.path !== '')]);
                setSfxUrl(publicUrl);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Audio generation failed.');
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };
    
    const handleUploadAudio = async (file: File, type: 'bgm' | 'sfx') => {
        setIsLoading(true);
        setLoadingMessage(`Uploading ${file.name}...`);
        setError(null);
        try {
            const publicUrl = await uploadAudioFile(file, type);
            if (type === 'bgm') {
                setBgMusicSamples(prev => [{ name: file.name, path: publicUrl }, ...prev.filter(s => s.path !== '')]);
                setBgMusicUrl(publicUrl);
            } else {
                setSfxSamples(prev => [{ name: file.name, path: publicUrl }, ...prev.filter(s => s.path !== '')]);
                setSfxUrl(publicUrl);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Audio upload failed.');
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };


    const handleNarrationUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setError(null);
            setIsLoading(true);
            try {
                setLoadingMessage(`Processing ${file.name}...`);
                const { base64, mimeType } = await fileToBase64(file);
                const dataUrl = `data:${mimeType};base64,${base64}`;
                setNarrationUrl(dataUrl);
    
                setLoadingMessage(`Transcribing ${file.name}...`);
                const transcript = await transcribeAudio(base64, mimeType);
                
                setLoadingMessage('Enhancing transcript...');
                const enhancedTranscript = await enhanceScript(transcript, SCRIPT_ENHANCER_SYSTEM_PROMPT);

                setNarrationScript(enhancedTranscript);
                updateSpeakersFromScript(enhancedTranscript);

            } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to process audio file.";
                setError(message);
                console.error(err);
            } finally {
                setIsLoading(false);
                setLoadingMessage('');
            }
        }
    };
    
    const togglePlay = () => {
        if (!mediaItems.length || !narrationUrl) {
            setError("Please generate scenes and provide narration audio before playing.");
            return;
        }
        
        // Stop any previews
        if (isPlayingNarration) handlePreviewToggle('narration');
        if (isPlayingBgMusic) handlePreviewToggle('bgm');
        if (isPlayingSfx) handlePreviewToggle('sfx');

        // Reset loops for main playback
        if(bgMusicRef.current) bgMusicRef.current.loop = true;
        if(sfxRef.current) sfxRef.current.loop = true;

        if (currentMediaIndex >= mediaItems.length - 1 || (!isPlaying && narrationRef.current?.ended)) {
            setCurrentMediaIndex(0);
            if (narrationRef.current) narrationRef.current.currentTime = 0;
            if (bgMusicRef.current) bgMusicRef.current.currentTime = 0;
            if (sfxRef.current) sfxRef.current.currentTime = 0;
        }
        setIsPlaying(!isPlaying);
    };

    const handleSamplePromptChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedIndexString = e.target.value;
        setSelectedSample(selectedIndexString);
        if (selectedIndexString) {
            const index = parseInt(selectedIndexString, 10);
            const prompt = samplePrompts[index];
            if (prompt) {
                setNarrationScript(prompt.script);
                updateSpeakersFromScript(prompt.script);
            }
        } else {
            setNarrationScript('');
            setSpeakers([{ id: Date.now(), name: 'Speaker 1', voice: 'Aoede' }]);
        }
    };

    const MediaSourceButton: React.FC<{source: MediaSource, label: string}> = ({ source, label }) => (
        <button
            onClick={() => setMediaSource(source)}
            className={`px-3 py-2 text-sm rounded-md transition-colors flex-1 ${mediaSource === source ? 'bg-primary text-[#050509] font-semibold' : 'bg-bg hover:bg-surface-alt font-medium'}`}
        >
            {label}
        </button>
    );

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Controls */}
                <div className="bg-surface p-6 rounded-lg shadow-soft space-y-6">
                    <h2 className="text-2xl font-bold text-main font-display">1. Create Your Story</h2>
                    
                    <div className="space-y-2">
                        <label htmlFor="sample-prompts" className="block text-md font-semibold text-main">Sample Prompts</label>
                        <select
                            id="sample-prompts"
                            value={selectedSample}
                            onChange={handleSamplePromptChange}
                            className="w-full p-2.5 bg-bg border border-border-strong rounded-lg focus:ring-2 focus:ring-primary/50 focus:outline-none appearance-none pr-8 select-arrow-bg"
                            aria-label="Select a sample prompt"
                        >
                            <option value="">-- Select a sample to get started --</option>
                            {samplePrompts.map((prompt, index) => (
                                <option key={index} value={index}>
                                    {prompt.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="narration" className="block text-lg font-semibold text-main">Script Topic or Full Script</label>
                        <textarea
                            id="narration"
                            value={narrationScript}
                            onChange={(e) => setNarrationScript(e.target.value)}
                            rows={4}
                            className="w-full p-3 bg-bg border border-border-strong rounded-lg focus:ring-2 focus:ring-primary/50 focus:outline-none"
                            placeholder="Enter a topic to generate a script, or paste your full script here..."
                        />
                         <div className="flex flex-col sm:flex-row gap-2 pt-2">
                            <button
                                onClick={handleGenerateScriptFromTopic}
                                disabled={isLoading || !narrationScript}
                                className="flex-1 flex items-center justify-center gap-2 bg-surface-alt hover:bg-primary/10 text-main font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-surface-alt disabled:text-text-disabled"
                            >
                                <SparklesIcon className="w-5 h-5" /> Generate Script
                            </button>
                            <button
                                onClick={handleEnhanceScript}
                                disabled={isLoading || !narrationScript}
                                className="flex-1 flex items-center justify-center gap-2 bg-surface-alt hover:bg-primary/10 text-main font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-surface-alt disabled:text-text-disabled"
                            >
                                <WandIcon className="w-5 h-5" /> Enhance Script
                            </button>
                         </div>
                    </div>

                    <div className='space-y-3'>
                        <label className="block text-lg font-semibold text-main">Media Source</label>
                        <div className="flex items-center gap-1 p-1 bg-bg rounded-lg border border-border-strong">
                            <MediaSourceButton source="ai" label="AI Generated" />
                            <MediaSourceButton source="pexels_photo" label="Pexels Photos" />
                            <MediaSourceButton source="pexels_video" label="Pexels Videos" />
                        </div>
                         {isPexelsKeyMissing && (
                            <div className="bg-warning/10 border border-warning text-warning px-4 py-3 rounded-lg text-sm" role="alert">
                                <strong>Configuration Needed:</strong> A Pexels API key is required. Please set <code>PEXELS_API_KEY</code> in your environment file.
                            </div>
                        )}
                    </div>

                     <button
                        onClick={handleGenerateScenesFromScript}
                        disabled={isLoading || !narrationScript.trim() || isPexelsKeyMissing}
                        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-opacity-80 text-[#050509] font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-surface-alt disabled:text-text-disabled disabled:cursor-not-allowed"
                    >
                       <FilmIcon className="w-5 h-5"/> Generate Scenes from Script
                    </button>

                    <button
                        onClick={handleGenerateFullRender}
                        disabled={isLoading || !narrationScript.trim() || mediaItems.length === 0 || !narrationUrl || ffmpegLoading}
                        className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-opacity-80 text-[#050509] font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-surface-alt disabled:text-text-disabled disabled:cursor-not-allowed"
                    >
                        <RocketLaunchIcon className="w-5 h-5"/> Generate Full Render
                    </button>
                    
                    <div className="space-y-3 pt-4">
                        <h3 className="text-lg font-semibold text-main">2. Customize Audio</h3>
                        <div className="space-y-4">
                            {speakers.map((speaker) => (
                                <div key={speaker.id} className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end p-3 bg-bg rounded-lg">
                                    {speakers.length > 1 && (
                                        <div>
                                            <label htmlFor={`speaker-name-${speaker.id}`} className="block text-sm font-medium text-text-muted mb-1">Speaker Name</label>
                                            <input
                                                id={`speaker-name-${speaker.id}`}
                                                type="text"
                                                value={speaker.name}
                                                onChange={(e) => handleSpeakerUpdate(speaker.id, 'name', e.target.value)}
                                                className="w-full p-2 bg-bg border border-border-strong rounded-lg focus:ring-2 focus:ring-primary/50 focus:outline-none"
                                                placeholder={`e.g., ${speaker.name}`}
                                            />
                                        </div>
                                    )}
                                    <div className={speakers.length > 1 ? '' : 'sm:col-span-2'}>
                                        <label htmlFor={`voice-select-${speaker.id}`} className="block text-sm font-medium text-text-muted mb-1">
                                            {speakers.length > 1 ? `Voice for ${speaker.name}` : 'Voice'}
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <select
                                                id={`voice-select-${speaker.id}`}
                                                value={speaker.voice}
                                                onChange={(e) => handleSpeakerUpdate(speaker.id, 'voice', e.target.value)}
                                                className="w-full p-2 bg-bg border border-border-strong rounded-lg focus:ring-2 focus:ring-primary/50 focus:outline-none appearance-none pr-8 select-arrow-bg"
                                                aria-label={`Select voice for ${speaker.name}`}
                                            >
                                                {TTS_VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                                            </select>
                                            {speakers.length > 1 && (
                                                <button onClick={() => removeSpeaker(speaker.id)} className="p-2 text-text-muted hover:text-error transition-colors" aria-label={`Remove ${speaker.name}`}>
                                                    <XCircleIcon className="w-6 h-6" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={addSpeaker}
                                className="w-full text-sm bg-surface-alt hover:bg-primary/10 text-main font-semibold py-2 px-4 rounded-lg transition duration-300"
                            >
                                + Add Another Speaker
                            </button>
                            {speakers.length > 1 && (
                                <p className="text-xs text-text-subtle text-center">
                                    Your script must use these speaker names (e.g., '{speakers[0].name}: Hello.').
                                </p>
                            )}
                        </div>

                        <button
                            onClick={handleGenerateNarration}
                            disabled={isLoading || !narrationScript}
                            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-opacity-80 text-[#050509] font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-surface-alt disabled:text-text-disabled"
                        >
                            <SpeakerWaveIcon className="w-5 h-5" /> Generate Narration
                        </button>
                    </div>
                    
                    <div className="relative flex items-center">
                        <div className="flex-grow border-t border-divider"></div>
                        <span className="flex-shrink mx-4 text-text-muted">OR</span>
                        <div className="flex-grow border-t border-divider"></div>
                    </div>
                    
                     <div className='space-y-4'>
                        <div>
                            <label htmlFor={`narration-upload`} className="block text-md font-semibold text-main mb-2">Upload Narration & Transcribe</label>
                            <input
                                id={`narration-upload`}
                                type="file"
                                accept="audio/*"
                                onChange={handleNarrationUpload}
                                className="block w-full text-sm text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/80 file:text-[#050509] hover:file:bg-primary"
                                disabled={isLoading}
                            />
                        </div>

                        {narrationUrl && (
                            <div className="p-3 bg-bg rounded-lg border border-border-strong animate-fade-in">
                                <label className="block text-md font-semibold text-main mb-2">Narration Preview</label>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => handlePreviewToggle('narration')} className="p-2 rounded-full hover:bg-surface-alt transition-colors" aria-label={`Play or pause narration`}>
                                        {isPlayingNarration ? <PauseIcon className="w-5 h-5 text-text-main" /> : <PlayIcon className="w-5 h-5 text-text-main" />}
                                    </button>
                                    <SpeakerWaveIcon className="w-5 h-5 text-text-muted" />
                                    <input
                                        type="range" min="0" max="1" step="0.05"
                                        value={narrationVolume}
                                        onChange={e => setNarrationVolume(parseFloat(e.target.value))}
                                        className="w-full h-2 bg-bg rounded-lg appearance-none cursor-pointer range-thumb:bg-primary"
                                        aria-label="Narration volume"
                                    />
                                </div>
                            </div>
                        )}

                        <AdvancedAudioControl
                            title="Background Music"
                            type="bgm"
                            audioUrl={bgMusicUrl}
                            onUrlChange={setBgMusicUrl}
                            volume={bgMusicVolume}
                            onVolumeChange={setBgMusicVolume}
                            samples={bgMusicSamples}
                            isPlaying={isPlayingBgMusic}
                            onTogglePlay={() => handlePreviewToggle('bgm')}
                            onGenerate={handleGenerateAudio}
                            onUpload={handleUploadAudio}
                            disabled={isLoading}
                        />
                        <AdvancedAudioControl
                            title="Sound Effects"
                            type="sfx"
                            audioUrl={sfxUrl}
                            onUrlChange={setSfxUrl}
                            volume={sfxVolume}
                            onVolumeChange={setSfxVolume}
                            samples={sfxSamples}
                            isPlaying={isPlayingSfx}
                            onTogglePlay={() => handlePreviewToggle('sfx')}
                            onGenerate={handleGenerateAudio}
                            onUpload={handleUploadAudio}
                            disabled={isLoading}
                        />
                     </div>

                     {mediaItems.length > 0 && !isLoading && (
                        <div className="bg-surface-alt p-4 rounded-lg space-y-4 mt-4 animate-fade-in border border-border-strong">
                            <h3 className="text-lg font-semibold text-main">3. Finalize Thumbnail</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <button
                                    onClick={handleGenerateThumbnail}
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-opacity-80 text-[#050509] font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-surface-alt disabled:text-text-disabled"
                                >
                                    <SparklesIcon className="w-5 h-5"/> Generate AI Thumbnail
                                </button>
                                <div>
                                    <label htmlFor="thumbnail-upload" className="w-full cursor-pointer flex items-center justify-center gap-2 bg-bg hover:bg-surface text-main font-bold py-3 px-4 rounded-lg transition duration-300 border border-border-strong">
                                        <ArrowUpTrayIcon className="w-5 h-5" /> Upload Custom
                                    </label>
                                    <input
                                        id="thumbnail-upload"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleThumbnailUpload}
                                        className="hidden"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Previewer */}
                <div className="bg-surface p-6 rounded-lg shadow-soft flex flex-col justify-between">
                    <h2 className="text-2xl font-bold text-main mb-4 font-display">4. Preview & Play</h2>
                    <div className="aspect-video bg-black rounded-md overflow-hidden relative flex items-center justify-center text-text-muted">
                       {isPlaying && mediaItems.length > 0 ? (
                            mediaItems.map((item, index) => (
                                item.type === 'video' ? (
                                    <video
                                        key={item.url}
                                        src={item.url}
                                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
                                            currentMediaIndex === index ? 'opacity-100' : 'opacity-0'
                                        }`}
                                        autoPlay
                                        muted
                                        loop
                                    />
                                ) : (
                                    <img
                                        key={item.url}
                                        src={item.url}
                                        alt={`Scene ${index + 1}`}
                                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
                                            currentMediaIndex === index ? 'opacity-100' : 'opacity-0'
                                        }`}
                                    />
                                )
                            ))
                        ) : thumbnailUrl ? (
                           <img src={thumbnailUrl} alt="Video Thumbnail" className="absolute inset-0 w-full h-full object-cover" />
                        ) : mediaItems.length > 0 ? (
                            <img src={mediaItems[0].thumbnailUrl || mediaItems[0].url} alt={`Scene 1`} className="absolute inset-0 w-full h-full object-cover"/>
                        ) : (
                            <div className="text-center">
                                <FilmIcon className="w-16 h-16 mx-auto text-primary/50"/>
                                <p>Your video will appear here</p>
                            </div>
                        )}
                        {isLoading && (
                            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                <Spinner message={loadingMessage} />
                            </div>
                        )}
                    </div>
                    <div className="mt-4">
                        {narrationUrl && (
                            <audio
                                key={narrationUrl}
                                ref={narrationRef}
                                src={narrationUrl}
                                onEnded={() => {
                                    setIsPlaying(false);
                                    setIsPlayingNarration(false);
                                }}
                                crossOrigin="anonymous"
                            />
                        )}
                        {bgMusicUrl && <audio key={bgMusicUrl} ref={bgMusicRef} src={bgMusicUrl} loop crossOrigin="anonymous" />}
                        {sfxUrl && <audio key={sfxUrl} ref={sfxRef} src={sfxUrl} loop crossOrigin="anonymous" />}
                        <div className="flex items-center justify-center gap-4">
                            <button onClick={togglePlay} disabled={!mediaItems.length || !narrationUrl || isLoading} className="p-4 bg-primary rounded-full text-[#050509] disabled:bg-surface-alt disabled:text-text-disabled disabled:cursor-not-allowed hover:bg-opacity-80 transition">
                                {isPlaying ? <PauseIcon className="w-8 h-8"/> : <PlayIcon className="w-8 h-8"/>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {error && <div className="bg-error/10 border border-error text-error px-4 py-3 rounded-lg" role="alert">{error}</div>}
            
            {mediaItems.length > 0 && (
                 <div>
                     <h3 className="text-xl font-bold text-main mt-8 mb-4">Generated Scenes</h3>
                     <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                         {mediaItems.map((item, index) => (
                             <img 
                                key={index} 
                                src={item.thumbnailUrl || item.url} 
                                alt={`Generated scene ${index + 1}`} 
                                className={`rounded-lg shadow-lg aspect-video object-cover border-2 transition-all ${currentMediaIndex === index && isPlaying ? 'border-primary scale-105' : 'border-transparent'}`} />
                         ))}
                     </div>
                </div>
            )}
        </div>
    );
};
