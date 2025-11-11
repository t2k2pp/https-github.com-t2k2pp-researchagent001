export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

export interface Source {
    uri: string;
    title: string;
}

export interface ResearchReport {
    title: string;
    summary: string;
    sections: {
        heading: string;
        content: string;
    }[];
}

export interface ResearchPlanItem {
    english_question: string;
    japanese_question: string;
}

export type ResearchStage = 'IDLE' | 'PLANNING' | 'SEARCHING' | 'EVALUATING' | 'SYNTHESIZING' | 'COMPLETE' | 'ERROR';
