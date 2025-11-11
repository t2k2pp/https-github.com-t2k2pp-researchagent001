// FIX: Use the correct package name "@google/genai" instead of "@google-ai/generativelanguage".
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
// FIX: Import ResearchReport type for synthesizeReport return type.
import { Source, ResearchPlanItem, ResearchReport } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Utility to parse JSON from Gemini response
const parseJson = <T>(jsonString: string): T | null => {
    try {
        const cleanedJson = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanedJson) as T;
    } catch (e) {
        console.error("Failed to parse JSON:", e, "Original string:", jsonString);
        return null;
    }
};

export const generateResearchPlan = async (topic: string): Promise<ResearchPlanItem[]> => {
    // FIX: Simplified system instruction as responseSchema will enforce the output format.
    const systemInstruction = `You are a senior research analyst. Your task is to create a structured research plan for the given topic. Generate a list of 3-5 key questions that need to be answered. For each question, provide both an English and a Japanese version.`;

    try {
        const response = await ai.models.generateContent({
            // FIX: Use the recommended model name 'gemini-flash-lite-latest'.
            model: 'gemini-flash-lite-latest',
            contents: `Research Topic: "${topic}"`,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                // FIX: Added responseSchema to enforce JSON output structure.
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        plan: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    english_question: { type: Type.STRING },
                                    japanese_question: { type: Type.STRING }
                                },
                                required: ['english_question', 'japanese_question']
                            }
                        }
                    },
                    required: ['plan']
                }
            }
        });
        const result = parseJson<{ plan: ResearchPlanItem[] }>(response.text);
        if (!result || !result.plan) {
            throw new Error("AI failed to generate a valid research plan from the response.");
        }
        return result.plan;
    } catch (error) {
        console.error("Error in generateResearchPlan:", error);
        throw new Error("Failed to generate a research plan. The AI model may be temporarily unavailable.");
    }
};

export const searchWithGrounding = async (query: string): Promise<{ text: string, sources: Source[] }> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Provide a comprehensive overview of the information available on the web regarding: "${query}"`,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });

        const text = response.text;
        const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        
        const sources: Source[] = rawChunks
            .map((chunk: any) => ({
                uri: chunk.web?.uri || '',
                title: chunk.web?.title || 'Untitled Source'
            }))
            .filter((source: Source) => source.uri);

        const uniqueSources = Array.from(new Map(sources.map(s => [s.uri, s])).values());

        return { text, sources: uniqueSources };
    } catch (error) {
        console.error(`Error with Google Search grounding for query "${query}":`, error);
        throw new Error(`Failed to search the web for: "${query}".`);
    }
};

export const evaluateCompleteness = async (plan: ResearchPlanItem[], searchResults: string): Promise<{ is_complete: boolean; unanswered_questions: string[]; reasoning: string; }> => {
    // FIX: Simplified system instruction as responseSchema will enforce the output format.
    const systemInstruction = `You are a meticulous research supervisor. Your task is to evaluate if the provided search results adequately answer the initial research plan.
- Review each question in the plan.
- Check if the search results contain sufficient information to answer it.
- Determine if the overall research is complete or if more information is needed.
- Be critical. If the information is only superficial, consider it unanswered.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: `## Research Plan
${JSON.stringify(plan, null, 2)}

## Collected Search Results
<results>
${searchResults}
</results>

Evaluate the completeness based on the provided data.`,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                // FIX: Added responseSchema to enforce JSON output structure.
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        is_complete: { type: Type.BOOLEAN },
                        unanswered_questions: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                        reasoning: { type: Type.STRING }
                    },
                    required: ['is_complete', 'unanswered_questions', 'reasoning']
                }
            }
        });

        const result = parseJson<{ is_complete: boolean; unanswered_questions: string[]; reasoning: string; }>(response.text);
        if (result === null) throw new Error("AI returned an unparsable response for completeness evaluation.");
        return result;

    } catch (error) {
        console.error("Error evaluating completeness:", error);
        throw new Error("AI failed to evaluate the completeness of the search results.");
    }
};


export const refineSearchQueries = async (unansweredQuestions: string[]): Promise<{ english_query: string; japanese_query: string; }[]> => {
    // FIX: Simplified system instruction as responseSchema will enforce the output format.
    const systemInstruction = `You are an expert search query strategist. Based on the provided unanswered questions, generate 2-3 new, highly specific search queries to find the missing information. Provide queries in both English and Japanese.`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Unanswered Questions:
- ${unansweredQuestions.join('\n- ')}
`,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                // FIX: Added responseSchema to enforce JSON output structure.
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        queries: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    english_query: { type: Type.STRING },
                                    japanese_query: { type: Type.STRING }
                                },
                                required: ['english_query', 'japanese_query']
                            }
                        }
                    },
                    required: ['queries']
                }
            }
        });

        const result = parseJson<{ queries: { english_query: string; japanese_query: string; }[] }>(response.text);
        if (!result || !result.queries) throw new Error("AI failed to generate valid refined search queries from the response.");
        return result.queries;

    } catch (error) {
        console.error("Error refining search queries:", error);
        throw new Error("AI failed to generate new search queries.");
    }
};


// FIX: Changed return type to Promise<ResearchReport> and added internal JSON parsing.
export const synthesizeReport = async (topic: string, searchResults: string): Promise<ResearchReport> => {
    // FIX: Simplified system instruction as responseSchema will enforce the output format.
    const systemInstruction = `You are DeepSeek, a world-class research analyst AI. Your task is to synthesize a comprehensive, well-structured, and insightful report based on the user's topic and the provided search results.

Follow these instructions precisely:
1.  **Analyze Data:** Carefully review all provided search results to understand key themes, facts, arguments, and data points.
2.  **Structure Report:** Create a clear structure with a main title, a concise executive summary, and multiple detailed sections with informative headings.
3.  **Synthesize, Don't Copy:** Do not simply copy-paste from the search results. Synthesize the information to provide a coherent narrative and a deep understanding of the topic.
4.  **Maintain Neutrality:** Present the information objectively.
5.  **Language:** The entire report, including the title, summary, headings, and content, MUST be in **Japanese**.`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: `User's Research Topic: "${topic}"\n\nHere are the search results collected from the web:\n\n<search_results>\n${searchResults}\n</search_results>\n\nNow, generate the comprehensive research report in the specified JSON format.`,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 32768 },
                // FIX: Added responseSchema to enforce JSON output structure.
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        summary: { type: Type.STRING },
                        sections: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    heading: { type: Type.STRING },
                                    content: { type: Type.STRING }
                                },
                                required: ['heading', 'content']
                            }
                        }
                    },
                    required: ['title', 'summary', 'sections']
                }
            }
        });

        // FIX: Parse the response and return a structured object.
        const result = parseJson<ResearchReport>(response.text);
        if (!result) {
            throw new Error("Failed to parse the synthesized report from the AI's response.");
        }
        return result;
    } catch (error) {
        console.error("Error synthesizing report with Gemini Pro:", error);
        throw new Error("The AI failed to synthesize the final report. This may be due to the complexity of the topic or an issue with the underlying data.");
    }
};