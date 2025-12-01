// recipes.js – logic for Recipes page

(function () {
  // Guard: only run on recipes.html
  if (!document.getElementById("recipes-list")) return;

  // ======== DOM references ========
  const formWrapper = document.getElementById("recipe-form-wrapper");
  const formTitle = document.getElementById("recipe-form-title");
  const formEl = document.getElementById("recipe-form");
  const nameInput = document.getElementById("recipe-name");
  const portionsInput = document.getElementById("recipe-portions");
  const priceInput = document.getElementById("recipe-price");
  const recipeIdInput = document.getElementById("recipe-id");
  const ingredientsContainer = document.getElementById("ingredients-container");
  const recipesList = document.getElementById("recipes-list");
  const showArchivedToggle = document.getElementById("show-archived-toggle");

  // Purchases cached for dropdowns & snapshots
  let purchases = [];

  // Settings (currency, locale, behaviour)
  const settings =
    typeof window.loadSettings === "function"
      ? window.loadSettings()
      : {
          currency: "EUR",
          locale: "eu",
          autoRecalc: true,
          showAdvanced: true,
        };

  const autoRecalc = settings.autoRecalc !== false; // default true
  const showAdvanced = settings.showAdvanced !== false; // default true

  // ======== Formatting helpers (match app.js) ========
  function getFormatting() {
    const currency = settings.currency || "EUR";
    const locale = settings.locale === "us" ? "en-US" : "de-DE";
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

  // ======== Unit helpers (same logic as app.js) ========
  function normalizeUnit(u) {
    if (!u) return "";
    const s = String(u).toLowerCase();
    if (s === "gr") return "g";
    return s;
  }

  function convertQuantity(qty, fromUnit, toUnit) {
    let q = Number(qty) || 0;
    const from = normalizeUnit(fromUnit);
    const to = normalizeUnit(toUnit);

    if (!from || !to || from === to) return q;

    // grams <-> kg
    if (from === "g" && to === "kg") return q / 1000;
    if (from === "kg" && to === "g") return q * 1000;

    // ml <-> l
    if (from === "ml" && to === "l") return q / 1000;
    if (from === "l" && to === "ml") return q * 1000;

    // incompatible: just return original as a fallback
    return q;
  }

  // ======== Helper: get store =========
  function getStore() {
    if (!window.ppStore) {
      console.error("ppStore (from app.js) not found.");
      return null;
    }
    return window.ppStore;
  }

  // ======== Ingredient row handling ========
  function buildPurchaseOptions(selectedId) {
    const frag = document.createDocumentFragment();

    const optPlaceholder = document.createElement("option");
    optPlaceholder.value = "";
    optPlaceholder.textContent = "Select ingredient…";
    frag.appendChild(optPlaceholder);

    purchases
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        if (selectedId && selectedId === p.id) opt.selected = true;
        frag.appendChild(opt);
      });

    return frag;
  }

  function addIngredientRow(existing) {
    const row = document.createElement("div");
    row.className = "recipe-ingredient-row";

    const select = document.createElement("select");
    select.className = "form-select";
    select.appendChild(
      buildPurchaseOptions(existing ? existing.purchaseId : null)
    );

    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.placeholder = "Qty";
    qtyInput.value = existing ? existing.quantity : "";
    qtyInput.className = "small-input";

    const unitSelect = document.createElement("select");
    unitSelect.className = "form-select";
    ["kg", "gr", "L", "ml", "pcs", "tray", "box"].forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.toLowerCase();
      opt.textContent = u;
      if (existing && normalizeUnit(existing.unit) === opt.value) {
        opt.selected = true;
      }
      unitSelect.appendChild(opt);
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.className = "btn-danger remove-btn";
    removeBtn.addEventListener("click", () => {
      row.remove();
    });

    row.appendChild(select);
    row.appendChild(qtyInput);
    row.appendChild(unitSelect);
    row.appendChild(removeBtn);

    if (existing && existing.pricePerUnitSnapshot != null) {
      row.dataset.snapshot = String(existing.pricePerUnitSnapshot);
    }

    ingredientsContainer.appendChild(row);
  }

  // Expose globally for button in HTML
  window.addIngredientRow = addIngredientRow;

  // ======== Show / hide form ========
  function clearRecipeForm() {
    nameInput.value = "";
    portionsInput.value = "";
    priceInput.value = "";
    recipeIdInput.value = "";
    ingredientsContainer.innerHTML = "";
  }

  function showRecipeForm(editId) {
    clearRecipeForm();

    const store = getStore();
    if (!store) return;

    if (editId) {
      const existing = store.getRecipes().find((r) => r.id === editId);
      if (existing) {
        formTitle.textContent = "Edit recipe";
        recipeIdInput.value = existing.id;
        nameInput.value = existing.name || "";
        portionsInput.value = existing.portions || "";
        if (existing.sellingPrice != null) {
          priceInput.value = existing.sellingPrice;
        }
        (existing.ingredients || []).forEach((ing) => addIngredientRow(ing));
      } else {
        formTitle.textContent = "Add a new recipe";
        addIngredientRow();
      }
    } else {
      formTitle.textContent = "Add a new recipe";
      addIngredientRow();
    }

    formWrapper.classList.remove("hidden");
    window.scrollTo({
      top: formWrapper.offsetTop - 40,
      behavior: "smooth",
    });
  }

  function hideRecipeForm() {
    formWrapper.classList.add("hidden");
  }

  window.showRecipeForm = showRecipeForm;
  window.hideRecipeForm = hideRecipeForm;

  // ======== Read form -> recipe object ========
  function readFormToRecipe() {
    const name = nameInput.value.trim();
    const portions = Number(portionsInput.value) || 0;
    const sellingRaw = priceInput.value.trim();
    const sellingPrice =
      sellingRaw === "" ? null : Number(sellingRaw.replace(",", "."));

    if (!name || !portions) {
      alert("Please enter a name and portions per batch.");
      return null;
    }

    const ingRows = Array.from(
      ingredientsContainer.querySelectorAll(".recipe-ingredient-row")
    );
    const ingredients = [];

    for (const row of ingRows) {
      const selects = row.getElementsByTagName("select");
      const inputs = row.getElementsByTagName("input");

      const purchaseId = selects[0].value;
      const qty = Number(inputs[0].value);
      const unit = selects[1].value;

      if (!purchaseId || !qty || qty <= 0) continue; // skip incomplete

      let pricePerUnitSnapshot = null;
      if (!autoRecalc) {
        const p = purchases.find((x) => x.id === purchaseId);
        if (p && typeof p.pricePerUnit === "number") {
          pricePerUnitSnapshot = p.pricePerUnit;
        }
      }

      ingredients.push({
        purchaseId,
        quantity: qty,
        unit,
        pricePerUnitSnapshot,
      });
    }

    if (!ingredients.length) {
      alert("Add at least one ingredient to the recipe.");
      return null;
    }

    const id = recipeIdInput.value || `r_${Date.now()}`;

    return {
      id,
      name,
      portions,
      sellingPrice,
      ingredients,
      archived: false,
    };
  }

  // ======== Cost calculations & rendering ========
  function findPurchase(id) {
    return purchases.find((p) => p.id === id);
  }

  function computeRecipeCosts(recipe) {
    let batchCost = 0;
    const ingredientsDetailed = [];

    const useLivePrices = autoRecalc;

    (recipe.ingredients || []).forEach((ing) => {
      const p = findPurchase(ing.purchaseId);
      if (!p && ing.pricePerUnitSnapshot == null) return;

      let pricePerUnit = 0;

      if (useLivePrices) {
        pricePerUnit = Number(p && p.pricePerUnit) || 0;
      } else {
        if (ing.pricePerUnitSnapshot != null) {
          pricePerUnit = Number(ing.pricePerUnitSnapshot) || 0;
        } else if (p) {
          pricePerUnit = Number(p.pricePerUnit) || 0;
        } else {
          pricePerUnit = 0;
        }
      }

      const purchaseUnit = p ? p.unit || ing.unit : ing.unit;
      const qtyInPurchaseUnit = convertQuantity(
        ing.quantity,
        ing.unit,
        purchaseUnit
      );

      const costInRecipe = qtyInPurchaseUnit * pricePerUnit;
      batchCost += costInRecipe;

      ingredientsDetailed.push({
        ingredientName: p ? p.name : "(missing ingredient)",
        category: p ? p.category || "" : "",
        subtype: p ? p.subtype || "" : "",
        quantity: ing.quantity,
        unit: ing.unit,
        pricePerUnit,
        costInRecipe,
      });
    });

    const portions = recipe.portions || 0;
    const costPerPortion = portions ? batchCost / portions : 0;

    let marginPerPortion = null;
    let marginPercent = null;

    if (recipe.sellingPrice != null) {
      marginPerPortion = recipe.sellingPrice - costPerPortion;
      if (recipe.sellingPrice > 0) {
        marginPercent = (marginPerPortion / recipe.sellingPrice) * 100;
      }
    }

    return {
      batchCost,
      costPerPortion,
      marginPerPortion,
      marginPercent,
      ingredientsDetailed,
    };
  }

  // ======== Snapshot helper when autoRecalc is OFF ========
  function ensureSnapshotsIfNeeded(recipes) {
    if (autoRecalc) return false;

    let changed = false;

    recipes.forEach((recipe) => {
      (recipe.ingredients || []).forEach((ing) => {
        if (ing.pricePerUnitSnapshot != null) return;
        const p = findPurchase(ing.purchaseId);
        if (!p) return;
        ing.pricePerUnitSnapshot = Number(p.pricePerUnit) || 0;
        changed = true;
      });
    });

    if (!changed) return false;

    const store = getStore();
    if (!store) return false;

    recipes.forEach((r) => store.upsertRecipe(r));
    return true;
  }

  // ======== Archive / Unarchive ========
  function toggleArchive(id) {
    const store = getStore();
    if (!store) return;

    const all = store.getRecipes();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return;

    const existing = all[idx];
    const updated = { ...existing, archived: !existing.archived };
    store.upsertRecipe(updated);
    renderRecipes();
  }

  // ======== Render recipes ========
  function renderRecipes() {
    const store = getStore();
    if (!store) return;

    let recipes = store.getRecipes();

    ensureSnapshotsIfNeeded(recipes);

    const showArchived = showArchivedToggle ? showArchivedToggle.checked : false;

    const visible = recipes.filter((r) => showArchived || !r.archived);

    recipesList.innerHTML = "";

    if (!visible.length) {
      const p = document.createElement("p");
      p.className = "text-muted";
      p.textContent = showArchived
        ? "No archived recipes yet."
        : "No active recipes yet. Click “Add recipe” to create your first one.";
      recipesList.appendChild(p);
      return;
    }

    visible.forEach((recipe) => {
      const card = document.createElement("div");
      card.className = "recipe-box";

      const costs = computeRecipeCosts(recipe);

      const header = document.createElement("div");
      header.style.display = "flex";
      header.style.justifyContent = "space-between";
      header.style.alignItems = "center";
      header.style.marginBottom = "10px";

      const left = document.createElement("div");
      const title = document.createElement("div");
      title.className = "recipe-title";
      title.textContent = recipe.name;

      const meta = document.createElement("div");
      meta.className = "recipe-summary";
      meta.textContent = `${recipe.portions || 0} portions per batch`;

      if (recipe.archived) {
        const archivedTag = document.createElement("span");
        archivedTag.textContent = "Archived";
        archivedTag.style.fontSize = "11px";
        archivedTag.style.color = "#aa2e25";
        archivedTag.style.marginLeft = "8px";
        archivedTag.style.textTransform = "uppercase";
        archivedTag.style.letterSpacing = "0.08em";
        meta.appendChild(archivedTag);
      }

      left.appendChild(title);
      left.appendChild(meta);

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.alignItems = "center";
      right.style.gap = "8px";

      const badge = document.createElement("span");
      badge.className = "recipe-cost-badge";
      badge.style.padding = "6px 12px";
      badge.style.borderRadius = "999px";
      badge.style.background = "#e3f5eb";
      badge.style.color = "#0b6e46";
      badge.style.fontSize = "14px";
      badge.textContent = `${formatMoney(
        costs.costPerPortion,
        2
      )} /portion`;

      const archiveBtn = document.createElement("button");
      archiveBtn.type = "button";
      archiveBtn.className = "btn-secondary";
      archiveBtn.textContent = recipe.archived ? "Unarchive" : "Archive";
      archiveBtn.addEventListener("click", () => toggleArchive(recipe.id));

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn-secondary";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => showRecipeForm(recipe.id));

      right.appendChild(badge);
      right.appendChild(archiveBtn);
      right.appendChild(editBtn);

      header.appendChild(left);
      header.appendChild(right);
      card.appendChild(header);

      const summary = document.createElement("div");
      summary.className = "recipe-summary";

      let summaryText;

      if (showAdvanced) {
        summaryText =
          `Total batch cost: ${formatMoney(costs.batchCost, 2)}` +
          ` • Cost per portion: ${formatMoney(costs.costPerPortion, 2)}`;

        if (recipe.sellingPrice != null) {
          summaryText +=
            ` • Selling price: ${formatMoney(
              recipe.sellingPrice,
              2
            )} /portion`;

          if (costs.marginPerPortion != null) {
            summaryText +=
              ` • Margin: ${formatMoney(
                costs.marginPerPortion,
                2
              )} (${(costs.marginPercent || 0).toFixed(0)}%)`;
          }
        }
      } else {
        summaryText = `Cost per portion: ${formatMoney(
          costs.costPerPortion,
          2
        )}`;
        if (recipe.sellingPrice != null) {
          summaryText +=
            ` • Selling price: ${formatMoney(
              recipe.sellingPrice,
              2
            )} /portion`;
        }
      }

      summary.textContent = summaryText;
      card.appendChild(summary);

      if (showAdvanced) {
        const tableWrapper = document.createElement("div");
        tableWrapper.style.marginTop = "12px";

        const table = document.createElement("table");

        const thead = document.createElement("thead");
        thead.innerHTML = `
          <tr>
            <th>Ingredient</th>
            <th>Category</th>
            <th>Sub-type</th>
            <th>Quantity</th>
            <th>Unit</th>
            <th>Price/unit</th>
            <th>Cost in recipe</th>
          </tr>
        `;
        table.appendChild(thead);

        const tbody = document.createElement("tbody");

        costs.ingredientsDetailed.forEach((ing) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${ing.ingredientName}</td>
            <td>${ing.category}</td>
            <td>${ing.subtype}</td>
            <td>${ing.quantity}</td>
            <td>${ing.unit}</td>
            <td>${formatMoney(ing.pricePerUnit, 4)}/unit</td>
            <td>${formatMoney(ing.costInRecipe, 2)}</td>
          `;
          tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        tableWrapper.appendChild(table);
        card.appendChild(tableWrapper);
      }

      recipesList.appendChild(card);
    });
  }

  // ======== Form submit ========
  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    const store = getStore();
    if (!store) return;

    let recipe = readFormToRecipe();
    if (!recipe) return;

    // Preserve archived flag when editing
    const existingId = recipe.id;
    const existing = store.getRecipes().find((r) => r.id === existingId);
    if (existing && existing.archived) {
      recipe.archived = true;
    }

    store.upsertRecipe(recipe);
    hideRecipeForm();
    renderRecipes();
  });

  // ======== Init ========
  function initRecipesPage() {
    const store = getStore();
    if (!store) return;
    purchases = store.getPurchases();

    if (showArchivedToggle) {
      showArchivedToggle.addEventListener("change", renderRecipes);
    }

    // ESC closes recipe form
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (!formWrapper.classList.contains("hidden")) {
          hideRecipeForm();
        }
      }
    });

    renderRecipes();
  }

  document.addEventListener("DOMContentLoaded", initRecipesPage);
})();
