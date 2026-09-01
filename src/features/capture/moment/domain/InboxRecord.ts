import type { EmotionCategory, StressLevel } from "../../../reflection/domain/Wellbeing.ts";

export interface InboxRecord {
    kind: "inbox";
    capturedAt: Date;
    defaultTitle: string;
    title: string;
    body: string;
    stressLevel?: StressLevel | null;
    emotionCategory?: EmotionCategory | null;
    emotionKey?: string | null;
    reflectionNotes?: string | null;
}
