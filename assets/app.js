// ---------------------------------------------------------
// ProfitPlate - shared settings helper
// ---------------------------------------------------------

(function () {
  const SETTINGS_KEY = "pp_settings";

  const defaultSettings = {
    currency: "EUR",
    locale: "eu",          // just a tag so you can change later
    autoRecalc: true,
    showAdvanced: true
  };

  function readSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...defaultSettings };
      const parsed = JSON.parse(raw);
      return { ...defaultSettings, ...(parsed || {}) };
    } catch (err) {
      console.warn("ProfitPlate: failed to load settings, using defaults.", err);
      return { ...defaultSettings };
    }
  }

  function writeSettings(next) {
    const merged = { ...defaultSettings, ...(next || {}) };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
    return merged;
  }

  // Expose globally for settings.html
  window.loadSettings = readSettings;
  window.saveSettings = writeSettings;
})();
