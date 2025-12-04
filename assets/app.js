/* assets/app.js */

// ===========================
// 1. GLOBAL STATE & CONSTANTS
// ===========================
const KEYS = {
  purchases: "pp_purchases",
  recipes: "pp_recipes",
  settings: "pp_settings",
};

// Internal state variables
let purchases = [];
let recipes = [];
let settings = {
  currency: "USD",
  dateFormat: "YYYY-MM-DD",
};

// ===========================
// 2. STORAGE HELPERS
// ===========================

function safeSave(key, data) {
  try {
    const str = JSON.stringify(data);
    localStorage.setItem(key, str);
  } catch (e) {
    console.error("Error saving to localStorage", e);
    alert("Storage full or error saving data!");
  }
}

function loadData() {
  try {
    const pStr = localStorage.getItem(KEYS.purchases);
    const rStr = localStorage.getItem(KEYS.recipes);
    const sStr = localStorage.getItem(KEYS.settings);

    if (pStr) purchases = JSON.parse(pStr);
    if (rStr) recipes = JSON.parse(rStr);
    if (sStr) settings = JSON.parse(sStr);
  } catch (e) {
    console.error("Error parsing data", e);
  }
}

// ===========================
// 3. THE "BRAIN" (ppStore)
// ===========================

const ppStore = {
  // --- PURCHASES ---
  getPurchases() {
    return purchases.slice();
  },

  upsertPurchase(purchase) {
    const nowIso = new Date().toISOString();
    const idx = purchases.findIndex((p) => p.id === purchase.id);
    const existing = idx !== -1 ? purchases[idx] : null;
    
    const id = purchase.id || (existing && existing.id) || "p_" + Date.now();
    const createdAt = (existing && existing.createdAt) || purchase.createdAt || nowIso;

    // Price History Logic
    const numericPrice = Number(String(purchase.pricePerUnit || "").replace(",", ".")) || 0;
    let history = existing && Array.isArray(existing.priceHistory) ? existing.priceHistory.slice() : [];
    let lastRecorded = history.length > 0 ? Number(history[history.length - 1].pricePerUnit) : null;

    if (!history.length && existing && existing.pricePerUnit > 0) {
      history.push({ date: existing.updatedAt || existing.createdAt || nowIso, pricePerUnit: Number(existing.pricePerUnit) || 0 });
      lastRecorded = history[history.length - 1].pricePerUnit;
    }

    if (numericPrice > 0 && (lastRecorded === null || !Number.isFinite(lastRecorded) || numericPrice !== lastRecorded)) {
      history.push({ date: nowIso, pricePerUnit: numericPrice });
    }

    if (history.length > 10) history = history.slice(history.length - 10);

    const merged = {
      ...(existing || {}),
      ...purchase,
      id,
      createdAt,
      updatedAt: nowIso,
      pricePerUnit: numericPrice,
      priceHistory: history,
    };

    if (merged.isDemo) delete merged.isDemo;

    if (idx === -1) {
      purchases.push(merged);
    } else {
      purchases[idx] = merged;
    }
    
    safeSave(KEYS.purchases, purchases);
    return merged;
  },

  deletePurchase(id) {
    purchases = purchases.filter((p) => p.id !== id);
    safeSave(KEYS.purchases, purchases);
  },

  // --- RECIPES ---
  getRecipes() {
    return recipes.slice();
  },

  upsertRecipe(recipe) {
    if (recipe.isDemo) delete recipe.isDemo; 
    const idx = recipes.findIndex((r) => r.id === recipe.id);
    if (idx === -1) {
      recipes.push(recipe);
    } else {
      recipes[idx] = recipe;
    }
    safeSave(KEYS.recipes, recipes);
  },

  deleteRecipe(id) {
    recipes = recipes.filter((r) => r.id !== id);
    safeSave(KEYS.recipes, recipes);
  },

  // --- SETTINGS ---
  getSettings() {
    return { ...settings };
  },

  saveSettings(newSettings) {
    settings = { ...settings, ...newSettings };
    safeSave(KEYS.settings, settings);
  },

  // --- DATA MANAGEMENT ---
  removeDemoData() {
    purchases = purchases.filter(p => !p.isDemo);
    recipes = recipes.filter(r => !r.isDemo);
    safeSave(KEYS.purchases, purchases);
    safeSave(KEYS.recipes, recipes);
    location.reload();
  },

  nukeUserData() {
    if(confirm("Are you SURE? This will delete all your recipes and ingredients.")) {
      purchases = [];
      recipes = [];
      safeSave(KEYS.purchases, purchases);
      safeSave(KEYS.recipes, recipes);
      location.reload();
    }
  },

  // --- SAFE DEMO LOADER ---
  addDemoDataSafe() {
    // Note the "subtype" field (Sub-category)
    const demoItems = [
      { id: "p_demo_oil", name: "Olive Oil (Demo)", category: "Spices & Condiments", subtype: "Oils", supplier: "Metro", unit: "L", pricePerUnit: 12.00, isDemo: true },
      { id: "p_demo_pasta", name: "Spaghetti No.5 (Demo)", category: "Dry Goods", subtype: "Pasta", supplier: "Metro", unit: "kg", pricePerUnit: 2.20, isDemo: true },
      { id: "p_demo_pancetta", name: "Pancetta Cured (Demo)", category: "Meat & Fish", subtype: "Cured Meat", supplier: "Butcher", unit: "kg", pricePerUnit: 18.50, isDemo: true },
      { id: "p_demo_eggs", name: "Eggs Large (Demo)", category: "Dairy & Eggs", subtype: "Eggs", supplier: "Farm", unit: "pcs", pricePerUnit: 0.40, isDemo: true },
      { id: "p_demo_parm", name: "Parmesan 24mo (Demo)", category: "Dairy & Eggs", subtype: "Cheese", supplier: "Import", unit: "kg", pricePerUnit: 22.00, isDemo: true },
    ];

    const demoRecipes = [
      {
        id: "r_demo_carb",
        name: "Carbonara Classic (Demo)",
        portions: 4,
        sellingPrice: 15.00,
        isDemo: true,
        ingredients: [
          { purchaseId: "p_demo_pasta", quantity: 0.5, unit: "kg" },
          { purchaseId: "p_demo_pancetta", quantity: 0.2, unit: "kg" },
          { purchaseId: "p_demo_eggs", quantity: 5, unit: "pcs" },
          { purchaseId: "p_demo_parm", quantity: 0.1, unit: "kg" },
          { purchaseId: "p_demo_oil", quantity: 0.05, unit: "L" }
        ]
      }
    ];

    let added = false;
    demoItems.forEach(d => {
      if (!purchases.find(p => p.id === d.id)) {
        d.createdAt = new Date().toISOString();
        d.updatedAt = new Date().toISOString();
        d.priceHistory = [{ date: d.createdAt, pricePerUnit: d.pricePerUnit }];
        purchases.push(d);
        added = true;
      }
    });

    demoRecipes.forEach(d => {
      if (!recipes.find(r => r.id === d.id)) {
        recipes.push(d);
        added = true;
      }
    });

    if (added) {
      safeSave(KEYS.purchases, purchases);
      safeSave(KEYS.recipes, recipes);
      window.location.href = "recipes.html";
    } else {
      alert("Demo data is already loaded!");
    }
  }
};

window.ppStore = ppStore;
loadData();
