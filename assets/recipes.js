// ---------------------------------------------------------
// ProfitPlate – Recipes logic (create, edit, calculate)
// ---------------------------------------------------------

// --- Local storage helpers ---
function loadPurchases() {
  return JSON.parse(localStorage.getItem("pp_purchases") || "[]");
}

function savePurchases(arr) {
  localStorage.setItem("pp_purchases", JSON.stringify(arr));
}

function loadRecipes() {
  return JSON.parse(localStorage.getItem("pp_recipes") || "[]");
}

function saveRecipes(arr) {
  localStorage.setItem("pp_recipes", JSON.stringify(arr));
}

// Unique ID generator
function newId() {
  return "r_" + Math.random().toString(36).substr(2, 9);
}

// --- Unit helpers --------------------------------------------------

function normUnit(u) {
  if (!u) return "";
  return u.toLowerCase().replace("gr", "g"); // treat "gr" as "g"
}

// ---------------------------------------------------------
// DOM Elements
// ---------------------------------------------------------
const formSection = document.getElementById("recipe-form-section");
const recipeForm = document.getElementById("recipe-form");
const recipeListContainer = document.getElementById("recipe-list");
const ingredientsContainer = document.getElementById("ingredients-container");
const addIngredientBtn = document.getElementById("add-ingredient-btn");
const addRecipeBtn = document.getElementById("add-recipe-btn");
const cancelRecipeBtn = document.getElementById("cancel-recipe-btn");

let editingRecipeId = null;

// ---------------------------------------------------------
// Create ingredient row in form
// ---------------------------------------------------------
function renderIngredientRow(existing) {
  const purchases = loadPurchases();
  const wrapper = document.createElement("div");
  wrapper.className = "recipe-ingredient-row";

  // Purchase item select
  const purchaseSelect = document.createElement("select");
  purchaseSelect.className = "recipe-purchase-select";

  if (!purchases.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No purchases saved yet";
    purchaseSelect.appendChild(opt);
    purchaseSelect.disabled = true;
  } else {
    purchases.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      purchaseSelect.appendChild(opt);
    });
  }

  // Quantity
  const qtyInput = document.createElement("input");
  qtyInput.type = "number";
  qtyInput.min = "0";
  qtyInput.step = "0.01";
  qtyInput.className = "recipe-qty-input";

  // Unit
  const unitSelect = document.createElement("select");
  ["gr", "kg", "ml", "l", "pcs"].forEach((u) => {
    const opt = document.createElement("option");
    opt.value = u;
    opt.textContent = u;
    unitSelect.appendChild(opt);
  });

  // Remove button
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn-secondary";
  removeBtn.textContent = "Remove";
  removeBtn.onclick = () => wrapper.remove();

  // If editing existing ingredient
  if (existing) {
    purchaseSelect.value = existing.purchaseId;
    qtyInput.value = existing.quantity;
    unitSelect.value = existing.unit || "gr";
  }

  wrapper.appendChild(purchaseSelect);
  wrapper.appendChild(qtyInput);
  wrapper.appendChild(unitSelect);
  wrapper.appendChild(removeBtn);
  ingredientsContainer.appendChild(wrapper);
}

// ---------------------------------------------------------
// Render list of saved recipes
// ---------------------------------------------------------
function renderRecipeList() {
  const recipes = loadRecipes();
  recipeListContainer.innerHTML = "";

  if (!recipes.length) {
    const empty = document.createElement("div");
    empty.className = "recipe-meta";
    empty.textContent = "No recipes yet. Use “Add recipe” to create one.";
    recipeListContainer.appendChild(empty);
    return;
  }

  recipes.forEach((r) => {
    const row = document.createElement("div");
    row.className = "recipe-row";

    const cost = calculateRecipeCost(r);
    let meta = `${r.portions} portions per batch`;
    if (r.sellingPricePerPortion) {
      const margin = r.sellingPricePerPortion - cost;
      meta += ` • margin ${margin.toFixed(2)} €/portion`;
    }

    row.innerHTML = `
      <div>
        <div class="recipe-name">${r.name}</div>
        <div class="recipe-meta">${meta}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="recipe-cost-badge">${cost.toFixed(2)} €/portion</span>
        <button type="button" class="btn-secondary" data-edit="${r.id}">
          View details
        </button>
      </div>
    `;

    recipeListContainer.appendChild(row);
  });
}

