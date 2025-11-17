
import React, { useState } from 'react';
import { GenerateContentResponse } from '@google/genai';
import { quickResponse, groundedSearch, groundedMapsSearch } from '../services/geminiService';
import type { GroundingMetadata, GeolocationCoordinates } from '../types';
import { Spinner } from './Spinner';

type SearchType = 'fast' | 'web' | 'maps';

export const ResearchAssistant: React.FC = () => {
    const [prompt, setPrompt] = useState<string>('');
    const [searchType, setSearchType] = useState<SearchType>('web');
    const [result, setResult] = useState<string | null>(null);
    const [sources, setSources] = useState<GroundingMetadata | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async () => {
        if (!prompt.trim()) {
            setError("Please enter a prompt.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setResult(null);
        setSources(null);

        try {
            let response: string | GenerateContentResponse;
            if (searchType === 'fast') {
                response = await quickResponse(prompt);
                setResult(response);
            } else if (searchType === 'web') {
                response = await groundedSearch(prompt);
                setResult(response.text);
                setSources(response.candidates?.[0]?.groundingMetadata as GroundingMetadata);
            } else if (searchType === 'maps') {
                const location = await new Promise<GeolocationCoordinates>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(
                        (position) => resolve(position.coords),
                        (err) => reject(new Error(`Geolocation error: ${err.message}`))
                    );
                });
                response = await groundedMapsSearch(prompt, location);
                setResult(response.text);
                setSources(response.candidates?.[0]?.groundingMetadata as GroundingMetadata);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };
    
    const SearchTypeButton: React.FC<{type: SearchType, label: string}> = ({ type, label }) => (
        <button
            onClick={() => setSearchType(type)}
            className={`px-4 py-2 text-sm rounded-md transition-colors flex-1 ${searchType === type ? 'bg-primary text-[#050509] font-semibold' : 'bg-bg hover:bg-surface-alt font-medium'}`}
        >
            {label}
        </button>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-surface p-6 rounded-lg shadow-soft space-y-4">
                <h2 className="text-2xl font-bold text-main font-display">AI Research Assistant</h2>
                <div className="flex items-center gap-2 p-1 bg-bg rounded-lg border border-border-strong">
                    <SearchTypeButton type="web" label="Web Search" />
                    <SearchTypeButton type="maps" label="Maps Search" />
                    <SearchTypeButton type="fast" label="Fast Response" />
                </div>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={3}
                    className="w-full p-3 bg-bg border border-border-strong rounded-lg focus:ring-2 focus:ring-primary/50 focus:outline-none"
                    placeholder={
                        searchType === 'maps' ? "e.g., Good Italian restaurants nearby" :
                        searchType === 'web' ? "e.g., Who won the latest F1 race?" :
                        "e.g., Explain quantum computing simply"
                    }
                />
                <button
                    onClick={handleSearch}
                    disabled={isLoading}
                    className="w-full bg-primary hover:bg-opacity-80 text-[#050509] font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-surface-alt disabled:text-text-disabled"
                >
                    {isLoading ? 'Searching...' : 'Ask AI'}
                </button>
            </div>
            
            {error && <div className="bg-error/10 border border-error text-error px-4 py-3 rounded-lg" role="alert">{error}</div>}

            <div className="bg-surface p-6 rounded-lg shadow-soft min-h-[200px]">
                <h3 className="text-xl font-bold text-main mb-4">Response</h3>
                {isLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <Spinner message="Thinking..." />
                    </div>
                ) : (
                    result && (
                        <div className="space-y-4 animate-fade-in">
                            <p className="text-main whitespace-pre-wrap">{result}</p>
                            {sources && sources.groundingChunks?.length > 0 && (
                                <div>
                                    <h4 className="text-lg font-semibold text-text-muted mt-6 mb-2">Sources:</h4>
                                    <ul className="list-disc list-inside space-y-2">
                                        {sources.groundingChunks.map((chunk, index) => {
                                            const source = chunk.web || chunk.maps;
                                            return source?.uri ? (
                                                <li key={index}>
                                                    <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                                        {source.title || source.uri}
                                                    </a>
                                                </li>
                                            ) : null;
                                        })}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )
                )}
            </div>
        </div>
    );
};