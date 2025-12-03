// app.js – Tiny brain for ProfitPlate
// - Shared storage (purchases, recipes, settings)
// - Purchases page behaviour (form, pack helper, table render, filters)
// - Settings helpers
// - Exposes window.ppStore for recipes.js
(function () {
  // ===========================
  // Storage helpers
  // ===========================
  const KEYS = {
    purchases: "pp_purchases",
    recipes: "pp_recipes",
    settings: "pp_settings",
  };

  function safeLoad(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn("ProfitPlate: failed to load", key, e);
      return fallback;
    }
  }

  function safeSave(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn("ProfitPlate: failed to save", key, e);
    }
  }

  // In-memory caches
  let purchases = safeLoad(KEYS.purchases, []);
  let recipes = safeLoad(KEYS.recipes, []);
  let settings = safeLoad(KEYS.settings, {
    currency: "EUR",
    locale: "eu",
    autoRecalc: true,
    showAdvanced: true,
  });

  // --- sanitize old / broken purchase entries (from earlier versions)
  function sanitizePurchases() {
    purchases = (purchases || [])
      .filter((p) => p && typeof p === "object")
      .map((p) => {
        const n = { ...p };

        // Normalize price
        const raw = n.pricePerUnit;
        const price = Number(raw);
        if (!Number.isFinite(price) || price < 0) {
          n.pricePerUnit = 0;
        } else {
          n.pricePerUnit = price;
        }

        // Normalize history: ensure array of { date, pricePerUnit }
        let hist = Array.isArray(n.priceHistory) ? n.priceHistory : [];
        hist = hist
          .filter((h) => h && typeof h === "object")
          .map((h) => {
            const hp = Number(h.pricePerUnit);
            const d =
              h.date ||
              n.updatedAt ||
              n.createdAt ||
              new Date().toISOString();
            return {
              date: d,
              pricePerUnit: Number.isFinite(hp) ? hp : n.pricePerUnit || 0,
            };
          });

        // If there is no history but we have a price, seed one entry
        if (!hist.length && n.pricePerUnit > 0) {
          const baseDate =
            n.updatedAt || n.createdAt || new Date().toISOString();
          hist.push({
            date: baseDate,
            pricePerUnit: n.pricePerUnit,
          });
        }

        // Keep only last 10 records (oldest dropped)
        if (hist.length > 10) {
          hist = hist.slice(hist.length - 10);
        }

        n.priceHistory = hist;
        return n;
      });

    safeSave(KEYS.purchases, purchases);
  }

  sanitizePurchases();

  // ===========================
  // Settings helper API
  // ===========================
  function loadSettings() {
    return { ...settings };
  }

  function saveSettings(next) {
    settings = { ...settings, ...(next || {}) };
    safeSave(KEYS.settings, settings);
    return { ...settings };
  }

  window.loadSettings = loadSettings;
  window.saveSettings = saveSettings;

  // ===========================
  // Shared unit helpers
  // ===========================
  function normalizeUnit(u) {
    if (!u) return "";
    u = String(u).toLowerCase();
    if (u === "gr") u = "g";
    return u;
  }

  function convertQty(qty, fromUnit, toUnit) {
    let q = Number(qty) || 0;
    const from = normalizeUnit(fromUnit);
    const to = normalizeUnit(toUnit);
    if (!from || !to || from === to) return q;

    // g <-> kg
    if (from === "g" && to === "kg") return q / 1000;
    if (from === "kg" && to === "g") return q * 1000;

    // ml <-> l
    if (from === "ml" && to === "l") return q / 1000;
    if (from === "l" && to === "ml") return q * 1000;

    // incompatible? just return original
    return q;
  }

  // ===========================
  // Shared store API for Recipes
  // ===========================
  const ppStore = {
    // Purchases
    getPurchases() {
      return purchases.slice();
    },

    upsertPurchase(purchase) {
      // central place to maintain history + timestamps
      const nowIso = new Date().toISOString();

      const idx = purchases.findIndex((p) => p.id === purchase.id);
      const existing = idx !== -1 ? purchases[idx] : null;
      const id =
        purchase.id || (existing && existing.id) || "p_" + Date.now();
      const createdAt =
        (existing && existing.createdAt) ||
        purchase.createdAt ||
        nowIso;

      const numericPrice =
        Number(String(purchase.pricePerUnit || "").replace(",", ".")) || 0;

      // Start from existing history if present
      let history =
        existing && Array.isArray(existing.priceHistory)
          ? existing.priceHistory.slice()
          : [];

      let lastRecorded =
        history.length > 0
          ? Number(history[history.length - 1].pricePerUnit)
          : null;

      if (!history.length && existing && existing.pricePerUnit > 0) {
        // Seed with existing stored price
        history.push({
          date: existing.updatedAt || existing.createdAt || nowIso,
          pricePerUnit: Number(existing.pricePerUnit) || 0,
        });
        lastRecorded = history[history.length - 1].pricePerUnit;
      }

      // If price changed, append new history record
      if (
        numericPrice > 0 &&
        (lastRecorded === null ||
          !Number.isFinite(lastRecorded) ||
          numericPrice !== lastRecorded)
      ) {
        history.push({
          date: nowIso,
          pricePerUnit: numericPrice,
        });
      }

      // If still no history but we have a price (new item), seed entry
      if (!history.length && numericPrice > 0) {
        history.push({
          date: nowIso,
          pricePerUnit: numericPrice,
        });
      }

      // Keep only last 10
      if (history.length > 10) {
        history = history.slice(history.length - 10);
      }

      const merged = {
        ...(existing || {}),
        ...purchase,
        id,
        createdAt,
        updatedAt: nowIso,
        pricePerUnit: numericPrice,
        priceHistory: history,
      };

      if (idx === -1) {
        purchases.push(merged);
      } else {
        purchases[idx] = merged;
      }

      sanitizePurchases();
    },

    // Recipes
    getRecipes() {
      return recipes.slice();
    },

    upsertRecipe(recipe) {
      const idx = recipes.findIndex((r) => r.id === recipe.id);
      if (idx === -1) {
        recipes.push(recipe);
      } else {
        recipes[idx] = recipe;
      }
      safeSave(KEYS.recipes, recipes);
    },
  };

  window.ppStore = ppStore;

  // ===========================
  // Purchases page behaviour
  // ===========================
  function initPurchasesPage() {
    const tableBody = document.getElementById("purchase-table");
    if (!tableBody) return; // not on purchases.html

    const addFormWrapper = document.getElementById("add-item-form");
    const purchaseForm = document.getElementById("purchase-form");
    const recentList = document.getElementById("recent-list");
    const searchInput = document.getElementById("search-input");
    const categoryFilter = document.getElementById("category-filter");
    const nameInput = document.getElementById("item-name");
    const categoryInput = document.getElementById("item-category");
    const subtypeInput = document.getElementById("item-subtype");
    const supplierInput = document.getElementById("item-supplier");
    const invoiceNumberInput = document.getElementById("item-invoice-number");
    const invoiceDateInput = document.getElementById("item-invoice-date");
    const unitInput = document.getElementById("item-unit");
    const priceInput = document.getElementById("item-price");
    const notesInput = document.getElementById("item-notes");

    const packQtyInput = document.getElementById("pack-qty");
    const packUnitSelect = document.getElementById("pack-unit");
    const packPriceInput = document.getElementById("pack-price");

    const historyBlock = document.getElementById("price-history-block");
    const historyBody = document.getElementById("price-history-body");

    let editingId = null;

    // Category -> subtype options
    const categorySubtypes = {
      "Meat & Fish": ["Fresh", "Frozen", "Smoked", "Raw", "Cured", "Seafood"],
      "Dairy & Eggs": ["Milk / Cream", "Butter", "Cheese", "Eggs"],
      "Vegetables & Fruit": ["Fresh", "Frozen", "Dried", "Canned"],
      "Dry Goods": ["Pasta", "Flour", "Sugar", "Rice", "Legumes"],
      "Spices & Condiments": ["Spices", "Oils", "Vinegars", "Sauces"],
      Other: [],
    };

    function populateSubtypeSelect(category) {
      const list = categorySubtypes[category] || [];
      subtypeInput.innerHTML = "";
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = list.length ? "Select..." : "No sub-type";
      subtypeInput.appendChild(placeholder);
      list.forEach((st) => {
        const opt = document.createElement("option");
        opt.value = st;
        opt.textContent = st;
        subtypeInput.appendChild(opt);
      });
    }

    if (categoryInput) {
      categoryInput.addEventListener("change", function (e) {
        populateSubtypeSelect(e.target.value);
      });
    }

    // Toggle form visibility
    function toggleAddForm() {
      if (!addFormWrapper || !purchaseForm) return;
      const isHidden = addFormWrapper.classList.contains("hidden");
      if (isHidden) {
        addFormWrapper.classList.remove("hidden");
        if (historyBlock) historyBlock.classList.add("hidden");
        editingId = null;
        purchaseForm.reset();
        window.scrollTo({
          top: addFormWrapper.offsetTop - 40,
          behavior: "smooth",
        });
      } else {
        addFormWrapper.classList.add("hidden");
        editingId = null;
        purchaseForm.reset();
        if (historyBlock) historyBlock.classList.add("hidden");
      }
    }

    window.toggleAddForm = toggleAddForm;

    // Pack helper
    function fillPriceFromPack() {
      const baseUnit = unitInput.value;
      const packQty =
        Number(String(packQtyInput.value || "").replace(",", ".")) || 0;
      const packUnit = packUnitSelect.value;
      const packPrice =
        Number(String(packPriceInput.value || "").replace(",", ".")) || 0;

      if (!baseUnit || !packUnit || !packQty || !packPrice) {
        alert(
          "Fill pack quantity, pack unit and pack price before using the helper."
        );
        return;
      }

      const qtyInBase = convertQty(packQty, packUnit, baseUnit);
      if (!qtyInBase || qtyInBase <= 0) {
        alert(
          "Units not compatible.\nUse g/kg or ml/L or the same unit for the pack and recipe."
        );
        return;
      }

      const perUnit = packPrice / qtyInBase;
      priceInput.value = perUnit.toFixed(4);
    }

    window.fillPriceFromPack = fillPriceFromPack;

    // Helpers
    function formatDate(dateStr) {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      if (isNaN(d)) return dateStr;
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    }

    function getSafePrice(item) {
      const p = Number(item.pricePerUnit);
      if (!Number.isFinite(p) || p <= 0) return 0;
      return p;
    }

    // Render "Recently updated"
    function renderRecent() {
      if (!recentList) return;
      recentList.innerHTML = "";

      if (!purchases.length) {
        const p = document.createElement("p");
        p.className = "text-muted";
        p.textContent = "No items yet. Add your first ingredient above.";
        recentList.appendChild(p);
        return;
      }

      const latest = purchases
        .slice()
        .sort(
          (a, b) =>
            new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
        )
        .slice(0, 3);

      latest.forEach((item) => {
        const card = document.createElement("div");
        card.className = "card-updated";

        const price = getSafePrice(item);
        const priceLabel =
          price > 0
            ? `${price.toFixed(4)} €/ ${item.unit || ""}`
            : "-";

        const title = document.createElement("div");
        title.className = "card-updated-title";
        title.textContent = `${item.name} – ${priceLabel}`;

        const meta = document.createElement("small");
        const catPart = item.category || "";
        const subPart = item.subtype ? ` (${item.subtype})` : "";
        const supPart = item.supplier
          ? ` • Supplier: ${item.supplier}`
          : "";
        meta.textContent = `Updated ${formatDate(
          item.updatedAt
        )} • ${catPart}${subPart}${supPart}`;

        card.appendChild(title);
        card.appendChild(meta);
        recentList.appendChild(card);
      });
    }

    // Render price history table
    function renderPriceHistory(item) {
      if (!historyBlock || !historyBody) return;
      historyBody.innerHTML = "";

      if (
        !item ||
        !Array.isArray(item.priceHistory) ||
        !item.priceHistory.length
      ) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 2;
        td.textContent = "No price history yet.";
        tr.appendChild(td);
        historyBody.appendChild(tr);
        historyBlock.classList.remove("hidden");
        return;
      }

      const sorted = item.priceHistory
        .slice()
        .sort((a, b) => new Date(b.date) - new Date(a.date)) // newest first
        .slice(0, 10);

      sorted.forEach((entry) => {
        const tr = document.createElement("tr");
        const tdDate = document.createElement("td");
        tdDate.textContent = formatDate(entry.date);
        const tdPrice = document.createElement("td");
        const val = Number(entry.pricePerUnit) || 0;
        tdPrice.textContent =
          val.toFixed(4) + " €/ " + (item.unit || "");
        tr.appendChild(tdDate);
        tr.appendChild(tdPrice);
        historyBody.appendChild(tr);
      });

      historyBlock.classList.remove("hidden");
    }

    // Render main table with search + category filter
    function renderTable() {
      const q = (searchInput ? searchInput.value : "").toLowerCase();
      const cat = categoryFilter ? categoryFilter.value : "";

      tableBody.innerHTML = "";

      purchases
        .slice()
        .filter((p) => {
          if (cat && p.category !== cat) return false;

          if (!q) return true;

          const haystack =
            [
              p.name || "",
              p.category || "",
              p.subtype || "",
              p.supplier || "",
              p.invoiceNumber || "",
            ]
              .join(" ")
              .toLowerCase();

          return haystack.includes(q);
        })
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((item) => {
          const tr = document.createElement("tr");

          function addCell(text) {
            const td = document.createElement("td");
            td.textContent = text;
            tr.appendChild(td);
          }

          const price = getSafePrice(item);
          const priceLabel =
            price > 0
              ? `${price.toFixed(4)} €/ ${item.unit || ""}`
              : "-";

          addCell(item.name || "");
          addCell(item.category || "");
          addCell(item.subtype || "");
          addCell(item.supplier || "");
          addCell(item.invoiceNumber || "");
          addCell(item.unit || "");
          addCell(priceLabel);
          addCell(formatDate(item.updatedAt));

          const actionsTd = document.createElement("td");
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = "Edit";
          btn.dataset.edit = item.id;
          btn.className = "btn-secondary small";
          actionsTd.appendChild(btn);
          tr.appendChild(actionsTd);

          tableBody.appendChild(tr);
        });
    }

    // Initial render
    renderRecent();
    renderTable();

    // Search + category filter listeners
    if (searchInput) {
      searchInput.addEventListener("input", renderTable);
    }
    if (categoryFilter) {
      categoryFilter.addEventListener("change", renderTable);
    }

    // Edit click
    tableBody.addEventListener("click", function (e) {
      const btn = e.target.closest("button[data-edit]");
      if (!btn) return;

      const id = btn.dataset.edit;
      const item = purchases.find((p) => p.id === id);
      if (!item) return;

      editingId = id;

      nameInput.value = item.name || "";
      categoryInput.value = item.category || "";
      populateSubtypeSelect(item.category || "");
      subtypeInput.value = item.subtype || "";
      supplierInput.value = item.supplier || "";
      invoiceNumberInput.value = item.invoiceNumber || "";
      invoiceDateInput.value = item.invoiceDate || "";
      unitInput.value = item.unit || "";

      const price = getSafePrice(item);
      priceInput.value = price > 0 ? price.toFixed(4) : "";

      notesInput.value = item.notes || "";

      addFormWrapper.classList.remove("hidden");
      renderPriceHistory(item);

      window.scrollTo({
        top: addFormWrapper.offsetTop - 40,
        behavior: "smooth",
      });
    });

    // Submit form
    purchaseForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const name = nameInput.value.trim();
      const category = categoryInput.value;
      const subtype = subtypeInput.value;
      const supplier = supplierInput.value.trim();
      const invoiceNumber = invoiceNumberInput.value.trim();
      const invoiceDate = invoiceDateInput.value || null;
      const unit = unitInput.value;
      const price =
        Number(String(priceInput.value || "").replace(",", ".")) || 0;
      const notes = notesInput.value.trim();

      if (!name) {
        alert("Please enter a name.");
        return;
      }
      if (!category) {
        alert("Please select a category.");
        return;
      }
      if (!unit) {
        alert("Please choose a unit.");
        return;
      }
      if (!price || price <= 0) {
        alert("Please enter a valid price per unit.");
        return;
      }

      const now = new Date().toISOString();
      let id = editingId;
      if (!id) {
        id = "p_" + Date.now();
      }

      const existing = purchases.find((p) => p.id === id);
      const createdAt = existing ? existing.createdAt : now;

      const obj = {
        id,
        name,
        category,
        subtype,
        supplier,
        invoiceNumber,
        invoiceDate,
        unit,
        pricePerUnit: price,
        notes,
        createdAt,
        updatedAt: now,
        // priceHistory will be handled/merged inside ppStore.upsertPurchase
      };

      // Persist through store
      ppStore.upsertPurchase(obj);
      purchases = ppStore.getPurchases();

      alert(
        "Item saved locally.\nIt will be available to use on the Recipes page."
      );

      editingId = null;
      purchaseForm.reset();
      addFormWrapper.classList.add("hidden");
      if (historyBlock) historyBlock.classList.add("hidden");

      renderRecent();
      renderTable();
    });
  }

  // ===========================
  // Init on DOMContentLoaded
  // ===========================
  document.addEventListener("DOMContentLoaded", function () {
    initPurchasesPage();
  });

  // ===========================
  // === PROFITPLATE 2.0+ ===
  // === GUIDED TOUR & DEMO DATA ===
  // ===========================

  // Demo data
  const PP_DEMO_PURCHASES = [
    { id: "p_demo_1", name: "Butter 82% 1kg", pricePerUnit: 16, unit: "kg", supplier: "Metro", isDemo: true },
    { id: "p_demo_2", name: "Pasta Spaghetti 5kg", pricePerUnit: 8, unit: "kg", supplier: "Metro", isDemo: true },
    { id: "p_demo_3", name: "Eggs 30pcs", pricePerUnit: 10, unit: "pcs", supplier: "Nicolas", isDemo: true },
    { id: "p_demo_4", name: "Parmesan Reggiano", pricePerUnit: 30, unit: "kg", supplier: "Metro", isDemo: true },
    { id: "p_demo_5", name: "Olive Oil", pricePerUnit: 12, unit: "L", supplier: "Metro", isDemo: true },
  ];
  const PP_DEMO_RECIPES = [
    {
      id: "r_demo_1",
      name: "Spaghetti Carbonara",
      servings: 10,
      price: 85,
      items: [
        { purchaseId: "p_demo_1", amount: 0.25 }, // Butter
        { purchaseId: "p_demo_2", amount: 1 },    // Pasta
        { purchaseId: "p_demo_3", amount: 10 },   // Eggs
        { purchaseId: "p_demo_4", amount: 0.4 },  // Parmesan
      ],
      isDemo: true
    }
  ];

  // Safe demo data loader
  function loadDemoData() {
    // Add demo purchases/recipes without removing user's real data
    let currentPurchases = safeLoad(KEYS.purchases, []).filter(p => !p.isDemo);
    let currentRecipes = safeLoad(KEYS.recipes, []).filter(r => !r.isDemo);
    // Avoid duplicate demo entries
    const allPurchases = [...currentPurchases, ...PP_DEMO_PURCHASES.filter(demo => !currentPurchases.some(p => p.id === demo.id))];
    const allRecipes = [...currentRecipes, ...PP_DEMO_RECIPES.filter(demo => !currentRecipes.some(r => r.id === demo.id))];
    safeSave(KEYS.purchases, allPurchases);
    safeSave(KEYS.recipes, allRecipes);
  }
  // Only removes isDemo: true
  function clearDemoData() {
    const currentPurchases = safeLoad(KEYS.purchases, []).filter(p => !p.isDemo);
    const currentRecipes = safeLoad(KEYS.recipes, []).filter(r => !r.isDemo);
    safeSave(KEYS.purchases, currentPurchases);
    safeSave(KEYS.recipes, currentRecipes);
  }
  // Deletes everything! Needs "DELETE" confirmation.
  function nukeAllData() {
    localStorage.removeItem(KEYS.purchases);
    localStorage.removeItem(KEYS.recipes);
    localStorage.removeItem(KEYS.settings);
    location.reload();
  }

  // Guided tour overlay
  function ppStartGuidedTour() {
    if (window.ppTourRunning) return;
    window.ppTourRunning = true;
    const steps = [
      {
        selector: 'nav a[href*="purchases"], nav li:contains("Purchases")',
        title: "Purchases – your ingredient base",
        msg: "This is where you keep all your ingredients with up-to-date prices and suppliers.",
      },
      {
        selector: '#add-item-form, #addItemButton, .add-item-btn',
        title: "Add ingredient",
        msg: "Click here to add butter, pasta, meat, herbs – anything you buy. Set unit, supplier, price, etc.",
      },
      {
        selector: '.purchase-list, #purchase-table, .recent-updates',
        title: "Keep prices fresh",
        msg: "Edit ingredients when prices change. Archive items you don’t use instead of deleting.",
      },
      {
        selector: 'nav a[href*="recipes"], nav li:contains("Recipes")',
        title: "Recipes – see real cost per portion",
        msg: "Create recipes, pick ingredients, and ProfitPlate calculates batch/portion/margin for you.",
      },
      {
        selector: 'nav a[href*="settings"], nav li:contains("Settings")',
        title: "Settings",
        msg: "Change currency, number format, and how ProfitPlate behaves. Manage demo data here.",
      }
    ];
    let idx = 0;
    function renderStep() {
      let s = steps[idx];
      removeTourOverlay();
      if (!s) { endTour(); return; }
      let el = document.querySelector(s.selector);
      let rect = el ? el.getBoundingClientRect() : {top:100,left:100,width:300,height:60};
      let overlay = document.createElement("div");
      overlay.id = "pp-tour-overlay";
      overlay.innerHTML = `
        <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.5);z-index:5000"></div>
        <div style="position:fixed;top:${rect.top+window.scrollY-20}px;left:${rect.left+window.scrollX-20}px;width:${rect.width+40}px;height:${rect.height+40}px;border:2px solid #18c18c;border-radius:10px;box-shadow:0 0 40px #18c18c;z-index:5001;pointer-events:none;"></div>
        <div style="position:fixed;top:${rect.top+rect.height+window.scrollY+20}px;left:${rect.left+window.scrollX}px;max-width:320px;background:#fff;padding:20px 18px 10px 18px;border-radius:16px;z-index:5002;box-shadow:0 2px 18px #3338">
          <div style="font-weight:bold;font-size:1.2em;margin-bottom:4px;">${s.title}</div>
          <div style="font-size:1em;margin-bottom:16px;">${s.msg}</div>
          <div>
            ${idx > 0 ? `<button id="ppTourBack" style="margin-right:8px">Back</button>` : ""}
            ${idx < steps.length-1 ? `<button id="ppTourNext" style="background:#18c18c;color:#fff">Next</button>` : `<button id="ppTourFinish" style="background:#18c18c;color:#fff">Finish</button>`}
            <button id="ppTourExit" style="float:right">Exit</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      document.getElementById("ppTourExit").onclick = endTour;
      if (document.getElementById("ppTourNext")) document.getElementById("ppTourNext").onclick = () => { idx++; renderStep(); };
      if (document.getElementById("ppTourBack")) document.getElementById("ppTourBack").onclick = () => { idx--; renderStep(); };
      if (document.getElementById("ppTourFinish")) document.getElementById("ppTourFinish").onclick = () => {
        endTour();
        setTimeout(showDemoLoadModal, 100);
      };
    }
    function endTour() { removeTourOverlay(); window.ppTourRunning = false; }
    function removeTourOverlay() {
      let ex = document.getElementById("pp-tour-overlay");
      if (ex) ex.remove();
    }
    renderStep();
  }

  // Demo Load Modal
  function showDemoLoadModal() {
    if (document.getElementById("pp-demo-modal")) return;
    let m = document.createElement("div");
    m.id = "pp-demo-modal";
    m.innerHTML = `
      <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.4);z-index:6000"></div>
      <div style="position:fixed;top:30vh;left:50vw;transform:translateX(-50%);background:#fff;padding:28px 34px 22px 34px;box-shadow:0 2px 24px #3336;border-radius:20px;z-index:6001;text-align:center;min-width:260px">
        <div style="font-size:1.1em;margin-bottom:10px;"><b>Want to try ProfitPlate with demo data?</b></div>
        <div style="margin-bottom:18px">We’ll add a few demo ingredients and recipes so you can play without entering your own data.<br><span style="color:#18c18c"><b>Your real data stays safe.</b></span></div>
        <button id="ppDemoLoadYes" style="background:#18c18c;color:#fff;margin:6px 0 0 0">Load demo data</button>
        <button id="ppDemoLoadNo" style="margin-left:14px">Not now</button>
      </div>
    `;
    document.body.appendChild(m);
    document.getElementById("ppDemoLoadYes").onclick = () => {
      loadDemoData();
      m.remove();
      window.location.href = "recipes.html";
    };
    document.getElementById("ppDemoLoadNo").onclick = () => m.remove();
  }

  // Hook "See how it works" on home page (by button text, 0 layout changes)
  document.addEventListener("DOMContentLoaded", function() {
    // Find button by text if no id
    let btn = Array.from(document.querySelectorAll("a,button"))
      .find(el => el.textContent.trim().toLowerCase().includes("see how it works"));
    if (btn) {
      btn.style.cursor = "pointer";
      btn.onclick = function(e) {
        e.preventDefault();
        ppStartGuidedTour();
      };
    }
    // Settings page: hook up demo/user data delete logic
    let clearDemoBtn = document.querySelector("#clearDemoBtn, button[data-demo-clear]");
    if (clearDemoBtn) {
      clearDemoBtn.onclick = function() {
        if (confirm("Remove demo data (sample ingredients/recipes) from this browser?")) {
          clearDemoData();
          location.reload();
        }
      };
    }
    // Add "Delete ALL data" button logic if present
    let delAllBtn = document.querySelector("#deleteAllBtn, button[data-delete-all]");
    if (delAllBtn) {
      delAllBtn.onclick = function() {
        let c = prompt("WARNING: This will delete ALL your purchases, recipes, and settings from this browser. This cannot be undone.\n\nType DELETE to confirm.");
        if (c && c.trim().toUpperCase() === "DELETE") {
          nukeAllData();
        } else {
          alert("Not deleted. To confirm, you must type DELETE.");
        }
      };
    }
  });

  // Utility for debug/export
  window.ppLoadDemoData = loadDemoData;
  window.ppStartGuidedTour = ppStartGuidedTour;
  window.ppClearDemoData = clearDemoData;
  window.ppNukeAllData = nukeAllData;

})(); // end
