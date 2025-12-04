// assets/tour.js
(function () {
  const TOUR_STATE_KEY = "pp_tour_state_v1";

  // Work out which page we are on
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
      panelPlacement: "bottom"
    },
    {
      id: "home-nav",
      page: "home",
      selector: "nav .nav-link[href='purchases.html']",
      title: "Three main areas",
      text:
        "Use these tabs to move between Purchases (ingredient costs), Recipes (dishes), and Settings (currency & behaviour).",
      panelPlacement: "bottom"
    },

    // PURCHASES
    {
      id: "purchases-table",
      page: "purchases",
      selector: "#purchase-table, table",
      title: "Latest price always visible",
      text:
        "Each row is an ingredient with its latest price. When you change prices here, any recipes using that ingredient will update automatically.",
      panelPlacement: "bottom"
    },

    // RECIPES
    {
      id: "recipes-overview",
      page: "recipes",
      selector: ".page h1, .page h2",
      title: "Recipes: cost per dish and margin",
      text:
        "This is where you’ll see each dish on your menu, its cost per portion, selling price, and profit margin.",
      panelPlacement: "bottom"
    },

    // SETTINGS – behaviour toggles
    {
      id: "settings-behaviour",
      page: "settings",
      selector: "#settings-behaviour",
      title: "Behaviour: smart updates",
      text:
        "These toggles control whether recipes auto-recalculate when ingredient prices change, and whether to show advanced cost breakdowns by default.",
      panelPlacement: "bottom"
    },

    // SETTINGS – data & local storage + demo CTA
    {
      id: "settings-data",
      page: "settings",
      selector: "#settings-data",
      title: "Data & local storage",
      text:
        "For now everything lives only in your browser — no server, no cloud. In the future this is where imports, exports and backups will live.",
      panelPlacement: "bottom",
      showDemoButton: true
    }
  ];

  // DOM chrome
  let backdropEl = null;
  let highlightEl = null;
  let panelEl = null;
  let currentIndex = null;

  function readState() {
    try {
      const raw = localStorage.getItem(TOUR_STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
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
    } catch {
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

    // Need to be on a different page?
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
        if (rect.width > 10 && rect.height > 10) {
          targetRect = rect;
        }
      }
    }

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

    // Position the panel
    setTimeout(() => {
      const panelRect = panelEl.getBoundingClientRect();
      let top, left;

      if (targetRect) {
        const margin = 24;
        const maxTop = window.innerHeight - panelRect.height - 16;
        top = Math.min(maxTop, targetRect.bottom + margin);

        const centerX = targetRect.left + targetRect.width / 2;
        left = centerX - panelRect.width / 2;
        left = Math.max(
          16,
          Math.min(left, window.innerWidth - panelRect.width - 16)
        );
      } else {
        top = window.innerHeight - panelRect.height - 32;
        left = (window.innerWidth - panelRect.width) / 2;
      }

      panelEl.style.top = top + "px";
      panelEl.style.left = left + "px";
    }, 0);

    // Wire buttons
    const exitBtn = panelEl.querySelector('[data-pp-tour="exit"]');
    if (exitBtn) {
      exitBtn.onclick = () => endTour();
    }

    const backBtn = panelEl.querySelector('[data-pp-tour="back"]');
    if (backBtn && !backBtn.disabled) {
      backBtn.onclick = () => {
        if (currentIndex > 0) goToStep(currentIndex - 1);
      };
    }

    const nextBtn = panelEl.querySelector('[data-pp-tour="next"]');
    if (nextBtn) {
      nextBtn.onclick = () => goToStep(currentIndex + 1);
    }

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
      // Wrong page for this step – let navigation handle it later
      return;
    }

    currentIndex = idx;
    renderCurrentStep();
  }

  // Hook up button + resume on load
  document.addEventListener("DOMContentLoaded", function () {
    const btn = document.getElementById("btn-how-it-works");
    if (btn) {
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        startTourFromBeginning();
      });
    }

    maybeResumeTourFromState();
  });
})();
