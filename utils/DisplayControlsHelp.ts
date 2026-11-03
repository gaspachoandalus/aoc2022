export interface DisplayControlHelpItem {
    label: string;
    description: string;
    key?: boolean;
}

export function createDisplayControlsHelp(
    dimension: "2d" | "3d",
    controls: readonly DisplayControlHelpItem[]
): HTMLDetailsElement {
    const details = document.createElement("details");
    details.className = `display-controls display-controls--${dimension}`;

    const summary = document.createElement("summary");
    summary.textContent = `${dimension.toUpperCase()} controls`;
    details.appendChild(summary);

    const panel = document.createElement("div");
    panel.className = "display-controls__panel";
    const list = document.createElement("dl");
    list.className = "display-controls__list";

    for (const control of controls) {
        const term = document.createElement("dt");
        if (control.key) {
            const keycap = document.createElement("kbd");
            keycap.textContent = control.label;
            term.appendChild(keycap);
        } else {
            term.textContent = control.label;
        }

        const description = document.createElement("dd");
        description.textContent = control.description;
        list.append(term, description);
    }

    panel.appendChild(list);
    details.appendChild(panel);
    return details;
}
