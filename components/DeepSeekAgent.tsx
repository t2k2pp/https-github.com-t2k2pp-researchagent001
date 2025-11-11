import React, { useState, useRef, useEffect } from 'react';
import { ResearchReport, ResearchStage, Source, ResearchPlanItem } from '../types';
import { generateResearchPlan, searchWithGrounding, synthesizeReport, evaluateCompleteness, refineSearchQueries } from '../services/geminiService';
import { SearchIcon } from './icons/SearchIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { LightbulbIcon } from './icons/LightbulbIcon';
import { BookOpenIcon } from './icons/BookOpenIcon';
import { ClipboardCheckIcon } from './icons/ClipboardCheckIcon';

const StageIndicator: React.FC<{
    stage: ResearchStage;
    currentStage: ResearchStage;
    title: string;
    icon: React.ReactNode;
}> = ({ stage, currentStage, title, icon }) => {
    const stageOrder: ResearchStage[] = ['PLANNING', 'SEARCHING', 'EVALUATING', 'SYNTHESIZING', 'COMPLETE'];
    const isActive = stage === currentStage;
    const isDone = stageOrder.indexOf(currentStage) > stageOrder.indexOf(stage);

    return (
        <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-800/50 border border-transparent">
            <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-300 ${isDone ? 'bg-green-500' : isActive ? 'bg-indigo-500' : 'bg-gray-700'}`}>
                {isActive ? <SpinnerIcon /> : icon}
            </div>
            <div>
                <h3 className={`font-semibold transition-colors duration-300 ${isActive || isDone ? 'text-white' : 'text-gray-400'}`}>{title}</h3>
                <p className="text-sm text-gray-500">
                    {isActive ? "In progress..." : isDone ? "Completed" : "Pending"}
                </p>
            </div>
        </div>
    );
};

export const DeepSeekAgent: React.FC = () => {
    const [topic, setTopic] = useState<string>('');
    const [stage, setStage] = useState<ResearchStage>('IDLE');
    const [report, setReport] = useState<ResearchReport | null>(null);
    const [sources, setSources] = useState<Source[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [plan, setPlan] = useState<ResearchPlanItem[]>([]);
    const [progressLog, setProgressLog] = useState<string[]>([]);
    
    const logContainerRef = useRef<HTMLDivElement>(null);
    const accumulatedResultsRef = useRef<string>("");
    const accumulatedSourcesRef = useRef<Source[]>([]);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [progressLog]);


    const addLog = (message: string) => {
        setProgressLog(prev => [...prev, message]);
    };
    
    const resetState = () => {
        setTopic('');
        setStage('IDLE');
        setReport(null);
        setSources([]);
        setError(null);
        setPlan([]);
        setProgressLog([]);
        accumulatedResultsRef.current = "";
        accumulatedSourcesRef.current = [];
    };

    const runPlanning = async () => {
        setStage('PLANNING');
        addLog("Phase 1: Planning research...");
        const researchPlan = await generateResearchPlan(topic);
        setPlan(researchPlan);
        addLog(`Plan created with ${researchPlan.length} key questions.`);
        return researchPlan;
    };

    const runSearchAndEvaluateLoop = async (initialPlan: ResearchPlanItem[]) => {
        const MAX_ITERATIONS = 3;
        let queriesToSearch = initialPlan.flatMap(item => [item.english_question, item.japanese_question]);

        for (let i = 0; i < MAX_ITERATIONS; i++) {
            addLog(`\n--- Iteration ${i + 1} of ${MAX_ITERATIONS} ---`);
            
            // SEARCHING
            setStage('SEARCHING');
            addLog(`Searching the web with ${queriesToSearch.length} queries...`);
            
            for (const query of queriesToSearch) {
                try {
                    addLog(`Searching for: "${query}"`);
                    const { text, sources: newSources } = await searchWithGrounding(query);
                    accumulatedResultsRef.current += `\n\n--- Query: ${query} ---\n${text}`;
                    accumulatedSourcesRef.current.push(...newSources);
                    const uniqueSources = Array.from(new Map(accumulatedSourcesRef.current.map(s => [s.uri, s])).values());
                    setSources(uniqueSources);
                } catch (searchError) {
                    const err = searchError as Error;
                    addLog(`Warning: Failed to search for "${query}". Reason: ${err.message}. Continuing...`);
                }
            }

            // EVALUATING
            setStage('EVALUATING');
            addLog("Evaluating collected information for completeness...");
            const evaluation = await evaluateCompleteness(initialPlan, accumulatedResultsRef.current);
            addLog(`Evaluation complete. Reasoning: ${evaluation.reasoning}`);

            if (evaluation.is_complete) {
                addLog("Information is sufficient. Proceeding to synthesis.");
                break; 
            }

            if (i === MAX_ITERATIONS - 1) {
                addLog("Max iterations reached. Proceeding to synthesis with available data.");
                break;
            }

            addLog(`Information is incomplete. Refining search for ${evaluation.unanswered_questions.length} topics.`);
            const newQueries = await refineSearchQueries(evaluation.unanswered_questions);
            if (newQueries.length === 0) {
                addLog("Could not generate new queries. Proceeding to synthesis.");
                break;
            }
            queriesToSearch = newQueries.flatMap(q => [q.english_query, q.japanese_query]);
        }
    };
    
    const runSynthesis = async () => {
        setStage('SYNTHESIZING');
        addLog("\nPhase 4: Synthesizing final report...");
        const finalReport = await synthesizeReport(topic, accumulatedResultsRef.current);
        setReport(finalReport);
        addLog("Report synthesized successfully!");
    };


    const handleResearch = async () => {
        if (!topic.trim()) {
            setError('Please enter a research topic.');
            return;
        }
        resetState();

        try {
            const researchPlan = await runPlanning();
            await runSearchAndEvaluateLoop(researchPlan);
            await runSynthesis();
            setStage('COMPLETE');
        } catch (e) {
            const err = e as Error;
            console.error(err);
            const errorMessage = err.message || 'An unknown error occurred.';
            setError(errorMessage);
            addLog(`Error: ${errorMessage}`);
            setStage('ERROR');
        }
    };

    const renderContent = () => {
        if (stage === 'IDLE' || stage === 'ERROR') {
            return (
                <div className="w-full max-w-2xl mx-auto">
                    <div className="relative">
                        <textarea
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="Enter a complex topic to research, e.g., 'The impact of quantum computing on cryptography'"
                            className="w-full h-28 p-4 pr-16 text-lg bg-gray-800 border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                        />
                        <button
                            onClick={handleResearch}
                            disabled={stage !== 'IDLE' && stage !== 'ERROR'}
                            className="absolute top-1/2 right-4 -translate-y-1/2 bg-indigo-600 p-3 rounded-full hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                        >
                           <SearchIcon />
                        </button>
                    </div>
                     {error && <p className="mt-4 text-center text-red-400">{error}</p>}
                     {stage === 'ERROR' && (
                         <div className="text-center mt-4">
                            <button onClick={resetState} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-transform hover:scale-105">
                                Try Again
                            </button>
                         </div>
                     )}
                </div>
            );
        }

        if (stage === 'COMPLETE' && report) {
            return (
                <div className="max-w-4xl mx-auto animate-fade-in">
                    <div className="bg-gray-800 rounded-xl p-6 md:p-8 shadow-lg border border-gray-700">
                        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500 mb-2">{report.title}</h2>
                        <p className="text-lg text-gray-300 mb-6 border-b border-gray-700 pb-4">{report.summary}</p>
                        
                        {report.sections.map((section, index) => (
                            <div key={index} className="mb-6">
                                <h3 className="text-xl font-semibold text-indigo-300 mb-2">{section.heading}</h3>
                                <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{section.content}</p>
                            </div>
                        ))}

                        <div className="mt-8">
                             <h3 className="text-xl font-semibold text-indigo-300 mb-4">Sources</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {sources.map((source, index) => (
                                    <a key={index} href={source.uri} target="_blank" rel="noopener noreferrer" className="block p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors truncate">
                                        <p className="font-semibold text-indigo-400 truncate">{source.title}</p>
                                        <p className="text-sm text-gray-500 truncate">{source.uri}</p>
                                    </a>
                                ))}
                             </div>
                        </div>
                    </div>
                    <div className="text-center mt-8">
                        <button onClick={resetState} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-transform hover:scale-105">
                            Start New Research
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="max-w-2xl mx-auto flex flex-col gap-4">
                <StageIndicator stage="PLANNING" currentStage={stage} title="Planning Research" icon={<LightbulbIcon />} />
                <StageIndicator stage="SEARCHING" currentStage={stage} title="Searching & Gathering" icon={<SearchIcon />} />
                <StageIndicator stage="EVALUATING" currentStage={stage} title="Evaluating Information" icon={<ClipboardCheckIcon />} />
                <StageIndicator stage="SYNTHESIZING" currentStage={stage} title="Synthesizing Report" icon={<BookOpenIcon />} />
                
                <div ref={logContainerRef} className="mt-4 p-4 bg-gray-800 border border-gray-700 rounded-lg h-64 overflow-y-auto font-mono text-sm">
                    <h4 className="font-semibold text-indigo-300 mb-2 sticky top-0 bg-gray-800 pb-2">Agent Log:</h4>
                    <div className="text-gray-300 whitespace-pre-wrap">
                        {progressLog.join('\n')}
                    </div>
                    {/* FIX: Removed redundant `stage !== 'ERROR'` check. This resolves a TypeScript error as control-flow analysis determines `stage` cannot be 'ERROR' here. */}
                    {stage !== 'COMPLETE' && <div className="animate-pulse mt-2">Running...</div>}
                </div>
            </div>
        );
    };

    return <div className="w-full">{renderContent()}</div>;
};
