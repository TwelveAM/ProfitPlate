// recipes.js – Logic for Recipes page

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
  const recipeSearchInput = document.getElementById("recipe-search");

  let purchases = [];

  // Settings
  const settings = typeof window.loadSettings === "function"
      ? window.loadSettings()
      : { currency: "EUR", locale: "eu", autoRecalc: true, showAdvanced: true };

  const autoRecalc = settings.autoRecalc !== false;
  const showAdvanced = settings.showAdvanced !== false;

  // ======== Helpers (Money/Units) ========
  function getFormatting() {
    const currency = settings.currency || "EUR";
    const locale = settings.locale === "us" ? "en-US" : "de-DE";
    const symbolMap = { EUR: "€", RON: "lei", USD: "$", GBP: "£" };
    return { currency, symbol: symbolMap[currency] || currency, locale };
  }

  function formatMoney(value, decimals) {
    const { symbol, locale } = getFormatting();
    const n = Number(value) || 0;
    return `${n.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${symbol}`;
  }

  function normalizeUnit(u) {
    if (!u) return "";
    const s = String(u).toLowerCase();
    return s === "gr" ? "g" : s;
  }

  function convertQuantity(qty, fromUnit, toUnit) {
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

  function getStore() {
    return window.ppStore || null;
  }

  // ======== Form: Ingredient Rows ========
  function buildPurchaseOptions(selectedId) {
    const frag = document.createDocumentFragment();
    const optPlaceholder = document.createElement("option");
    optPlaceholder.value = "";
    optPlaceholder.textContent = "Select ingredient…";
    frag.appendChild(optPlaceholder);

    purchases.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      if (selectedId === p.id) opt.selected = true;
      frag.appendChild(opt);
    });
    return frag;
  }

  function addIngredientRow(existing) {
    const row = document.createElement("div");
    row.className = "recipe-ingredient-row";
    // Add simple flex styling for the row
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.marginBottom = "8px";

    const select = document.createElement("select");
    select.className = "form-select";
    select.style.flex = "2";
    select.appendChild(buildPurchaseOptions(existing ? existing.purchaseId : null));

    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.className = "form-input small-input";
    qtyInput.style.flex = "1";
    qtyInput.placeholder = "Qty";
    qtyInput.value = existing ? existing.quantity : "";

    const unitSelect = document.createElement("select");
    unitSelect.className = "form-select";
    unitSelect.style.flex = "1";
    ["kg", "gr", "L", "ml", "pcs", "tray", "box"].forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.toLowerCase();
      opt.textContent = u;
      if (existing && normalizeUnit(existing.unit) === opt.value) opt.selected = true;
      unitSelect.appendChild(opt);
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "×";
    removeBtn.className = "btn-danger";
    removeBtn.style.padding = "0 10px";
    removeBtn.addEventListener("click", () => row.remove());

    row.appendChild(select);
    row.appendChild(qtyInput);
    row.appendChild(unitSelect);
    row.appendChild(removeBtn);

    if (existing && existing.pricePerUnitSnapshot != null) {
      row.dataset.snapshot = String(existing.pricePerUnitSnapshot);
    }
    ingredientsContainer.appendChild(row);
  }
  window.addIngredientRow = addIngredientRow;

  // ======== Show / Hide Form ========
  function showRecipeForm(editId) {
    if (!formEl) return;
    nameInput.value = "";
    portionsInput.value = "";
    priceInput.value = "";
    recipeIdInput.value = "";
    ingredientsContainer.innerHTML = "";

    const store = getStore();
    if (editId && store) {
      const existing = store.getRecipes().find((r) => r.id === editId);
      if (existing) {
        formTitle.textContent = "Edit Recipe";
        recipeIdInput.value = existing.id;
        nameInput.value = existing.name || "";
        portionsInput.value = existing.portions || "";
        if (existing.sellingPrice != null) priceInput.value = existing.sellingPrice;
        (existing.ingredients || []).forEach((ing) => addIngredientRow(ing));
      } else {
        addIngredientRow();
      }
    } else {
      formTitle.textContent = "Add New Recipe";
      addIngredientRow();
    }
    formWrapper.classList.remove("hidden");
    formWrapper.scrollIntoView({ behavior: 'smooth' });
  }

  function hideRecipeForm() {
    formWrapper.classList.add("hidden");
  }
  window.showRecipeForm = showRecipeForm;
  window.hideRecipeForm = hideRecipeForm;

  // ======== Logic: Read Form ========
  function readFormToRecipe() {
    const name = nameInput.value.trim();
    const portions = Number(portionsInput.value) || 0;
    const sellingRaw = priceInput.value.trim();
    const sellingPrice = sellingRaw === "" ? null : Number(sellingRaw.replace(",", "."));

    if (!name || !portions) {
      alert("Please enter a name and portions per batch.");
      return null;
    }

    const ingredients = [];
    const rows = ingredientsContainer.querySelectorAll(".recipe-ingredient-row");
    
    for (const row of rows) {
      const selects = row.getElementsByTagName("select");
      const inputs = row.getElementsByTagName("input");
      const purchaseId = selects[0].value;
      const qty = Number(inputs[0].value);
      const unit = selects[1].value;

      if (!purchaseId || !qty) continue;

      let pricePerUnitSnapshot = null;
      // Snapshot logic: If autoRecalc is OFF, freeze the price now.
      if (!autoRecalc) {
        const p = purchases.find((x) => x.id === purchaseId);
        if (p) pricePerUnitSnapshot = Number(p.pricePerUnit) || 0;
      }
      ingredients.push({ purchaseId, quantity: qty, unit, pricePerUnitSnapshot });
    }

    if (!ingredients.length) {
      alert("Add at least one ingredient.");
      return null;
    }

    const id = recipeIdInput.value || `r_${Date.now()}`;
    return { id, name, portions, sellingPrice, ingredients, archived: false };
  }

  // ======== Logic: Costs ========
  function computeRecipeCosts(recipe) {
    let batchCost = 0;
    const ingredientsDetailed = [];
    const useLivePrices = autoRecalc;

    (recipe.ingredients || []).forEach((ing) => {
      const p = purchases.find((x) => x.id === ing.purchaseId);
      if (!p && ing.pricePerUnitSnapshot == null) return;

      let pricePerUnit = 0;
      if (useLivePrices) {
        pricePerUnit = Number(p && p.pricePerUnit) || 0;
      } else {
        pricePerUnit = ing.pricePerUnitSnapshot != null 
          ? Number(ing.pricePerUnitSnapshot) 
          : (Number(p?.pricePerUnit) || 0);
      }

      const purchaseUnit = p ? p.unit || ing.unit : ing.unit;
      const qtyInPurchaseUnit = convertQuantity(ing.quantity, ing.unit, purchaseUnit);
      const costInRecipe = qtyInPurchaseUnit * pricePerUnit;
      batchCost += costInRecipe;

      ingredientsDetailed.push({
        ingredientName: p ? p.name : "(Unknown)",
        category: p ? p.category : "",
        supplier: p ? p.supplier : "",
        quantity: ing.quantity,
        unit: ing.unit,
        pricePerUnit,
        costInRecipe
      });
    });

    const portions = recipe.portions || 1;
    const costPerPortion = batchCost / portions;
    let marginPerPortion = null;
    let marginPercent = null;

    if (recipe.sellingPrice) {
      marginPerPortion = recipe.sellingPrice - costPerPortion;
      marginPercent = (marginPerPortion / recipe.sellingPrice) * 100;
    }

    return { batchCost, costPerPortion, marginPerPortion, marginPercent, ingredientsDetailed };
  }

  function ensureSnapshotsIfNeeded(recipes) {
    if (autoRecalc) return;
    let changed = false;
    recipes.forEach((r) => {
      (r.ingredients || []).forEach((ing) => {
        if (ing.pricePerUnitSnapshot != null) return;
        const p = purchases.find((x) => x.id === ing.purchaseId);
        if (p) {
          ing.pricePerUnitSnapshot = Number(p.pricePerUnit) || 0;
          changed = true;
        }
      });
    });
    if (changed) {
      const store = getStore();
      if(store) recipes.forEach(r => store.upsertRecipe(r));
    }
  }

  function toggleArchive(id) {
    const store = getStore();
    if (!store) return;
    const all = store.getRecipes();
    const existing = all.find((r) => r.id === id);
    if (existing) {
      existing.archived = !existing.archived;
      store.upsertRecipe(existing);
      renderRecipes();
    }
  }

  // ======== RENDER RECIPES (Design Upgrade) ========
  function renderRecipes() {
    const store = getStore();
    if (!store) return;
    
    let allRecipes = store.getRecipes();
    ensureSnapshotsIfNeeded(allRecipes);

    const showArchived = showArchivedToggle ? showArchivedToggle.checked : false;
    const search = recipeSearchInput ? recipeSearchInput.value.toLowerCase() : "";

    let visible = allRecipes.filter((r) => showArchived || !r.archived);
    if (search) visible = visible.filter((r) => (r.name || "").toLowerCase().includes(search));

    recipesList.innerHTML = "";
    if (!visible.length) {
      recipesList.innerHTML = `<div class="empty-state"><p>No recipes found.</p></div>`;
      return;
    }

    visible.forEach((recipe) => {
      const costs = computeRecipeCosts(recipe);
      
      // Card Container
      const card = document.createElement("div");
      card.className = "card recipe-card"; // using new Design class
      if (recipe.archived) card.classList.add("archived-card");

      // 1. Header Row
      const headerDiv = document.createElement("div");
      headerDiv.className = "card-header";
      
      const titleEl = document.createElement("h3");
      titleEl.className = "card-title";
      titleEl.textContent = recipe.name;
      if(recipe.archived) titleEl.innerHTML += ` <span class="badge badge-gray">Archived</span>`;

      // Cost Badge (Top Right)
      const costBadge = document.createElement("span");
      costBadge.className = "badge badge-green";
      costBadge.textContent = `${formatMoney(costs.costPerPortion, 2)} / portion`;

      headerDiv.appendChild(titleEl);
      headerDiv.appendChild(costBadge);

      // 2. Body
      const bodyDiv = document.createElement("div");
      bodyDiv.className = "card-body";
      
      const infoP = document.createElement("p");
      infoP.className = "text-muted small";
      infoP.textContent = `${recipe.portions} portions • Batch Cost: ${formatMoney(costs.batchCost, 2)}`;
      bodyDiv.appendChild(infoP);

      if (recipe.sellingPrice) {
        const marginP = document.createElement("p");
        marginP.style.marginTop = "4px";
        marginP.style.fontWeight = "500";
        const isPositive = (costs.marginPercent || 0) > 0;
        marginP.innerHTML = `
          Selling: ${formatMoney(recipe.sellingPrice, 2)} 
          <span style="color:${isPositive ? 'var(--color-success)' : 'var(--color-danger)'}; margin-left:8px;">
            Margin: ${costs.marginPercent.toFixed(0)}%
          </span>
        `;
        bodyDiv.appendChild(marginP);
      }

      // 3. Detailed Table (Advanced View)
      if (showAdvanced) {
        const detailsEl = document.createElement("details");
        detailsEl.style.marginTop = "12px";
        const summaryEl = document.createElement("summary");
        summaryEl.textContent = "View Ingredients";
        summaryEl.style.fontSize = "13px";
        summaryEl.style.color = "#666";
        summaryEl.style.cursor = "pointer";
        
        const table = document.createElement("table");
        table.className = "data-table small-table"; // Modern table class
        table.style.marginTop = "8px";
        table.innerHTML = `
          <thead>
            <tr>
              <th>Ingr.</th>
              <th>Qty</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            ${costs.ingredientsDetailed.map(ing => `
              <tr>
                <td>
                  <strong>${ing.ingredientName}</strong><br>
                  <span style="font-size:11px;color:#888">${ing.supplier || '-'}</span>
                </td>
                <td>${ing.quantity} ${ing.unit}</td>
                <td>${formatMoney(ing.costInRecipe, 2)}</td>
              </tr>
            `).join('')}
          </tbody>
        `;
        detailsEl.appendChild(summaryEl);
        detailsEl.appendChild(table);
        bodyDiv.appendChild(detailsEl);
      }

      // 4. Footer Actions
      const footerDiv = document.createElement("div");
      footerDiv.className = "card-footer";
      footerDiv.style.justifyContent = "flex-end";

      const archiveBtn = document.createElement("button");
      archiveBtn.className = "btn-icon"; // Minimal button
      archiveBtn.textContent = recipe.archived ? "Unarchive" : "Archive";
      archiveBtn.onclick = () => toggleArchive(recipe.id);

      const editBtn = document.createElement("button");
      editBtn.className = "btn-secondary small";
      editBtn.textContent = "Edit";
      editBtn.style.marginLeft = "8px";
      editBtn.onclick = () => showRecipeForm(recipe.id);

      footerDiv.appendChild(archiveBtn);
      footerDiv.appendChild(editBtn);

      card.appendChild(headerDiv);
      card.appendChild(bodyDiv);
      card.appendChild(footerDiv);

      recipesList.appendChild(card);
    });
  }

  // Handle Submit
  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    const store = getStore();
    let recipe = readFormToRecipe();
    if (!recipe || !store) return;

    // Preserve archived status if editing
    const existing = store.getRecipes().find(r => r.id === recipe.id);
    if (existing && existing.archived) recipe.archived = true;

    store.upsertRecipe(recipe);
    hideRecipeForm();
    renderRecipes();
  });

  // Init
  function init() {
    const store = getStore();
    if (!store) return;
    purchases = store.getPurchases();
    if (showArchivedToggle) showArchivedToggle.addEventListener("change", renderRecipes);
    if (recipeSearchInput) recipeSearchInput.addEventListener("input", renderRecipes);
    renderRecipes();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
