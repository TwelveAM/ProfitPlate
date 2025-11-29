/*
  ProfitPlate Tiny Brain v1
  LocalStorage-based data engine
  -------------------------------
  Stores:
    - purchases
    - recipes
    - settings

  Uses key: "profitplate_data_v1"
*/

// KEY FOR LOCALSTORAGE
const STORAGE_KEY = "profitplate_data_v1";

// DEFAULT STRUCTURE ON FIRST RUN
const defaultData = {
  purchases: [
    // Example data (so Recipes page can show something)
    {
      id: "pur_butter",
      name: "Butter 82%",
      category: "Dairy & Eggs",
      subtype: "Butter",
      unit: "kg",
      pricePerUnit: 6.4,
      currency: "EUR",
      supplier: "Metro",
      notes: "",
      updatedAt: "2025-02-01T10:32:00Z"
    },
    {
      id: "pur_pancetta",
      name: "Pancetta cubetti",
      category: "Meat & Fish",
      subtype: "Smoked",
      unit: "kg",
      pricePerUnit: 10.2,
      currency: "EUR",
      supplier: "Metro",
      notes: "",
      updatedAt: "2025-02-01T10:32:00Z"
    },
    {
      id: "pur_fries",
      name: "Frozen fries",
      category: "Vegetables & Fruit",
      subtype: "Frozen",
      unit: "bag",
      pricePerUnit: 4.2,
      currency: "EUR",
      supplier: "Carrefour",
      notes: "2.5kg bag",
      updatedAt: "2025-02-01T10:32:00Z"
    }
  ],

  recipes: [
    {
      id: "rec_carbonara",
      name: "Pasta Carbonara",
      portions: 5,
      sellingPricePerPortion: 9.5,
      currency: "EUR",
      ingredients: [
        { purchaseId: "pur_pancetta", quantity: 0.2, unit: "kg" },
        { purchaseId: "pur_butter", quantity: 0.05, unit: "kg" }
      ],
      updatedAt: "2025-02-02T09:15:00Z"
    }
  ],

  settings: {
    showPriceColumns: true,
    showCostPerPortionInList: true,
    currency: "EUR"
  }
};

// LOAD DATA FROM LOCALSTORAGE
function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    // No data? First launch → use default
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
    return structuredClone(defaultData);
  }

  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("Corrupted data, resetting:", e);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
    return structuredClone(defaultData);
  }
}

// SAVE DATA BACK TO LOCALSTORAGE
function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// GLOBAL DATA OBJECT IN MEMORY
let ppData = loadData();

/*
  =========================
  ACCESS HELPERS
  =========================
*/

function getPurchaseById(id) {
  return ppData.purchases.find((p) => p.id === id) || null;
}

function getRecipeById(id) {
  return ppData.recipes.find((r) => r.id === id) || null;
}

/*
  =========================
  CALCULATIONS
  =========================
*/

// Calculate cost of one ingredient in a recipe
function calculateIngredientCost(ingredient) {
  const purchase = getPurchaseById(ingredient.purchaseId);
  if (!purchase) return 0;

  return ingredient.quantity * purchase.pricePerUnit;
}

// Sum all ingredient costs
function calculateBatchCost(recipe) {
  return recipe.ingredients
    .map(calculateIngredientCost)
    .reduce((a, b) => a + b, 0);
}

// Cost per portion
function calculateCostPerPortion(recipe) {
  const batchCost = calculateBatchCost(recipe);
  return recipe.portions > 0 ? batchCost / recipe.portions : 0;
}

// Margin per portion (if selling price exists)
function calculateMargin(recipe) {
  const cpp = calculateCostPerPortion(recipe);
  const sell = recipe.sellingPricePerPortion;

  if (!sell || sell <= 0) return { euro: 0, percent: 0 };

  const euro = sell - cpp;
  const percent = euro / sell;

  return { euro, percent };
}

/*
  =========================
  ADDING ITEMS
  =========================
*/

// Add purchase item
function addPurchaseItem(item) {
  ppData.purchases.push(item);
  saveData(ppData);
}

// Add recipe
function addRecipe(recipe) {
  ppData.recipes.push(recipe);
  saveData(ppData);
}

/*
  =========================
  DEBUG HELPERS
  (You can test these in the browser console)
  =========================

  console.log(ppData);
  calculateBatchCost(ppData.recipes[0]);
  calculateCostPerPortion(ppData.recipes[0]);
  calculateMargin(ppData.recipes[0]);
*/
