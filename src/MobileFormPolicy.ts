const MOBILE_PREVIEW_MAX_WIDTH = 640;

export function shouldUseMobileForm(isObsidianMobile: boolean, viewportWidth: number): boolean {
    return isObsidianMobile || viewportWidth <= MOBILE_PREVIEW_MAX_WIDTH;
}
