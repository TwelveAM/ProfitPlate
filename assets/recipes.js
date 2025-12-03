// recipes.js – Dish builder and costing for ProfitPlate
// - Handles recipes page: lists, add/edit, portion cost, margin calc

(function () {
  // ===========================
  // DOMs
  // ===========================
  const recipeList = document.getElementById("recipe-list");
  const addForm = document.getElementById("add-recipe-form");
  const nameInput = document.getElementById("recipe-name");
  const servingsInput = document.getElementById("recipe-servings");
  const priceInput = document.getElementById("recipe-price");
  const itemsBlock = document.getElementById("recipe-items");
  const addItemBtn = document.getElementById("add-recipe-item-btn");
  const recipesPage = document.getElementById("recipes-page");

  // ===========================
  // Helpers
  // ===========================
  function formatMoney(val) {
    return Number(val).toFixed(2) + " €";
  }
  function getPurchases() {
    // Filter out demo items if needed, but usually both show
    return window.ppStore.getPurchases();
  }
  function getRecipes() {
    return window.ppStore.getRecipes();
  }

  // ===========================
  // Recipe Rendering
  // ===========================
  function renderRecipes() {
    if (!recipeList) return;

    const recipes = getRecipes();
    recipeList.innerHTML = "";

    if (!recipes.length) {
      const p = document.createElement("p");
      p.className = "text-muted";
      p.textContent = "No recipes yet. Add your first recipe above.";
      recipeList.appendChild(p);
      return;
    }

    recipes
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((recipe) => {
        // Simple card for each recipe
        const div = document.createElement("div");
        div.className = "card-recipe";
        if (recipe.isDemo) {
          div.style.opacity = "0.93";
          div.style.border = "2px dashed #18c18c";
        }

        const name = document.createElement("div");
        name.className = "card-recipe-title";
        name.textContent = recipe.name;

        const servings = document.createElement("span");
        servings.className = "card-recipe-servings";
        servings.textContent =
          (recipe.servings ? "Serves: " + recipe.servings : "");

        // Cost & Margin
        const batchCost = calcBatchCost(recipe);
        const portionCost =
          recipe.servings > 0 ? batchCost / recipe.servings : batchCost;
        const sellingPrice = recipe.price || 0;
        const margin =
          sellingPrice > 0
            ? ((sellingPrice - portionCost) / sellingPrice) * 100
            : 0;

        const info = document.createElement("div");
        info.className = "card-recipe-info";
        info.innerHTML = `
          <div>Batch Cost: <b>${formatMoney(batchCost)}</b></div>
          <div>Cost per Portion: <b>${formatMoney(portionCost)}</b></div>
          <div>Selling Price: <b>${formatMoney(sellingPrice)}</b></div>
          <div>Margin: <b>${margin.toFixed(1)}%</b></div>
        `;

        // List ingredients
        const ingredients = document.createElement("div");
        ingredients.className = "card-recipe-ingredients";
        ingredients.innerHTML =
          "<u>Ingredients:</u><br>" +
          (recipe.items && recipe.items.length
            ? recipe.items
                .map((item) => {
                  const pur = getPurchases().find((p) => p.id === item.purchaseId);
                  return pur
                    ? `${item.amount} ${pur.unit} ${pur.name} @ ${formatMoney(
                        pur.pricePerUnit
                      )}`
                    : `<span style="color:red;">[Missing]</span>`;
                })
                .join("<br>")
            : "<span class='text-muted'>None</span>");

        div.appendChild(name);
        div.appendChild(servings);
        div.appendChild(info);
        div.appendChild(ingredients);

        recipeList.appendChild(div);
      });
  }

  function calcBatchCost(recipe) {
    if (!recipe || !Array.isArray(recipe.items)) return 0;
    let total = 0;
    recipe.items.forEach((item) => {
      const pur = getPurchases().find((p) => p.id === item.purchaseId);
      if (pur && pur.pricePerUnit > 0) {
        total += (item.amount || 0) * pur.pricePerUnit;
      }
    });
    return total;
  }

  // ===========================
  // Add/Edit Logic (simplified)
  // ===========================
  // Not shown here: form to add new recipe, but easy to extend

  // ===========================
  // Init on DOMContentLoaded
  // ===========================
  document.addEventListener("DOMContentLoaded", function () {
    renderRecipes();
    // Add more listeners here for your forms/buttons if needed
  });
})();
