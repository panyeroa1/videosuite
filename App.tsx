import React, { useState, useEffect } from 'react';
import { VideoCreator } from './components/VideoCreator';
import { ImageEditor } from './components/ImageEditor';
import { ResearchAssistant } from './components/ResearchAssistant';
import { AudioTranscriber } from './components/AudioTranscriber';
import { FilmIcon, PencilIcon, GlobeAltIcon, SunIcon, MoonIcon, MicrophoneIcon } from './components/Icons';

type Tab = 'creator' | 'editor' | 'research' | 'transcriber';
type Theme = 'light' | 'dark';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('creator');
  const [theme, setTheme] = useState<Theme>(localStorage.getItem('theme') as Theme || 'dark');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'creator':
        return <VideoCreator />;
      case 'editor':
        return <ImageEditor />;
      case 'research':
        return <ResearchAssistant />;
      case 'transcriber':
        return <AudioTranscriber />;
      default:
        return null;
    }
  };
  
  const TabButton: React.FC<{tabName: Tab, label: string, icon: React.ReactNode}> = ({tabName, label, icon}) => {
    const activeClasses = theme === 'light'
      ? 'bg-bg text-main'
      : 'bg-surface text-main shadow-md';
    
    const inactiveClasses = 'bg-transparent text-text-subtle hover:bg-surface-alt hover:text-main';

    return (
      <button
        onClick={() => setActiveTab(tabName)}
        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-md transition-all duration-300 ease-in-out w-full md:w-auto text-sm md:text-base font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 ${
          activeTab === tabName ? activeClasses : inactiveClasses
        }`}
      >
        {icon}
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-bg text-text-muted font-sans flex flex-col">
      <header className="bg-bg/80 backdrop-blur-sm sticky top-0 z-10 w-full border-b border-border-strong">
        <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-3 mb-4 md:mb-0">
             <img src="https://eburon.ai/assets/icon.png" alt="Eburon Media Suite Logo" className="w-8 h-8" />
             <h1 className="text-2xl font-bold text-main font-display">Eburon Media Suite</h1>
          </div>
          <div className="flex items-center gap-2">
            <nav className="bg-surface dark:bg-transparent flex flex-col sm:flex-row w-full md:w-auto rounded-md border border-border-strong p-1 space-y-2 sm:space-y-0 sm:space-x-1">
              <TabButton tabName="creator" label="Video Creator" icon={<FilmIcon className="w-5 h-5" />} />
              <TabButton tabName="editor" label="Image Studio" icon={<PencilIcon className="w-5 h-5" />} />
              <TabButton tabName="research" label="AI Research" icon={<GlobeAltIcon className="w-5 h-5" />} />
              <TabButton tabName="transcriber" label="Audio Transcriber" icon={<MicrophoneIcon className="w-5 h-5" />} />
            </nav>
            <button
                onClick={toggleTheme}
                className="p-2 rounded-md hover:bg-surface-alt focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Toggle theme"
              >
                {theme === 'light' ? (
                  <MoonIcon className="w-6 h-6 text-text-muted" />
                ) : (
                  <SunIcon className="w-6 h-6 text-text-muted" />
                )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4 md:p-6">
        <div className="animate-fade-in">
          {renderTabContent()}
        </div>
      </main>
      
      <footer className="w-full text-center p-4 border-t border-border-strong mt-8">
        <p className="text-sm text-text-subtle">&copy; {new Date().getFullYear()} Eburon Media Suite. Powered by AI.</p>
      </footer>
    </div>
  );
};