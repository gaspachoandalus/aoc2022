import { DAYS } from "../days.js";
import type { PuzzleDay, PuzzleSolution } from "../days.js";
import { daySummary, solutionPartsLabel } from "./DaySelectorLabels.js";
import {
    clearPuzzleInput,
    hasSavedPuzzleInput,
    puzzleDayNumber,
    readPuzzleInput,
    savePuzzleInput,
} from "./PuzzleInput.js";

const SELECTOR_SELECTED_SOLUTION_KEY = "aoc-selector-selected-solution";
const SELECTOR_SCROLL_POSITION_KEY = "aoc-selector-scroll-position";

type SolutionElements = {
    solution: PuzzleSolution;
    button: HTMLButtonElement;
    previewImage: HTMLImageElement | null;
};

type DayElements = {
    row: HTMLLIElement;
    coverage: HTMLSpanElement;
    solutionList: HTMLDivElement;
    meta: HTMLDivElement;
    savedIndicator: HTMLSpanElement;
    clearInputButton: HTMLButtonElement;
    solutions: SolutionElements[];
};

/** Creates the Advent of Code input URL for a valid puzzle day. */
function adventOfCodeInputPage(dayNumber: number): string {
    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 25) {
        throw new Error(`Cannot create an Advent of Code input link for day "${dayNumber}".`);
    }
    return `https://adventofcode.com/2022/day/${dayNumber}/input`;
}

/** Finds required build-generated markup or reports a stale or malformed page shell. */
function requireSelectorElement<T extends Element>(root: ParentNode, selector: string): T {
    const element = root.querySelector<T>(selector);
    if (!element) {
        throw new Error(`Missing generated day selector element: ${selector}`);
    }
    return element;
}

/**
 * Connects build-generated selector markup to browser state and user interactions.
 * The manifest controls the HTML structure; this module only updates stateful details.
 */
