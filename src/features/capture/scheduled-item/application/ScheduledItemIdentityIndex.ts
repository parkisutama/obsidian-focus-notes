import type {
    CanonicalScheduledItemIdentity,
    ScheduledItemIdentityRecord,
    ScheduledItemReferenceIdentity,
    ScheduledItemReferenceResolution,
} from "../domain/ScheduledItemIdentity.ts";

export class ScheduledItemIdentityIndex {
    private readonly files = new Map<string, ScheduledItemIdentityRecord[]>();
    private readonly canonicals = new Map<string, CanonicalScheduledItemIdentity[]>();
    private readonly references = new Map<string, ScheduledItemReferenceIdentity[]>();

    replaceFile(filePath: string, records: readonly ScheduledItemIdentityRecord[]): void {
        this.files.set(
            filePath,
            records.map((record) => ({ ...record, filePath })),
        );
        this.rebuild();
    }

    removeFile(filePath: string): void {
        if (!this.files.delete(filePath)) return;
        this.rebuild();
    }

    clear(): void {
        this.files.clear();
        this.canonicals.clear();
        this.references.clear();
    }

    resolveReference(referenceBlockId: string): ScheduledItemReferenceResolution {
        const references = this.references.get(referenceBlockId) ?? [];
        if (references.length === 0) return { status: "missing-reference" };
        if (references.length > 1) return { status: "ambiguous-reference", references: [...references] };

        const reference = references[0];
        const canonicals = this.canonicals.get(reference.itemId) ?? [];
        if (canonicals.length === 0) return { status: "orphan", reference };
        if (canonicals.length > 1) return { status: "ambiguous", reference, canonicals: [...canonicals] };
        return { status: "resolved", reference, canonical: canonicals[0] };
    }

    private rebuild(): void {
        this.canonicals.clear();
        this.references.clear();
        for (const records of this.files.values()) {
            for (const record of records) {
                if (record.entryType === "canonical") this.add(this.canonicals, record.itemId, record);
                else this.add(this.references, record.blockId, record);
            }
        }
    }

    private add<T>(index: Map<string, T[]>, key: string, record: T): void {
        const records = index.get(key);
        if (records) records.push(record);
        else index.set(key, [record]);
    }
}
