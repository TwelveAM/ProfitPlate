// assets/tour.js
// Multi-page guided tour for ProfitPlate.
// - Starts when the user clicks "See how it works" on Home.
// - Moves through Home -> Purchases -> Recipes -> Settings.
// - Uses localStorage to remember where the user is in the tour.
// - NO changes to layout, header, or existing app logic.

(function () {
  const STORAGE_KEY = "pp_tour_state_v1";
  const HOW_IT_WORKS_ID = "pp-how-it-works";

  // --- Identify current page ---------------------------------------
  function getPageId() {
    const path = (location.pathname || "").toLowerCase();

    if (path.endsWith("purchases.html")) return "purchases";
    if (path.endsWith("recipes.html")) return "recipes";
    if (path.endsWith("settings.html")) return "settings";
    // treat index.html or / as home
    return "home";
  }

  const CURRENT_PAGE = getPageId();

  // --- Tour config per page ----------------------------------------
  // panelPosition: "bottom" | "top" | "center"
  // nextPage: when present, Next will redirect to that page and continue tour there.
  const TOUR_STEPS = {
    home: [
      {
        id: "welcome",
        title: "Welcome to ProfitPlate",
        body:
          "ProfitPlate helps you track real ingredient costs and profit per plate — without living in spreadsheets.",
        targetSelector: null,
        panelPosition: "bottom",
      },
      {
        id: "home-header",
        title: "Your kitchen cockpit",
        body:
          "Use this green bar to switch between Purchases, Recipes and Settings. Think of it as your kitchen control panel.",
        targetSelector: ".hero-banner, #site-header",
        panelPosition: "bottom",
      },
      {
        id: "home-body",
        title: "What ProfitPlate does for you",
        body:
          "This section explains the idea: add ingredients once, then build recipes and see cost per portion and margin instantly.",
        targetSelector: "main h1, main h2",
        panelPosition: "top",
      },
      {
        id: "to-purchases",
        title: "Let’s start where the money goes out",
        body:
          "First stop: Purchases. There you store all your ingredients — names, suppliers, pack size and price.",
        targetSelector: 'nav a[href="purchases.html"], nav',
        panelPosition: "bottom",
        nextPage: "purchases",
        nextIndex: 0,
      },
    ],

    purchases: [
      {
        id: "purchases-title",
        title: "Your ingredient base",
        body:
          "Every ingredient you buy lives here. Recipes will only use items you’ve added on this page.",
        targetSelector: "h1",
        panelPosition: "top",
      },
      {
        id: "purchases-add",
        title: "Add items from your invoices",
        body:
          'Use the "Add item manually" button to record new ingredients. Pack helper will convert weird pack sizes into clean €/kg, €/g, etc.',
        targetSelector:
          'button.btn.btn-primary, button.btn-primary, button[type="button"]',
        panelPosition: "bottom",
      },
      {
        id: "purchases-filter",
        title: "Find stuff fast",
        body:
          "The search and category filter help you find ingredients by name, supplier or category when your list gets long.",
        targetSelector: "#search-input, input[type='search']",
        panelPosition: "top",
      },
      {
        id: "purchases-table",
        title: "Latest price always visible",
        body:
          "Each row is an ingredient with its latest price. When you change prices here, recipes will update automatically.",
        targetSelector: "#purchase-table, table",
        panelPosition: "top",
      },
      {
        id: "to-recipes",
        title: "Next: turn ingredients into dishes",
        body:
          "Now let’s jump to Recipes and see how your ingredients become real menu items with cost and margin.",
        targetSelector: 'nav a[href="recipes.html"], nav',
        panelPosition: "bottom",
        nextPage: "recipes",
        nextIndex: 0,
      },
    ],

    recipes: [
      {
        id: "recipes-title",
        title: "Your menu overview",
        body:
          "Each recipe here is a menu item: pasta, burgers, desserts, whatever you sell. ProfitPlate shows cost per portion and margin.",
        targetSelector: "h1",
        panelPosition: "top",
      },
      {
        id: "recipes-add",
        title: "Build a new recipe",
        body:
          'Click "Add recipe" to compose a dish using your Purchases. Pick ingredients, set portions and selling price.',
        targetSelector:
          'button.btn.btn-primary, button.btn-primary, button[type="button"]',
        panelPosition: "bottom",
      },
      {
        id: "recipes-search",
        title: "Search your menu",
        body:
          "Use the search box to find dishes quickly when your menu grows — perfect for checking cost before changing prices.",
        targetSelector: "input[type='search'], input[placeholder*='Search recipes']",
        panelPosition: "top",
      },
      {
        id: "to-settings",
        title: "Last stop: Settings",
        body:
          "Here you control currency, number format and how aggressively recipes auto-recalculate when prices change.",
        targetSelector: 'nav a[href="settings.html"], nav',
        panelPosition: "bottom",
        nextPage: "settings",
        nextIndex: 0,
      },
    ],

    settings: [
      {
        id: "settings-title",
        title: "Adjust ProfitPlate to your kitchen",
        body:
          "Change currency, number format and language placeholders here. In a real app these would sync across all your devices.",
        targetSelector: "h1",
        panelPosition: "top",
      },
      {
        id: "settings-behaviour",
        title: "Behaviour: smart updates",
        body:
          "These toggles control whether recipes auto-recalculate when ingredient prices change, and whether to show advanced cost breakdowns.",
        targetSelector: ".settings-box:nth-of-type(2), .settings-box",
        panelPosition: "bottom",
      },
      {
        id: "settings-data",
        title: "Data & local storage",
        body:
          "For now everything lives only in your browser — no server, no cloud. In the future this is where imports, exports and backups will live.",
        targetSelector: ".settings-box:nth-of-type(3), .settings-box",
        panelPosition: "bottom",
      },
      {
        id: "finish",
        title: "Tour finished",
        body:
          "You’ve seen the core flow: Purchases → Recipes → Settings. Add a few real ingredients and build your first recipe to see ProfitPlate in action.",
        targetSelector: null,
        panelPosition: "center",
      },
    ],
  };

  // --- State helpers ------------------------------------------------
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // ignore
    }
  }

  function clearState() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // ignore
    }
  }

  // --- DOM globals for overlay --------------------------------------
  let overlayEl = null;
  let highlightEl = null;
  let panelEl = null;
  let stepTitleEl = null;
  let stepBodyEl = null;
  let backBtn = null;
  let nextBtn = null;
  let exitBtn = null;
  let currentStepIndex = 0;
  let previousBodyOverflow = null;

  document.addEventListener("DOMContentLoaded", function () {
    injectTourStyles();

    const existingState = loadState();

    // If tour is running and this page is the one we expect -> resume.
    if (existingState && existingState.running && existingState.page === CURRENT_PAGE) {
      startTour(existingState.stepIndex || 0, false);
      return;
    }

    // Only Home page has the "See how it works" trigger.
    if (CURRENT_PAGE === "home") {
      const btn = document.getElementById(HOW_IT_WORKS_ID);
      if (btn) {
        btn.addEventListener("click", function () {
          // Start from beginning of home tour
          saveState({ running: true, page: "home", stepIndex: 0 });
          startTour(0, true);
        });
      }
    }
  });

  // --- Core tour logic ----------------------------------------------
  function startTour(stepIndex, createOverlayNow) {
    const steps = TOUR_STEPS[CURRENT_PAGE] || [];
    if (!steps.length) return;

    currentStepIndex = stepIndex || 0;

    if (!overlayEl) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      createOverlay();
    }

    renderStep();

    if (createOverlayNow) {
      saveState({ running: true, page: CURRENT_PAGE, stepIndex: currentStepIndex });
    }
  }

  function endTour() {
    if (overlayEl && overlayEl.parentNode) {
      overlayEl.parentNode.removeChild(overlayEl);
    }
    overlayEl = null;
    highlightEl = null;
    panelEl = null;
    stepTitleEl = null;
    stepBodyEl = null;
    backBtn = null;
    nextBtn = null;
    exitBtn = null;
    document.body.style.overflow = previousBodyOverflow || "";
    clearState();
  }

  function createOverlay() {
    overlayEl = document.createElement("div");
    overlayEl.className = "pp-tour-overlay";

    // Don't close on click outside; user must use buttons.
    overlayEl.addEventListener("click", function (e) {
      if (e.target === overlayEl) {
        // do nothing
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
        saveState({ running: true, page: CURRENT_PAGE, stepIndex: currentStepIndex });
        renderStep();
      }
    });

    nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "pp-tour-btn-primary";
    nextBtn.textContent = "Next";
    nextBtn.addEventListener("click", function () {
      handleNext();
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

  function handleNext() {
    const steps = TOUR_STEPS[CURRENT_PAGE] || [];
    const step = steps[currentStepIndex];

    // If this step says "go to another page", do that.
    if (step && step.nextPage) {
      saveState({
        running: true,
        page: step.nextPage,
        stepIndex: step.nextIndex || 0,
      });
      // simple redirect
      if (step.nextPage === "purchases") location.href = "purchases.html";
      else if (step.nextPage === "recipes") location.href = "recipes.html";
      else if (step.nextPage === "settings") location.href = "settings.html";
      else location.href = "index.html";
      return;
    }

    if (currentStepIndex < steps.length - 1) {
      currentStepIndex++;
      saveState({ running: true, page: CURRENT_PAGE, stepIndex: currentStepIndex });
      renderStep();
    } else {
      endTour();
    }
  }

  function renderStep() {
    const steps = TOUR_STEPS[CURRENT_PAGE] || [];
    const step = steps[currentStepIndex];
    if (!step) {
      endTour();
      return;
    }

    stepTitleEl.textContent = step.title;
    stepBodyEl.textContent = step.body;

    // Back button state
    if (currentStepIndex === 0) {
      backBtn.disabled = true;
      backBtn.classList.add("pp-tour-btn-disabled");
    } else {
      backBtn.disabled = false;
      backBtn.classList.remove("pp-tour-btn-disabled");
    }

    // Next button label
    const isLast = currentStepIndex === steps.length - 1 && !step.nextPage;
    nextBtn.textContent = isLast ? "Finish" : "Next";

    const rect = positionHighlight(step);
    positionPanel(step, rect);
  }

  function positionHighlight(step) {
    const sel = step.targetSelector;
    const target =
      sel && typeof sel === "string"
        ? document.querySelector(sel)
        : null;

    if (!target) {
      highlightEl.style.opacity = "0";
      return null;
    }

    try {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (e) {
      // ignore
    }

    const rect = target.getBoundingClientRect();

    highlightEl.style.opacity = "1";
    highlightEl.style.top = rect.top - 8 + "px";
    highlightEl.style.left = rect.left - 8 + "px";
    highlightEl.style.width = rect.width + 16 + "px";
    highlightEl.style.height = rect.height + 16 + "px";

    return rect;
  }

  function positionPanel(step, rect) {
    const pos = step.panelPosition || "bottom";

    panelEl.style.left = "50%";
    panelEl.style.transform = "translateX(-50%)";
    panelEl.style.maxWidth = "480px";

    if (pos === "top") {
      panelEl.style.top = "24px";
      panelEl.style.bottom = "auto";
      panelEl.style.transform = "translateX(-50%)";
    } else if (pos === "center") {
      panelEl.style.top = "50%";
      panelEl.style.bottom = "auto";
      panelEl.style.transform = "translate(-50%, -50%)";
    } else {
      // default: bottom
      panelEl.style.top = "auto";
      panelEl.style.bottom = "24px";
      panelEl.style.transform = "translateX(-50%)";
    }
  }

  // --- Styles -------------------------------------------------------
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
        position: fixed;
        max-width: 480px;
        width: 90%;
        background: #ffffff;
        border-radius: 16px;
        padding: 16px 18px 14px;
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
