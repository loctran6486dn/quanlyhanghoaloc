/**
 * cloud-sync.js - Trình Quản Lý & Đồng Bộ Đám Mây Đa Thiết Bị Cho Ứng Dụng
 * Sử dụng Vercel Serverless API (/api/sync) kết nối Vercel KV / Upstash
 */

class CloudSyncManager {
  constructor() {
    this.storageKey = 'app_store_sync_code';
    this.storeCode = '';
    this.autoSyncEnabled = true;
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.lastError = null;
    this.needsKVSetup = false;
    this.listeners = new Set();
    this.autoSyncInterval = null;
    this.debouncePushTimer = null;
  }

  init() {
    // 1. Kiểm tra liên kết chia sẻ từ URL: ?sync=KHOLOC-6486
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlSyncCode = urlParams.get('sync');
      if (urlSyncCode && urlSyncCode.trim().length >= 3) {
        const clean = this.cleanCode(urlSyncCode);
        this.saveStoreCode(clean);
        // Xóa query param trên thanh địa chỉ URL cho sạch đẹp
        if (window.history && window.history.replaceState) {
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        }
      }
    } catch (e) {
      console.warn('Lỗi đọc URL param sync:', e);
    }

    // 2. Nạp mã cửa hàng đã lưu trong máy
    this.storeCode = localStorage.getItem(this.storageKey) || '';

    // 3. Đăng ký sự kiện mạng & chuyển ứng dụng
    window.addEventListener('online', () => {
      this.notifyListeners();
      if (this.storeCode) this.pull();
    });

    window.addEventListener('offline', () => {
      this.notifyListeners();
    });

    document.addEventListener('visibilitychange', () => {
      // Khi người dùng mở lại app / mở lại tab điện thoại -> Tự động kéo dữ liệu mới nhất
      if (!document.hidden && this.storeCode) {
        this.pull();
      }
    });

    // 4. Khởi động chu kỳ tự động đồng bộ (mỗi 25 giây nếu có mã kho)
    this.startAutoSync();

