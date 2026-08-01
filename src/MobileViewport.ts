export interface VisualViewportSnapshot {
    height: number;
    offsetTop: number;
}

export interface MobileViewportMetrics {
    height: number;
    offsetTop: number;
    keyboardInset: number;
}

export function getMobileViewportMetrics(
    windowHeight: number,
    viewport?: VisualViewportSnapshot
): MobileViewportMetrics {
    if (!viewport) {
        return { height: windowHeight, offsetTop: 0, keyboardInset: 0 };
    }

    const height = Math.max(240, viewport.height);
    const offsetTop = Math.max(0, viewport.offsetTop);
    return {
        height,
        offsetTop,
        keyboardInset: Math.max(0, windowHeight - viewport.height - viewport.offsetTop)
    };
}
