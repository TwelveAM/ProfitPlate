// app.js – Tiny brain for ProfitPlate
// Storage + Purchases page logic (+ exposes ppStore for recipes.js)

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

  // Normalise / clean
  function sanitizePurchases() {
    purchases = (purchases || [])
      .filter((p) => p && typeof p === "object")
      .map((p) => {
        const n = { ...p };
        const v = Number(n.pricePerUnit);
        n.pricePerUnit = Number.isFinite(v) && v >= 0 ? v : 0;

        if (Array.isArray(n.priceHistory)) {
          n.priceHistory = n.priceHistory
            .filter((h) => h && h.date)
            .map((h) => ({
              date: h.date,
              pricePerUnit:
                Number(h.pricePerUnit) > 0
                  ? Number(h.pricePerUnit)
                  : n.pricePerUnit,
            }));
        } else {
          n.priceHistory = [];
        }

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
  // Formatting helpers
  // ===========================
  function getFormatting() {
    const s = loadSettings();
    const currency = s.currency || "EUR";
    const locale = s.locale === "us" ? "en-US" : "de-DE";

    const symbolMap = {
      EUR: "€",
      RON: "lei",
      USD: "$",
      GBP: "£",
    };

    const symbol = symbolMap[currency] || currency;
    return { currency, symbol, locale };
  }

  function formatMoney(value, decimals) {
    const { symbol, locale } = getFormatting();
    const n = Number(value) || 0;
    const formatted = n.toLocaleString(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return `${formatted} ${symbol}`;
  }

  // DD-MM-YYYY display
  function formatDate(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    if (isNaN(d)) return "-";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }

  // ===========================
  // Unit helpers
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

    if (from === "g" && to === "kg") return q / 1000;
    if (from === "kg" && to === "g") return q * 1000;
    if (from === "ml" && to === "l") return q / 1000;
    if (from === "l" && to === "ml") return q * 1000;

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
      const nowIso = new Date().toISOString();
      const idx = purchases.findIndex((p) => p.id === purchase.id);
      const existing = idx !== -1 ? purchases[idx] : null;

      const id = purchase.id || (existing && existing.id) || "p_" + Date.now();
      const createdAt =
        (existing && existing.createdAt) ||
        purchase.createdAt ||
        nowIso;

      const numericPrice =
        Number(String(purchase.pricePerUnit || "").replace(",", ".")) || 0;

      // Build / update priceHistory (max 10)
      let history = [];
      if (existing && Array.isArray(existing.priceHistory)) {
        history = existing.priceHistory.slice();
      }

      if (!existing) {
        if (numericPrice > 0) {
          history.unshift({ date: nowIso, pricePerUnit: numericPrice });
        }
      } else {
        const prevPrice = Number(existing.pricePerUnit) || 0;
        if (numericPrice > 0 && numericPrice !== prevPrice) {
          history.unshift({ date: nowIso, pricePerUnit: numericPrice });
        } else if (!history.length && prevPrice > 0) {
          history.unshift({
            date: existing.updatedAt || existing.createdAt || nowIso,
            pricePerUnit: prevPrice,
          });
        }
      }

      if (history.length > 10) {
        history = history.slice(0, 10);
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

    function clearHistoryUI() {
      if (!historyBlock || !historyBody) return;
      historyBlock.classList.add("hidden");
      historyBody.innerHTML = "";
    }

    function renderHistoryForItem(item) {
      if (!historyBlock || !historyBody) return;
      const hist = Array.isArray(item.priceHistory) ? item.priceHistory : [];
      if (!hist.length) {
        clearHistoryUI();
        return;
      }

      historyBody.innerHTML = "";
      hist.forEach((entry) => {
        const tr = document.createElement("tr");
        const td1 = document.createElement("td");
        const td2 = document.createElement("td");

        td1.textContent = formatDate(entry.date);
        const price = Number(entry.pricePerUnit) || 0;
        td2.textContent =
          price > 0
            ? formatMoney(price, 4).replace(/\s.*$/, "") +
              " / " +
              (item.unit || "")
            : "-";

        tr.appendChild(td1);
        tr.appendChild(td2);
        historyBody.appendChild(tr);
      });

      historyBlock.classList.remove("hidden");
    }

    // Toggle form visibility
    function toggleAddForm() {
      if (!addFormWrapper || !purchaseForm) return;
      const isHidden = addFormWrapper.classList.contains("hidden");

      if (isHidden) {
        addFormWrapper.classList.remove("hidden");
        clearHistoryUI();
        window.scrollTo({
          top: addFormWrapper.offsetTop - 40,
          behavior: "smooth",
        });
      } else {
        addFormWrapper.classList.add("hidden");
        editingId = null;
        purchaseForm.reset();
        clearHistoryUI();
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
          "Units not compatible. Use g/kg or ml/L or the same unit for the pack and recipe."
        );
        return;
      }

      const perUnit = packPrice / qtyInBase;
      priceInput.value = perUnit.toFixed(4);
    }

    window.fillPriceFromPack = fillPriceFromPack;

    // Helpers
    function getSafePrice(item) {
      const p = Number(item.pricePerUnit);
      if (!Number.isFinite(p) || p <= 0) return 0;
      return p;
    }

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
            ? formatMoney(price, 4).replace(/\s.*$/, "") +
              " / " +
              (item.unit || "")
            : "-";

        let metaParts = [];
        metaParts.push("Updated " + formatDate(item.updatedAt));
        if (item.category) {
          let cat = item.category;
          if (item.subtype) cat += " (" + item.subtype + ")";
          metaParts.push(cat);
        }
        if (item.supplier) {
          metaParts.push("Supplier: " + item.supplier);
        }
        const line2 = metaParts.join(" • ");

        card.innerHTML =
          '<div class="card-updated-title">' +
          (item.name + " – " + priceLabel) +
          "</div><small>" +
          line2 +
          "</small>";

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

          function addCell(text) {
            const td = document.createElement("td");
            td.textContent = text;
            tr.appendChild(td);
          }

          const price = getSafePrice(item);
          const priceLabel =
            price > 0
              ? formatMoney(price, 4).replace(/\s.*$/, "") +
                " / " +
                (item.unit || "")
              : "-";

          addCell(item.name);
          addCell(item.category || "");
          addCell(item.subtype || "");
          addCell(item.supplier || "");
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
    renderTable("");

    // Search
    if (searchInput) {
      searchInput.addEventListener("input", function (e) {
        renderTable(e.target.value);
      });
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
      unitInput.value = item.unit || "";

      const price = getSafePrice(item);
      priceInput.value = price > 0 ? price.toFixed(4) : "";

      notesInput.value = item.notes || "";

      addFormWrapper.classList.remove("hidden");
      renderHistoryForItem(item);

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
        unit,
        pricePerUnit: price,
        notes,
        createdAt,
        updatedAt: now,
        priceHistory: existing ? existing.priceHistory : [],
      };

      ppStore.upsertPurchase(obj);
      purchases = ppStore.getPurchases();

      alert(
        "Item saved locally. It will be available to use on the Recipes page."
      );

      editingId = null;
      purchaseForm.reset();
      clearHistoryUI();
      addFormWrapper.classList.add("hidden");

      renderRecent();
      renderTable(searchInput ? searchInput.value : "");
    });
  }

  // ===========================
  // Init on DOMContentLoaded
  // ===========================
  document.addEventListener("DOMContentLoaded", function () {
    initPurchasesPage();
    // Recipes + Settings use their own JS (recipes.js + inline script)
  });
})();
