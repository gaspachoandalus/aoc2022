/** Build-only HTML templates keep static selector rendering out of the browser bundle. */
/** Escapes manifest text before it becomes part of generated HTML. */
function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;",
    })[character]);
}

/** Renders one solution button for the static selector page. */
function renderSolutionButton(day, solution, solutionPartsLabel) {
    const label = solutionPartsLabel(solution);
    const preview = solution.preview
        ? `
                    <picture class="solution-option__preview" aria-hidden="true">
                        <source media="(prefers-reduced-motion: reduce)" srcset="previews/${escapeHtml(solution.id)}-poster.webp">
                        <img src="previews/${escapeHtml(solution.id)}-poster.webp" alt="" loading="lazy" decoding="async" data-animation-src="previews/${escapeHtml(solution.id)}.webp" data-poster-src="previews/${escapeHtml(solution.id)}-poster.webp">
                    </picture>`
        : "";

    return `                <button class="solution-option${solution.preview ? " has-preview" : ""}" type="button" data-solution-id="${escapeHtml(solution.id)}" aria-label="Select Day ${day.day} ${escapeHtml(label)} solution ${escapeHtml(solution.id)}" aria-pressed="false">
${preview}
                    <span class="solution-option__part">${escapeHtml(label)}</span>
                    <span class="solution-option__id">${escapeHtml(solution.id)}</span>
                </button>`;
}

/** Generates the day index from the same manifest used to load solutions. */
export function renderDayRows(days, { daySummary, solutionPartsLabel }) {
    return days.map((day) => {
        const title = day.label
            ? `\n                        <span class="day-option__title">${escapeHtml(day.label)}</span>`
            : "";
        const solutions = day.solutions
            .map((solution) => renderSolutionButton(day, solution, solutionPartsLabel))
            .join("\n");
        const isSingle = day.solutions.length === 1 ? " is-single" : "";

        return `            <li class="day-option" data-day="${day.day}" aria-labelledby="day-${day.day}-heading">
                <div class="day-option__header">
                    <div class="day-option__identity">
                        <h3 id="day-${day.day}-heading" class="day-option__heading">
                            <span class="day-option__code">DAY ${String(day.day).padStart(2, "0")}</span>${title}
                        </h3>
                    </div>
                    <span class="day-option__coverage">${escapeHtml(daySummary(day))}</span>
                </div>
                <div class="day-option__solutions${isSingle}">
${solutions}
                </div>
                <div class="day-option__meta is-empty" aria-hidden="true">
                    <span class="day-option__saved" data-saved-indicator hidden>Saved input</span>
                    <button class="day-option__clear" type="button" data-clear-input aria-label="Clear saved input for day ${day.day}" hidden>Clear</button>
                </div>
            </li>`;
    }).join("\n");
}