export function render(container: HTMLElement): void {
    let selectedId: string | null = null;
    let showAllSolutions = new URL(window.location.href).searchParams.get("solutions") === "all";
    const filterButton = requireSelectorElement<HTMLButtonElement>(container, ".solution-filter__button");
    const filterStatus = requireSelectorElement<HTMLSpanElement>(container, ".solution-filter__status");
    const inputPanel = requireSelectorElement<HTMLElement>(container, ".input-panel");
    const inputSource = requireSelectorElement<HTMLAnchorElement>(container, ".input-source");
    const textarea = requireSelectorElement<HTMLTextAreaElement>(container, "#puzzle-input");
    const inputStatus = requireSelectorElement<HTMLParagraphElement>(container, ".input-status");
    const runButton = requireSelectorElement<HTMLButtonElement>(container, ".run-button");
    const previewVisibility = new Map<HTMLImageElement, boolean>();
    const reducedMotionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const previewObserver = typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => {
            for (const entry of entries) {
                const image = entry.target as HTMLImageElement;
                previewVisibility.set(image, entry.isIntersecting);
                updatePreviewSource(image);
            }
        }, { root: container });

    const expectedSolutionCount = DAYS.reduce((count, day) => count + day.solutions.length, 0);
    if (
        container.querySelectorAll(".day-option").length !== DAYS.length
        || container.querySelectorAll(".solution-option").length !== expectedSolutionCount
    ) {
        throw new Error("Generated day selector does not match days.ts; rebuild the site.");
    }

    const dayElements = new Map<number, DayElements>();
    for (const day of DAYS) {
        const row = requireSelectorElement<HTMLLIElement>(
            container,
            `.day-option[data-day="${day.day}"]`,
        );
        const solutionButtons = Array.from(
            row.querySelectorAll<HTMLButtonElement>(".solution-option"),
        );
        if (solutionButtons.length !== day.solutions.length) {
            throw new Error(`Generated solutions for day ${day.day} do not match days.ts.`);
        }

        const solutions = day.solutions.map((solution): SolutionElements => {
            const button = solutionButtons.find(
                (candidate) => candidate.dataset.solutionId === solution.id,
            );
            if (!button) {
                throw new Error(`Generated solution button "${solution.id}" is missing.`);
            }

            button.addEventListener("click", () => selectSolution(day, solution));
            const previewImage = solution.preview
                ? requireSelectorElement<HTMLImageElement>(button, "img[data-animation-src][data-poster-src]")
                : null;
            return { solution, button, previewImage };
        });

        const clearInputButton = requireSelectorElement<HTMLButtonElement>(row, "[data-clear-input]");
        clearInputButton.addEventListener("click", (event) => {
            event.stopPropagation();
            clearPuzzleInput(day.solutions[0].id);
            if (selectedId !== null && puzzleDayNumber(selectedId) === day.day) {
                textarea.value = "";
                updateRunState();
            }
            refreshRows();
        });

        dayElements.set(day.day, {
            row,
            coverage: requireSelectorElement<HTMLSpanElement>(row, ".day-option__coverage"),
            solutionList: requireSelectorElement<HTMLDivElement>(row, ".day-option__solutions"),
            meta: requireSelectorElement<HTMLDivElement>(row, ".day-option__meta"),
            savedIndicator: requireSelectorElement<HTMLSpanElement>(row, "[data-saved-indicator]"),
            clearInputButton,
            solutions,
        });
    }

    function restoreSelectorState(): void {
        const savedSolutionId = window.sessionStorage.getItem(SELECTOR_SELECTED_SOLUTION_KEY);
        if (savedSolutionId !== null) {
            window.sessionStorage.removeItem(SELECTOR_SELECTED_SOLUTION_KEY);
            if (selectedId === null) {
                const selectedDay = DAYS.find((day) =>
                    day.solutions.some((solution) => solution.id === savedSolutionId)
                );
                const savedSolution = selectedDay?.solutions.find(
                    (solution) => solution.id === savedSolutionId
                );
                if (selectedDay && savedSolution) {
                    selectSolution(selectedDay, savedSolution, false);
                }
            }
        }

        const savedScrollPosition = window.sessionStorage.getItem(SELECTOR_SCROLL_POSITION_KEY);
        if (savedScrollPosition === null) {
            return;
        }

        window.sessionStorage.removeItem(SELECTOR_SCROLL_POSITION_KEY);
        const scrollPosition = Number(savedScrollPosition);
        if (Number.isFinite(scrollPosition) && scrollPosition >= 0) {
            window.requestAnimationFrame(() => window.scrollTo(0, scrollPosition));
        }
    }

    /** Chooses an animated preview or still image based on visibility and motion preference. */
    function updatePreviewSource(image: HTMLImageElement): void {
        const animationSource = image.dataset.animationSrc;
        const posterSource = image.dataset.posterSrc;
        if (!animationSource || !posterSource) {
            throw new Error("A solution preview is missing its animation or poster source.");
        }

        const visible = previewVisibility.get(image) ?? false;
        const source = visible && !reducedMotionPreference.matches
            ? animationSource
            : posterSource;
        if (image.getAttribute("src") !== source) {
            image.src = source;
        }
    }

    reducedMotionPreference.addEventListener("change", () => {
        for (const image of previewVisibility.keys()) {
            updatePreviewSource(image);
        }
    });

    /** Enables input and launch only when a solution and nonblank input are both selected. */
    function updateRunState(): void {
        const hasInput = textarea.value.trim().length > 0;
        textarea.disabled = !selectedId;
        textarea.placeholder = selectedId
            ? "Paste the input for this solution..."
            : "Select a solution to enable this field...";
        runButton.disabled = !selectedId || !hasInput;
        inputStatus.textContent = !selectedId
            ? "Select a solution to enable input."
            : hasInput
                ? `Ready to run solution ${selectedId}.`
                : `Puzzle input required for solution ${selectedId}.`;
    }

    textarea.addEventListener("input", updateRunState);

    /** Keeps the filter's live status aligned with the visible and selected solutions. */
    function updateSolutionFilterStatus(): void {
        const selectedSolutionIsAnimated = selectedId !== null
            && DAYS.some((day) => day.solutions.some(
                (solution) => solution.id === selectedId && solution.preview,
            ));
        filterStatus.textContent = showAllSolutions
            ? "All solutions shown"
            : selectedId !== null && !selectedSolutionIsAnimated
                ? "Selected solution stays visible"
                : "Animated solutions only";
    }

    /** Persists the solution filter in the URL without reloading the current page. */
    function saveSolutionFilterToUrl(): void {
        const url = new URL(window.location.href);
        url.searchParams.set("solutions", showAllSolutions ? "all" : "animated");
        window.history.replaceState(
            window.history.state,
            "",
            `${url.pathname}${url.search}${url.hash}`,
        );
    }

    /** Updates pre-rendered rows in place and observes only the previews currently shown. */
    function refreshRows(): void {
        for (const image of previewVisibility.keys()) {
            previewObserver?.unobserve(image);
            const posterSource = image.dataset.posterSrc;
            if (!posterSource) {
                throw new Error("A solution preview is missing its poster source.");
            }
            if (image.getAttribute("src") !== posterSource) {
                image.src = posterSource;
            }
        }
        previewVisibility.clear();

        for (const day of DAYS) {
            const elements = dayElements.get(day.day);
            if (!elements) {
                throw new Error(`Generated day row ${day.day} is missing.`);
            }

            const visibleSolutions: PuzzleSolution[] = [];
            for (const item of elements.solutions) {
                const isVisible = showAllSolutions
                    || item.solution.preview
                    || item.solution.id === selectedId;
                item.button.hidden = !isVisible;
                item.button.classList.toggle("is-selected", item.solution.id === selectedId);
                item.button.setAttribute("aria-pressed", String(item.solution.id === selectedId));
                if (isVisible) {
                    visibleSolutions.push(item.solution);
                }
            }

            elements.row.hidden = visibleSolutions.length === 0;
            elements.row.classList.toggle(
                "has-selected-solution",
                visibleSolutions.some((solution) => solution.id === selectedId),
            );
            elements.solutionList.classList.toggle("is-single", visibleSolutions.length === 1);
            elements.coverage.textContent = daySummary(day, visibleSolutions);

            const hasSavedInput = hasSavedPuzzleInput(day.solutions[0].id);
            elements.savedIndicator.hidden = !hasSavedInput;
            elements.clearInputButton.hidden = !hasSavedInput;
            elements.meta.classList.toggle("is-empty", !hasSavedInput);
            elements.meta.toggleAttribute("aria-hidden", !hasSavedInput);

            for (const item of elements.solutions) {
                if (!item.solution.preview || !item.previewImage || !visibleSolutions.includes(item.solution)) {
                    continue;
                }
                previewVisibility.set(item.previewImage, false);
                previewObserver?.observe(item.previewImage);
            }
        }
    }

    filterButton.textContent = showAllSolutions
        ? "Show animated solutions only"
        : "Show all solutions";
    filterButton.setAttribute("aria-expanded", String(showAllSolutions));
    filterButton.addEventListener("click", () => {
        showAllSolutions = !showAllSolutions;
        saveSolutionFilterToUrl();
        filterButton.textContent = showAllSolutions
            ? "Show animated solutions only"
            : "Show all solutions";
        filterButton.setAttribute("aria-expanded", String(showAllSolutions));
        updateSolutionFilterStatus();
        refreshRows();
    });

    /** Selects a solution, restores its day-shared input, and keeps its row visible. */
    function selectSolution(
        day: PuzzleDay,
        solution: PuzzleSolution,
        scrollInputIntoView = true,
    ): void {
        selectedId = solution.id;
        textarea.value = readPuzzleInput(solution.id) ?? "";
        inputSource.href = adventOfCodeInputPage(day.day);
        inputSource.textContent = `Open Day ${day.day} input on Advent of Code (new tab)`;
        inputSource.hidden = false;
        updateRunState();
        updateSolutionFilterStatus();
        refreshRows();
        if (scrollInputIntoView && window.matchMedia("(max-width: 900px)").matches) {
            inputPanel.scrollIntoView({
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
                block: "start",
            });
        }
    }

    runButton.onclick = () => {
        if (!selectedId || textarea.value.trim().length === 0) {
            return;
        }
        savePuzzleInput(selectedId, textarea.value);
        window.sessionStorage.setItem(SELECTOR_SELECTED_SOLUTION_KEY, selectedId);
        window.sessionStorage.setItem(SELECTOR_SCROLL_POSITION_KEY, String(window.scrollY));
        window.location.hash = `module=${selectedId}`;
        window.location.reload();
    };

    updateRunState();
    updateSolutionFilterStatus();
    refreshRows();
    restoreSelectorState();
}
