// app.js – Tiny brain for ProfitPlate
// - Shared storage (purchases, recipes, settings)
// - Purchases page behaviour (form, pack helper, table render)
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
      const idx = purchases.findIndex((p) => p.id === purchase.id);
      if (idx === -1) {
        purchases.push(purchase);
      } else {
        purchases[idx] = purchase;
      }
      safeSave(KEYS.purchases, purchases);
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

    const nameInput = document.getElementById("item-name");
    const categoryInput = document.getElementById("item-category");
    const subtypeInput = document.getElementById("item-subtype");
    const supplierInput = document.getElementById("item-supplier");
    const unitInput = document.getElementById("item-unit");
    const priceInput = document.getElementById("item-price");
    const notesInput = document.getElementById("item-notes");

    const packQtyInput = document.getElementById("pack-qty");
    const packUnitSelect = document.getElementById("pack-unit");
    const packPriceInput = document.getElementById("pack-price");

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

    categoryInput.addEventListener("change", (e) => {
      populateSubtypeSelect(e.target.value);
    });

    // Toggle form visibility
    function toggleAddForm() {
      const isHidden = addFormWrapper.classList.contains("hidden");
      if (isHidden) {
        addFormWrapper.classList.remove("hidden");
        window.scrollTo({ top: addFormWrapper.offsetTop - 40, behavior: "smooth" });
      } else {
        addFormWrapper.classList.add("hidden");
        editingId = null;
        purchaseForm.reset();
      }
    }

    window.toggleAddForm = toggleAddForm;

    // Pack helper
    function fillPriceFromPack() {
      const baseUnit = unitInput.value;
      const packQty = Number((packQtyInput.value || "").toString().replace(",", ".")) || 0;
      const packUnit = packUnitSelect.value;
      const packPrice = Number((packPriceInput.value || "").toString().replace(",", ".")) || 0;

      if (!baseUnit || !packUnit || !packQty || !packPrice) {
        alert("Fill pack quantity, unit, and pack price first.");
        return;
      }

      const qtyInBase = convertQty(packQty, packUnit, baseUnit);
      if (!qtyInBase || qtyInBase <= 0) {
        alert("Units not compatible. Use g/kg or ml/L or same unit.");
        return;
      }

      const perUnit = packPrice / qtyInBase;
      priceInput.value = perUnit.toFixed(4);
    }

    window.fillPriceFromPack = fillPriceFromPack;

    // Helpers
    function formatDate(iso) {
      if (!iso) return "-";
      try {
        const d = new Date(iso);
        return d.toISOString().slice(0, 10);
      } catch {
        return "-";
      }
    }

    function renderRecent() {
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
        .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
        .slice(0, 3);

      latest.forEach((item) => {
        const card = document.createElement("div");
        card.className = "card-updated";
        card.innerHTML = `
          <div class="card-updated-title">
            ${item.name} – ${item.pricePerUnit.toFixed(4)} €/ ${item.unit}
          </div>
          <small>
            Updated ${formatDate(item.updatedAt)} • ${item.category || ""}${
          item.subtype ? " (" + item.subtype + ")" : ""
        }
          </small>
        `;
        recentList.appendChild(card);
      });
    }

    function renderTable(filterText) {
      const q = (filterText || "").toLowerCase();
      tableBody.innerHTML = "";

      purchases
        .filter((p) => {
          if (!q) return true;
          return (
            p.name.toLowerCase().includes(q) ||
            (p.category || "").toLowerCase().includes(q) ||
            (p.supplier || "").toLowerCase().includes(q)
          );
        })
        .forEach((item) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${item.name}</td>
            <td>${item.category || ""}</td>
            <td>${item.subtype || ""}</td>
            <td>${item.unit || ""}</td>
            <td>${item.pricePerUnit.toFixed(4)} €/ ${item.unit}</td>
            <td>${formatDate(item.updatedAt)}</td>
            <td>
              <button class="btn-secondary" data-edit="${item.id}">Edit</button>
            </td>
          `;
          tableBody.appendChild(tr);
        });
    }

    // Load existing
    renderRecent();
    renderTable("");

    // Search
    searchInput.addEventListener("input", (e) => {
      renderTable(e.target.value);
    });

    // Edit
    tableBody.addEventListener("click", (e) => {
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
      unitInput.value = item.unit || "";
      priceInput.value = item.pricePerUnit.toFixed(4);
      notesInput.value = item.notes || "";

      addFormWrapper.classList.remove("hidden");
      window.scrollTo({ top: addFormWrapper.offsetTop - 40, behavior: "smooth" });
    });

    // Submit form
    purchaseForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const name = nameInput.value.trim();
      const category = categoryInput.value;
      const subtype = subtypeInput.value;
      const supplier = supplierInput.value.trim();
      const unit = unitInput.value;
      const price = Number(priceInput.value.replace(",", ".")) || 0;
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

      const obj = {
        id,
        name,
        category,
        subtype,
        supplier,
        unit,
        pricePerUnit: price,
        notes,
        createdAt: purchases.find((p) => p.id === id)?.createdAt || now,
        updatedAt: now,
      };

      // Update cache & store
      const idx = purchases.findIndex((p) => p.id === id);
      if (idx === -1) purchases.push(obj);
      else purchases[idx] = obj;

      safeSave(KEYS.purchases, purchases);
      ppStore.upsertPurchase(obj);

      alert("Item saved locally. It will be available in Recipes.");
      editingId = null;
      purchaseForm.reset();
      renderRecent();
      renderTable(searchInput.value);
      addFormWrapper.classList.add("hidden");
    });
  }

  // ===========================
  // Init on DOMContentLoaded
  // ===========================
  document.addEventListener("DOMContentLoaded", () => {
    initPurchasesPage();
    // Recipes and Settings are initialized in their own JS (recipes.js) or page logic
  });
})();
