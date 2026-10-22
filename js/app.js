/**
 * app.js - Trình Điều Khiển Mobile-First Tối Ưu Cho Điện Thoại Di Động
 */

document.addEventListener('DOMContentLoaded', async () => {
  await window.appStore.init();
  MobileApp.init();
});

const MobileApp = {
  activeTab: 'dashboard',
  dateFilter: { startDate: '', endDate: '' },
  productStockFilter: 'all',
  salesPaymentFilter: 'all',

  init() {
    this.setupDatePillFilters();
    this.setupBottomNav();
    this.setupModalEvents();
    this.setupDashboardEvents();
    this.setupProductsEvents();
    this.setupPurchasesEvents();
    this.setupSalesEvents();
    this.setupCashflowEvents();
    this.setupReportsEvents();
    this.setupSettingsAndMoreEvents();

    // Tự động re-render khi DataStore thay đổi
    window.appStore.subscribe(() => {
      this.renderCurrentView();
    });

    this.loadStoreSettings();
    this.renderCurrentView();

    // Gợi ý demo nếu trống
    if (window.appStore.state.products.length === 0 && window.appStore.state.sales.length === 0) {
      setTimeout(() => {
        this.showToast('Chào bạn! Vào Menu ⚙️ để nạp Dữ liệu mẫu trải nghiệm ngay.', 'info');
      }, 600);
    }
  },

  /* =================== TOAST THÔNG BÁO =================== */
  showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✅' : (type === 'danger' ? '⚠️' : 'ℹ️');
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        if (toast.parentNode) container.removeChild(toast);
      }, 250);
    }, 3200);
  },

  /* =================== BỘ LỌC THỜI GIAN DẠNG PILL =================== */
  setupDatePillFilters() {
    const pills = document.querySelectorAll('#mobileTimePills .pill-item');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        const range = pill.getAttribute('data-range');
        const today = new Date();
        let start = '';
        let end = today.toISOString().slice(0, 10);

        if (range === 'today') {
          start = end;
        } else if (range === 'this_week') {
          const d = new Date(today);
          d.setDate(d.getDate() - 6);
          start = d.toISOString().slice(0, 10);
        } else if (range === 'this_month') {
          start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
        } else if (range === 'last_month') {
          start = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 10);
          end = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().slice(0, 10);
        } else if (range === 'this_year') {
          start = new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);
        } else {
          start = '';
          end = '';
        }

        this.dateFilter = { startDate: start, endDate: end };
        this.renderCurrentView();
      });
    });

    // Mặc định: Tháng này
    const today = new Date();
    this.dateFilter = {
      startDate: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10),
      endDate: today.toISOString().slice(0, 10)
    };
  },

  /* =================== ĐIỀU HƯỚNG BOTTOM NAVIGATION =================== */
  setupBottomNav() {
    const navBtns = document.querySelectorAll('.nav-tab-btn[data-tab]');
    navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // Nút FAB tròn to ở giữa: Bán hàng nhanh
    document.getElementById('btnFabCreateSale')?.addEventListener('click', () => {
      this.openAddSaleModal();
    });

    // Nút xem kho / xem đơn từ dashboard
    document.getElementById('btnDashViewStock')?.addEventListener('click', () => this.switchTab('products'));
    document.getElementById('btnDashViewSales')?.addEventListener('click', () => this.switchTab('sales'));
  },

  switchTab(tabName) {
    this.activeTab = tabName;

    // Cập nhật tab bar icon active
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      const match = btn.getAttribute('data-tab') === tabName;
      btn.classList.toggle('active', match);
    });

    // Hiển thị panel
    document.querySelectorAll('.tab-panel').forEach(p => {
      p.classList.toggle('active', p.id === `tab-${tabName}`);
    });

    // Cuộn mượt về đầu trang khi chuyển tab
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.renderCurrentView();
  },

  renderCurrentView() {
    this.updateLowStockBadge();
    switch (this.activeTab) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'products':
        this.renderProducts();
        break;
      case 'purchases':
        this.renderPurchases();
        break;
      case 'sales':
        this.renderSales();
        break;
      case 'cashflow':
        this.renderCashflow();
        break;
      case 'reports':
        this.renderReports();
        break;
      case 'more':
        this.loadStoreSettings();
        break;
    }
  },

  updateLowStockBadge() {
    const products = window.appStore.state.products || [];
    const lowStockCount = products.filter(p => Number(p.stock || 0) <= Number(p.minStock || 5)).length;
    const badge = document.getElementById('mobileStockBadge');
    if (badge) {
      if (lowStockCount > 0) {
        badge.textContent = lowStockCount;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
  },

  /* =================== MODALS HELPER =================== */
  setupModalEvents() {
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
      });
    });

    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) backdrop.classList.remove('active');
      });
    });
  },

  openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  },

  closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  },

  /* =================== 1. TỔNG QUAN (DASHBOARD) =================== */
  setupDashboardEvents() {
    // Header buttons
    document.getElementById('btnOpenConnectQR')?.addEventListener('click', () => {
      this.openModal('modalConnectQR');
    });
    document.getElementById('btnHeaderSettings')?.addEventListener('click', () => {
      this.switchTab('more');
    });
  },

  renderDashboard() {
    const state = window.appStore.state;
    const summary = Calculations.generateFinancialSummary(state, this.dateFilter);

    // Hero Banner
    const netEl = document.getElementById('kpiNetProfit');
    netEl.textContent = Calculations.formatCurrency(summary.totalNetProfit);
    netEl.style.color = summary.totalNetProfit >= 0 ? '#10b981' : '#ef4444';

    document.getElementById('kpiNetMargin').textContent = Calculations.formatPercent(summary.netMargin);
    document.getElementById('kpiRevenue').textContent = Calculations.formatCurrency(summary.totalRevenue);

    const totalExp = summary.totalCOGS + summary.totalShopOutboundShip + summary.totalOperatingExpense;
    document.getElementById('kpiTotalExpense').textContent = Calculations.formatCurrency(totalExp);

    // 4 Mini KPIs
    document.getElementById('kpiGrossProfit').textContent = Calculations.formatCurrency(summary.totalGrossProfit);
    document.getElementById('kpiInventoryValue').textContent = Calculations.formatCurrency(summary.totalInventoryValue);
    document.getElementById('kpiInventoryUnits').textContent = summary.totalInventoryUnits;
    document.getElementById('kpiCOGS').textContent = Calculations.formatCurrency(summary.totalCOGS);
    document.getElementById('kpiPendingDebt').textContent = Calculations.formatCurrency(summary.pendingPaymentAmount);

    // Biểu đồ
    ChartsManager.renderTrendChart('trendChartContainer', state.sales, state.purchases, state.cashflow, 7);
    ChartsManager.renderBreakdownChart('breakdownChartContainer', summary.totalExpensesBreakdown);

    // Cảnh báo tồn kho dạng Cards
    const lowStockContainer = document.getElementById('dashboardLowStockList');
    if (lowStockContainer) {
      const lowStockProds = state.products.filter(p => Number(p.stock || 0) <= Number(p.minStock || 5));
      if (lowStockProds.length === 0) {
        lowStockContainer.innerHTML = `
          <div style="background: #fff; padding: 14px; border-radius: 12px; text-align: center; color: #10b981; font-size: 13px; border: 1px solid #e2e8f0;">
            ✅ Kho an toàn, không có món nào sắp hết!
          </div>
        `;
      } else {
        lowStockContainer.innerHTML = lowStockProds.slice(0, 4).map(p => {
          const isOut = Number(p.stock || 0) === 0;
          return `
            <div class="m-card" style="border-left: 4px solid ${isOut ? '#ef4444' : '#f59e0b'};">
              <div class="m-card-header">
                <div>
                  <div class="m-card-title">${p.name}</div>
                  <div class="m-card-subtitle">Mã: ${p.sku} | Danh mục: ${p.category}</div>
                </div>
                <span class="badge ${isOut ? 'badge-danger' : 'badge-warning'}">
                  ${isOut ? 'Hết hàng' : 'Sắp hết'}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 13px; margin-top: 6px;">
                <span>Tồn hiện tại: <strong style="color: ${isOut ? '#ef4444' : '#f59e0b'}; font-size: 15px;">${p.stock} ${p.unit}</strong></span>
                <span style="color: #64748b;">Mức báo: <= ${p.minStock}</span>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Đơn hàng gần đây dạng Cards
    const recentSalesContainer = document.getElementById('dashboardRecentSalesList');
    if (recentSalesContainer) {
      const recent = state.sales.slice(0, 4);
      if (recent.length === 0) {
        recentSalesContainer.innerHTML = `
          <div style="background: #fff; padding: 14px; border-radius: 12px; text-align: center; color: #94a3b8; font-size: 13px; border: 1px solid #e2e8f0;">
            Chưa có đơn bán hàng nào phát sinh
          </div>
        `;
      } else {
        recentSalesContainer.innerHTML = recent.map(s => `
          <div class="m-card" onclick="MobileApp.printSaleInvoice('${s.id}')">
            <div class="m-card-header">
              <div>
                <div class="m-card-title">${s.customerName}</div>
                <div class="m-card-subtitle">${s.code} • ${Calculations.formatDate(s.date)} (${s.channel})</div>
              </div>
              <span class="badge badge-success">+${Calculations.formatNumber(s.grossProfit)} đ lãi</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; font-size: 13px;">
              <span style="color: #64748b;">Tổng bill:</span>
              <strong style="font-size: 15px; color: #0f172a;">${Calculations.formatCurrency(s.totalAmount)}</strong>
            </div>
          </div>
        `).join('');
      }
    }
  },

  /* =================== 2. HÀNG HÓA & TỒN KHO =================== */
  setupProductsEvents() {
    document.getElementById('btnMobileAddProduct')?.addEventListener('click', () => {
      this.openAddProductModal();
    });

    document.getElementById('btnMobileExportProducts')?.addEventListener('click', () => {
      ExportManager.exportProducts(window.appStore.state.products);
      this.showToast('Đã tải danh sách hàng hóa ra Excel!');
    });

    document.getElementById('mobileProductSearch')?.addEventListener('input', () => this.renderProducts());

    // Pills lọc tồn kho
    const stockPills = document.querySelectorAll('.prod-stock-pill');
    stockPills.forEach(pill => {
      pill.addEventListener('click', () => {
        stockPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.productStockFilter = pill.getAttribute('data-stock');
        this.renderProducts();
      });
    });

    // Form submit sản phẩm
    document.getElementById('formProduct')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('prodId').value;
      const name = document.getElementById('prodName').value.trim();
      const sku = document.getElementById('prodSku').value.trim();
      const category = document.getElementById('prodCategory').value.trim();
      const unit = document.getElementById('prodUnit').value.trim();
      const costPrice = parseFloat(document.getElementById('prodCostPrice').value) || 0;
      const sellingPrice = parseFloat(document.getElementById('prodSellingPrice').value) || 0;
      const stock = parseInt(document.getElementById('prodStock').value) || 0;
      const minStock = parseInt(document.getElementById('prodMinStock').value) || 0;
      const notes = document.getElementById('prodNotes').value.trim();

      await window.appStore.saveProduct({
        id: id || undefined,
        name,
        sku,
        category,
        unit,
        costPrice,
        sellingPrice,
        stock,
        minStock,
        notes
      });

      this.closeModal('modalProduct');
      this.showToast(id ? 'Đã sửa sản phẩm!' : 'Đã thêm sản phẩm mới!');
    });
  },

  openAddProductModal(product = null) {
    document.getElementById('modalProductTitle').textContent = product ? '✏️ Sửa Hàng Hóa' : '🏷️ Thêm Hàng Hóa Mới';
    document.getElementById('prodId').value = product ? product.id : '';
    document.getElementById('prodName').value = product ? product.name : '';
    document.getElementById('prodSku').value = product ? product.sku : '';
    document.getElementById('prodCategory').value = product ? product.category : 'Thời trang';
    document.getElementById('prodUnit').value = product ? product.unit : 'Cái';
    document.getElementById('prodCostPrice').value = product ? product.costPrice : 0;
    document.getElementById('prodSellingPrice').value = product ? product.sellingPrice : '';
    document.getElementById('prodStock').value = product ? product.stock : 0;
    document.getElementById('prodMinStock').value = product ? product.minStock : 5;
    document.getElementById('prodNotes').value = product ? product.notes : '';

    this.openModal('modalProduct');
  },

  renderProducts() {
    const state = window.appStore.state;
    const search = (document.getElementById('mobileProductSearch')?.value || '').toLowerCase().trim();

    let filtered = state.products.filter(p => {
      const matchSearch = !search || p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search);
      let matchStock = true;
      const stock = Number(p.stock || 0);
      const minStock = Number(p.minStock || 5);

      if (this.productStockFilter === 'in_stock') matchStock = stock > 0;
      else if (this.productStockFilter === 'low_stock') matchStock = stock <= minStock;
      else if (this.productStockFilter === 'out_of_stock') matchStock = stock === 0;

      return matchSearch && matchStock;
    });

    const container = document.getElementById('productsCardsList');
    if (!container) return;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="background: #fff; padding: 24px; border-radius: 14px; text-align: center; color: #94a3b8; font-size: 13.5px; border: 1px solid #e2e8f0;">
          Không tìm thấy hàng hóa nào phù hợp
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(p => {
      const stock = Number(p.stock || 0);
      const minStock = Number(p.minStock || 5);
      const cost = Number(p.costPrice || 0);
      const sell = Number(p.sellingPrice || 0);
      const profitPerUnit = sell - cost;

      let stockBadge = '<span class="badge badge-success">Còn ' + stock + ' ' + p.unit + '</span>';
      if (stock === 0) {
        stockBadge = '<span class="badge badge-danger">Hết hàng</span>';
      } else if (stock <= minStock) {
        stockBadge = '<span class="badge badge-warning">Còn ' + stock + ' (Sắp hết)</span>';
      }

      return `
        <div class="m-card">
          <div class="m-card-header">
            <div>
              <div class="m-card-title">${p.name}</div>
              <div class="m-card-subtitle">Mã: <code>${p.sku}</code> • ${p.category}</div>
            </div>
            ${stockBadge}
          </div>

          <div class="m-card-grid">
            <div class="m-card-grid-item">
              <span>Giá vốn:</span>
              <strong>${Calculations.formatNumber(cost)} đ</strong>
            </div>
            <div class="m-card-grid-item">
              <span>Giá bán niêm yết:</span>
              <strong style="color: #2563eb;">${Calculations.formatNumber(sell)} đ</strong>
            </div>
            <div class="m-card-grid-item">
              <span>Lãi dự kiến/cái:</span>
              <strong style="color: #10b981;">+${Calculations.formatNumber(profitPerUnit)} đ</strong>
            </div>
            <div class="m-card-grid-item">
              <span>Tổng tiền đọng kho:</span>
              <strong>${Calculations.formatNumber(stock * cost)} đ</strong>
            </div>
          </div>

          <div class="m-card-footer">
            <span style="font-size: 11px; color: #94a3b8;">${p.notes || ''}</span>
            <div class="m-card-actions">
              <button class="btn btn-sm btn-outline" onclick="MobileApp.editProduct('${p.id}')">✏️ Sửa</button>
              <button class="btn btn-sm btn-outline" style="color: #ef4444;" onclick="MobileApp.deleteProduct('${p.id}')">🗑️</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  editProduct(id) {
    const prod = window.appStore.getProductById(id);
    if (prod) this.openAddProductModal(prod);
  },

  async deleteProduct(id) {
    const prod = window.appStore.getProductById(id);
    if (!prod) return;
    if (confirm(`Xóa sản phẩm "${prod.name}" khỏi danh mục?`)) {
      await window.appStore.deleteProduct(id);
      this.showToast('Đã xóa sản phẩm!');
    }
  },

  /* =================== 3. NHẬP HÀNG (PURCHASES) =================== */
  setupPurchasesEvents() {
    document.getElementById('btnMobileAddPurchase')?.addEventListener('click', () => {
      this.openAddPurchaseModal();
    });

    document.getElementById('btnAddPurchaseRow')?.addEventListener('click', () => {
      this.addPurchaseRow();
    });

    ['poShippingCost', 'poAllocationMethod'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.updatePurchaseLiveCalc());
      document.getElementById(id)?.addEventListener('change', () => this.updatePurchaseLiveCalc());
    });

    document.getElementById('formPurchase')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rows = document.querySelectorAll('#purchaseItemsContainer .mobile-item-row');
      if (rows.length === 0) {
        alert('Vui lòng thêm ít nhất 1 sản phẩm nhập.');
        return;
      }

      const items = [];
      let isValid = true;

      rows.forEach(row => {
        const prodSelect = row.querySelector('.po-product-select');
        const qtyInput = row.querySelector('.po-qty-input');
        const priceInput = row.querySelector('.po-price-input');

        const productId = prodSelect.value;
        const quantity = parseFloat(qtyInput.value) || 0;
        const purchasePrice = parseFloat(priceInput.value) || 0;

        if (!productId || quantity <= 0) {
          isValid = false;
        } else {
          const prod = window.appStore.getProductById(productId);
          items.push({
            productId,
            productName: prod ? prod.name : 'Sản phẩm',
            quantity,
            purchasePrice
          });
        }
      });

      if (!isValid || items.length === 0) {
        alert('Vui lòng chọn sản phẩm và nhập số lượng lớn hơn 0.');
        return;
      }

      const date = document.getElementById('poDate').value;
      const supplier = document.getElementById('poSupplier').value;
      const shippingCost = parseFloat(document.getElementById('poShippingCost').value) || 0;
      const allocationMethod = document.getElementById('poAllocationMethod').value;
      const notes = document.getElementById('poNotes').value;

      await window.appStore.createPurchase({
        date,
        supplier,
        shippingCost,
        allocationMethod,
        items,
        notes
      });

      this.closeModal('modalPurchase');
      this.showToast('Đã lưu phiếu nhập & cộng dồn tồn kho!');
    });
  },

  openAddPurchaseModal() {
    if (window.appStore.state.products.length === 0) {
      alert('Vui lòng thêm ít nhất 1 sản phẩm trong kho trước khi nhập.');
      this.switchTab('products');
      return;
    }

    document.getElementById('poDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('poSupplier').value = '';
    document.getElementById('poShippingCost').value = 0;
    document.getElementById('poAllocationMethod').value = window.appStore.state.settings.defaultAllocationMethod || 'by_quantity';
    document.getElementById('poNotes').value = '';

    const container = document.getElementById('purchaseItemsContainer');
    container.innerHTML = '';
    this.addPurchaseRow();

    this.openModal('modalPurchase');
  },

  addPurchaseRow() {
    const container = document.getElementById('purchaseItemsContainer');
    const div = document.createElement('div');
    div.className = 'mobile-item-row';
    div.style.cssText = 'background: #fff; border: 1px solid var(--border); border-radius: 10px; padding: 10px;';

    const products = window.appStore.state.products || [];
    const optionsHtml = products.map(p => `
      <option value="${p.id}" data-cost="${p.costPrice}">${p.name} (Tồn: ${p.stock})</option>
    `).join('');

    div.innerHTML = `
      <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
        <select class="form-control po-product-select" style="flex: 1;" required>
          <option value="">-- Chọn sản phẩm --</option>
          ${optionsHtml}
        </select>
        <button type="button" class="btn btn-sm btn-outline" style="color: #ef4444; width: 34px; padding: 0;" onclick="this.closest('.mobile-item-row').remove(); MobileApp.updatePurchaseLiveCalc();">&times;</button>
      </div>
      <div class="form-row">
        <div>
          <label style="font-size: 11px; color: #64748b;">Số lượng:</label>
          <input type="number" class="form-control po-qty-input" value="10" min="1" required inputmode="numeric">
        </div>
        <div>
          <label style="font-size: 11px; color: #64748b;">Giá mua 1 cái (VNĐ):</label>
          <input type="number" class="form-control po-price-input" value="0" min="0" required inputmode="numeric">
        </div>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 6px; color: #64748b;">
        <span>Thành tiền:</span>
        <strong class="po-line-total" style="color: #0f172a;">0 đ</strong>
      </div>
    `;

    container.appendChild(div);

    const prodSelect = div.querySelector('.po-product-select');
    const priceInput = div.querySelector('.po-price-input');
    const qtyInput = div.querySelector('.po-qty-input');

    prodSelect.addEventListener('change', () => {
      const selected = prodSelect.options[prodSelect.selectedIndex];
      const cost = selected.getAttribute('data-cost');
      if (cost && (!priceInput.value || priceInput.value === '0')) {
        priceInput.value = cost;
      }
      this.updatePurchaseLiveCalc();
    });

    priceInput.addEventListener('input', () => this.updatePurchaseLiveCalc());
    qtyInput.addEventListener('input', () => this.updatePurchaseLiveCalc());

    this.updatePurchaseLiveCalc();
  },

  updatePurchaseLiveCalc() {
    const rows = document.querySelectorAll('#purchaseItemsContainer .mobile-item-row');
    let subtotal = 0;

    rows.forEach(row => {
      const qty = parseFloat(row.querySelector('.po-qty-input')?.value) || 0;
      const price = parseFloat(row.querySelector('.po-price-input')?.value) || 0;
      const lineTotal = qty * price;
      subtotal += lineTotal;

      const totalEl = row.querySelector('.po-line-total');
      if (totalEl) totalEl.textContent = Calculations.formatNumber(lineTotal) + ' đ';
    });

    const shipping = parseFloat(document.getElementById('poShippingCost')?.value) || 0;
    const total = subtotal + shipping;

    document.getElementById('poPreviewSubtotal').textContent = Calculations.formatCurrency(subtotal);
    document.getElementById('poPreviewShipping').textContent = Calculations.formatCurrency(shipping);
    document.getElementById('poPreviewTotal').textContent = Calculations.formatCurrency(total);
  },

  renderPurchases() {
    const state = window.appStore.state;
    const container = document.getElementById('purchasesCardsList');
    if (!container) return;

    if (state.purchases.length === 0) {
      container.innerHTML = `
        <div style="background: #fff; padding: 24px; border-radius: 14px; text-align: center; color: #94a3b8; font-size: 13.5px; border: 1px solid #e2e8f0;">
          Chưa có phiếu nhập hàng nào
        </div>
      `;
      return;
    }

    container.innerHTML = state.purchases.map(p => {
      const itemsHtml = (p.items || []).map(i => `
        <div style="padding: 3px 0;">
          • <strong>${i.productName}</strong>: ${i.quantity} cái x ${Calculations.formatNumber(i.purchasePrice)} đ
          <span style="color: #10b981;">(Sau ship: ${Calculations.formatNumber(i.landedCostPerUnit)} đ)</span>
        </div>
      `).join('');

      return `
        <div class="m-card">
          <div class="m-card-header">
            <div>
              <div class="m-card-title">${p.supplier}</div>
              <div class="m-card-subtitle">${p.code} • ${Calculations.formatDate(p.date)}</div>
            </div>
            <strong style="color: #0f172a; font-size: 15px;">${Calculations.formatCurrency(p.totalAmount)}</strong>
          </div>

          <div style="background: #f8fafc; padding: 10px 12px; border-radius: 8px; font-size: 12px; margin: 8px 0;">
            ${itemsHtml}
          </div>

          <div class="m-card-footer">
            <span style="font-size: 12px; color: #8b5cf6;">🚚 Ship xưởng: +${Calculations.formatNumber(p.shippingCost)} đ</span>
            <button class="btn btn-sm btn-outline" style="color: #ef4444;" onclick="MobileApp.deletePurchase('${p.id}')">🗑️ Xóa</button>
          </div>
        </div>
      `;
    }).join('');
  },

  async deletePurchase(id) {
    if (confirm('Xóa phiếu nhập sẽ trừ bớt tồn kho đã cộng. Bạn có chắc muốn xóa không?')) {
      await window.appStore.deletePurchase(id);
      this.showToast('Đã xóa phiếu nhập hàng!');
    }
  },

  /* =================== 4. BÁN HÀNG (SALES) =================== */
  setupSalesEvents() {
    document.getElementById('btnMobileAddSale')?.addEventListener('click', () => {
      this.openAddSaleModal();
    });

    document.getElementById('btnAddSaleRow')?.addEventListener('click', () => {
      this.addSaleRow();
    });

    document.getElementById('btnMobileExportSales')?.addEventListener('click', () => {
      ExportManager.exportSales(window.appStore.state.sales);
      this.showToast('Đã xuất lịch sử bán hàng ra Excel!');
    });

    document.getElementById('mobileSalesSearch')?.addEventListener('input', () => this.renderSales());

    // Pills lọc thanh toán
    const payPills = document.querySelectorAll('.sale-pay-pill');
    payPills.forEach(pill => {
      pill.addEventListener('click', () => {
        payPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.salesPaymentFilter = pill.getAttribute('data-pay');
        this.renderSales();
      });
    });

    ['saleDiscount', 'saleShippingFee', 'saleShippingPayer'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.updateSaleLiveCalc());
      document.getElementById(id)?.addEventListener('change', () => this.updateSaleLiveCalc());
    });

    document.getElementById('salePaymentStatus')?.addEventListener('change', (e) => {
      const divPaid = document.getElementById('divPaidAmount');
      if (divPaid) {
        divPaid.style.display = e.target.value === 'partial' ? 'block' : 'none';
      }
    });

    // Form submit bán hàng
    document.getElementById('formSale')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rows = document.querySelectorAll('#saleItemsContainer .mobile-item-row');
      if (rows.length === 0) {
        alert('Vui lòng chọn ít nhất 1 sản phẩm bán.');
        return;
      }

      const items = [];
      let isValid = true;
      let outOfStockWarning = false;

      rows.forEach(row => {
        const prodSelect = row.querySelector('.sale-product-select');
        const qtyInput = row.querySelector('.sale-qty-input');
        const priceInput = row.querySelector('.sale-price-input');

        const productId = prodSelect.value;
        const quantity = parseFloat(qtyInput.value) || 0;
        const sellingPrice = parseFloat(priceInput.value) || 0;

        if (!productId || quantity <= 0) {
          isValid = false;
        } else {
          const prod = window.appStore.getProductById(productId);
          if (prod && quantity > Number(prod.stock || 0)) {
            outOfStockWarning = true;
          }
          items.push({
            productId,
            productName: prod ? prod.name : 'Sản phẩm',
            sku: prod ? prod.sku : '',
            quantity,
            sellingPrice,
            costPrice: prod ? prod.costPrice : 0
          });
        }
      });

      if (!isValid || items.length === 0) {
        alert('Vui lòng chọn sản phẩm và số lượng bán hợp lệ.');
        return;
      }

      if (outOfStockWarning) {
        if (!confirm('Số lượng bán vượt quá tồn kho hiện có. Bạn có chắc muốn tạo đơn?')) {
          return;
        }
      }

      const date = document.getElementById('saleDate').value;
      const customerName = document.getElementById('saleCustomerName').value.trim();
      const customerPhone = document.getElementById('saleCustomerPhone').value.trim();
      const channel = document.getElementById('saleChannel').value;
      const paymentStatus = document.getElementById('salePaymentStatus').value;
      const paidAmount = parseFloat(document.getElementById('salePaidAmount').value) || 0;
      const discount = parseFloat(document.getElementById('saleDiscount').value) || 0;
      const shippingFee = parseFloat(document.getElementById('saleShippingFee').value) || 0;
      const shippingPayer = document.getElementById('saleShippingPayer').value;
      const notes = document.getElementById('saleNotes').value.trim();

      await window.appStore.createSale({
        date,
        customerName,
        customerPhone,
        channel,
        paymentStatus,
        paidAmount,
        discount,
        shippingFee,
        shippingPayer,
        items,
        notes
      });

      this.closeModal('modalSale');
      this.showToast('Đã lưu đơn bán và trừ tồn kho!');
    });
  },

  openAddSaleModal() {
    if (window.appStore.state.products.length === 0) {
      alert('Chưa có sản phẩm nào. Vui lòng thêm sản phẩm trước khi bán.');
      this.switchTab('products');
      return;
    }

    document.getElementById('saleDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('saleCustomerName').value = 'Khách lẻ';
    document.getElementById('saleCustomerPhone').value = '';
    document.getElementById('saleChannel').value = 'Trực tiếp';
    document.getElementById('salePaymentStatus').value = 'paid';
    document.getElementById('divPaidAmount').style.display = 'none';
    document.getElementById('salePaidAmount').value = 0;
    document.getElementById('saleDiscount').value = 0;
    document.getElementById('saleShippingFee').value = 0;
    document.getElementById('saleShippingPayer').value = window.appStore.state.settings.defaultShippingPayer || 'customer';
    document.getElementById('saleNotes').value = '';

    const container = document.getElementById('saleItemsContainer');
    container.innerHTML = '';
    this.addSaleRow();

    this.openModal('modalSale');
  },

  addSaleRow() {
    const container = document.getElementById('saleItemsContainer');
    const div = document.createElement('div');
    div.className = 'mobile-item-row';
    div.style.cssText = 'background: #fff; border: 1px solid var(--border); border-radius: 10px; padding: 10px;';

    const products = window.appStore.state.products || [];
    const optionsHtml = products.map(p => `
      <option value="${p.id}" data-price="${p.sellingPrice}" data-stock="${p.stock}">${p.name} (Kho: ${p.stock})</option>
    `).join('');

    div.innerHTML = `
      <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
        <select class="form-control sale-product-select" style="flex: 1;" required>
          <option value="">-- Chọn món bán --</option>
          ${optionsHtml}
        </select>
        <button type="button" class="btn btn-sm btn-outline" style="color: #ef4444; width: 34px; padding: 0;" onclick="this.closest('.mobile-item-row').remove(); MobileApp.updateSaleLiveCalc();">&times;</button>
      </div>
      <div class="form-row">
        <div>
          <label style="font-size: 11px; color: #64748b;">Số lượng bán:</label>
          <input type="number" class="form-control sale-qty-input" value="1" min="1" required inputmode="numeric">
        </div>
        <div>
          <label style="font-size: 11px; color: #64748b;">Giá bán (VNĐ):</label>
          <input type="number" class="form-control sale-price-input" value="0" min="0" required inputmode="numeric">
        </div>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 6px; color: #64748b;">
        <span>Thành tiền:</span>
        <strong class="sale-line-total" style="color: #0f172a;">0 đ</strong>
      </div>
    `;

    container.appendChild(div);

    const prodSelect = div.querySelector('.sale-product-select');
    const priceInput = div.querySelector('.sale-price-input');
    const qtyInput = div.querySelector('.sale-qty-input');

    prodSelect.addEventListener('change', () => {
      const selected = prodSelect.options[prodSelect.selectedIndex];
      const price = selected.getAttribute('data-price');
      if (price) priceInput.value = price;
      this.updateSaleLiveCalc();
    });

    priceInput.addEventListener('input', () => this.updateSaleLiveCalc());
    qtyInput.addEventListener('input', () => this.updateSaleLiveCalc());

    this.updateSaleLiveCalc();
  },

  updateSaleLiveCalc() {
    const rows = document.querySelectorAll('#saleItemsContainer .mobile-item-row');
    let merchandiseValue = 0;
    let totalCOGS = 0;

    rows.forEach(row => {
      const prodSelect = row.querySelector('.sale-product-select');
      const qty = parseFloat(row.querySelector('.sale-qty-input')?.value) || 0;
      const price = parseFloat(row.querySelector('.sale-price-input')?.value) || 0;
      const lineTotal = qty * price;
      merchandiseValue += lineTotal;

      const totalEl = row.querySelector('.sale-line-total');
      if (totalEl) totalEl.textContent = Calculations.formatNumber(lineTotal) + ' đ';

      const prod = window.appStore.getProductById(prodSelect?.value);
      if (prod) {
        totalCOGS += qty * Number(prod.costPrice || 0);
      }
    });

    const discount = parseFloat(document.getElementById('saleDiscount')?.value) || 0;
    const shippingFee = parseFloat(document.getElementById('saleShippingFee')?.value) || 0;
    const shippingPayer = document.getElementById('saleShippingPayer')?.value || 'customer';

    const netMerch = Math.max(0, merchandiseValue - discount);
    const totalBill = shippingPayer === 'customer' ? (netMerch + shippingFee) : netMerch;
    const shopShipCost = shippingPayer === 'shop' ? shippingFee : 0;
    const grossProfit = netMerch - totalCOGS - shopShipCost;
    const margin = netMerch > 0 ? (grossProfit / netMerch) : 0;

    document.getElementById('salePrevMerchandise').textContent = Calculations.formatCurrency(merchandiseValue);

    const discRow = document.getElementById('salePrevDiscountRow');
    if (discount > 0) {
      discRow.style.display = 'flex';
      document.getElementById('salePrevDiscount').textContent = '-' + Calculations.formatCurrency(discount);
    } else {
      discRow.style.display = 'none';
    }

    document.getElementById('salePrevShipping').textContent = shippingFee > 0 
      ? `${Calculations.formatNumber(shippingFee)} đ (${shippingPayer === 'shop' ? 'Shop chịu' : 'Khách trả'})`
      : '0 đ';

    document.getElementById('salePrevTotal').textContent = Calculations.formatCurrency(totalBill);
    document.getElementById('salePrevCOGS').textContent = Calculations.formatCurrency(totalCOGS);

    const profitEl = document.getElementById('salePrevGrossProfit');
    profitEl.textContent = (grossProfit >= 0 ? '+' : '') + Calculations.formatCurrency(grossProfit);
    profitEl.style.color = grossProfit >= 0 ? '#10b981' : '#ef4444';

    document.getElementById('salePrevMargin').textContent = Calculations.formatPercent(margin);
  },

  renderSales() {
    const state = window.appStore.state;
    const search = (document.getElementById('mobileSalesSearch')?.value || '').toLowerCase().trim();

    let filtered = state.sales.filter(s => {
      const matchSearch = !search || s.code.toLowerCase().includes(search) || s.customerName.toLowerCase().includes(search) || (s.customerPhone && s.customerPhone.includes(search));
      const matchPay = this.salesPaymentFilter === 'all' || s.paymentStatus === this.salesPaymentFilter;
      return matchSearch && matchPay;
    });

    const container = document.getElementById('salesCardsList');
    if (!container) return;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="background: #fff; padding: 24px; border-radius: 14px; text-align: center; color: #94a3b8; font-size: 13.5px; border: 1px solid #e2e8f0;">
          Không tìm thấy đơn bán hàng nào
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(s => {
      const itemsList = (s.items || []).map(i => `${i.productName} (x${i.quantity})`).join(', ');

      let statusBadge = '<span class="badge badge-success">Đã thu đủ</span>';
      if (s.paymentStatus === 'unpaid') {
        statusBadge = '<span class="badge badge-danger">Chưa thu (Nợ)</span>';
      } else if (s.paymentStatus === 'partial') {
        statusBadge = `<span class="badge badge-warning">Đã cọc: ${Calculations.formatNumber(s.paidAmount)} đ</span>`;
      }

      let shipInfo = '';
      if (s.shippingFee > 0) {
        shipInfo = s.shippingPayer === 'shop' 
          ? `<span style="color: #ef4444; font-size: 11px;">🚚 Shop freeship: -${Calculations.formatNumber(s.shippingFee)} đ</span>`
          : `<span style="color: #64748b; font-size: 11px;">🚚 Ship khách trả: +${Calculations.formatNumber(s.shippingFee)} đ</span>`;
      }

      return `
        <div class="m-card">
          <div class="m-card-header">
            <div>
              <div class="m-card-title">${s.customerName}</div>
              <div class="m-card-subtitle">${s.code} • ${Calculations.formatDate(s.date)} • ${s.channel}</div>
            </div>
            ${statusBadge}
          </div>

          <div style="font-size: 12.5px; color: #475569; margin: 6px 0; background: #f8fafc; padding: 8px 10px; border-radius: 8px;">
            ${itemsList}
          </div>

          <div style="display: flex; justify-content: space-between; align-items: baseline; margin: 8px 0;">
            <div>
              <span style="font-size: 11px; color: #64748b;">Tổng bill:</span>
              <div style="font-size: 17px; font-weight: 800; color: #0f172a;">${Calculations.formatCurrency(s.totalAmount)}</div>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 11px; color: #64748b;">Lợi nhuận gộp:</span>
              <div style="font-size: 16px; font-weight: 800; color: #10b981;">+${Calculations.formatCurrency(s.grossProfit)}</div>
            </div>
          </div>

          ${shipInfo ? `<div style="margin-bottom: 8px;">${shipInfo}</div>` : ''}

          <div class="m-card-footer">
            <span style="font-size: 11px; color: #94a3b8;">${s.customerPhone ? '📞 ' + s.customerPhone : ''}</span>
            <div class="m-card-actions">
              <button class="btn btn-sm btn-outline" title="In hóa đơn" onclick="MobileApp.printSaleInvoice('${s.id}')">🖨️ In</button>
              <button class="btn btn-sm btn-outline" title="Thanh toán" onclick="MobileApp.promptPaymentStatus('${s.id}')">💳 Thu tiền</button>
              <button class="btn btn-sm btn-outline" style="color: #ef4444;" onclick="MobileApp.deleteSale('${s.id}')">🗑️</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  printSaleInvoice(id) {
    const sale = window.appStore.state.sales.find(s => s.id === id);
    if (sale) ExportManager.printInvoice(sale);
  },

  async promptPaymentStatus(id) {
    const sale = window.appStore.state.sales.find(s => s.id === id);
    if (!sale) return;

    const opt = prompt(
      `Cập nhật thanh toán cho đơn ${sale.code}:\n` +
      `1: Đã thanh toán đủ (${Calculations.formatCurrency(sale.totalAmount)})\n` +
      `2: Chưa thanh toán (Khách nợ)\n` +
      `3: Nhập số tiền thu một phần`,
      sale.paymentStatus === 'paid' ? '1' : (sale.paymentStatus === 'unpaid' ? '2' : '3')
    );

    if (opt === '1') {
      await window.appStore.updateSalePayment(id, 'paid', sale.totalAmount);
      this.showToast('Đã đánh dấu: Đã thanh toán!');
    } else if (opt === '2') {
      await window.appStore.updateSalePayment(id, 'unpaid', 0);
      this.showToast('Đã chuyển sang: Chưa thanh toán!');
    } else if (opt === '3') {
      const amtStr = prompt('Nhập số tiền đã nhận:', sale.paidAmount || '0');
      if (amtStr !== null) {
        const amt = parseFloat(amtStr) || 0;
        const status = amt >= sale.totalAmount ? 'paid' : (amt > 0 ? 'partial' : 'unpaid');
        await window.appStore.updateSalePayment(id, status, amt);
        this.showToast('Đã cập nhật tiền thanh toán!');
      }
    }
  },

  async deleteSale(id) {
    if (confirm('Xóa đơn bán hàng này sẽ hoàn trả lại số lượng tồn kho. Bạn có chắc muốn xóa không?')) {
      await window.appStore.deleteSale(id);
      this.showToast('Đã xóa đơn bán hàng!');
    }
  },

  /* =================== 5. SỔ QUỸ THU - CHI =================== */
  setupCashflowEvents() {
    document.getElementById('btnMobileAddCashflow')?.addEventListener('click', () => {
      document.getElementById('cfDate').value = new Date().toISOString().slice(0, 10);
      document.getElementById('cfType').value = 'expense';
      document.getElementById('cfCategory').value = 'Bao bì & Đóng gói';
      document.getElementById('cfAmount').value = '';
      document.getElementById('cfDescription').value = '';
      this.openModal('modalCashflow');
    });

    document.getElementById('btnBackToMoreFromCashflow')?.addEventListener('click', () => {
      this.switchTab('more');
    });

    document.getElementById('formCashflow')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = document.getElementById('cfType').value;
      const date = document.getElementById('cfDate').value;
      const category = document.getElementById('cfCategory').value.trim();
      const amount = parseFloat(document.getElementById('cfAmount').value) || 0;
      const description = document.getElementById('cfDescription').value.trim();

      await window.appStore.addCashflow({
        type,
        date,
        category,
        amount,
        description
      });

      this.closeModal('modalCashflow');
      this.showToast('Đã ghi nhận vào sổ quỹ!');
    });
  },

  renderCashflow() {
    const state = window.appStore.state;
    const container = document.getElementById('cashflowCardsList');
    if (!container) return;

    if (state.cashflow.length === 0) {
      container.innerHTML = `
        <div style="background: #fff; padding: 24px; border-radius: 14px; text-align: center; color: #94a3b8; font-size: 13.5px; border: 1px solid #e2e8f0;">
          Chưa có giao dịch thu chi nào
        </div>
      `;
      return;
    }

    container.innerHTML = state.cashflow.map(c => {
      const isExp = c.type === 'expense';
      return `
        <div class="m-card">
          <div class="m-card-header">
            <div>
              <div class="m-card-title">${c.category}</div>
              <div class="m-card-subtitle">${Calculations.formatDate(c.date)} • ${c.description}</div>
            </div>
            <span class="badge ${isExp ? 'badge-danger' : 'badge-success'}">
              ${isExp ? 'Chi phí' : 'Khoản thu'}
            </span>
          </div>
          <div class="m-card-footer">
            <span style="font-size: 16px; font-weight: 800; color: ${isExp ? '#ef4444' : '#10b981'};">
              ${isExp ? '-' : '+'}${Calculations.formatCurrency(c.amount)}
            </span>
            <button class="btn btn-sm btn-outline" style="color: #ef4444;" onclick="MobileApp.deleteCashflow('${c.id}')">🗑️ Xóa</button>
          </div>
        </div>
      `;
    }).join('');
  },

  async deleteCashflow(id) {
    if (confirm('Xóa bản ghi thu chi này?')) {
      await window.appStore.deleteCashflow(id);
      this.showToast('Đã xóa bản ghi!');
    }
  },

  /* =================== 6. BÁO CÁO P&L =================== */
  setupReportsEvents() {
    document.getElementById('btnBackToMoreFromReports')?.addEventListener('click', () => {
      this.switchTab('more');
    });

    document.getElementById('btnMobileExportReport')?.addEventListener('click', () => {
      const summary = Calculations.generateFinancialSummary(window.appStore.state, this.dateFilter);
      ExportManager.exportFinancialReport(summary, this.dateFilter);
      this.showToast('Đã xuất báo cáo P&L ra Excel!');
    });
  },

  renderReports() {
    const summary = Calculations.generateFinancialSummary(window.appStore.state, this.dateFilter);

    document.getElementById('repTotalRevenue').textContent = Calculations.formatCurrency(summary.totalRevenue);
    document.getElementById('repCOGS').textContent = '-' + Calculations.formatCurrency(summary.totalCOGS);
    document.getElementById('repShopShipping').textContent = '-' + Calculations.formatCurrency(summary.totalShopOutboundShip);
    document.getElementById('repGrossProfit').textContent = Calculations.formatCurrency(summary.totalGrossProfit);
    document.getElementById('repGrossMargin').textContent = Calculations.formatPercent(summary.grossMargin);

    document.getElementById('repOtherIncome').textContent = '+' + Calculations.formatCurrency(summary.totalOtherIncome);
    document.getElementById('repOperatingExpense').textContent = '-' + Calculations.formatCurrency(summary.totalOperatingExpense);
    document.getElementById('repNetProfit').textContent = Calculations.formatCurrency(summary.totalNetProfit);
    document.getElementById('repNetMargin').textContent = Calculations.formatPercent(summary.netMargin);

    // Top sản phẩm
    const productStats = {};
    const filteredSales = window.appStore.state.sales.filter(s => {
      if (this.dateFilter.startDate && s.date < this.dateFilter.startDate) return false;
      if (this.dateFilter.endDate && s.date > this.dateFilter.endDate) return false;
      return true;
    });

    filteredSales.forEach(s => {
      (s.items || []).forEach(it => {
        if (!productStats[it.productId]) {
          productStats[it.productId] = { name: it.productName, qty: 0, revenue: 0, profit: 0 };
        }
        const qty = Number(it.quantity || 0);
        const rev = qty * Number(it.sellingPrice || 0);
        const cost = qty * Number(it.costPrice || 0);
        productStats[it.productId].qty += qty;
        productStats[it.productId].revenue += rev;
        productStats[it.productId].profit += (rev - cost);
      });
    });

    const sortedProds = Object.values(productStats).sort((a, b) => b.profit - a.profit).slice(0, 5);
    const container = document.getElementById('repTopProductsList');

    if (!container) return;

    if (sortedProds.length === 0) {
      container.innerHTML = `
        <div style="background: #fff; padding: 20px; border-radius: 12px; text-align: center; color: #94a3b8; font-size: 13px;">
          Chưa có số liệu bán hàng trong kỳ
        </div>
      `;
    } else {
      container.innerHTML = sortedProds.map((p, idx) => `
        <div class="m-card">
          <div class="m-card-header">
            <div>
              <div class="m-card-title">#${idx + 1} ${p.name}</div>
              <div class="m-card-subtitle">Đã bán: ${p.qty} cái • Doanh thu: ${Calculations.formatNumber(p.revenue)} đ</div>
            </div>
            <span class="badge badge-success">+${Calculations.formatNumber(p.profit)} đ lãi</span>
          </div>
        </div>
      `).join('');
    }
  },

  /* =================== 7. MENU THÊM, CÀI ĐẶT & KẾT NỐI WI-FI =================== */
  setupSettingsAndMoreEvents() {
    // Chuyển sang Sổ quỹ
    document.getElementById('menuRowCashflow')?.addEventListener('click', () => {
      this.switchTab('cashflow');
    });

    // Chuyển sang Báo cáo
    document.getElementById('menuRowReports')?.addEventListener('click', () => {
      this.switchTab('reports');
    });

    // Mở QR kết nối điện thoại
    document.getElementById('menuRowConnectPhone')?.addEventListener('click', () => {
      this.openModal('modalConnectQR');
    });

    // Mở Modal Cài đặt
    document.getElementById('menuRowSettings')?.addEventListener('click', () => {
      this.openModal('modalSettings');
    });

    // Lưu cài đặt
    document.getElementById('btnSaveMobileSettings')?.addEventListener('click', async () => {
      const storeName = document.getElementById('mobileSettingStoreName').value.trim() || 'Cửa Hàng Cá Nhân';
      const defaultShippingPayer = document.getElementById('mobileSettingShippingPayer').value;
      const defaultAllocationMethod = document.getElementById('mobileSettingAllocation').value;

      await window.appStore.saveSettings({
        storeName,
        defaultShippingPayer,
        defaultAllocationMethod
      });

      this.closeModal('modalSettings');
      this.loadStoreSettings();
      this.showToast('Đã lưu cài đặt cửa hàng!');
    });

    // Backup JSON
    document.getElementById('menuRowBackup')?.addEventListener('click', () => {
      ExportManager.backupData();
      this.showToast('Đã tải file sao lưu về máy!');
    });

    // Restore JSON
    const restoreInput = document.getElementById('mobileRestoreInput');
    document.getElementById('menuRowRestore')?.addEventListener('click', () => {
      restoreInput.click();
    });

    restoreInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      ExportManager.restoreData(file, (err, msg) => {
        if (err) {
          alert('Lỗi: ' + msg);
        } else {
          this.showToast(msg);
          this.switchTab('dashboard');
        }
        restoreInput.value = '';
      });
    });

    // Demo Data
    document.getElementById('menuRowDemoData')?.addEventListener('click', async () => {
      if (confirm('Nạp bộ dữ liệu mẫu thực tế để trải nghiệm ngay?')) {
        await window.appStore.loadSampleDemoData();
        this.showToast('Đã nạp dữ liệu mẫu!');
        this.switchTab('dashboard');
      }
    });

    // Clear Data
    document.getElementById('menuRowClearData')?.addEventListener('click', async () => {
      if (confirm('⚠️ CẢNH BÁO: Xóa trắng toàn bộ dữ liệu? Thao tác này không thể hoàn tác.')) {
        await window.appStore.clearAllData();
        this.showToast('Đã xóa sạch dữ liệu.');
        this.switchTab('dashboard');
      }
    });
  },

  loadStoreSettings() {
    const settings = window.appStore.state.settings || {};
    const name = settings.storeName || 'Cửa Hàng Cá Nhân';

    const headerName = document.getElementById('mobileStoreName');
    if (headerName) headerName.textContent = name;

    const inputName = document.getElementById('mobileSettingStoreName');
    if (inputName) inputName.value = name;

    const shipSelect = document.getElementById('mobileSettingShippingPayer');
    if (shipSelect) shipSelect.value = settings.defaultShippingPayer || 'customer';

    const allocSelect = document.getElementById('mobileSettingAllocation');
    if (allocSelect) allocSelect.value = settings.defaultAllocationMethod || 'by_quantity';
  }
};

window.MobileApp = MobileApp;