    // 5. Nếu đã có mã cửa hàng, thực hiện kéo dữ liệu ngay khi khởi động
    if (this.storeCode) {
      setTimeout(() => {
        this.pull();
      }, 800);
    }
  }

  cleanCode(code) {
    if (!code) return '';
    return code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  }

  saveStoreCode(code) {
    this.storeCode = this.cleanCode(code);
    if (this.storeCode) {
      localStorage.setItem(this.storageKey, this.storeCode);
    } else {
      localStorage.removeItem(this.storageKey);
    }
    this.notifyListeners();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners() {
    const status = this.getStatus();
    this.listeners.forEach(cb => {
      try { cb(status); } catch (e) { console.error(e); }
    });
  }

  getStatus() {
    return {
      storeCode: this.storeCode,
      isConnected: !!this.storeCode,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastError,
      needsKVSetup: this.needsKVSetup,
      isOnline: navigator.onLine !== false
    };
  }

  startAutoSync() {
    if (this.autoSyncInterval) clearInterval(this.autoSyncInterval);
    this.autoSyncInterval = setInterval(() => {
      if (this.storeCode && navigator.onLine !== false && !this.isSyncing && !document.hidden) {
        this.pull();
      }
    }, 25000);
  }

  /**
   * Kéo dữ liệu mới nhất từ Cloud về và trộn thông minh với dữ liệu máy này
   */
  async pull(isManual = false) {
    if (!this.storeCode) return { success: false, reason: 'no_code' };
    if (!navigator.onLine) return { success: false, reason: 'offline' };
    if (this.isSyncing) return { success: false, reason: 'busy' };

    this.isSyncing = true;
    this.lastError = null;
    this.notifyListeners();

    try {
      const resp = await fetch(`/api/sync?storeCode=${encodeURIComponent(this.storeCode)}`);
      if (!resp.ok) {
        throw new Error(`Máy chủ trả về mã ${resp.status}`);
      }

      const resJson = await resp.json();

      // Nếu Vercel chưa tạo Database KV
      if (resJson.needsKVSetup) {
        this.needsKVSetup = true;
        this.isSyncing = false;
        this.notifyListeners();
        return { success: false, needsKVSetup: true };
      }
      this.needsKVSetup = false;

      // Nếu mã này chưa có trên Cloud -> Tự động đẩy dữ liệu của máy này lên làm dữ liệu gốc
      if (resJson.notFound) {
        console.log('Mã kho mới trên Cloud, tự động đẩy dữ liệu hiện tại lên...');
        this.isSyncing = false;
        await this.pushNow();
        return { success: true, seeded: true };
      }

      if (resJson.success && resJson.data) {
        const remoteData = this.parseStoreData(resJson.data);
        const localState = window.appStore ? window.appStore.state : null;

        if (localState) {
          // Trộn dữ liệu thông minh không làm mất đơn hàng hay hàng hóa của cả 2 máy
          const mergedState = this.smartMerge(localState, remoteData);
          window.appStore.state = mergedState;

          // Lưu vào bộ nhớ cục bộ IndexedDB & LocalStorage
          if (typeof window.appStore.persistAll === 'function') {
            await window.appStore.persistAll();
          } else if (typeof window.appStore.saveToLocalStorage === 'function') {
            window.appStore.saveToLocalStorage();
          }

          // Thông báo cho toàn bộ giao diện re-render (truyền false để không đẩy ngược lên Cloud)
          if (typeof window.appStore.notify === 'function') {
            window.appStore.notify(false);
          } else if (typeof window.appStore.notifyListeners === 'function') {
            window.appStore.notifyListeners(false);
          }

          // Kiểm tra xem máy này có mặt hàng/đơn hàng hợp lệ nào chưa có trên Cloud hay không
          const del = (window.appStore && typeof window.appStore.getDeletedIds === 'function')
            ? window.appStore.getDeletedIds()
            : {};
          const delProds = new Set(del.products || []);
          const delSales = new Set(del.sales || []);
          const delPo = new Set(del.purchases || []);
          const delCf = new Set(del.cashflow || []);

          const localContributedNew = (localState.products || []).some(p => !delProds.has(p.id) && !(remoteData.products || []).some(rp => rp.id === p.id))
            || (localState.sales || []).some(s => !delSales.has(s.id) && !(remoteData.sales || []).some(rs => rs.id === s.id))
            || (localState.purchases || []).some(pu => !delPo.has(pu.id) && !(remoteData.purchases || []).some(rpu => rpu.id === pu.id))
            || (localState.cashflow || []).some(c => !delCf.has(c.id) && !(remoteData.cashflow || []).some(rc => rc.id === c.id));

          if (localContributedNew) {
            console.log('Phát hiện dữ liệu nội bộ mới hơn Cloud, tự động đồng bộ ngược lên...');
            this.triggerAutoPush();
          }
        }

        this.lastSyncTime = Date.now();
        this.isSyncing = false;
        this.notifyListeners();
        return { success: true, data: remoteData };
      }

      throw new Error(resJson.error || 'Dữ liệu không hợp lệ');
    } catch (err) {
      console.warn('Lỗi khi kéo dữ liệu Cloud:', err);
      this.lastError = err.message || 'Lỗi kết nối';
      this.isSyncing = false;
      this.notifyListeners();
      return { success: false, error: this.lastError };
    }
  }

  /**
   * Kích hoạt tự động đẩy dữ liệu khi có thay đổi trên máy này (Debounce 1.2s)
   */
  triggerAutoPush() {
    if (!this.storeCode || !navigator.onLine) return;
    if (this.debouncePushTimer) clearTimeout(this.debouncePushTimer);
    this.debouncePushTimer = setTimeout(() => {
      this.pushNow();
    }, 1200);
  }

  /**
   * Đẩy dữ liệu hiện tại lên Cloud ngay lập tức
   */
  async pushNow() {
    if (!this.storeCode || !navigator.onLine || !window.appStore) return;

    this.isSyncing = true;
    this.notifyListeners();

    try {
      const payload = {
        storeCode: this.storeCode,
        deviceName: navigator.userAgent.includes('iPhone') ? 'iPhone' : (navigator.userAgent.includes('Android') ? 'Android' : 'Máy tính'),
        data: {
          products: window.appStore.state.products || [],
          purchases: window.appStore.state.purchases || [],
          sales: window.appStore.state.sales || [],
          cashflow: window.appStore.state.cashflow || [],
          settings: window.appStore.state.settings || {},
          deletedIds: window.appStore.getDeletedIds ? window.appStore.getDeletedIds() : {}
        }
      };

      const resp = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resJson = await resp.json();
      if (resJson.needsKVSetup) {
        this.needsKVSetup = true;
      } else if (resJson.success) {
        this.needsKVSetup = false;
        this.lastSyncTime = Date.now();
        this.lastError = null;

        // Nếu server trả về dữ liệu đã trộn (merged data), nạp ngay vào máy
        if (resJson.data) {
          const serverData = this.parseStoreData(resJson.data);
          if (serverData && Array.isArray(serverData.products)) {
            const mergedWithServer = this.smartMerge(window.appStore.state, serverData);
            window.appStore.state = mergedWithServer;
            if (typeof window.appStore.persistAll === 'function') {
              await window.appStore.persistAll();
            }
            if (typeof window.appStore.notify === 'function') {
              window.appStore.notify(false);
            }
          }
        }
      } else {
        throw new Error(resJson.error || 'Lỗi lưu dữ liệu');
      }
    } catch (err) {
      console.warn('Lỗi khi đẩy dữ liệu lên Cloud:', err);
      this.lastError = err.message || 'Lỗi đẩy dữ liệu';
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  /**
   * Đồng bộ yêu cầu reset toàn bộ giao dịch lên Cloud
   */
  async resetTransactionsOnCloud() {
    if (!this.storeCode || !navigator.onLine || !window.appStore) return;

    this.isSyncing = true;
    this.notifyListeners();

    try {
      const payload = {
        storeCode: this.storeCode,
        resetTransactions: true,
        deviceName: navigator.userAgent.includes('iPhone') ? 'iPhone' : 'Điện thoại',
        data: {
          products: window.appStore.state.products || [],
          purchases: [],
          sales: [],
          cashflow: [],
          settings: window.appStore.state.settings || {},
          deletedIds: window.appStore.getDeletedIds ? window.appStore.getDeletedIds() : {}
        }
      };

      const resp = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resJson = await resp.json();
      if (resJson.success) {
        this.lastSyncTime = Date.now();
        this.lastError = null;
      }
    } catch (err) {
      console.warn('Lỗi gửi reset lên Cloud:', err);
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  parseStoreData(data) {
    let res = data;
    while (typeof res === 'string') {
      try {
        res = JSON.parse(res);
      } catch (e) {
        break;
      }
    }
    return (res && typeof res === 'object') ? res : {};
  }

  /**
   * Trộn dữ liệu thông minh (Smart Merge):
   * Kết hợp dữ liệu từ cả 2 điện thoại mà KHÔNG BAO GIỜ làm mất đơn hàng hay sản phẩm của nhau
   */
  smartMerge(local, remote) {
    const safeLocal = this.parseStoreData(local);
    const safeRemote = this.parseStoreData(remote);

    const result = {
      products: [],
      purchases: [],
      sales: [],
      cashflow: [],
      settings: safeLocal.settings || safeRemote.settings || {}
    };

    const del = (window.appStore && typeof window.appStore.getDeletedIds === 'function')
      ? window.appStore.getDeletedIds()
      : {};
    const remoteDel = safeRemote.deletedIds || {};
    const delProds = new Set([...(del.products || []), ...(remoteDel.products || [])]);
    const delSales = new Set([...(del.sales || []), ...(remoteDel.sales || [])]);
    const delPo = new Set([...(del.purchases || []), ...(remoteDel.purchases || [])]);
    const delCf = new Set([...(del.cashflow || []), ...(remoteDel.cashflow || [])]);

    // 1. Trộn sản phẩm (Ghép theo ID, ưu tiên bản ghi có thời gian cập nhật mới hơn)
    const prodMap = new Map();
    (safeLocal.products || []).forEach(p => {
      if (p && p.id && !delProds.has(p.id)) prodMap.set(p.id, p);
    });
    (safeRemote.products || []).forEach(p => {
      if (p && p.id && !delProds.has(p.id)) {
        if (!prodMap.has(p.id)) {
          prodMap.set(p.id, p);
        } else {
          const existing = prodMap.get(p.id);
          const localTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
          const remoteTime = new Date(p.updatedAt || p.createdAt || 0).getTime();
          if (remoteTime >= localTime) {
            prodMap.set(p.id, p);
          }
        }
      }
    });
    result.products = Array.from(prodMap.values());

    // 2. Trộn lịch sử bán hàng (Hợp nhất theo mã đơn ID, giữ đủ đơn của cả 2 máy)
    const salesMap = new Map();
    (safeLocal.sales || []).forEach(s => { if (s && s.id && !delSales.has(s.id)) salesMap.set(s.id, s); });
    (safeRemote.sales || []).forEach(s => { if (s && s.id && !delSales.has(s.id)) salesMap.set(s.id, s); });
    result.sales = Array.from(salesMap.values()).sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt || 0).getTime();
      const dateB = new Date(b.date || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    // 3. Trộn lịch sử nhập hàng (Hợp nhất theo ID)
    const poMap = new Map();
    (safeLocal.purchases || []).forEach(po => { if (po && po.id && !delPo.has(po.id)) poMap.set(po.id, po); });
    (safeRemote.purchases || []).forEach(po => { if (po && po.id && !delPo.has(po.id)) poMap.set(po.id, po); });
    result.purchases = Array.from(poMap.values()).sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt || 0).getTime();
      const dateB = new Date(b.date || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    // 4. Trộn sổ quỹ thu chi (Hợp nhất theo ID)
    const cfMap = new Map();
    (safeLocal.cashflow || []).forEach(cf => { if (cf && cf.id && !delCf.has(cf.id)) cfMap.set(cf.id, cf); });
    (safeRemote.cashflow || []).forEach(cf => { if (cf && cf.id && !delCf.has(cf.id)) cfMap.set(cf.id, cf); });
    result.cashflow = Array.from(cfMap.values()).sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt || 0).getTime();
      const dateB = new Date(b.date || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    // 5. Cài đặt cửa hàng
    if (safeRemote.settings && Object.keys(safeRemote.settings).length > 0) {
      result.settings = { ...safeLocal.settings, ...safeRemote.settings };
    }

    return result;
  }

  /**
   * Tạo link chia sẻ kết nối cho điện thoại khác
   */
  getShareUrl() {
    if (!this.storeCode) return window.location.origin;
    const base = window.location.origin + window.location.pathname;
    return `${base}?sync=${encodeURIComponent(this.storeCode)}`;
  }

  /**
   * Tạo URL mã QR để quét kết nối
   */
  getQrCodeUrl() {
    const shareUrl = this.getShareUrl();
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(shareUrl)}`;
  }
}

// Khởi tạo đối tượng toàn cục
window.CloudSync = new CloudSyncManager();
