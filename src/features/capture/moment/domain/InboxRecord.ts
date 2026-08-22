export interface InboxRecord {
    kind: "inbox";
    capturedAt: Date;
    defaultTitle: string;
    title: string;
    body: string;
}
