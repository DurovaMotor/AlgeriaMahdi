(() => {
  if (window.__QUOTE_LOCALE_BLOCKED__) return;

  const state = {
    products: [],
    meta: null,
    filtered: [],
  };

  const els = {
    summaryGrid: document.querySelector("#summaryGrid"),
    productGrid: document.querySelector("#productGrid"),
    quoteRows: document.querySelector("#quoteRows"),
    resultCount: document.querySelector("#resultCount"),
  };

  const fmtNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
  const fmtMoney = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  function money(value) {
    return `RMB ${fmtMoney.format(Number(value || 0))}`;
  }

  function quantity(value) {
    return fmtNumber.format(Number(value || 0));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setProtectedBackground(element, src) {
    if (!element || !src) return;
    element.style.backgroundImage = `url(${JSON.stringify(src)})`;
  }

  function hydrateProtectedImages(root = document) {
    root.querySelectorAll(".protected-media[data-src]").forEach((element) => {
      setProtectedBackground(element, element.dataset.src);
    });
  }

  function installImageProtections() {
    const protectedTarget = (target) => {
      const element = target instanceof Element ? target : target?.parentElement;
      return element?.closest(".protected-media, .image-frame, .table-thumb");
    };
    document.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });
    document.addEventListener("dragstart", (event) => {
      if (protectedTarget(event.target)) {
        event.preventDefault();
      }
    });
    document.addEventListener("selectstart", (event) => {
      if (protectedTarget(event.target)) {
        event.preventDefault();
      }
    });
    document.addEventListener("keydown", (event) => {
      const key = String(event.key || "").toLowerCase();
      const command = event.ctrlKey || event.metaKey;
      const blockedCommand = command && ["s", "u", "p"].includes(key);
      const blockedDevTools = event.key === "F12" || (event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key));
      if (blockedCommand || blockedDevTools) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
  }

  function renderSummary() {
    const meta = state.meta;
    const stats = [
      ["Quote Total", money(meta.quoteTotal)],
      ["Line Items", fmtNumber.format(meta.itemCount)],
      ["Image-backed Items", fmtNumber.format(meta.imageBackedItems)],
      ["Sales Quantity", quantity(meta.totalQuantity)],
    ];
    els.summaryGrid.innerHTML = stats
      .map(([label, value]) => `
        <div class="summary-card">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `)
      .join("");
  }

  function getFirstImage(product) {
    return product.images && product.images.length ? product.images[0] : null;
  }

  function productCard(product) {
    const firstImage = getFirstImage(product);
    return `
      <article class="product-card" data-row="${escapeHtml(product.sourceRow)}">
        <div class="image-frame">
          ${firstImage
            ? `<div class="main-product-image protected-media" role="img" aria-label="${escapeHtml(product.productEnglishName)}" data-src="${escapeHtml(firstImage.src)}"></div>`
            : `<div class="image-placeholder">No image</div>`}
        </div>
        <div class="card-body">
          <h3>${escapeHtml(product.productEnglishName)}</h3>
          <p class="model-line">Model: ${escapeHtml(product.model)}</p>
          <dl class="metrics">
            <div class="metric">
              <dt>Sales Quantity</dt>
              <dd>${quantity(product.salesQuantity)}</dd>
            </div>
            <div class="metric">
              <dt>Actual Price</dt>
              <dd>${money(product.actualSalesPrice)}</dd>
            </div>
            <div class="metric">
              <dt>SUM</dt>
              <dd>${money(product.sum)}</dd>
            </div>
          </dl>
        </div>
      </article>
    `;
  }

  function tableRow(product) {
    const firstImage = getFirstImage(product);
    return `
      <tr>
        <td>
          ${firstImage
            ? `<div class="table-thumb protected-media" role="img" aria-label="${escapeHtml(product.productEnglishName)}" data-src="${escapeHtml(firstImage.src)}"></div>`
            : `<div class="table-placeholder">No image</div>`}
        </td>
        <td>${escapeHtml(product.productEnglishName)}</td>
        <td class="number">${quantity(product.salesQuantity)}</td>
        <td class="number">${money(product.actualSalesPrice)}</td>
        <td class="number">${money(product.sum)}</td>
        <td>${escapeHtml(product.model)}</td>
      </tr>
    `;
  }

  function renderAllProducts() {
    state.filtered = [...state.products].sort((a, b) => a.sourceRow - b.sourceRow);
    renderProducts();
  }

  function renderProducts() {
    els.resultCount.textContent = `${fmtNumber.format(state.filtered.length)} products shown`;
    if (!state.filtered.length) {
      els.productGrid.innerHTML = `<div class="empty-state">No products match the current filters.</div>`;
      els.quoteRows.innerHTML = "";
      return;
    }
    els.productGrid.innerHTML = state.filtered.map(productCard).join("");
    els.quoteRows.innerHTML = state.filtered.map(tableRow).join("");
    hydrateProtectedImages(els.productGrid);
    hydrateProtectedImages(els.quoteRows);
  }

  function bindEvents() {
    return true;
  }

  async function init() {
    const response = await fetch("assets/data/products.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Unable to load quotation data: ${response.status}`);
    }
    const payload = await response.json();
    state.meta = payload.meta;
    state.products = payload.products;
    renderSummary();
    installImageProtections();
    bindEvents();
    renderAllProducts();
  }

  init().catch((error) => {
    console.error(error);
    els.productGrid.innerHTML = `<div class="empty-state">Quotation data could not be loaded.</div>`;
  });
})();
