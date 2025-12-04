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

  // ===========================
  // Demo Data Seeder
  // ===========================
  function seedDemoData() {
    // Only seed if absolutely nothing exists
    if (purchases.length > 0 || recipes.length > 0) return;

    const demoPurchases = [
      {
        id: "p_demo_1",
        name: "Butter 82% (Demo)",
        category: "Dairy & Eggs",
        subtype: "Butter",
        supplier: "Metro",
        unit: "kg",
        pricePerUnit: 12.5,
        updatedAt: new Date().toISOString(),
        isDemo: true,
        priceHistory: []
      },
      {
        id: "p_demo_2",
        name: "Spaghetti No.5 (Demo)",
        category: "Dry Goods",
        subtype: "Pasta",
        supplier: "Local Dist.",
        unit: "kg",
        pricePerUnit: 2.2,
        updatedAt: new Date().toISOString(),
        isDemo: true,
        priceHistory: []
      },
      {
        id: "p_demo_3",
        name: "Pancetta Cured (Demo)",
        category: "Meat & Fish",
        subtype: "Cured",
        supplier: "Butcher",
        unit: "kg",
        pricePerUnit: 18.0,
        updatedAt: new Date().toISOString(),
        isDemo: true,
        priceHistory: []
      },
      {
        id: "p_demo_4",
        name: "Eggs (Large) (Demo)",
        category: "Dairy & Eggs",
        subtype: "Eggs",
        supplier: "Farm",
        unit: "pcs",
        pricePerUnit: 0.35,
        updatedAt: new Date().toISOString(),
        isDemo: true,
        priceHistory: []
      }
    ];

    const demoRecipes = [
      {
        id: "r_demo_1",
        name: "Carbonara (Demo)",
        portions: 4,
        sellingPrice: 14.0,
        archived: false,
        isDemo: true,
        ingredients: [
          { purchaseId: "p_demo_2", quantity: 0.5, unit: "kg" }, // 500g pasta
          { purchaseId: "p_demo_3", quantity: 0.2, unit: "kg" }, // 200g pancetta
          { purchaseId: "p_demo_4", quantity: 5, unit: "pcs" },   // 5 eggs
          { purchaseId: "p_demo_1", quantity: 0.05, unit: "kg" } // 50g butter
        ]
      }
    ];

    purchases = demoPurchases;
    recipes = demoRecipes;
    safeSave(KEYS.purchases, purchases);
    safeSave(KEYS.recipes, recipes);
    console.log("ProfitPlate: Demo data seeded.");
  }

  // Run seeder on init
  seedDemoData();

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

      // If user edits a demo item, it's no longer a demo item
      if (merged.isDemo) delete merged.isDemo;

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
      // If user edits a demo recipe, it's no longer demo
      if (recipe.isDemo) delete recipe.isDemo;

      const idx = recipes.findIndex((r) => r.id === recipe.id);
      if (idx === -1) {
        recipes.push(recipe);
      } else {
        recipes[idx] = recipe;
      }
      safeSave(KEYS.recipes, recipes);
    },

    // --- DATA MANAGEMENT ---
    removeDemoData() {
      // Filter out anything marked isDemo
      purchases = purchases.filter(p => !p.isDemo);
      recipes = recipes.filter(r => !r.isDemo);
      safeSave(KEYS.purchases, purchases);
      safeSave(KEYS.recipes, recipes);
      return { pCount: purchases.length, rCount: recipes.length };
    },

    nukeUserData() {
      // Keep settings, kill data
      purchases = [];
      recipes = [];
      safeSave(KEYS.purchases, purchases);
      safeSave(KEYS.recipes, recipes);
    }
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

        if(item.isDemo) {
          const demoTag = document.createElement("span");
          demoTag.textContent = " (Demo)";
          demoTag.style.color = "#888";
          title.appendChild(demoTag);
        }

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

          let displayName = item.name || "";
          if (item.isDemo) displayName += " (Demo)";

          addCell(displayName);
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
})();
