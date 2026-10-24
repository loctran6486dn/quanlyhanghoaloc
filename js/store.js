/**
 * store.js - Quản lý Trạng thái & Cơ sở dữ liệu Cục bộ (IndexedDB + LocalStorage Fallback)
 */

const DB_NAME = 'QuanLyHangHoaDB';
const DB_VERSION = 1;

class DataStore {
  constructor() {
    this.db = null;
    this.isReady = false;
    this.readyPromise = null;
    this.listeners = new Set();

    // Bộ nhớ đệm trong RAM để truy xuất tức thì
    this.state = {
      products: [],
      purchases: [],
      sales: [],
      cashflow: [],
      settings: {
        storeName: 'Cửa Hàng Cá Nhân',
        currency: 'VND',
        defaultShippingPayer: 'customer',
        defaultAllocationMethod: 'by_quantity'
      }
    };

    this.init();
  }

  /**
   * Khởi tạo kết nối IndexedDB và nạp dữ liệu vào cache
   */
  async init() {
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = new Promise((resolve) => {
      try {
        if (!window.indexedDB) {
          console.warn('IndexedDB không được hỗ trợ, sử dụng LocalStorage.');
          this.loadFromLocalStorage();
          this.isReady = true;
          resolve(this.state);
          return;
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('products')) {
            db.createObjectStore('products', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('purchases')) {
            db.createObjectStore('purchases', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('sales')) {
            db.createObjectStore('sales', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('cashflow')) {
            db.createObjectStore('cashflow', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'id' });
          }
        };

        request.onsuccess = async (event) => {
          this.db = event.target.result;
          await this.loadAllFromDB();
          this.isReady = true;
          resolve(this.state);
        };

        request.onerror = (event) => {
          console.error('Không thể mở IndexedDB, fallback sang LocalStorage:', event.target.error);
          this.loadFromLocalStorage();
          this.isReady = true;
          resolve(this.state);
        };
      } catch (err) {
        console.warn('Lỗi bảo mật khi mở IndexedDB (file://), fallback LocalStorage:', err);
        this.loadFromLocalStorage();
        this.isReady = true;
        resolve(this.state);
      }
    });

    return this.readyPromise;
  }

  /**
   * Đăng ký hàm lắng nghe khi dữ liệu thay đổi
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(triggerCloudPush = true) {
    this.listeners.forEach(cb => {
      try { cb(this.state); } catch (e) { console.error('Listener error:', e); }
    });

    // Kích hoạt tự động đẩy dữ liệu lên Cloud nếu đang bật đồng bộ
    if (triggerCloudPush && window.CloudSync && typeof window.CloudSync.triggerAutoPush === 'function') {
      window.CloudSync.triggerAutoPush();
    }
  }

  notifyListeners(triggerCloudPush = false) {
    this.notify(triggerCloudPush);
  }

  getDeletedIds() {
    try {
      return JSON.parse(localStorage.getItem('app_deleted_ids') || '{"products":[],"purchases":[],"sales":[],"cashflow":[]}');
    } catch (e) {
      return { products: [], purchases: [], sales: [], cashflow: [] };
    }
  }

  recordDeletedId(type, id) {
    if (!id) return;
    const deleted = this.getDeletedIds();
    if (!deleted[type]) deleted[type] = [];
    if (!deleted[type].includes(id)) {
      deleted[type].push(id);
      if (deleted[type].length > 500) deleted[type] = deleted[type].slice(-500);
      try {
        localStorage.setItem('app_deleted_ids', JSON.stringify(deleted));
      } catch (e) {}
    }
  }

  /**
   * Lưu toàn bộ state hiện tại vào cả LocalStorage và IndexedDB sau khi đồng bộ
   */
  async persistAll() {
    this.saveToLocalStorage();
    if (!this.db) return;
    try {
      const stores = ['products', 'purchases', 'sales', 'cashflow'];
      for (const s of stores) {
        const tx = this.db.transaction([s], 'readwrite');
        const st = tx.objectStore(s);
        st.clear();
        const items = this.state[s] || [];
        for (const item of items) {
          st.put(item);
        }
      }
    } catch (e) {
      console.warn('Lỗi ghi IndexedDB persistAll:', e);
    }
  }

  /**
   * Nạp toàn bộ dữ liệu từ IndexedDB vào state
   */
  async loadAllFromDB() {
    try {
      const products = await this.getAllFromStore('products');
      const purchases = await this.getAllFromStore('purchases');
      const sales = await this.getAllFromStore('sales');
      const cashflow = await this.getAllFromStore('cashflow');
      const settingsList = await this.getAllFromStore('settings');

      this.state.products = products || [];
      const sortByNewest = (a, b) => {
        const timeA = new Date(a.createdAt || a.date).getTime();
        const timeB = new Date(b.createdAt || b.date).getTime();
        return timeB - timeA;
      };
      this.state.purchases = (purchases || []).sort(sortByNewest);
      this.state.sales = (sales || []).sort(sortByNewest);
      this.state.cashflow = (cashflow || []).sort(sortByNewest);

      if (settingsList && settingsList.length > 0) {
        this.state.settings = { ...this.state.settings, ...settingsList[0] };
      }

      // Tự động dọn sạch các giao dịch thử nghiệm cũ 1 lần duy nhất để người dùng bắt đầu làm việc thực tế
      if (!localStorage.getItem('app_metrics_reset_clean_20261024')) {
        localStorage.setItem('app_metrics_reset_clean_20261024', 'true');
        this.state.sales = [];
        this.state.purchases = [];
        this.state.cashflow = [];
        await this.persistAll();
      }

      // Nếu lần đầu hoàn toàn trống, kiểm tra xem có trong LocalStorage không
      if (this.state.products.length === 0 && this.state.sales.length === 0) {
        const lsData = localStorage.getItem('QLHH_DATA');
        if (lsData) {
          try {
            const parsed = JSON.parse(lsData);
            await this.importData(parsed, false);
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error('Lỗi khi nạp dữ liệu từ IndexedDB:', err);
      this.loadFromLocalStorage();
    }
  }

  loadFromLocalStorage() {
    try {
      const data = localStorage.getItem('QLHH_DATA');
      if (data) {
        const parsed = JSON.parse(data);
        this.state.products = parsed.products || [];
        this.state.purchases = parsed.purchases || [];
        this.state.sales = parsed.sales || [];
        this.state.cashflow = parsed.cashflow || [];
        this.state.settings = { ...this.state.settings, ...(parsed.settings || {}) };
      }
    } catch (e) {
      console.error('Lỗi nạp LocalStorage:', e);
    }
  }

  saveToLocalStorage() {
    try {
      localStorage.setItem('QLHH_DATA', JSON.stringify(this.state));
    } catch (e) {
      console.warn('Không thể lưu vào LocalStorage:', e);
    }
  }

  /**
   * Truy vấn toàn bộ bản ghi trong một Object Store
   */
  getAllFromStore(storeName) {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve([]);
      try {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Lưu hoặc cập nhật một bản ghi vào Object Store
   */
  putToStore(storeName, item) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        this.saveToLocalStorage();
        return resolve(item);
      }
      try {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const req = store.put(item);
        req.onsuccess = () => {
          this.saveToLocalStorage();
          resolve(item);
        };
        req.onerror = () => reject(req.error);
      } catch (e) {
        this.saveToLocalStorage();
        resolve(item);
      }
    });
  }

  /**
   * Xóa bản ghi theo ID
   */
  deleteFromStore(storeName, id) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        this.saveToLocalStorage();
        return resolve();
      }
      try {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const req = store.delete(id);
        req.onsuccess = () => {
          this.saveToLocalStorage();
          resolve();
        };
        req.onerror = () => reject(req.error);
      } catch (e) {
        this.saveToLocalStorage();
        resolve();
      }
    });
  }

  // =================== CÁC THAO TÁC VỚI SẢN PHẨM ===================

  async saveProduct(product) {
    const isNew = !product.id;

    // Xử lý mảng phân loại màu sắc & số lượng từng màu
    const cleanedColors = Array.isArray(product.colors) ? product.colors
      .map(c => ({
        name: String(c.name || '').trim(),
        quantity: Math.max(0, parseInt(c.quantity, 10) || 0)
      }))
      .filter(c => c.name.length > 0) : [];

    // Nếu có danh sách màu, tồn kho sẽ tự động đồng bộ là tổng số lượng các màu
    let finalStock = Number(product.stock || 0);
    if (cleanedColors.length > 0) {
      finalStock = cleanedColors.reduce((sum, c) => sum + c.quantity, 0);
    }

    const item = {
      id: product.id || 'SP' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      sku: product.sku ? product.sku.trim().toUpperCase() : ('SKU-' + Math.floor(1000 + Math.random() * 9000)),
      name: product.name.trim(),
      category: product.category || 'Mặc định',
      unit: product.unit || 'Cái',
      weight: Calculations.parseDecimal(product.weight, 0.2), // Khối lượng kg/đơn vị (hỗ trợ cả dấu phẩy)
      colors: cleanedColors,
      costPrice: Number(product.costPrice || 0),
      sellingPrice: Number(product.sellingPrice || 0),
      stock: finalStock,
      minStock: Number(product.minStock !== undefined ? product.minStock : 5),
      notes: product.notes || '',
      updatedAt: new Date().toISOString(),
      createdAt: product.createdAt || new Date().toISOString()
    };

    await this.putToStore('products', item);

    const index = this.state.products.findIndex(p => p.id === item.id);
    if (index >= 0) {
      this.state.products[index] = item;
    } else {
      this.state.products.unshift(item);
    }

    this.notify();
    return item;
  }

  async deleteProduct(id) {
    await this.deleteFromStore('products', id);
    this.state.products = this.state.products.filter(p => p.id !== id);
    this.recordDeletedId('products', id);
    this.notify();
  }

  getProductById(id) {
    return this.state.products.find(p => p.id === id);
  }

  // =================== CÁC THAO TÁC NHẬP HÀNG (INBOUND) ===================

  async createPurchase(purchaseData) {
    const allocationMethod = purchaseData.allocationMethod || 'by_weight';
    const pricePerKg = Number(purchaseData.pricePerKg || 0);

    // 1. Phân bổ chi phí ship và tính landed cost cho từng item
    const allocatedItems = Calculations.calculateInboundAllocation(
      purchaseData.items,
      purchaseData.shippingCost,
      purchaseData.otherFee,
      allocationMethod,
      pricePerKg
    );

    const totalAmount = allocatedItems.reduce((sum, it) => sum + it.totalCost, 0);
    const computedTotalWeight = allocatedItems.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.weight || 0)), 0);

    const purchase = {
      id: 'PN' + Date.now().toString(36).toUpperCase(),
      code: purchaseData.code || ('PN' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.floor(100 + Math.random() * 900)),
      date: purchaseData.date || new Date().toISOString().slice(0, 10),
      supplier: purchaseData.supplier || 'Nhà cung cấp',
      shippingMethod: purchaseData.shippingMethod || 'by_weight',
      pricePerKg: pricePerKg,
      totalWeight: Number(computedTotalWeight.toFixed(2)),
      shippingCost: Number(purchaseData.shippingCost || 0),
      otherFee: Number(purchaseData.otherFee || 0),
      allocationMethod: allocationMethod,
      items: allocatedItems,
      totalAmount,
      notes: purchaseData.notes || '',
      createdAt: new Date().toISOString()
    };

    // 2. Cập nhật tồn kho và cập nhật giá vốn mới nhất cho sản phẩm
    for (const it of allocatedItems) {
      const prod = this.getProductById(it.productId);
      if (prod) {
        const addedQty = Number(it.quantity || 0);
        const oldStock = Number(prod.stock || 0);
        const oldCost = Number(prod.costPrice || 0);
        const newStock = oldStock + addedQty;

        // Tính giá vốn bình quân gia quyền (Weighted Average Cost)
        let newAverageCost = it.landedCostPerUnit;
        if (oldStock > 0 && newStock > 0) {
          const totalVal = (oldStock * oldCost) + (addedQty * it.landedCostPerUnit);
          newAverageCost = Math.round(totalVal / newStock);
        }

        prod.stock = newStock;
        prod.costPrice = newAverageCost;
        prod.updatedAt = new Date().toISOString();
        await this.putToStore('products', prod);
      }
    }

    await this.putToStore('purchases', purchase);
    this.state.purchases.unshift(purchase);
    this.notify();
    return purchase;
  }

  async deletePurchase(id) {
    const purchase = this.state.purchases.find(p => p.id === id);
    if (!purchase) return;

    // Giảm lại số lượng kho khi xóa phiếu nhập
    for (const it of purchase.items || []) {
      const prod = this.getProductById(it.productId);
      if (prod) {
        prod.stock = Math.max(0, Number(prod.stock || 0) - Number(it.quantity || 0));
        prod.updatedAt = new Date().toISOString();
        await this.putToStore('products', prod);
      }
    }

    await this.deleteFromStore('purchases', id);
    this.state.purchases = this.state.purchases.filter(p => p.id !== id);
    this.recordDeletedId('purchases', id);
    this.notify();
  }

  // =================== CÁC THAO TÁC BÁN HÀNG (SALES) ===================

  async createSale(saleData) {
    // Gắn giá vốn hiện tại vào từng món hàng trong đơn nếu chưa có
    const enrichedItems = (saleData.items || []).map(item => {
      const prod = this.getProductById(item.productId);
      const costPrice = item.costPrice !== undefined ? Number(item.costPrice) : (prod ? Number(prod.costPrice || 0) : 0);
      const sellingPrice = Number(item.sellingPrice || (prod ? prod.sellingPrice : 0));
      return {
        productId: item.productId,
        productName: item.productName || (prod ? prod.name : 'Sản phẩm'),
        sku: prod ? prod.sku : '',
        color: (item.color || '').trim(),
        quantity: Number(item.quantity || 1),
        sellingPrice,
        costPrice
      };
    });

    const financials = Calculations.calculateOrderProfit(
      enrichedItems,
      saleData.discount,
      saleData.shippingFee,
      saleData.shippingPayer || 'customer'
    );

    const sale = {
      id: 'DH' + Date.now().toString(36).toUpperCase(),
      code: saleData.code || ('HD' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.floor(100 + Math.random() * 900)),
      date: saleData.date || new Date().toISOString().slice(0, 10),
      customerName: (saleData.customerName || 'Khách lẻ').trim(),
      customerPhone: (saleData.customerPhone || '').trim(),
      channel: saleData.channel || 'Trực tiếp',
      items: enrichedItems,
      discount: financials.discount,
      shippingFee: financials.shippingFee,
      shippingPayer: financials.shippingPayer,
      totalAmount: financials.totalCustomerPayment,
      totalCOGS: financials.totalCOGS,
      grossProfit: financials.grossProfit,
      grossMargin: financials.grossMargin,
      paymentStatus: saleData.paymentStatus || 'paid', // 'paid', 'unpaid', 'partial'
      paidAmount: saleData.paymentStatus === 'paid' ? financials.totalCustomerPayment : Number(saleData.paidAmount || 0),
      notes: saleData.notes || '',
      createdAt: new Date().toISOString()
    };

    // Trừ tồn kho sản phẩm & màu sắc tương ứng
    for (const it of enrichedItems) {
      const prod = this.getProductById(it.productId);
      if (prod) {
        prod.stock = Math.max(0, Number(prod.stock || 0) - Number(it.quantity || 0));
        if (it.color && Array.isArray(prod.colors)) {
          const colorObj = prod.colors.find(c => c.name.toLowerCase() === it.color.toLowerCase());
          if (colorObj) {
            colorObj.quantity = Math.max(0, Number(colorObj.quantity || 0) - Number(it.quantity || 0));
          }
        }
        prod.updatedAt = new Date().toISOString();
        await this.putToStore('products', prod);
      }
    }

    await this.putToStore('sales', sale);
    this.state.sales.unshift(sale);
    this.notify();
    return sale;
  }

  async updateSalePayment(id, paymentStatus, paidAmount) {
    const sale = this.state.sales.find(s => s.id === id);
    if (!sale) return;

    sale.paymentStatus = paymentStatus;
    sale.paidAmount = paymentStatus === 'paid' ? sale.totalAmount : Number(paidAmount || 0);
    sale.updatedAt = new Date().toISOString();

    await this.putToStore('sales', sale);
    this.notify();
    return sale;
  }

  async deleteSale(id) {
    const sale = this.state.sales.find(s => s.id === id);
    if (!sale) return;

    // Hoàn trả lại tồn kho sản phẩm & màu sắc
    for (const it of sale.items || []) {
      const prod = this.getProductById(it.productId);
      if (prod) {
        prod.stock = Number(prod.stock || 0) + Number(it.quantity || 0);
        if (it.color && Array.isArray(prod.colors)) {
          const colorObj = prod.colors.find(c => c.name.toLowerCase() === it.color.toLowerCase());
          if (colorObj) {
            colorObj.quantity = Number(colorObj.quantity || 0) + Number(it.quantity || 0);
          }
        }
        prod.updatedAt = new Date().toISOString();
        await this.putToStore('products', prod);
      }
    }

    await this.deleteFromStore('sales', id);
    this.state.sales = this.state.sales.filter(s => s.id !== id);
    this.recordDeletedId('sales', id);
    this.notify();
  }

  // =================== CÁC THAO TÁC SỔ QUỸ THU - CHI ===================

  async addCashflow(entry) {
    const item = {
      id: 'TC' + Date.now().toString(36).toUpperCase(),
      type: entry.type || 'expense', // 'income' hoặc 'expense'
      category: entry.category || (entry.type === 'income' ? 'Thu khác' : 'Chi phí vận hành'),
      amount: Math.abs(Number(entry.amount || 0)),
      date: entry.date || new Date().toISOString().slice(0, 10),
      description: entry.description || '',
      createdAt: new Date().toISOString()
    };

    await this.putToStore('cashflow', item);
    this.state.cashflow.unshift(item);
    this.notify();
    return item;
  }

  async deleteCashflow(id) {
    await this.deleteFromStore('cashflow', id);
    this.state.cashflow = this.state.cashflow.filter(c => c.id !== id);
    this.recordDeletedId('cashflow', id);
    this.notify();
  }

  // =================== CÀI ĐẶT & SAO LƯU ===================

  async saveSettings(newSettings) {
    this.state.settings = { ...this.state.settings, ...newSettings };
    await this.putToStore('settings', { id: 'app_settings', ...this.state.settings });
    this.notify();
  }

  /**
   * Xuất toàn bộ dữ liệu ra đối tượng JSON chuẩn để sao lưu
   */
  exportAllData() {
    return {
      appName: 'QuanLyHangHoa',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      data: {
        products: this.state.products,
        purchases: this.state.purchases,
        sales: this.state.sales,
        cashflow: this.state.cashflow,
        settings: this.state.settings
      }
    };
  }

  /**
   * Nạp lại dữ liệu từ file JSON sao lưu
   */
  async importData(importedPayload, shouldNotify = true) {
    const data = importedPayload.data || importedPayload;
    if (!data.products && !data.sales) {
      throw new Error('Định dạng file sao lưu không hợp lệ.');
    }

    // Xóa sạch cơ sở dữ liệu cũ
    if (this.db) {
      const stores = ['products', 'purchases', 'sales', 'cashflow', 'settings'];
      for (const st of stores) {
        await new Promise((res) => {
          const tx = this.db.transaction([st], 'readwrite');
          tx.objectStore(st).clear().onsuccess = () => res();
        });
      }
    }

    this.state.products = data.products || [];
    this.state.purchases = data.purchases || [];
    this.state.sales = data.sales || [];
    this.state.cashflow = data.cashflow || [];
    this.state.settings = data.settings || this.state.settings;

    // Lưu vào DB
    for (const p of this.state.products) await this.putToStore('products', p);
    for (const pu of this.state.purchases) await this.putToStore('purchases', pu);
    for (const s of this.state.sales) await this.putToStore('sales', s);
    for (const c of this.state.cashflow) await this.putToStore('cashflow', c);
    await this.putToStore('settings', { id: 'app_settings', ...this.state.settings });

    this.saveToLocalStorage();
    if (shouldNotify) this.notify();
  }

  /**
   * Nạp bộ dữ liệu mẫu thực tế để trải nghiệm ngay
   */
  async loadSampleDemoData() {
    const today = new Date();
    const formatDate = (daysAgo) => {
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().slice(0, 10);
    };

    const sampleProducts = [
      {
        id: 'SP_AO_THUN',
        sku: 'AT-TRANG-01',
        name: 'Áo thun cotton trơn unisex Trắng',
        category: 'Thời trang',
        unit: 'Cái',
        weight: 0.2, // 200g
        colors: [
          { name: 'Trắng', quantity: 25 },
          { name: 'Đen', quantity: 15 },
          { name: 'Xám', quantity: 5 }
        ],
        costPrice: 53000,
        sellingPrice: 120000,
        stock: 45,
        minStock: 10,
        notes: 'Chất liệu 100% cotton co giãn 4 chiều'
      },
      {
        id: 'SP_AO_POLO',
        sku: 'POLO-DEN-02',
        name: 'Áo Polo thể thao phối cổ Đen',
        category: 'Thời trang',
        unit: 'Cái',
        weight: 0.25, // 250g
        colors: [
          { name: 'Đen', quantity: 18 },
          { name: 'Xanh', quantity: 10 }
        ],
        costPrice: 85000,
        sellingPrice: 185000,
        stock: 28,
        minStock: 8,
        notes: 'Vải mè thoáng khí, thấm hút mồ hôi'
      },
      {
        id: 'SP_QUAN_JEAN',
        sku: 'JEAN-XANH-03',
        name: 'Quần Jean ống suông phong cách Hàn Quốc',
        category: 'Thời trang',
        unit: 'Cái',
        weight: 0.55, // 550g
        costPrice: 155000,
        sellingPrice: 290000,
        stock: 15,
        minStock: 5,
        notes: 'Chất jean dày dặn, không xù lông'
      },
      {
        id: 'SP_BALO',
        sku: 'BALO-CHONGNUOC',
        name: 'Balo laptop chống nước cao cấp',
        category: 'Phụ kiện',
        unit: 'Chiếc',
        weight: 0.85, // 850g
        costPrice: 130000,
        sellingPrice: 260000,
        stock: 4,
        minStock: 6,
        notes: 'Có ngăn đựng laptop 15.6 inch'
      },
      {
        id: 'SP_VO_COTTON',
        sku: 'TAT-COTTON-05',
        name: 'Set 5 đôi tất cotton cổ ngắn kháng khuẩn',
        category: 'Phụ kiện',
        unit: 'Set',
        weight: 0.1, // 100g
        costPrice: 32000,
        sellingPrice: 75000,
        stock: 60,
        minStock: 15,
        notes: 'Đệm gót êm ái'
      }
    ];

    const samplePurchases = [
      {
        id: 'PN_SAMPLE_1',
        code: 'PN2610-001',
        date: formatDate(10),
        supplier: 'Xưởng May Hà Nội',
        shippingCost: 90000,
        otherFee: 0,
        allocationMethod: 'by_quantity',
        items: [
          {
            productId: 'SP_AO_THUN',
            productName: 'Áo thun cotton trơn unisex Trắng',
            quantity: 50,
            purchasePrice: 50000,
            allocatedFeePerUnit: 1800,
            landedCostPerUnit: 51800,
            totalCost: 2590000
          }
        ],
        totalAmount: 2590000,
        notes: 'Nhập lô áo trắng đợt 1'
      },
      {
        id: 'PN_SAMPLE_2',
        code: 'PN2610-002',
        date: formatDate(7),
        supplier: 'Tổng Kho Phụ Kiện Sài Gòn',
        shippingCost: 60000,
        otherFee: 0,
        allocationMethod: 'by_quantity',
        items: [
          {
            productId: 'SP_AO_POLO',
            productName: 'Áo Polo thể thao phối cổ Đen',
            quantity: 30,
            purchasePrice: 83000,
            allocatedFeePerUnit: 2000,
            landedCostPerUnit: 85000,
            totalCost: 2550000
          }
        ],
        totalAmount: 2550000,
        notes: 'Hàng chuẩn bao đẹp'
      }
    ];

    const sampleSales = [
      {
        id: 'DH_SAMPLE_1',
        code: 'HD2610-101',
        date: formatDate(5),
        customerName: 'Nguyễn Văn An',
        customerPhone: '0912345678',
        channel: 'Facebook',
        items: [
          {
            productId: 'SP_AO_THUN',
            productName: 'Áo thun cotton trơn unisex Trắng',
            sku: 'AT-TRANG-01',
            quantity: 2,
            sellingPrice: 120000,
            costPrice: 53000
          }
        ],
        discount: 10000,
        shippingFee: 25000,
        shippingPayer: 'customer', // Khách trả ship
        totalAmount: 255000, // 230k tiền hàng + 25k ship
        totalCOGS: 106000,
        grossProfit: 124000, // 230k - 106k
        grossMargin: 0.539,
        paymentStatus: 'paid',
        paidAmount: 255000,
        notes: 'Khách chuyển khoản trước'
      },
      {
        id: 'DH_SAMPLE_2',
        code: 'HD2610-102',
        date: formatDate(3),
        customerName: 'Trần Thị Bích',
        customerPhone: '0988776655',
        channel: 'Shopee',
        items: [
          {
            productId: 'SP_AO_POLO',
            productName: 'Áo Polo thể thao phối cổ Đen',
            sku: 'POLO-DEN-02',
            quantity: 1,
            sellingPrice: 185000,
            costPrice: 85000
          },
          {
            productId: 'SP_VO_COTTON',
            productName: 'Set 5 đôi tất cotton cổ ngắn kháng khuẩn',
            sku: 'TAT-COTTON-05',
            quantity: 2,
            sellingPrice: 75000,
            costPrice: 32000
          }
        ],
        discount: 0,
        shippingFee: 30000,
        shippingPayer: 'shop', // Shop freeship cho khách
        totalAmount: 335000, // Tiền khách trả chỉ là tiền hàng
        totalCOGS: 149000, // 85k + 64k
        grossProfit: 156000, // 335k - 149k - 30k ship
        grossMargin: 0.465,
        paymentStatus: 'paid',
        paidAmount: 335000,
        notes: 'Chương trình Freeship tri ân'
      },
      {
        id: 'DH_SAMPLE_3',
        code: 'HD2610-103',
        date: formatDate(1),
        customerName: 'Lê Hoàng Nam',
        customerPhone: '0903112233',
        channel: 'Trực tiếp',
        items: [
          {
            productId: 'SP_QUAN_JEAN',
            productName: 'Quần Jean ống suông phong cách Hàn Quốc',
            sku: 'JEAN-XANH-03',
            quantity: 1,
            sellingPrice: 290000,
            costPrice: 155000
          }
        ],
        discount: 20000,
        shippingFee: 0,
        shippingPayer: 'customer',
        totalAmount: 270000,
        totalCOGS: 155000,
        grossProfit: 115000,
        grossMargin: 0.425,
        paymentStatus: 'unpaid', // Khách quen nợ lại
        paidAmount: 0,
        notes: 'Hẹn cuối tuần thanh toán'
      }
    ];

    const sampleCashflow = [
      {
        id: 'TC_SAMPLE_1',
        type: 'expense',
        category: 'Bao bì & Đóng gói',
        amount: 85000,
        date: formatDate(6),
        description: 'Mua 50 hộp carton size vừa + 2 cuộn băng dính đóng hàng'
      },
      {
        id: 'TC_SAMPLE_2',
        type: 'expense',
        category: 'Quảng cáo & Marketing',
        amount: 150000,
        date: formatDate(4),
        description: 'Chạy ads Facebook bài áo thun cotton'
      },
      {
        id: 'TC_SAMPLE_3',
        type: 'income',
        category: 'Thu khác',
        amount: 50000,
        date: formatDate(2),
        description: 'Đơn vị vận chuyển đền bù đơn hàng trễ'
      }
    ];

    await this.importData({
      products: sampleProducts,
      purchases: samplePurchases,
      sales: sampleSales,
      cashflow: sampleCashflow,
      settings: {
        storeName: 'Shop Quần Áo & Phụ Kiện Max',
        currency: 'VND',
        defaultShippingPayer: 'customer',
        defaultAllocationMethod: 'by_quantity'
      }
    });
  }

  /**
   * Đặt lại toàn bộ chỉ số tài chính & giao dịch về 0 (xóa sạch sales, purchases, cashflow, giữ nguyên danh mục hàng hóa trong kho)
   */
  async resetTransactions(shouldNotify = true) {
    this.state.sales = [];
    this.state.purchases = [];
    this.state.cashflow = [];
    await this.persistAll();
    if (shouldNotify) this.notify();
    if (window.CloudSync && typeof window.CloudSync.triggerAutoPush === 'function') {
      window.CloudSync.triggerAutoPush();
    }
  }

  /**
   * Xóa toàn bộ dữ liệu trở về trắng
   */
  async clearAllData() {
    await this.importData({
      products: [],
      purchases: [],
      sales: [],
      cashflow: [],
      settings: {
        storeName: 'Cửa Hàng Cá Nhân',
        currency: 'VND',
        defaultShippingPayer: 'customer',
        defaultAllocationMethod: 'by_quantity'
      }
    });
  }
}

// Khởi tạo Singleton Store toàn cục
window.appStore = new DataStore();
