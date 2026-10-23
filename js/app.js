/**
 * app.js - Trình Điều Khiển Mobile-First Tối Ưu Cho Điện Thoại Di Động
 */

// Đảm bảo đối tượng MobileApp và các hàm mở modal luôn sẵn sàng trên phạm vi toàn cục (Global Scope)
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

    // Nhả focus nếu có để tránh giật bàn phím khi chuyển tab
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }

    if (window.scrollY > 0) {
      window.scrollTo(0, 0);
    }

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
    const alertBadge = document.getElementById('headerAlertBadge');
    if (alertBadge) {
      if (lowStockCount > 0) {
        alertBadge.textContent = lowStockCount;
        alertBadge.style.display = 'inline-block';
      } else {
        alertBadge.style.display = 'none';
      }
    }
  },

  /* =================== MODALS HELPER =================== */
  setupModalEvents() {
    // 1. Đóng modal khi bấm các nút đóng [data-close-modal] (bao gồm nút X và nút Hủy)
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      let lastCloseTrigger = 0;
      const triggerClose = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        const now = Date.now();
        if (now - lastCloseTrigger < 300) return;
        lastCloseTrigger = now;
        MobileApp.closeModal();
      };
      btn.addEventListener('pointerup', triggerClose, { passive: false });
      btn.addEventListener('touchend', triggerClose, { passive: false });
      btn.addEventListener('click', triggerClose);
    });

    // 2. Chặn click bên trong .modal-dialog không cho nổi bọt ra ngoài backdrop
    document.querySelectorAll('.modal-dialog').forEach(dialog => {
      dialog.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    });

    // 3. Đóng modal khi chạm vào vùng backdrop mờ bên ngoài
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      let pointerDownOnBackdrop = false;

      backdrop.addEventListener('pointerdown', (e) => {
        pointerDownOnBackdrop = (e.target === backdrop);
      });

      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop && pointerDownOnBackdrop) {
          this.closeModal();
        }
        pointerDownOnBackdrop = false;
      });
    });

    // 4. Ngăn phím Enter trên bàn phím ảo gửi form bất ngờ làm đóng modal khi đang nhập liệu
    document.querySelectorAll('.modal-dialog form').forEach(form => {
      form.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'submit') {
          e.preventDefault();
          const inputs = Array.from(form.querySelectorAll('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'));
          const idx = inputs.indexOf(e.target);
          if (idx >= 0 && idx < inputs.length - 1) {
            inputs[idx + 1].focus();
          } else {
            e.target.blur();
          }
        }
      });
    });
  },

  openModal(id) {
    const el = document.getElementById(id);
    if (el) {
      document.querySelectorAll('.modal-backdrop.active').forEach(m => {
        if (m !== el) m.classList.remove('active');
      });
      el.classList.add('active');
      const body = el.querySelector('.modal-body');
      if (body) body.scrollTop = 0;
      document.body.style.overflow = 'hidden';
    }
  },

  closeModal(id = null) {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    if (id) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    } else {
      document.querySelectorAll('.modal-backdrop.active').forEach(m => m.classList.remove('active'));
    }
    const hasActiveModal = document.querySelectorAll('.modal-backdrop.active').length > 0;
    if (!hasActiveModal) {
      document.body.style.overflow = '';
    }
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
    document.getElementById('btnHeaderStockAlert')?.addEventListener('click', () => {
      this.switchTab('products');
      const lowPill = document.querySelector('.prod-stock-pill[data-stock="low_stock"]');
      if (lowPill) lowPill.click();
    });

    // 4 Bento Quick Action Tiles
    document.getElementById('btnQuickActionSale')?.addEventListener('click', () => {
      this.openAddSaleModal();
    });
    document.getElementById('btnQuickActionPurchase')?.addEventListener('click', () => {
      this.openAddPurchaseModal();
    });
    document.getElementById('btnQuickActionProduct')?.addEventListener('click', () => {
      this.openAddProductModal();
    });
    document.getElementById('btnQuickActionCashflow')?.addEventListener('click', () => {
      this.openAddCashflowModal();
    });
  },

  renderDashboard() {
    const state = window.appStore.state;
    const summary = Calculations.generateFinancialSummary(state, this.dateFilter);

    // Cập nhật nhãn thời gian trên Bento Hero Card
    const activePill = document.querySelector('#mobileTimePills .pill-item.active');
    const heroPeriod = document.getElementById('heroPeriodLabel');
    if (heroPeriod && activePill) {
      heroPeriod.textContent = activePill.textContent + ' ▾';
    }

    // Hero Bento Banner
    const netEl = document.getElementById('kpiNetProfit');
    netEl.textContent = (summary.totalNetProfit >= 0 ? '+' : '') + Calculations.formatCurrency(summary.totalNetProfit);
    netEl.style.color = summary.totalNetProfit >= 0 ? '#059669' : '#e11d48';

    document.getElementById('kpiNetMargin').textContent = Calculations.formatPercent(summary.netMargin);
    document.getElementById('kpiRevenue').textContent = Calculations.formatCurrency(summary.totalRevenue);

    const totalExp = summary.totalCOGS + summary.totalShopOutboundShip + summary.totalOperatingExpense;
    document.getElementById('kpiTotalExpense').textContent = Calculations.formatCurrency(totalExp);

    // Vòng tròn tiến trình SVG (Circular Progress Ring chuẩn màn hình 5)
    const gauge = document.getElementById('heroGaugeCircle');
    if (gauge) {
      const marginRatio = Math.max(0, Math.min(1, Number(summary.netMargin || 0)));
      const circumference = 2 * Math.PI * 34; // r = 34 -> 213.6
      const offset = circumference - (marginRatio * circumference);
      gauge.style.strokeDashoffset = offset;
    }

    // 4 Bento Metric Cards
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
    const btnAddProd = document.getElementById('btnMobileAddProduct');
    if (btnAddProd) {
      let lastTrigger = 0;
      const triggerOpen = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        const now = Date.now();
        if (now - lastTrigger < 350) return;
        lastTrigger = now;
        MobileApp.openAddProductModal();
      };
      btnAddProd.addEventListener('pointerup', triggerOpen, { passive: false });
      btnAddProd.addEventListener('touchend', triggerOpen, { passive: false });
      btnAddProd.addEventListener('click', triggerOpen);
    }

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

    // Xử lý nhập khối lượng: cho phép nhập dấu phẩy ',' hoặc dấu chấm '.' mượt mà trên iPhone
    const prodWeightInput = document.getElementById('prodWeight');
    if (prodWeightInput) {
      prodWeightInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9.,]/g, '');
      });
    }

    // Nút thêm dòng màu
    document.getElementById('btnAddColorRow')?.addEventListener('click', () => {
      this.addColorRow('', 1);
    });

    // Chạm các chip màu nhanh bằng 1 chạm
    const colorChips = document.querySelectorAll('#quickColorChips .color-chip');
    colorChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const color = chip.getAttribute('data-color');
        if (color) {
          const existingRows = document.querySelectorAll('#productColorsContainer .color-variant-row');
          let found = false;
          existingRows.forEach(row => {
            const nameInput = row.querySelector('.color-name-input');
            if (nameInput && nameInput.value.trim().toLowerCase() === color.toLowerCase()) {
              const qtyInput = row.querySelector('.color-qty-input');
              if (qtyInput) {
                qtyInput.value = (parseInt(qtyInput.value, 10) || 0) + 1;
                found = true;
              }
            }
          });
          if (!found) {
            this.addColorRow(color, 1);
          } else {
            this.syncColorStockSum();
          }
        }
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
      const weight = Calculations.parseDecimal(document.getElementById('prodWeight').value, 0.2);
      const costPrice = Calculations.parseDecimal(document.getElementById('prodCostPrice').value, 0);
      const sellingPrice = Calculations.parseDecimal(document.getElementById('prodSellingPrice').value, 0);
      const minStock = parseInt(document.getElementById('prodMinStock').value, 10) || 0;
      const notes = document.getElementById('prodNotes').value.trim();

      // Đọc danh sách màu sắc & số lượng từng màu
      const colorRows = document.querySelectorAll('#productColorsContainer .color-variant-row');
      const colors = [];
      colorRows.forEach(row => {
        const cName = (row.querySelector('.color-name-input')?.value || '').trim();
        const cQty = parseInt(row.querySelector('.color-qty-input')?.value, 10) || 0;
        if (cName) {
          colors.push({ name: cName, quantity: cQty });
        }
      });

      // Nếu có phân loại màu thì lấy tổng số lượng các màu làm tồn kho, ngược lại lấy ô prodStock
      let stock = parseInt(document.getElementById('prodStock').value, 10) || 0;
      if (colors.length > 0) {
        stock = colors.reduce((sum, c) => sum + c.quantity, 0);
      }

      await window.appStore.saveProduct({
        id: id || undefined,
        name,
        sku,
        category,
        unit,
        weight,
        colors,
        costPrice,
        sellingPrice,
        stock,
        minStock,
        notes
      });

      this.closeModal('modalProduct');
      this.showToast(id ? 'Đã cập nhật sản phẩm!' : 'Đã thêm sản phẩm mới!');
    });
  },

  addColorRow(colorName = '', qty = 1) {
    const container = document.getElementById('productColorsContainer');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'color-variant-row';
    div.style.cssText = 'background: #ffffff; border: 1.5px solid #ddd6fe; border-radius: 14px; padding: 10px 12px; display: flex; gap: 8px; align-items: center; box-shadow: 0 2px 8px rgba(109,40,217,0.04);';
    div.innerHTML = `
      <div style="flex: 1.3;">
        <input type="text" class="form-control color-name-input" value="${colorName}" placeholder="Tên màu (Đỏ, Cam...)" style="height: 40px; font-size: 13.5px; font-weight: 700; border-radius: 10px;">
      </div>
      <div style="flex: 1; display: flex; align-items: center; gap: 4px;">
        <input type="number" class="form-control color-qty-input" value="${qty}" min="0" placeholder="0" inputmode="numeric" style="height: 40px; font-size: 14px; text-align: center; font-weight: 800; border-radius: 10px;">
        <span style="font-size: 11.5px; color: #64748b; font-weight: 700;">cái</span>
      </div>
      <button type="button" class="btn-icon-remove btn-remove-color" title="Xóa màu">&times;</button>
    `;

    container.appendChild(div);

    const nameInput = div.querySelector('.color-name-input');
    const qtyInput = div.querySelector('.color-qty-input');
    const removeBtn = div.querySelector('.btn-remove-color');

    qtyInput.addEventListener('input', () => this.syncColorStockSum());
    nameInput.addEventListener('input', () => this.syncColorStockSum());
    removeBtn.addEventListener('click', () => {
      div.remove();
      this.syncColorStockSum();
    });

    this.syncColorStockSum();
    if (!colorName) nameInput.focus();
  },

  syncColorStockSum() {
    const rows = document.querySelectorAll('#productColorsContainer .color-variant-row');
    const summaryBox = document.getElementById('colorTotalSummary');
    const sumDisplay = document.getElementById('colorTotalSumQty');
    const stockInput = document.getElementById('prodStock');
    const syncBadge = document.getElementById('prodStockSyncBadge');

    if (rows.length === 0) {
      if (summaryBox) summaryBox.style.display = 'none';
      if (syncBadge) syncBadge.style.display = 'none';
      if (stockInput) {
        stockInput.style.background = '#ffffff';
      }
      return;
    }

    let totalQty = 0;
    rows.forEach(r => {
      const q = parseInt(r.querySelector('.color-qty-input')?.value, 10) || 0;
      totalQty += q;
    });

    if (summaryBox) summaryBox.style.display = 'flex';
    if (sumDisplay) sumDisplay.textContent = totalQty;
    if (syncBadge) syncBadge.style.display = 'inline';
    if (stockInput) {
      stockInput.value = totalQty;
      stockInput.style.background = '#f1f5f9';
    }
  },

  openAddProductModal(product = null) {
    try {
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
      };
      const titleEl = document.getElementById('modalProductTitle');
      if (titleEl) titleEl.textContent = product ? '✏️ Sửa Hàng Hóa' : '🏷️ Thêm Hàng Hóa Mới';
      setVal('prodId', product ? product.id : '');
      setVal('prodName', product ? product.name : '');
      setVal('prodSku', product ? product.sku : '');
      setVal('prodCategory', product ? product.category : 'Thời trang');
      setVal('prodUnit', product ? product.unit : 'Cái');
      setVal('prodWeight', product && product.weight !== undefined ? product.weight : 0.2);
      setVal('prodCostPrice', product ? product.costPrice : 0);
      setVal('prodSellingPrice', product ? product.sellingPrice : '');
      setVal('prodStock', product ? product.stock : 0);
      setVal('prodMinStock', product ? product.minStock : 5);
      setVal('prodNotes', product ? product.notes : '');

      // Khởi tạo các dòng màu sắc
      const container = document.getElementById('productColorsContainer');
      if (container) {
        container.innerHTML = '';
        if (product && Array.isArray(product.colors) && product.colors.length > 0) {
          product.colors.forEach(c => {
            MobileApp.addColorRow(c.name, c.quantity);
          });
        }
      }
      MobileApp.syncColorStockSum();
    } catch (err) {
      console.warn('Lỗi chuẩn bị form sản phẩm:', err);
    }

    MobileApp.openModal('modalProduct');
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
              <span>Khối lượng:</span>
              <strong>${p.weight || 0} kg / ${p.unit}</strong>
            </div>
          </div>

          ${Array.isArray(p.colors) && p.colors.length > 0 ? `
            <div style="margin: 8px 0 4px 0; padding-top: 6px; border-top: 1px dashed #e2e8f0; font-size: 12px;">
              <div style="color: #64748b; font-weight: 600; margin-bottom: 4px;">🎨 Màu sắc & tồn từng màu:</div>
              <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                ${p.colors.map(c => `
                  <span style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; border-radius: 6px; font-size: 11px; font-weight: 600; background: ${c.quantity > 0 ? '#eff6ff' : '#f8fafc'}; color: ${c.quantity > 0 ? '#1d4ed8' : '#94a3b8'}; border: 1px solid ${c.quantity > 0 ? '#bfdbfe' : '#e2e8f0'};">
                    ${c.name}: <strong>${c.quantity}</strong> ${c.quantity === 0 ? '<span style="font-size: 9px; opacity: 0.7;">(Hết)</span>' : ''}
                  </span>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div class="m-card-footer">
            <span style="font-size: 11px; color: #94a3b8;">${p.notes || ''}</span>
            <div class="m-card-actions">
              <button class="btn-flat-action" onclick="MobileApp.editProduct('${p.id}')">✏️ Sửa</button>
              <button class="btn-icon-circle-danger" title="Xóa" onclick="MobileApp.deleteProduct('${p.id}')">🗑️</button>
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
    const btnAddPo = document.getElementById('btnMobileAddPurchase');
    if (btnAddPo) {
      let lastTrigger = 0;
      const triggerOpen = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        const now = Date.now();
        if (now - lastTrigger < 350) return;
        lastTrigger = now;
        MobileApp.openAddPurchaseModal();
      };
      btnAddPo.addEventListener('pointerup', triggerOpen, { passive: false });
      btnAddPo.addEventListener('touchend', triggerOpen, { passive: false });
      btnAddPo.addEventListener('click', triggerOpen);
    }

    document.getElementById('btnAddPurchaseRow')?.addEventListener('click', () => {
      this.addPurchaseRow();
    });

    // Chuyển đổi giữa tính ship theo kg và ship trọn gói
    document.getElementById('poShippingType')?.addEventListener('change', (e) => {
      const isWeight = e.target.value === 'by_weight';
      const divPricePerKg = document.getElementById('divPoPricePerKg');
      const divTotalWeight = document.getElementById('divPoTotalWeight');
      const costInput = document.getElementById('poShippingCost');

      if (divPricePerKg) divPricePerKg.style.display = isWeight ? 'block' : 'none';
      if (divTotalWeight) divTotalWeight.style.display = isWeight ? 'block' : 'none';
      if (costInput) {
        costInput.readOnly = isWeight;
        costInput.style.background = isWeight ? '#f1f5f9' : '#fff';
      }
      this.updatePurchaseLiveCalc();
    });

    // Nút tự động tính tổng khối lượng từ các dòng món hàng
    document.getElementById('btnAutoCalcWeight')?.addEventListener('click', () => {
      const rows = document.querySelectorAll('#purchaseItemsContainer .mobile-item-row');
      let sumWeight = 0;
      rows.forEach(row => {
        const qty = parseFloat(row.querySelector('.po-qty-input')?.value) || 0;
        const weight = parseFloat(row.querySelector('.po-weight-input')?.value) || 0;
        sumWeight += (qty * weight);
      });
      const weightInput = document.getElementById('poTotalWeight');
      if (weightInput) {
        weightInput.value = Number(sumWeight.toFixed(2));
      }
      this.updatePurchaseLiveCalc();
      this.showToast(`Đã tính tổng khối lượng: ${sumWeight.toFixed(2)} kg`);
    });

    ['poPricePerKg', 'poTotalWeight', 'poShippingCost'].forEach(id => {
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
        const weightInput = row.querySelector('.po-weight-input');

        const productId = prodSelect.value;
        const quantity = parseFloat(qtyInput.value) || 0;
        const purchasePrice = Calculations.parseDecimal(priceInput.value, 0);
        const weight = Calculations.parseDecimal(weightInput?.value, 0.2);

        if (!productId || quantity <= 0) {
          isValid = false;
        } else {
          const prod = window.appStore.getProductById(productId);
          items.push({
            productId,
            productName: prod ? prod.name : 'Sản phẩm',
            quantity,
            purchasePrice,
            weight
          });
        }
      });

      if (!isValid || items.length === 0) {
        alert('Vui lòng chọn sản phẩm và nhập số lượng lớn hơn 0.');
        return;
      }

      const date = document.getElementById('poDate').value;
      const supplier = document.getElementById('poSupplier').value;
      const shippingType = document.getElementById('poShippingType')?.value || 'by_weight';
      const pricePerKg = Calculations.parseDecimal(document.getElementById('poPricePerKg')?.value, 0);
      const totalWeight = Calculations.parseDecimal(document.getElementById('poTotalWeight')?.value, 0);
      const shippingCost = Calculations.parseDecimal(document.getElementById('poShippingCost')?.value, 0);
      const notes = document.getElementById('poNotes').value;

      await window.appStore.createPurchase({
        date,
        supplier,
        shippingMethod: shippingType,
        pricePerKg,
        totalWeight,
        shippingCost,
        allocationMethod: shippingType === 'by_weight' ? 'by_weight' : 'by_quantity',
        items,
        notes
      });

      this.closeModal('modalPurchase');
      this.showToast('Đã lưu phiếu nhập & cộng dồn tồn kho!');
    });
  },

  openAddPurchaseModal() {
    try {
      if (!window.appStore.state.products || window.appStore.state.products.length === 0) {
        alert('Vui lòng thêm ít nhất 1 sản phẩm trong kho trước khi nhập.');
        this.switchTab('products');
        return;
      }

      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
      };

      setVal('poDate', new Date().toISOString().slice(0, 10));
      setVal('poSupplier', '');
      setVal('poShippingType', 'by_weight');
      setVal('poPricePerKg', 30000);
      setVal('poTotalWeight', 0);
      
      const costInput = document.getElementById('poShippingCost');
      if (costInput) {
        costInput.value = 0;
        costInput.readOnly = true;
        costInput.style.background = '#f1f5f9';
      }

      setVal('poNotes', '');

      const container = document.getElementById('purchaseItemsContainer');
      if (container) {
        container.innerHTML = '';
        this.addPurchaseRow();
      }
    } catch (err) {
      console.warn('Lỗi chuẩn bị form nhập hàng:', err);
    }

    this.openModal('modalPurchase');
  },

  addPurchaseRow() {
    const container = document.getElementById('purchaseItemsContainer');
    const div = document.createElement('div');
    div.className = 'mobile-item-row bento-dynamic-row';

    const products = window.appStore.state.products || [];
    const optionsHtml = products.map(p => `
      <option value="${p.id}" data-cost="${p.costPrice}" data-weight="${p.weight !== undefined ? p.weight : 0.2}">${p.name} (Tồn: ${p.stock})</option>
    `).join('');

    div.innerHTML = `
      <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
        <select class="form-control po-product-select" style="flex: 1; font-weight: 700; border-radius: 12px;" required>
          <option value="">-- Chọn sản phẩm --</option>
          ${optionsHtml}
        </select>
        <button type="button" class="btn-icon-remove" title="Xóa món" onclick="this.closest('.mobile-item-row').remove(); MobileApp.updatePurchaseLiveCalc();">&times;</button>
      </div>
      <div class="form-row">
        <div>
          <label style="font-size: 11px; color: #64748b; font-weight: 700;">Số lượng nhập:</label>
          <input type="number" class="form-control po-qty-input" value="10" min="1" required inputmode="numeric" style="font-weight: 700; border-radius: 12px;">
        </div>
        <div>
          <label style="font-size: 11px; color: #64748b; font-weight: 700;">Giá mua (VNĐ/cái):</label>
          <input type="number" class="form-control po-price-input" value="0" min="0" required inputmode="numeric" style="font-weight: 700; border-radius: 12px;">
        </div>
      </div>
      <div class="form-row" style="margin-top: 8px;">
        <div>
          <label style="font-size: 11px; color: #15803d; font-weight: 700;">⚖️ Khối lượng (kg/cái):</label>
          <input type="text" class="form-control po-weight-input" value="0.2" placeholder="0.2 hoặc 0,2" inputmode="decimal" style="font-weight: 700; border-radius: 12px; background: #f0fdf4; border-color: #86efac; color: #166534;">
        </div>
        <div>
          <label style="font-size: 11px; color: #64748b; font-weight: 700;">Tổng kg món này:</label>
          <div class="po-item-total-weight" style="height: 44px; display: flex; align-items: center; font-weight: 800; color: #15803d; padding: 0 12px; background: #dcfce7; border: 1.5px solid #86efac; border-radius: 12px; font-size: 13.5px;">
            0 kg
          </div>
        </div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; margin-top: 10px; padding-top: 8px; border-top: 1.5px dashed #bbf7d0; color: #64748b;">
        <span>Tiền hàng: <strong class="po-line-total" style="color: #0f172a; font-size: 14px; font-weight: 800;">0 đ</strong></span>
        <span class="po-line-landed-preview" style="color: #15803d; font-weight: 700; background: #dcfce7; padding: 3px 10px; border-radius: 999px;">Sau ship: 0 đ/cái</span>
      </div>
    `;

    container.appendChild(div);

    const prodSelect = div.querySelector('.po-product-select');
    const priceInput = div.querySelector('.po-price-input');
    const qtyInput = div.querySelector('.po-qty-input');
    const weightInput = div.querySelector('.po-weight-input');

    prodSelect.addEventListener('change', () => {
      const selected = prodSelect.options[prodSelect.selectedIndex];
      const cost = selected.getAttribute('data-cost');
      const w = selected.getAttribute('data-weight');
      if (cost && (!priceInput.value || priceInput.value === '0')) {
        priceInput.value = cost;
      }
      if (w) {
        weightInput.value = w;
      }
      this.updatePurchaseLiveCalc();
    });

    priceInput.addEventListener('input', () => this.updatePurchaseLiveCalc());
    qtyInput.addEventListener('input', () => this.updatePurchaseLiveCalc());
    weightInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9.,]/g, '');
      this.updatePurchaseLiveCalc();
    });

    this.updatePurchaseLiveCalc();
  },

  updatePurchaseLiveCalc() {
    const rows = document.querySelectorAll('#purchaseItemsContainer .mobile-item-row');
    let subtotal = 0;
    let sumWeight = 0;

    const shipType = document.getElementById('poShippingType')?.value || 'by_weight';
    const pricePerKg = Calculations.parseDecimal(document.getElementById('poPricePerKg')?.value, 0);

    rows.forEach(row => {
      const qty = parseFloat(row.querySelector('.po-qty-input')?.value) || 0;
      const price = Calculations.parseDecimal(row.querySelector('.po-price-input')?.value, 0);
      const weight = Calculations.parseDecimal(row.querySelector('.po-weight-input')?.value, 0);

      const lineTotal = qty * price;
      const lineWeight = qty * weight;
      subtotal += lineTotal;
      sumWeight += lineWeight;

      const totalEl = row.querySelector('.po-line-total');
      if (totalEl) totalEl.textContent = Calculations.formatNumber(lineTotal) + ' đ';

      const weightEl = row.querySelector('.po-item-total-weight');
      if (weightEl) weightEl.textContent = `${Number(lineWeight.toFixed(2))} kg`;

      const landedEl = row.querySelector('.po-line-landed-preview');
      if (landedEl) {
        let shipPerUnit = 0;
        if (shipType === 'by_weight' && pricePerKg > 0) {
          shipPerUnit = weight * pricePerKg;
        }
        const unitLanded = price + shipPerUnit;
        landedEl.textContent = `Sau ship: ${Calculations.formatNumber(Math.round(unitLanded))} đ/cái`;
      }
    });

    const weightInput = document.getElementById('poTotalWeight');
    let totalWeight = sumWeight;

    if (shipType === 'by_weight') {
      const currentEntered = weightInput ? weightInput.value.trim() : '';
      if (weightInput && (currentEntered === '0' || currentEntered === '')) {
        weightInput.value = Number(sumWeight.toFixed(2));
      }
      totalWeight = Calculations.parseDecimal(weightInput?.value, sumWeight);
      const autoShipCost = Math.round(totalWeight * pricePerKg);
      const costInput = document.getElementById('poShippingCost');
      if (costInput) costInput.value = autoShipCost;
    }

    const shipping = Calculations.parseDecimal(document.getElementById('poShippingCost')?.value, 0);
    const total = subtotal + shipping;

    document.getElementById('poPreviewSubtotal').textContent = Calculations.formatCurrency(subtotal);
    document.getElementById('poPreviewWeight').textContent = `${Number(totalWeight.toFixed(2))} kg`;
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
        <div style="padding: 4px 0; border-bottom: 1px dashed #e2e8f0;">
          <div>• <strong>${i.productName}</strong>: ${i.quantity} cái x ${Calculations.formatNumber(i.purchasePrice)} đ</div>
          <div style="font-size: 11px; color: #64748b; margin-left: 8px;">
            Nặng: ${i.weight || 0} kg/cái (Tổng: ${(Number(i.quantity || 0) * Number(i.weight || 0)).toFixed(2)} kg) 
            &rarr; <span style="color: #10b981; font-weight: 700;">Giá vốn sau ship: ${Calculations.formatNumber(i.landedCostPerUnit)} đ/cái</span>
          </div>
        </div>
      `).join('');

      let shipDetails = `🚚 Tiền ship: +${Calculations.formatNumber(p.shippingCost)} đ`;
      if (p.pricePerKg > 0) {
        shipDetails = `⚖️ ${p.totalWeight || 0} kg (${Calculations.formatNumber(p.pricePerKg)} đ/kg) &bull; Ship: +${Calculations.formatNumber(p.shippingCost)} đ`;
      }

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
            <span style="font-size: 12px; color: #8b5cf6; font-weight: 600;">${shipDetails}</span>
            <button class="btn-flat-danger" onclick="MobileApp.deletePurchase('${p.id}')">🗑️ Xóa</button>
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
    const btnAddSale = document.getElementById('btnMobileAddSale');
    if (btnAddSale) {
      let lastTrigger = 0;
      const triggerOpen = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        const now = Date.now();
        if (now - lastTrigger < 350) return;
        lastTrigger = now;
        MobileApp.openAddSaleModal();
      };
      btnAddSale.addEventListener('pointerup', triggerOpen, { passive: false });
      btnAddSale.addEventListener('touchend', triggerOpen, { passive: false });
      btnAddSale.addEventListener('click', triggerOpen);
    }

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
        const sellingPrice = Calculations.parseDecimal(priceInput.value, 0);
        const colorSelect = row.querySelector('.sale-color-select');
        const color = (colorSelect ? colorSelect.value : '').trim();

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
            color,
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
    try {
      if (!window.appStore.state.products || window.appStore.state.products.length === 0) {
        alert('Kho chưa có sản phẩm nào. Vui lòng thêm sản phẩm trước khi tạo đơn bán.');
        this.switchTab('products');
        return;
      }

      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
      };

      setVal('saleDate', new Date().toISOString().slice(0, 10));
      setVal('saleCustomerName', 'Khách lẻ');
      setVal('saleCustomerPhone', '');
      setVal('saleChannel', 'Trực tiếp');
      setVal('salePaymentStatus', 'paid');
      const divPaid = document.getElementById('divPaidAmount');
      if (divPaid) divPaid.style.display = 'none';
      setVal('salePaidAmount', 0);
      setVal('saleDiscount', 0);
      setVal('saleShippingFee', 0);
      setVal('saleShippingPayer', window.appStore.state.settings?.defaultShippingPayer || 'customer');
      setVal('saleNotes', '');

      const container = document.getElementById('saleItemsContainer');
      if (container) {
        container.innerHTML = '';
        this.addSaleRow();
      }
    } catch (err) {
      console.warn('Lỗi chuẩn bị form bán hàng:', err);
    }

    this.openModal('modalSale');
  },

  addSaleRow() {
    const container = document.getElementById('saleItemsContainer');
    const div = document.createElement('div');
    div.className = 'mobile-item-row bento-dynamic-row';

    const products = window.appStore.state.products || [];
    const optionsHtml = products.map(p => `
      <option value="${p.id}" data-price="${p.sellingPrice}" data-stock="${p.stock}">${p.name} (Kho: ${p.stock})</option>
    `).join('');

    div.innerHTML = `
      <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
        <select class="form-control sale-product-select" style="flex: 1; font-weight: 700; border-radius: 12px;" required>
          <option value="">-- Chọn món bán --</option>
          ${optionsHtml}
        </select>
        <button type="button" class="btn-icon-remove" title="Xóa món" onclick="this.closest('.mobile-item-row').remove(); MobileApp.updateSaleLiveCalc();">&times;</button>
      </div>
      <div class="sale-color-wrap" style="display: none; margin-bottom: 8px; background: #faf5ff; padding: 8px 12px; border-radius: 12px; border: 1.5px solid #ddd6fe;">
        <label style="font-size: 11px; color: #6d28d9; font-weight: 700; margin-bottom: 4px; display: block;">🎨 Chọn màu xuất kho:</label>
        <select class="form-control sale-color-select" style="font-size: 13px; height: 38px; background: #ffffff; border-radius: 10px; font-weight: 600;">
          <option value="">-- Mặc định --</option>
        </select>
      </div>
      <div class="form-row">
        <div>
          <label style="font-size: 11px; color: #64748b; font-weight: 700;">Số lượng bán:</label>
          <input type="number" class="form-control sale-qty-input" value="1" min="1" required inputmode="numeric" style="font-weight: 700; border-radius: 12px;">
        </div>
        <div>
          <label style="font-size: 11px; color: #64748b; font-weight: 700;">Giá bán (VNĐ):</label>
          <input type="number" class="form-control sale-price-input" value="0" min="0" required inputmode="numeric" style="font-weight: 700; border-radius: 12px;">
        </div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; margin-top: 8px; padding-top: 6px; border-top: 1.5px dashed #fecdd3; color: #64748b;">
        <span>Thành tiền món:</span>
        <strong class="sale-line-total" style="color: #be123c; font-size: 14px; font-weight: 800;">0 đ</strong>
      </div>
    `;

    container.appendChild(div);

    const prodSelect = div.querySelector('.sale-product-select');
    const priceInput = div.querySelector('.sale-price-input');
    const qtyInput = div.querySelector('.sale-qty-input');
    const colorWrap = div.querySelector('.sale-color-wrap');
    const colorSelect = div.querySelector('.sale-color-select');

    prodSelect.addEventListener('change', () => {
      const selected = prodSelect.options[prodSelect.selectedIndex];
      const price = selected.getAttribute('data-price');
      if (price) priceInput.value = price;

      const prod = window.appStore.getProductById(prodSelect.value);
      if (prod && Array.isArray(prod.colors) && prod.colors.length > 0) {
        colorWrap.style.display = 'block';
        colorSelect.innerHTML = `<option value="">-- Chọn màu xuất kho (${prod.colors.length} màu) --</option>` +
          prod.colors.map(c => `
            <option value="${c.name}">Màu ${c.name} (Kho còn: ${c.quantity})</option>
          `).join('');
      } else {
        colorWrap.style.display = 'none';
        colorSelect.innerHTML = `<option value="">-- Mặc định --</option>`;
      }

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
      const itemsList = (s.items || []).map(i => `${i.productName}${i.color ? ` (Màu: ${i.color})` : ''} (x${i.quantity})`).join(', ');

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
              <button class="btn-flat-action" title="In hóa đơn" onclick="MobileApp.printSaleInvoice('${s.id}')">🖨️ In</button>
              <button class="btn-flat-dark" title="Thanh toán" onclick="MobileApp.promptPaymentStatus('${s.id}')">💳 Thu tiền</button>
              <button class="btn-icon-circle-danger" title="Xóa" onclick="MobileApp.deleteSale('${s.id}')">🗑️</button>
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
  openAddCashflowModal() {
    try {
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
      };
      setVal('cfDate', new Date().toISOString().slice(0, 10));
      setVal('cfType', 'expense');
      setVal('cfCategory', 'Bao bì & Đóng gói');
      setVal('cfAmount', '');
      setVal('cfDescription', '');
    } catch (err) {
      console.warn('Lỗi chuẩn bị form thu chi:', err);
    }
    this.openModal('modalCashflow');
  },

  setupCashflowEvents() {
    document.getElementById('btnMobileAddCashflow')?.addEventListener('click', () => {
      this.openAddCashflowModal();
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
            <button class="btn-flat-danger" onclick="MobileApp.deleteCashflow('${c.id}')">🗑️ Xóa</button>
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

    // Lưu cài đặt (Nút footer hoặc nút header)
    const saveSettingsHandler = async () => {
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
    };

    document.getElementById('btnSaveMobileSettings')?.addEventListener('click', saveSettingsHandler);
    document.getElementById('btnSaveMobileSettingsHeader')?.addEventListener('click', saveSettingsHandler);

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

// Xuất MobileApp ra window để mọi sự kiện inline HTML và script khác đều gọi được ngay lập tức
window.MobileApp = MobileApp;
window.openAddProductModal = (prod = null) => MobileApp.openAddProductModal(prod);
window.openAddSaleModal = () => MobileApp.openAddSaleModal();
window.openAddPurchaseModal = () => MobileApp.openAddPurchaseModal();
window.openAddCashflowModal = () => MobileApp.openAddCashflowModal();
window.closeModal = (id = null) => MobileApp.closeModal(id);

document.addEventListener('DOMContentLoaded', async () => {
  if (window.appStore && typeof window.appStore.init === 'function') {
    await window.appStore.init();
  }
  MobileApp.init();
});
