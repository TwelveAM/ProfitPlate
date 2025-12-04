// assets/tour.js
// Lightweight guided tour for the Home page.
// No layout changes, just an overlay + highlight when the user clicks
// "See how it works".

(function () {
  const HOW_IT_WORKS_ID = "pp-how-it-works";

  // --- Simple tour steps ---------------------------------------------
  // targetSelector may be null; in that case we just show a centered overlay.
  const TOUR_STEPS = [
    {
      id: "welcome",
      title: "Welcome to ProfitPlate",
      body:
        "ProfitPlate helps you track real ingredient costs and profit per plate — no spreadsheets, no headaches.",
      targetSelector: null,
    },
    {
      id: "banner",
      title: "This is your kitchen cockpit",
      body:
        "The green bar at the top is your main navigation. You can jump between Purchases, Recipes and Settings from here.",
      // We try hero banner first, then fall back to the header container.
      targetSelector: ".hero-banner, #site-header",
    },
    {
      id: "hero",
      title: "Know your dish cost in seconds",
      body:
        "This section explains what ProfitPlate does. Once you load some data, you’ll see how ingredient prices roll into dish cost and margin.",
      targetSelector: "main h1",
    },
    {
      id: "cta",
      title: "Try it with your own menu",
      body:
        "Use the buttons here to start playing with the app. In the future this could start a free trial or launch a demo.",
      // First primary button in the hero. If it doesn’t exist, we just show the panel.
      targetSelector:
        "main .btn-primary, main button.btn-primary, main .hero-actions button",
    },
    {
      id: "finish",
      title: "That’s the quick tour",
      body:
        "Next steps: add a few ingredients in Purchases, then build your first recipe to see cost per portion and profit margin.",
      targetSelector: null,
    },
  ];

  let currentStepIndex = 0;
  let overlayEl = null;
  let panelEl = null;
  let highlightEl = null;
  let stepTitleEl = null;
  let stepBodyEl = null;
  let backBtn = null;
  let nextBtn = null;
  let exitBtn = null;
  let previousBodyOverflow = null;

  document.addEventListener("DOMContentLoaded", function () {
    const btn = document.getElementById(HOW_IT_WORKS_ID);
    if (!btn) return;

    injectTourStyles();

    btn.addEventListener("click", function () {
      startTour();
    });
  });

  function startTour() {
    if (overlayEl) {
      // Already running; just restart from step 0
      currentStepIndex = 0;
      renderStep();
      return;
    }

    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    createOverlay();
    currentStepIndex = 0;
    renderStep();
  }

  function endTour() {
    if (overlayEl && overlayEl.parentNode) {
      overlayEl.parentNode.removeChild(overlayEl);
    }
    overlayEl = null;
    panelEl = null;
    highlightEl = null;
    stepTitleEl = null;
    stepBodyEl = null;
    backBtn = null;
    nextBtn = null;
    exitBtn = null;
    document.body.style.overflow = previousBodyOverflow || "";
  }

  function createOverlay() {
    overlayEl = document.createElement("div");
    overlayEl.className = "pp-tour-overlay";

    // Click outside = do nothing (we force use of buttons)
    overlayEl.addEventListener("click", function (e) {
      if (e.target === overlayEl) {
        // ignore
      }
    });

    highlightEl = document.createElement("div");
    highlightEl.className = "pp-tour-highlight";
    overlayEl.appendChild(highlightEl);

    panelEl = document.createElement("div");
    panelEl.className = "pp-tour-panel";

    stepTitleEl = document.createElement("h2");
    stepTitleEl.className = "pp-tour-title";
    panelEl.appendChild(stepTitleEl);

    stepBodyEl = document.createElement("p");
    stepBodyEl.className = "pp-tour-body";
    panelEl.appendChild(stepBodyEl);

    const buttonsRow = document.createElement("div");
    buttonsRow.className = "pp-tour-buttons";

    backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "pp-tour-btn-secondary";
    backBtn.textContent = "Back";
    backBtn.addEventListener("click", function () {
      if (currentStepIndex > 0) {
        currentStepIndex--;
        renderStep();
      }
    });

    nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "pp-tour-btn-primary";
    nextBtn.textContent = "Next";
    nextBtn.addEventListener("click", function () {
      if (currentStepIndex < TOUR_STEPS.length - 1) {
        currentStepIndex++;
        renderStep();
      } else {
        endTour();
      }
    });

    exitBtn = document.createElement("button");
    exitBtn.type = "button";
    exitBtn.className = "pp-tour-btn-text";
    exitBtn.textContent = "Exit";
    exitBtn.addEventListener("click", function () {
      endTour();
    });

    buttonsRow.appendChild(backBtn);
    buttonsRow.appendChild(nextBtn);
    buttonsRow.appendChild(exitBtn);

    panelEl.appendChild(buttonsRow);
    overlayEl.appendChild(panelEl);

    document.body.appendChild(overlayEl);
  }

  function renderStep() {
    const step = TOUR_STEPS[currentStepIndex];

    stepTitleEl.textContent = step.title;
    stepBodyEl.textContent = step.body;

    // Buttons state
    if (currentStepIndex === 0) {
      backBtn.disabled = true;
      backBtn.classList.add("pp-tour-btn-disabled");
    } else {
      backBtn.disabled = false;
      backBtn.classList.remove("pp-tour-btn-disabled");
    }

    if (currentStepIndex === TOUR_STEPS.length - 1) {
      nextBtn.textContent = "Finish";
    } else {
      nextBtn.textContent = "Next";
    }

    positionHighlight(step);
  }

  function positionHighlight(step) {
    const sel = step.targetSelector;
    const target =
      sel && typeof sel === "string"
        ? document.querySelector(sel)
        : null;

    if (!target) {
      // No target: hide highlight and keep panel at bottom center
      highlightEl.style.opacity = "0";
      panelEl.style.top = "auto";
      panelEl.style.bottom = "32px";
      panelEl.style.left = "50%";
      panelEl.style.transform = "translateX(-50%)";
      return;
    }

    // Ensure target is visible
    try {
      target.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    } catch (e) {
      // ignore
    }

    const rect = target.getBoundingClientRect();

    // Highlight box around target
    highlightEl.style.opacity = "1";
    highlightEl.style.top = rect.top - 8 + "px";
    highlightEl.style.left = rect.left - 8 + "px";
    highlightEl.style.width = rect.width + 16 + "px";
    highlightEl.style.height = rect.height + 16 + "px";

    // Position panel near bottom, but above the bottom edge
    panelEl.style.bottom = "24px";
    panelEl.style.left = "50%";
    panelEl.style.top = "auto";
    panelEl.style.transform = "translateX(-50%)";
  }

  function injectTourStyles() {
    if (document.getElementById("pp-tour-style")) return;

    const css = `
      .pp-tour-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        z-index: 9999;
        display: flex;
        justify-content: center;
        align-items: flex-end;
        pointer-events: auto;
      }

      .pp-tour-highlight {
        position: fixed;
        border-radius: 12px;
        box-shadow: 0 0 0 3px #ffffff, 0 0 0 2000px rgba(0,0,0,0.45);
        pointer-events: none;
        transition: all 0.25s ease;
        opacity: 0;
      }

      .pp-tour-panel {
        position: relative;
        max-width: 480px;
        width: 90%;
        background: #ffffff;
        border-radius: 16px;
        padding: 16px 18px 14px;
        margin-bottom: 24px;
        box-shadow: 0 18px 45px rgba(0,0,0,0.3);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }

      .pp-tour-title {
        margin: 0 0 6px;
        font-size: 18px;
        font-weight: 600;
        color: #1f2933;
      }

      .pp-tour-body {
        margin: 0 0 12px;
        font-size: 14px;
        line-height: 1.5;
        color: #4b5563;
      }

      .pp-tour-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      .pp-tour-btn-primary,
      .pp-tour-btn-secondary,
      .pp-tour-btn-text {
        border-radius: 999px;
        font-size: 13px;
        padding: 6px 14px;
        cursor: pointer;
        border: none;
        font-family: inherit;
      }

      .pp-tour-btn-primary {
        background: #0b5d3f;
        color: #ffffff;
      }

      .pp-tour-btn-primary:hover {
        background: #094a33;
      }

      .pp-tour-btn-secondary {
        background: #e5e7eb;
        color: #111827;
      }

      .pp-tour-btn-secondary:hover {
        background: #d1d5db;
      }

      .pp-tour-btn-text {
        background: transparent;
        color: #6b7280;
      }

      .pp-tour-btn-text:hover {
        color: #374151;
      }

      .pp-tour-btn-disabled {
        opacity: 0.4;
        cursor: default;
      }

      @media (max-width: 600px) {
        .pp-tour-panel {
          margin-bottom: 12px;
          padding: 12px 12px 10px;
        }
      }
    `;

    const styleEl = document.createElement("style");
    styleEl.id = "pp-tour-style";
    styleEl.type = "text/css";
    styleEl.appendChild(document.createTextNode(css));
    document.head.appendChild(styleEl);
  }
})();
