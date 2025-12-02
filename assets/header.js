// assets/header.js
// Single shared header/banner for all ProfitPlate pages

(function () {
  function ensureHeaderStyles() {
    if (document.getElementById("pp-header-style")) return;

    const css = `
header {
  background-color: #ffffff;
  border-bottom: 1px solid #dddddd;
}

.header-inner {
  max-width: 960px;
  margin: 0 auto;
  padding: 12px 20px 10px;
}

/* HERO BANNER */
.hero-banner {
  width: 630px;
  max-width: 100%;
  height: 130px;
  margin: 4px auto 16px;
  border-radius: 14px;
  background: linear-gradient(135deg, #0b5d3f, #06412a);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  color: #ffffff;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.16);
}

.hero-icons {
  font-size: 42px;
  opacity: 0.9;
}

.hero-title-block {
  text-align: center;
  flex: 1;
  margin: 0 24px;
}

.hero-title-banner {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.hero-subtitle-banner {
  margin-top: 6px;
  font-size: 16px;
  font-weight: 400;
}

/* NAV – centered pills */
nav {
  margin-top: 6px;
  margin-bottom: 6px;
}

.nav-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  gap: 32px;
  align-items: center;
  justify-content: center;
}

.nav-link {
  text-decoration: none;
  font-size: 14px;
  color: #222222;
  padding: 6px 12px;
  border-radius: 999px;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.nav-link:hover {
  background-color: rgba(11, 93, 63, 0.1);
}

.nav-link.active {
  background-color: #0b5d3f;
  color: #ffffff;
  font-weight: 500;
}

/* Mobile tweaks */
@media (max-width: 640px) {
  .nav-list {
    gap: 12px;
    flex-wrap: wrap;
  }
  .hero-banner {
    padding: 0 16px;
  }
  .hero-icons {
    display: none;
  }
  .hero-title-banner {
    font-size: 26px;
  }
  .hero-subtitle-banner {
    font-size: 14px;
  }
}
    `;

    const style = document.createElement("style");
    style.id = "pp-header-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function renderHeader(activePage) {
    ensureHeaderStyles();

    const host = document.getElementById("site-header");
    if (!host) return;

    host.innerHTML = `
<header>
  <div class="header-inner">
    <div class="hero-banner">
      <div class="hero-icons">⚖️</div>
      <div class="hero-title-block">
        <div class="hero-title-banner">PROFITPLATE</div>
        <div class="hero-subtitle-banner">Know your profit per plate.</div>
      </div>
      <div class="hero-icons">🥩</div>
    </div>

    <nav>
      <ul class="nav-list">
        <li><a class="nav-link" data-page="home" href="index.html">Home</a></li>
        <li><a class="nav-link" data-page="purchases" href="purchases.html">Purchases</a></li>
        <li><a class="nav-link" data-page="recipes" href="recipes.html">Recipes</a></li>
        <li><a class="nav-link" data-page="settings" href="settings.html">Settings</a></li>
      </ul>
    </nav>
  </div>
</header>
    `;

    // Mark active tab
    host.querySelectorAll(".nav-link").forEach((link) => {
      const page = link.getAttribute("data-page");
      if (page === activePage) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  window.renderHeader = renderHeader;
})();
