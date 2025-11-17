
import React, { useState } from 'react';
import { editImage, analyzeImage } from '../services/geminiService';
import { fileToBase64 } from '../utils/file';
import { Spinner } from './Spinner';
import { ArrowPathIcon, SparklesIcon } from './Icons';

export const ImageEditor: React.FC = () => {
    const [originalImage, setOriginalImage] = useState<{ url: string; base64: string; mimeType: string } | null>(null);
    const [editedImage, setEditedImage] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<string>('');
    const [editPrompt, setEditPrompt] = useState<string>('Add a retro filter');
    const [analyzePrompt, setAnalyzePrompt] = useState<string>('Describe this image in detail.');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingAction, setLoadingAction] = useState<'edit' | 'analyze' | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setOriginalImage(null);
            setEditedImage(null);
            setAnalysis('');
            setError(null);
            const imageUrl = URL.createObjectURL(file);
            const { base64, mimeType } = await fileToBase64(file);
            setOriginalImage({ url: imageUrl, base64, mimeType });
        }
    };

    const handleEditImage = async () => {
        if (!originalImage || !editPrompt.trim()) {
            setError("Please upload an image and provide an edit prompt.");
            return;
        }
        setIsLoading(true);
        setLoadingAction('edit');
        setError(null);
        setEditedImage(null);
        try {
            const result = await editImage(originalImage.base64, originalImage.mimeType, editPrompt);
            setEditedImage(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to edit image.");
            console.error(err);
        } finally {
            setIsLoading(false);
            setLoadingAction(null);
        }
    };
    
    const handleAnalyzeImage = async () => {
        if (!originalImage || !analyzePrompt.trim()) {
            setError("Please upload an image and provide an analysis prompt.");
            return;
        }
        setIsLoading(true);
        setLoadingAction('analyze');
        setError(null);
        setAnalysis('');
        try {
            const result = await analyzeImage(originalImage.base64, originalImage.mimeType, analyzePrompt);
            setAnalysis(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to analyze image.");
            console.error(err);
        } finally {
            setIsLoading(false);
            setLoadingAction(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-surface p-6 rounded-lg shadow-soft">
                 <h2 className="text-2xl font-bold text-main mb-4 font-display">Upload Your Image</h2>
                 <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-[#050509] hover:file:bg-primary/80"
                 />
            </div>
            
            {error && <div className="bg-error/10 border border-error text-error px-4 py-3 rounded-lg" role="alert">{error}</div>}

            {originalImage && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                    {/* Image Previews */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                             <h3 className="text-lg font-semibold text-main">Original</h3>
                             <img src={originalImage.url} alt="Original" className="w-full rounded-lg shadow-md aspect-square object-cover" />
                        </div>
                         <div className="space-y-2">
                             <h3 className="text-lg font-semibold text-main">Edited</h3>
                             <div className="w-full rounded-lg shadow-md aspect-square object-cover bg-bg flex items-center justify-center">
                                {loadingAction === 'edit' && isLoading ? <Spinner message="Editing..." /> : (
                                    editedImage ? <img src={editedImage} alt="Edited" className="w-full h-full rounded-lg object-cover" /> : <div className="text-text-muted">Your edited image will appear here.</div>
                                )}
                             </div>
                        </div>
                    </div>
                    
                    {/* Actions and Analysis */}
                    <div className="space-y-6">
                        {/* Edit Action */}
                        <div className="bg-surface p-4 rounded-md">
                            <label htmlFor="edit-prompt" className="block text-lg font-semibold text-main mb-2">Edit Prompt</label>
                            <input
                                id="edit-prompt"
                                type="text"
                                value={editPrompt}
                                onChange={(e) => setEditPrompt(e.target.value)}
                                className="w-full p-2 bg-bg border border-border-strong rounded-lg focus:ring-2 focus:ring-primary/50 focus:outline-none"
                                placeholder="e.g., Make it black and white"
                            />
                            <button onClick={handleEditImage} disabled={isLoading} className="mt-3 w-full flex items-center justify-center gap-2 bg-primary hover:bg-opacity-80 text-[#050509] font-bold py-2 px-4 rounded-lg transition duration-300 disabled:bg-surface-alt disabled:text-text-disabled">
                                <ArrowPathIcon className="w-5 h-5"/> Edit Image
                            </button>
                        </div>
                        
                        {/* Analyze Action */}
                         <div className="bg-surface p-4 rounded-md">
                            <label htmlFor="analyze-prompt" className="block text-lg font-semibold text-main mb-2">Analysis Prompt</label>
                             <input
                                id="analyze-prompt"
                                type="text"
                                value={analyzePrompt}
                                onChange={(e) => setAnalyzePrompt(e.target.value)}
                                className="w-full p-2 bg-bg border border-border-strong rounded-lg focus:ring-2 focus:ring-primary/50 focus:outline-none"
                                placeholder="e.g., What is in this image?"
                            />
                            <button onClick={handleAnalyzeImage} disabled={isLoading} className="mt-3 w-full flex items-center justify-center gap-2 bg-primary hover:bg-opacity-80 text-[#050509] font-bold py-2 px-4 rounded-lg transition duration-300 disabled:bg-surface-alt disabled:text-text-disabled">
                               <SparklesIcon className="w-5 h-5"/> Analyze Image
                            </button>
                            <div className="mt-4">
                                <h3 className="text-lg font-semibold text-main mb-2">AI Analysis</h3>
                                <div className="w-full p-3 h-32 overflow-y-auto bg-bg border border-border-strong rounded-lg">
                                     {loadingAction === 'analyze' && isLoading ? <Spinner message="Analyzing..." /> : (
                                        analysis ? <p className="text-text-muted whitespace-pre-wrap">{analysis}</p> : <p className="text-text-subtle">Analysis results will appear here.</p>
                                     )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};