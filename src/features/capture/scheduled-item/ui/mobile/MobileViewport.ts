export interface VisualViewportSnapshot {
    height: number;
    offsetTop: number;
}

export interface MobileViewportMetrics {
    height: number;
    offsetTop: number;
    keyboardInset: number;
}

const MINIMUM_MOBILE_CHROME_HEIGHT = 40;

export function getMobileViewportMetrics(
    windowHeight: number,
    viewport?: VisualViewportSnapshot,
    workspaceTop = 0,
    sheetGap = 0,
): MobileViewportMetrics {
    const viewportHeight = viewport?.height ?? windowHeight;
    const viewportTop = Math.max(0, viewport?.offsetTop ?? 0);
    const contentTop = Math.max(workspaceTop, MINIMUM_MOBILE_CHROME_HEIGHT);
    const absoluteTop = Math.max(contentTop + sheetGap, viewportTop + sheetGap);
    return {
        height: Math.max(240, viewportTop + viewportHeight - absoluteTop),
        offsetTop: absoluteTop,
        keyboardInset: viewport ? Math.max(0, windowHeight - viewport.height - viewport.offsetTop) : 0,
    };
}
