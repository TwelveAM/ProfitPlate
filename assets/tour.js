(function () {
  // Tour Configuration
  const steps = [
    {
      id: 0,
      page: "index.html", // Normalized path check
      type: "modal",
      title: "Welcome to ProfitPlate!",
      text: "A quick tour will show you the basics in under 20 seconds.",
      buttons: [
        { text: "Start tour", action: "next", class: "primary" },
        { text: "Skip", action: "exit" },
      ],
    },
    {
      id: 1,
      page: "index.html",
      selector: "nav a[href*='purchases']", // Target the nav link
      title: "Purchases – your ingredient base",
      text: "This is where you keep all your ingredients with up-to-date prices and suppliers.",
      position: "bottom",
      buttons: [
        { text: "Next", action: "next", class: "primary" },
        { text: "Exit", action: "exit" },
      ],
    },
    {
      id: 2,
      page: "purchases.html",
      selector: ".btn-primary", // The "Add item manually" button
      title: "Add ingredient",
      text: "Click here to add butter, pasta, meat, herbs – anything you buy. You’ll set unit, category, supplier and price here.",
      position: "bottom",
      buttons: [
        { text: "Back", action: "back" },
        { text: "Next", action: "next", class: "primary" },
        { text: "Exit", action: "exit" },
      ],
    },
    {
      id: 3,
      page: "purchases.html",
      selector: "#recent-list", // The recent list area
      title: "Keep prices fresh",
      text: "Edit ingredients when prices change. You can archive items you don’t use anymore instead of deleting them, so your history stays intact.",
      position: "top",
      buttons: [
        { text: "Back", action: "back" },
        { text: "Next", action: "next", class: "primary" },
        { text: "Exit", action: "exit" },
      ],
    },
    {
      id: 4,
      page: "recipes.html",
      selector: ".btn-primary", // The Add Recipe button
      title: "Recipes – see real cost",
      text: "Create a recipe, pick ingredients from Purchases, and ProfitPlate calculates batch cost, portion cost, and margin. <br><br>When ingredient prices change, recipes update automatically.",
      position: "bottom",
      buttons: [
        { text: "Back", action: "back" },
        { text: "Next", action: "next", class: "primary" },
        { text: "Exit", action: "exit" },
      ],
    },
    {
      id: 5,
      page: "settings.html",
      selector: ".settings-box", // First settings box
      title: "Settings",
      text: "Change currency, number format, and how ProfitPlate behaves. This is also where you’ll manage demo data.",
      position: "top",
      buttons: [
        { text: "Back", action: "back" },
        { text: "Finish", action: "finish", class: "primary" },
      ],
    },
  ];

  // Logic
  const STORAGE_KEY = "pp_tour_step";
  const STORAGE_ACTIVE = "pp_tour_active";

  function init() {
    // Check if tour is active
    if (sessionStorage.getItem(STORAGE_ACTIVE) === "true") {
      const stepIndex = parseInt(sessionStorage.getItem(STORAGE_KEY) || 0);
      renderStep(stepIndex);
    }

    // Hook 'See how it works' button on Home
    // We use a general listener in case the button loads later
    document.addEventListener("click", function (e) {
      if (e.target && e.target.textContent.includes("See how it works")) {
        e.preventDefault();
        startTour();
      }
    });
  }

  function startTour() {
    sessionStorage.setItem(STORAGE_ACTIVE, "true");
    sessionStorage.setItem(STORAGE_KEY, 0);
    // If not on home, go home
    if (!window.location.pathname.endsWith("index.html") && !window.location.pathname.endsWith("/")) {
      window.location.href = "index.html";
    } else {
      renderStep(0);
    }
  }

  function endTour() {
    sessionStorage.removeItem(STORAGE_ACTIVE);
    sessionStorage.removeItem(STORAGE_KEY);
    removeOverlay();
  }

  function navigateToPage(page) {
    // If we are already on the page (loose check), just return true
    if (window.location.pathname.includes(page) || (page === "index.html" && window.location.pathname.endsWith("/"))) {
      return true;
    }
    window.location.href = page;
    return false;
  }

  function renderStep(index) {
    const step = steps[index];
    if (!step) return endTour();

    // 1. Check Page
    if (!navigateToPage(step.page)) return; // browser will redirect, stop execution

    // 2. Setup Overlay
    let overlay = document.getElementById("tour-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "tour-overlay";
      document.body.appendChild(overlay);
      // Force reflow
      void overlay.offsetWidth;
      overlay.classList.add("active");
    }

    // Clear previous highlights
    document.querySelectorAll(".tour-highlight").forEach(el => el.classList.remove("tour-highlight"));
    const oldBubble = document.querySelector(".tour-bubble");
    if (oldBubble) oldBubble.remove();
    const oldModal = document.querySelector(".tour-modal");
    if (oldModal) oldModal.remove();

    // 3. Render Content
    if (step.type === "modal") {
      renderModal(step, index);
    } else {
      // Element highlight
      // Small delay to ensure DOM is ready if we just navigated
      setTimeout(() => {
        const target = document.querySelector(step.selector);
        if (target) {
          target.classList.add("tour-highlight");
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          renderBubble(step, target, index);
        } else {
          console.warn("Tour target not found:", step.selector);
          // If element missing, skip or end? Let's just end for safety.
          endTour();
        }
      }, 300);
    }
  }

  function renderModal(step, index) {
    const modal = document.createElement("div");
    modal.className = "tour-modal";
    modal.innerHTML = `
      <h2>${step.title}</h2>
      <p>${step.text}</p>
      <div class="tour-actions"></div>
    `;

    const actions = modal.querySelector(".tour-actions");
    step.buttons.forEach(btn => {
      const b = document.createElement("button");
      b.className = `tour-btn ${btn.class || ""}`;
      b.textContent = btn.text;
      b.onclick = () => handleAction(btn.action, index);
      actions.appendChild(b);
    });

    document.body.appendChild(modal);
  }

  function renderBubble(step, target, index) {
    const rect = target.getBoundingClientRect();
    const bubble = document.createElement("div");
    bubble.className = "tour-bubble";
    bubble.innerHTML = `
      <h3>${step.title}</h3>
      <p>${step.text}</p>
      <div class="tour-actions"></div>
    `;

    const actions = bubble.querySelector(".tour-actions");
    step.buttons.forEach(btn => {
      const b = document.createElement("button");
      b.className = `tour-btn ${btn.class || ""}`;
      b.textContent = btn.text;
      b.onclick = () => handleAction(btn.action, index);
      actions.appendChild(b);
    });

    document.body.appendChild(bubble);

    // Positioning logic (basic)
    const bubbleRect = bubble.getBoundingClientRect();
    let top, left;

    // Center horizontally on target
    left = rect.left + (rect.width / 2) - (bubbleRect.width / 2);
    // Keep in bounds
    if (left < 10) left = 10;
    if (left + bubbleRect.width > window.innerWidth) left = window.innerWidth - bubbleRect.width - 10;

    if (step.position === "top") {
      top = rect.top - bubbleRect.height - 15 + window.scrollY;
    } else {
      top = rect.bottom + 15 + window.scrollY;
    }

    bubble.style.top = `${top}px`;
    bubble.style.left = `${left}px`;
  }

  function handleAction(action, currentIndex) {
    if (action === "next") {
      const nextIndex = currentIndex + 1;
      sessionStorage.setItem(STORAGE_KEY, nextIndex);
      renderStep(nextIndex);
    } else if (action === "back") {
      const prevIndex = currentIndex - 1;
      if (prevIndex < 0) return;
      sessionStorage.setItem(STORAGE_KEY, prevIndex);
      renderStep(prevIndex);
    } else if (action === "exit") {
      endTour();
    } else if (action === "finish") {
      endTour();
      showDemoLoader();
    }
  }

  function removeOverlay() {
    const overlay = document.getElementById("tour-overlay");
    if (overlay) {
      overlay.classList.remove("active");
      setTimeout(() => overlay.remove(), 300);
    }
    document.querySelectorAll(".tour-highlight").forEach(el => el.classList.remove("tour-highlight"));
    const b = document.querySelector(".tour-bubble");
    if (b) b.remove();
    const m = document.querySelector(".tour-modal");
    if (m) m.remove();
  }

  function showDemoLoader() {
    // Create overlay
    const overlay = document.createElement("div");
    overlay.id = "tour-overlay";
    overlay.classList.add("active");
    document.body.appendChild(overlay);

    const modal = document.createElement("div");
    modal.className = "tour-modal";
    modal.innerHTML = `
      <h2>Load Demo Data?</h2>
      <p>We can add a few demo ingredients and a sample recipe (Carbonara) so you can see the math in action.</p>
      <p style="font-size:13px; color:#0b6e46; font-weight:500;">✅ Your existing data will stay safe and untouched.</p>
      <div class="tour-actions" style="justify-content: center; margin-top:20px;">
        <button class="tour-btn" id="btn-no-demo">Not now</button>
        <button class="tour-btn primary" id="btn-yes-demo">Load Demo Data</button>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById("btn-no-demo").onclick = function() {
      overlay.remove();
      modal.remove();
    };

    document.getElementById("btn-yes-demo").onclick = function() {
      if (window.ppStore && window.ppStore.addDemoDataSafe) {
        window.ppStore.addDemoDataSafe(); // Will handle adding + redirect
      }
      overlay.remove();
      modal.remove();
    };
  }

  // Run init on load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
