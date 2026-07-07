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
    searchInput: document.querySelector("#searchInput"),
    sortSelect: document.querySelector("#sortSelect"),
    imageOnly: document.querySelector("#imageOnly"),
    resetButton: document.querySelector("#resetButton"),
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
    const thumbs = product.images && product.images.length > 1
      ? `<div class="thumb-strip" aria-label="Additional product images">
          ${product.images.map((img, index) => `
            <button type="button" class="${index === 0 ? "active" : ""}" data-thumb="${escapeHtml(img.src)}" aria-label="Show product image ${index + 1}">
              <img src="${escapeHtml(img.src)}" alt="" loading="lazy">
            </button>
          `).join("")}
        </div>`
      : "";
    return `
      <article class="product-card" data-row="${escapeHtml(product.sourceRow)}">
        <div class="image-frame">
          ${firstImage
            ? `<img class="main-product-image" src="${escapeHtml(firstImage.src)}" alt="${escapeHtml(product.productEnglishName)}" loading="lazy">`
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
        ${thumbs}
      </article>
    `;
  }

  function tableRow(product) {
    const firstImage = getFirstImage(product);
    return `
      <tr>
        <td>
          ${firstImage
            ? `<img class="table-thumb" src="${escapeHtml(firstImage.src)}" alt="${escapeHtml(product.productEnglishName)}" loading="lazy">`
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

  function applyFilters() {
    const search = els.searchInput.value.trim().toLowerCase();
    const imageOnly = els.imageOnly.checked;
    let next = state.products.filter((product) => {
      const haystack = `${product.productEnglishName} ${product.model}`.toLowerCase();
      return (!search || haystack.includes(search)) && (!imageOnly || product.images.length);
    });

    switch (els.sortSelect.value) {
      case "sumDesc":
        next = next.sort((a, b) => b.sum - a.sum || a.sourceRow - b.sourceRow);
        break;
      case "qtyDesc":
        next = next.sort((a, b) => b.salesQuantity - a.salesQuantity || a.sourceRow - b.sourceRow);
        break;
      case "nameAsc":
        next = next.sort((a, b) => a.productEnglishName.localeCompare(b.productEnglishName));
        break;
      default:
        next = next.sort((a, b) => a.sourceRow - b.sourceRow);
    }
    state.filtered = next;
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
  }

  function bindEvents() {
    els.searchInput.addEventListener("input", applyFilters);
    els.sortSelect.addEventListener("change", applyFilters);
    els.imageOnly.addEventListener("change", applyFilters);
    els.resetButton.addEventListener("click", () => {
      els.searchInput.value = "";
      els.sortSelect.value = "sheet";
      els.imageOnly.checked = false;
      applyFilters();
    });
    els.productGrid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-thumb]");
      if (!button) return;
      const card = button.closest(".product-card");
      const image = card.querySelector(".main-product-image");
      if (!image) return;
      image.src = button.dataset.thumb;
      card.querySelectorAll(".thumb-strip button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
    });
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
    bindEvents();
    applyFilters();
  }

  init().catch((error) => {
    console.error(error);
    els.productGrid.innerHTML = `<div class="empty-state">Quotation data could not be loaded.</div>`;
  });
})();
