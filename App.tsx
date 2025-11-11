
import React, { useState } from 'react';
import { DeepSeekAgent } from './components/DeepSeekAgent';
import { ChatBot } from './components/ChatBot';
import { MessageSquare, Zap } from 'lucide-react';

const App: React.FC = () => {
    const [isChatOpen, setIsChatOpen] = useState(true);

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col md:flex-row">
            <main className="flex-1 p-4 md:p-8 overflow-y-auto">
                <header className="mb-8 text-center">
                    <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500">
                        DeepSeek Research Agent
                    </h1>
                    <p className="mt-2 text-gray-400">Your AI partner for in-depth information discovery and synthesis.</p>
                </header>
                <DeepSeekAgent />
            </main>

            <div className={`fixed bottom-4 right-4 md:static md:w-96 flex flex-col transition-all duration-300 ${isChatOpen ? 'h-[70vh] md:h-auto' : 'h-16 w-16 md:w-20'}`}>
                <div className={`bg-gray-800 border-l border-gray-700 rounded-xl shadow-2xl flex flex-col flex-1 ${isChatOpen ? 'opacity-100' : 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto'}`}>
                    <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <MessageSquare className="text-indigo-400" />
                            <span>Assistant</span>
                        </h2>
                         <button onClick={() => setIsChatOpen(false)} className="text-gray-400 hover:text-white md:hidden">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                   <div className="flex-1 min-h-0">
                     <ChatBot />
                   </div>
                </div>
                 {!isChatOpen && (
                    <button 
                        onClick={() => setIsChatOpen(true)}
                        className="md:hidden absolute bottom-0 right-0 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-gray-900"
                    >
                        <Zap size={24} />
                    </button>
                )}
            </div>

        </div>
    );
};

export default App;
