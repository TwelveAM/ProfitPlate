// assets/tour.js
(function () {
  const TOUR_STATE_KEY = "pp_tour_state_v1";

  // Figure out which page we are on
  const PAGE_ID = (function () {
    const path = window.location.pathname;
    if (path.endsWith("purchases.html")) return "purchases";
    if (path.endsWith("recipes.html")) return "recipes";
    if (path.endsWith("settings.html")) return "settings";
    return "home";
  })();

  function pageToUrl(page) {
    switch (page) {
      case "home":
        return "index.html";
      case "purchases":
        return "purchases.html";
      case "recipes":
        return "recipes.html";
      case "settings":
        return "settings.html";
      default:
        return "index.html";
    }
  }

  // Tour steps across pages
  const STEPS = [
    // HOME
    {
      id: "home-intro",
      page: "home",
      selector: ".hero-banner",
      title: "Welcome to ProfitPlate",
      text:
        "This is a static prototype that shows how you’ll track real dish cost and margin. Let’s do a quick tour.",
      panelPlacement: "bottom",
    },
    {
      id: "home-nav",
      page: "home",
      selector: "nav .nav-link[href='purchases.html']",
      title: "Three main areas",
      text:
        "Use these tabs to move between Purchases (ingredient costs), Recipes (dishes), and Settings (currency & behaviour).",
      panelPlacement: "bottom",
    },

    // PURCHASES
    {
      id: "purchases-table",
      page: "purchases",
      selector: "table",
      title: "Latest price always visible",
      text:
        "Each row is an ingredient with its latest price. When you change prices here, any recipes using that ingredient will update automatically.",
      panelPlacement: "bottom",
    },

    // RECIPES
    {
      id: "recipes-overview",
      page: "recipes",
      selector: ".page h1, .page h2",
      title: "Recipes: cost per dish and margin",
      text:
        "This is where you’ll see each dish on your menu, its cost per portion, selling price, and profit margin.",
      panelPlacement: "bottom",
    },

    // SETTINGS – behaviour toggles
    {
      id: "settings-behaviour",
      page: "settings",
      selector: "#settings-behaviour",
      title: "Behaviour: smart updates",
      text:
        "These toggles control whether recipes auto-recalculate when ingredient prices change, and whether to show advanced cost breakdowns by default.",
      panelPlacement: "bottom",
    },

    // SETTINGS – data & local storage + demo CTA
    {
      id: "settings-data",
      page: "settings",
      selector: "#settings-data",
      title: "Data & local storage",
      text:
        "Right now everything lives only in your browser — no server, no cloud. In a future version, this is where imports, exports and backups will live.",
      panelPlacement: "bottom",
      showDemoButton: true, // show “Load demo data” here
    },
  ];

  // DOM elements for overlay
  let backdropEl = null;
  let highlightEl = null;
  let panelEl = null;
  let currentIndex = null;

  function readState() {
    try {
      const raw = localStorage.getItem(TOUR_STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveState(state) {
    try {
      if (!state) {
        localStorage.removeItem(TOUR_STATE_KEY);
      } else {
        localStorage.setItem(TOUR_STATE_KEY, JSON.stringify(state));
      }
    } catch (e) {
      // ignore
    }
  }

  function ensureChrome() {
    if (backdropEl) return;

    const style = document.createElement("style");
    style.textContent = `
.pp-tour-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.55);
  z-index: 9998;
}

.pp-tour-highlight {
  position: fixed;
  border-radius: 16px;
  box-shadow: 0 0 0 2px #ffffff, 0 0 0 9999px rgba(0,0,0,0.55);
  pointer-events: none;
  z-index: 9999;
}

.pp-tour-panel {
  position: fixed;
  max-width: 520px;
  padding: 20px 24px 16px;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 18px 40px rgba(0,0,0,0.35);
  z-index: 10000;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.pp-tour-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.pp-tour-text {
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 16px;
}

.pp-tour-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.pp-tour-btn {
  border-radius: 999px;
  border: none;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
}

.pp-tour-btn-secondary {
  background: #f0f0f0;
  color: #222;
}

.pp-tour-btn-primary {
  background: #0b5d3f;
  color: #ffffff;
}

.pp-tour-btn-ghost {
  background: transparent;
  color: #555;
}
`;
    document.head.appendChild(style);

    backdropEl = document.createElement("div");
    backdropEl.className = "pp-tour-backdrop";

    highlightEl = document.createElement("div");
    highlightEl.className = "pp-tour-highlight";
    highlightEl.style.display = "none";

    panelEl = document.createElement("div");
    panelEl.className = "pp-tour-panel";

    document.body.appendChild(backdropEl);
    document.body.appendChild(highlightEl);
    document.body.appendChild(panelEl);
  }

  function endTour() {
    currentIndex = null;
    saveState(null);
    if (backdropEl) backdropEl.style.display = "none";
    if (highlightEl) highlightEl.style.display = "none";
    if (panelEl) panelEl.style.display = "none";
  }

  function goToStep(newIndex) {
    if (newIndex < 0 || newIndex >= STEPS.length) {
      endTour();
      return;
    }

    const nextStep = STEPS[newIndex];

    // If step is on another page, save state and navigate
    if (nextStep.page !== PAGE_ID) {
      saveState({ active: true, index: newIndex });
      window.location.href = pageToUrl(nextStep.page);
      return;
    }

    currentIndex = newIndex;
    saveState({ active: true, index: currentIndex });
    renderCurrentStep();
  }

  function renderCurrentStep() {
    if (currentIndex == null) return;
    ensureChrome();

    const step = STEPS[currentIndex];

    // Default: hide highlight
    highlightEl.style.display = "none";

    let targetRect = null;
    let targetEl = null;

    if (step.selector) {
      targetEl = document.querySelector(step.selector);
      if (targetEl) {
        targetEl.scrollIntoView({ block: "center", behavior: "smooth" });
        const rect = targetEl.getBoundingClientRect();
        // Only treat as valid if it has some size
        if (rect.width > 10 && rect.height > 10) {
          targetRect = rect;
        }
      }
    }

    // Show highlight if we have a valid target
    if (targetRect) {
      const padding = 12;
      highlightEl.style.display = "block";
      highlightEl.style.top = targetRect.top - padding + "px";
      highlightEl.style.left = targetRect.left - padding + "px";
      highlightEl.style.width = targetRect.width + padding * 2 + "px";
      highlightEl.style.height = targetRect.height + padding * 2 + "px";
    } else {
      highlightEl.style.display = "none";
    }

    backdropEl.style.display = "block";
    panelEl.style.display = "block";

    // Build panel content
    const isFirst = currentIndex === 0;
    const isLast = currentIndex === STEPS.length - 1;

    const showDemo =
      !!step.showDemoButton &&
      typeof window.ppLoadSampleDataFromTour === "function";

    panelEl.innerHTML = `
      <div class="pp-tour-title">${step.title}</div>
      <div class="pp-tour-text">${step.text}</div>
      <div class="pp-tour-footer">
        <button class="pp-tour-btn pp-tour-btn-ghost" data-pp-tour="exit">Exit</button>
        <button class="pp-tour-btn pp-tour-btn-secondary" data-pp-tour="back"${
          isFirst ? ' disabled style="opacity:0.4;cursor:default;"' : ""
        }>Back</button>
        ${
          showDemo
            ? '<button class="pp-tour-btn pp-tour-btn-secondary" data-pp-tour="demo">Load demo data</button>'
            : ""
        }
        <button class="pp-tour-btn pp-tour-btn-primary" data-pp-tour="next">${
          isLast ? "Finish" : "Next"
        }</button>
      </div>
    `;

    // Position panel – relative to target if present, otherwise centered bottom
    // Use a small timeout so the browser can measure the element
    setTimeout(() => {
      const panelRect = panelEl.getBoundingClientRect();
      let top, left;

      if (targetRect) {
        // Attach under the target, centered horizontally
        const margin = 24;
        const maxTop = window.innerHeight - panelRect.height - 16;
        top = Math.min(maxTop, targetRect.bottom + margin);

        const centerX = targetRect.left + targetRect.width / 2;
        left = centerX - panelRect.width / 2;
        left = Math.max(16, Math.min(left, window.innerWidth - panelRect.width - 16));
      } else {
        // No target – center at the bottom
        top = window.innerHeight - panelRect.height - 32;
        left = (window.innerWidth - panelRect.width) / 2;
      }

      panelEl.style.top = top + "px";
      panelEl.style.left = left + "px";
    }, 0);

    // Wire buttons
    panelEl.querySelector('[data-pp-tour="exit"]').onclick = () => {
      endTour();
    };

    const backBtn = panelEl.querySelector('[data-pp-tour="back"]');
    if (backBtn) {
      backBtn.onclick = () => {
        if (currentIndex > 0) goToStep(currentIndex - 1);
      };
    }

    panelEl.querySelector('[data-pp-tour="next"]').onclick = () => {
      goToStep(currentIndex + 1);
    };

    const demoBtn = panelEl.querySelector('[data-pp-tour="demo"]');
    if (demoBtn) {
      demoBtn.onclick = () => {
        if (typeof window.ppLoadSampleDataFromTour === "function") {
          window.ppLoadSampleDataFromTour();
        }
      };
    }
  }

  function startTourFromBeginning() {
    goToStep(0);
  }

  function maybeResumeTourFromState() {
    const state = readState();
    if (!state || !state.active) return;
    const idx = typeof state.index === "number" ? state.index : 0;
    const step = STEPS[idx];
    if (!step || step.page !== PAGE_ID) {
      // Not our page for this step – do nothing, next navigation will handle it
      return;
    }
    currentIndex = idx;
    renderCurrentStep();
  }

  document.addEventListener("DOMContentLoaded", function () {
    // Hook the “See how it works” button on home
    const startBtn = document.getElementById("pp-how-it-works");
    if (howBtn && PAGE_ID === "home") {
      howBtn.addEventListener("click", function () {
        startTourFromBeginning();
      });
    }

    // If the user was in the middle of the tour, resume
    maybeResumeTourFromState();
  });
})();
