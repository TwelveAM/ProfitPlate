// assets/sample-data.js
// Tiny helper to load demo data into localStorage for ProfitPlate.
// It overwrites pp_purchases, pp_recipes and pp_settings.

(function () {
  function nowIso() {
    return new Date().toISOString();
  }

  const samplePurchases = [
    {
      id: "p_butter_1kg",
      name: "Butter 82% 1kg",
      category: "Dairy & Eggs",
      subtype: "Butter",
      supplier: "Nicolas",
      invoiceNumber: "INV-2025-001",
      invoiceDate: "2025-01-10",
      unit: "kg",
      pricePerUnit: 16.0,
      notes: "Keep refrigerated. For sauces, baking.",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      priceHistory: [
        {
          date: "2025-01-10",
          pricePerUnit: 15.5,
        },
        {
          date: "2025-02-01",
          pricePerUnit: 16.0,
        },
      ],
    },
    {
      id: "p_pasta_spaghetti_5kg",
      name: "Spaghetti 5kg",
      category: "Dry Goods",
      subtype: "Pasta",
      supplier: "Metro",
      invoiceNumber: "INV-2025-002",
      invoiceDate: "2025-02-05",
      unit: "kg",
      pricePerUnit: 1.4, // 7.00 € / 5 kg
      notes: "Dry storage.",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      priceHistory: [
        {
          date: "2025-02-05",
          pricePerUnit: 1.4,
        },
      ],
    },
    {
      id: "p_parmigiano_1kg",
      name: "Parmigiano Reggiano 1kg",
      category: "Dairy & Eggs",
      subtype: "Cheese",
      supplier: "Italian supplier",
      invoiceNumber: "INV-2025-003",
      invoiceDate: "2025-02-08",
      unit: "kg",
      pricePerUnit: 18.0,
      notes: "Use for grating & finishing.",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      priceHistory: [
        {
          date: "2025-02-08",
          pricePerUnit: 18.0,
        },
      ],
    },
    {
      id: "p_bacon_3kg",
      name: "Smoked bacon 3kg",
      category: "Meat & Fish",
      subtype: "Pork",
      supplier: "Metro",
      invoiceNumber: "INV-2025-004",
      invoiceDate: "2025-02-10",
      unit: "kg",
      pricePerUnit: 8.0, // 24 € / 3 kg
      notes: "",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      priceHistory: [
        {
          date: "2025-02-10",
          pricePerUnit: 8.0,
        },
      ],
    },
    {
      id: "p_eggs_30pcs",
      name: "Eggs L – tray 30 pcs",
      category: "Dairy & Eggs",
      subtype: "Eggs",
      supplier: "Local farm",
      invoiceNumber: "INV-2025-005",
      invoiceDate: "2025-02-12",
      unit: "pcs",
      pricePerUnit: 0.23, // 6.90 € / 30
      notes: "",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      priceHistory: [
        {
          date: "2025-02-12",
          pricePerUnit: 0.23,
        },
      ],
    },
  ];

  const sampleRecipes = [
    {
      id: "r_carbonara",
      name: "Pasta Carbonara",
      portions: 10,
      sellingPrice: 16.0,
      archived: false,
      notes: "Classic carbonara, no cream.",
      ingredients: [
        {
          purchaseId: "p_pasta_spaghetti_5kg",
          quantity: 0.10, // 100 g per portion
          unit: "kg",
        },
        {
          purchaseId: "p_bacon_3kg",
          quantity: 0.025, // 25 g per portion
          unit: "kg",
        },
        {
          purchaseId: "p_parmigiano_1kg",
          quantity: 0.015, // 15 g per portion
          unit: "kg",
        },
        {
          purchaseId: "p_eggs_30pcs",
          quantity: 1,
          unit: "pcs",
        },
      ],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: "r_butter_pasta",
      name: "Butter pasta (kids)",
      portions: 8,
      sellingPrice: 9.0,
      archived: false,
      notes: "Simple kid-friendly pasta.",
      ingredients: [
        {
          purchaseId: "p_pasta_spaghetti_5kg",
          quantity: 0.09,
          unit: "kg",
        },
        {
          purchaseId: "p_butter_1kg",
          quantity: 0.012,
          unit: "kg",
        },
        {
          purchaseId: "p_parmigiano_1kg",
          quantity: 0.012,
          unit: "kg",
        },
      ],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ];

  const sampleSettings = {
    language: "en",
    currency: "EUR",
    locale: "eu",
    autoRecalc: true,
    showAdvanced: true,
  };

  function loadSampleDataIntoLocalStorage() {
    const msg =
      "Load sample demo data?\n\nThis will OVERWRITE your current Purchases, Recipes and Settings stored in this browser.";
    if (!window.confirm(msg)) {
      return;
    }

    try {
      localStorage.setItem("pp_purchases", JSON.stringify(samplePurchases));
      localStorage.setItem("pp_recipes", JSON.stringify(sampleRecipes));
      localStorage.setItem("pp_settings", JSON.stringify(sampleSettings));
      alert("Sample data loaded. The page will now reload.");
      window.location.reload();
    } catch (err) {
      console.error("Failed to load sample data", err);
      alert("Could not load sample data. Check browser storage settings.");
    }
  }

  // expose globally so settings.html can call it
  window.loadSampleDataIntoLocalStorage = loadSampleDataIntoLocalStorage;
})();
