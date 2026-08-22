// Compatibility shim while consumers move to the domain-owned module.
export type {
    EventOccurrenceStatus,
    ScheduledItem,
    ScheduledItemKind,
    ScheduledItemSource,
    TaskPriority,
} from "./features/capture/scheduled-item/domain/ScheduledItem";
export type {
    TimelineMode,
    TimelineRange,
    TimelineSourceGroup,
    TimelineSourceState,
} from "./features/timeline/domain/Timeline";