// ---------------------------------------------------------
// Cost calculation
// ---------------------------------------------------------
function calculateRecipeCost(recipe) {
  const purchases = loadPurchases();
  let total = 0;

  recipe.ingredients.forEach((ing) => {
    const purchase = purchases.find((p) => p.id === ing.purchaseId);
    if (!purchase) return;

    const unit = normUnit(ing.unit);
    const priceUnit = normUnit(purchase.unit);

    let recipeQty = parseFloat(ing.quantity) || 0;

    // g ↔ kg
    if (unit === "g" && priceUnit === "kg") recipeQty = recipeQty / 1000;
    if (unit === "kg" && priceUnit === "g") recipeQty = recipeQty * 1000;

    // ml ↔ l
    if (unit === "ml" && priceUnit === "l") recipeQty = recipeQty / 1000;
    if (unit === "l" && priceUnit === "ml") recipeQty = recipeQty * 1000;

    // pcs / other: no conversion

    const cost = recipeQty * (purchase.latestPrice || 0);
    total += cost;
  });

  if (!recipe.portions || recipe.portions <= 0) return 0;
  return total / recipe.portions;
}

// ---------------------------------------------------------
// Load a recipe for editing
// ---------------------------------------------------------
function startEditingRecipe(id) {
  const recipes = loadRecipes();
  const r = recipes.find((x) => x.id === id);
  if (!r) return;

  editingRecipeId = id;

  // Open form
  formSection.style.display = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });

  // Fill form fields
  document.getElementById("recipe-name").value = r.name;
  document.getElementById("recipe-portions").value = r.portions;
  document.getElementById("recipe-selling").value =
    r.sellingPricePerPortion || "";

  // Ingredients
  ingredientsContainer.innerHTML = "";
  r.ingredients.forEach((ing) => renderIngredientRow(ing));
}

// ---------------------------------------------------------
// Save recipe (create or update)
// ---------------------------------------------------------
recipeForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = document.getElementById("recipe-name").value.trim();
  const portions = parseFloat(
    document.getElementById("recipe-portions").value
  );
  const selling =
    parseFloat(document.getElementById("recipe-selling").value) || null;

  const rows = [...document.querySelectorAll(".recipe-ingredient-row")];

  const ingredients = rows
    .map((row) => {
      return {
        purchaseId: row.children[0].value,
        quantity: parseFloat(row.children[1].value),
        unit: row.children[2].value
      };
    })
    .filter((ing) => !!ing.purchaseId && !isNaN(ing.quantity));

  if (!name) {
    alert("Give the recipe a name.");
    return;
  }
  if (!portions || portions <= 0) {
    alert("Set how many portions the batch makes.");
    return;
  }
  if (ingredients.length === 0) {
    alert("Add at least one ingredient.");
    return;
  }

  let recipes = loadRecipes();

  if (editingRecipeId) {
    // Update existing
    const idx = recipes.findIndex((r) => r.id === editingRecipeId);
    if (idx !== -1) {
      recipes[idx].name = name;
      recipes[idx].portions = portions;
      recipes[idx].sellingPricePerPortion = selling;
      recipes[idx].ingredients = ingredients;
      recipes[idx].updatedAt = new Date().toISOString();
    }
    alert("Recipe updated!");
  } else {
    // Create new
    recipes.push({
      id: newId(),
      name,
      portions,
      sellingPricePerPortion: selling,
      ingredients,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    alert("Recipe saved!");
  }

  saveRecipes(recipes);
  editingRecipeId = null;
  recipeForm.reset();
  ingredientsContainer.innerHTML = "";
  formSection.style.display = "none";
  renderRecipeList();
});

// ---------------------------------------------------------
// Add ingredient button
// ---------------------------------------------------------
addIngredientBtn.addEventListener("click", () => {
  renderIngredientRow();
});

// ---------------------------------------------------------
// Add recipe / Cancel buttons
// ---------------------------------------------------------
addRecipeBtn.addEventListener("click", () => {
  editingRecipeId = null;
  recipeForm.reset();
  ingredientsContainer.innerHTML = "";
  formSection.style.display = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });
});

cancelRecipeBtn.addEventListener("click", () => {
  editingRecipeId = null;
  recipeForm.reset();
  ingredientsContainer.innerHTML = "";
  formSection.style.display = "none";
});

// ---------------------------------------------------------
// Listen for Edit clicks
// ---------------------------------------------------------
recipeListContainer.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-edit]");
  if (btn) {
    const id = btn.dataset.edit;
    startEditingRecipe(id);
  }
});

// ---------------------------------------------------------
// Init
// ---------------------------------------------------------
renderRecipeList();
