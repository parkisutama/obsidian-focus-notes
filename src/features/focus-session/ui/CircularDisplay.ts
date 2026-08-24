/**
 * SVG progress-ring with centered time + label text.
 *
 * Why SVG over canvas:
 *   - Native theming via CSS variables (Obsidian's accent color "just works").
 *   - Crisp scaling for any sidebar width.
 *   - DOM-inspectable, accessible, and selectable for screen readers.
 *
 * Why a class instead of a render function:
 *   We want to mutate the same nodes on every tick instead of re-creating
 *   them, and we want a tiny stable API (update / setProgress) so the view
 *   doesn't have to know about SVG attributes.
 */

const NS = "http://www.w3.org/2000/svg";
const RADIUS = 80;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export class CircularDisplay {
    private progressEl!: SVGCircleElement;
    private timeText!: SVGTextElement;
    private labelText!: SVGTextElement;

    constructor(parent: HTMLElement) {
        const wrap = parent.createDiv({ cls: "focus-notes-circle-wrap" });
        const svg = document.createElementNS(NS, "svg");
        svg.setAttribute("viewBox", "0 0 200 200");
        svg.setAttribute("class", "focus-notes-circle-svg");
        wrap.appendChild(svg);

        this.appendCircle(svg, "focus-notes-track");
        this.progressEl = this.appendCircle(svg, "focus-notes-progress");
        this.progressEl.setAttribute("transform", "rotate(-90 100 100)");
        this.progressEl.setAttribute("stroke-dasharray", String(CIRCUMFERENCE));
        this.progressEl.setAttribute("stroke-dashoffset", String(CIRCUMFERENCE));

        this.timeText = this.appendText(svg, "100", "96", "focus-notes-time");
        this.labelText = this.appendText(svg, "100", "128", "focus-notes-label");
    }

    /**
     * Update everything in one go. Caller passes:
     *   time     — preformatted string (mm:ss or h:mm:ss)
     *   label    — short context line under the time
     *   progress — null for "no progress arc" (stopwatch / idle stopwatch),
     *              or 0..1 for the proportion of the countdown elapsed
     */
    public update(time: string, label: string, progress: number | null): void {
        this.timeText.textContent = time;
        this.labelText.textContent = label;
        if (progress === null) {
            this.progressEl.setAttribute("stroke-dashoffset", String(CIRCUMFERENCE));
            this.progressEl.classList.add("focus-notes-progress--idle");
        } else {
            this.progressEl.classList.remove("focus-notes-progress--idle");
            const offset = CIRCUMFERENCE * (1 - progress);
            this.progressEl.setAttribute("stroke-dashoffset", String(offset));
        }
    }

    private appendCircle(svg: SVGElement, cls: string): SVGCircleElement {
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", "100");
        c.setAttribute("cy", "100");
        c.setAttribute("r", String(RADIUS));
        c.setAttribute("class", cls);
        svg.appendChild(c);
        return c as SVGCircleElement;
    }

    private appendText(svg: SVGElement, x: string, y: string, cls: string): SVGTextElement {
        const t = document.createElementNS(NS, "text");
        t.setAttribute("x", x);
        t.setAttribute("y", y);
        t.setAttribute("text-anchor", "middle");
        t.setAttribute("class", cls);
        svg.appendChild(t);
        return t as SVGTextElement;
    }
}
