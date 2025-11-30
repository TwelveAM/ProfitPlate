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

// ---------------------------------------------------------
// DOM Elements
// ---------------------------------------------------------
const formSection = document.getElementById("recipe-form-section");
const recipeForm = document.getElementById("recipe-form");
const recipeListContainer = document.getElementById("recipe-list");
const ingredientsContainer = document.getElementById("ingredients-container");
const addIngredientBtn = document.getElementById("add-ingredient-btn");

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

  purchases.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    purchaseSelect.appendChild(opt);
  });

  // Quantity
  const qtyInput = document.createElement("input");
  qtyInput.type = "number";
  qtyInput.min = "0";
  qtyInput.className = "recipe-qty-input";

  // Unit
  const unitSelect = document.createElement("select");
  ["gr", "kg", "ml", "l", "pcs"].forEach(u => {
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
    unitSelect.value = existing.unit;
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

  recipes.forEach(r => {
    const row = document.createElement("div");
    row.className = "recipe-list-row";

    const cost = calculateRecipeCost(r);

    row.innerHTML = `
      <div>
        <div class="recipe-list-name">${r.name}</div>
        <div class="recipe-list-meta">${r.portions} portions</div>
      </div>

      <div class="recipe-list-actions">
        <span class="recipe-cost-badge">${cost.toFixed(2)} €/portion</span>
        <button class="btn-secondary" data-edit="${r.id}">Edit</button>
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

  recipe.ingredients.forEach(ing => {
    const purchase = purchases.find(p => p.id === ing.purchaseId);
    if (!purchase) return;

    const unit = ing.unit.toLowerCase();
    const priceUnit = purchase.unit.toLowerCase();

    // Convert recipe units to purchase units
    let recipeQty = parseFloat(ing.quantity);

    // grams ↔ kg
    if (unit === "gr" && priceUnit === "kg") recipeQty = recipeQty / 1000;
    if (unit === "kg" && priceUnit === "gr") recipeQty = recipeQty * 1000;

    // ml ↔ L
    if (unit === "ml" && priceUnit === "l") recipeQty = recipeQty / 1000;
    if (unit === "l" && priceUnit === "ml") recipeQty = recipeQty * 1000;

    // pcs stays pcs

    const cost = recipeQty * purchase.latestPrice;
    total += cost;
  });

  return total / recipe.portions;
}

// ---------------------------------------------------------
// Load a recipe for editing
// ---------------------------------------------------------
function startEditingRecipe(id) {
  const recipes = loadRecipes();
  const r = recipes.find(x => x.id === id);
  if (!r) return;

  editingRecipeId = id;

  // Open form
  formSection.style.display = "block";
  window.scrollTo(0, 0);

  // Fill form fields
  document.getElementById("recipe-name").value = r.name;
  document.getElementById("recipe-portions").value = r.portions;
  document.getElementById("recipe-selling").value = r.sellingPricePerPortion || "";

  // Ingredients
  ingredientsContainer.innerHTML = "";
  r.ingredients.forEach(ing => renderIngredientRow(ing));
}

// ---------------------------------------------------------
// Save recipe (create or update)
// ---------------------------------------------------------
recipeForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = document.getElementById("recipe-name").value.trim();
  const portions = parseFloat(document.getElementById("recipe-portions").value);
  const selling = parseFloat(document.getElementById("recipe-selling").value) || null;

  const rows = [...document.querySelectorAll(".recipe-ingredient-row")];

  const ingredients = rows.map(row => {
    return {
      purchaseId: row.children[0].value,
      quantity: parseFloat(row.children[1].value),
      unit: row.children[2].value
    };
  });

  if (ingredients.length === 0) {
    alert("Add at least one ingredient.");
    return;
  }

  let recipes = loadRecipes();

  if (editingRecipeId) {
    // Update existing
    const idx = recipes.findIndex(r => r.id === editingRecipeId);
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
