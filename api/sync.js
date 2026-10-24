/**
 * api/sync.js - Vercel Serverless Function đồng bộ dữ liệu đa thiết bị
 * Lưu trữ trên Vercel KV / Upstash Redis
 */

function safeParse(val) {
  let res = val;
  while (typeof res === 'string') {
    try {
      res = JSON.parse(res);
    } catch (e) {
      break;
    }
  }
  return (res && typeof res === 'object') ? res : {};
}

function mergeListById(listA, listB, deletedSet = new Set(), dateField = 'updatedAt') {
  const map = new Map();
  (Array.isArray(listA) ? listA : []).forEach(item => {
    if (item && item.id && !deletedSet.has(item.id)) {
      map.set(item.id, item);
    }
  });
  (Array.isArray(listB) ? listB : []).forEach(item => {
    if (item && item.id && !deletedSet.has(item.id)) {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      } else {
        const existing = map.get(item.id);
        const timeA = new Date(existing[dateField] || existing.createdAt || 0).getTime();
        const timeB = new Date(item[dateField] || item.createdAt || 0).getTime();
        if (timeB >= timeA) {
          map.set(item.id, item);
        }
      }
    }
  });
  return Array.from(map.values());
}

module.exports = async function handler(req, res) {
  // Cấu hình CORS cho phép mọi thiết bị điện thoại gọi API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Lấy mã cửa hàng từ Query hoặc Body
  const storeCode = (req.query.storeCode || (req.body && req.body.storeCode) || '').trim().toUpperCase();

  if (!storeCode || storeCode.length < 3) {
    return res.status(400).json({
      error: 'Mã cửa hàng không hợp lệ (tối thiểu 3 ký tự, ví dụ: KHOLOC-6486).'
    });
  }

  // Khóa định danh chuẩn hóa an toàn
  const safeKey = `store_${storeCode.replace(/[^A-Z0-9_-]/g, '')}`;

  // Kiểm tra biến môi trường Vercel KV / Upstash Redis
  const KV_URL = process.env.KV_REST_API_URL 
    || process.env.UPSTASH_REDIS_REST_URL 
    || process.env.REDIS_REST_URL;

  const KV_TOKEN = process.env.KV_REST_API_TOKEN 
    || process.env.UPSTASH_REDIS_REST_TOKEN 
    || process.env.REDIS_REST_TOKEN;

  if (!KV_URL || !KV_TOKEN) {
    return res.status(200).json({
      success: false,
      needsKVSetup: true,
      message: 'Vercel KV chưa được kích hoạt trên trang quản trị Vercel. Bạn vào Vercel > Storage > Tạo KV Database (miễn phí) nhé!'
    });
  }

  try {
    // ================= 1. GET: Tải dữ liệu mới nhất từ Cloud =================
    if (req.method === 'GET') {
      const resp = await fetch(`${KV_URL}/get/${safeKey}`, {
        headers: {
          Authorization: `Bearer ${KV_TOKEN}`
        }
      });

      if (!resp.ok) {
        throw new Error(`KV response status ${resp.status}`);
      }

      const json = await resp.json();
      if (!json || json.result === null || json.result === undefined) {
        return res.status(200).json({
          success: true,
          notFound: true,
          message: 'Mã cửa hàng này chưa có dữ liệu trên Cloud.'
        });
      }

      const storeData = safeParse(json.result);

      return res.status(200).json({
        success: true,
        data: storeData,
        lastUpdated: storeData.lastUpdated || Date.now()
      });
    }

    // ================= 2. POST: Đẩy dữ liệu từ máy lên Cloud =================
    if (req.method === 'POST') {
      let payload = req.body;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch (e) {}
      }
      if (!payload || !payload.data) {
        return res.status(400).json({ error: 'Thiếu dữ liệu cửa hàng để lưu.' });
      }

      let clientData = payload.data;
      if (typeof clientData === 'string') {
        try { clientData = JSON.parse(clientData); } catch (e) {}
      }

      const now = Date.now();

      // Đọc dữ liệu cũ từ Cloud để thực hiện Smart Merge trên Server
      let existingData = {};
      try {
        const getResp = await fetch(`${KV_URL}/get/${safeKey}`, {
          headers: { Authorization: `Bearer ${KV_TOKEN}` }
        });
        if (getResp.ok) {
          const getJson = await getResp.json();
          if (getJson && getJson.result) {
            existingData = safeParse(getJson.result);
          }
        }
      } catch (e) {
        console.warn('Lỗi đọc dữ liệu cũ để merge:', e);
      }

      // Xử lý danh sách ID đã xóa (Tombstone)
      const clientDeleted = clientData.deletedIds || {};
      const existingDeleted = existingData.deletedIds || {};
      const allDeleted = {
        products: Array.from(new Set([...(clientDeleted.products || []), ...(existingDeleted.products || [])])),
        sales: Array.from(new Set([...(clientDeleted.sales || []), ...(existingDeleted.sales || [])])),
        purchases: Array.from(new Set([...(clientDeleted.purchases || []), ...(existingDeleted.purchases || [])])),
        cashflow: Array.from(new Set([...(clientDeleted.cashflow || []), ...(existingDeleted.cashflow || [])]))
      };

      const delProds = new Set(allDeleted.products);
      const delSales = new Set(allDeleted.sales);
      const delPo = new Set(allDeleted.purchases);
      const delCf = new Set(allDeleted.cashflow);

      const mergedProducts = mergeListById(existingData.products, clientData.products, delProds);
      const mergedPurchases = mergeListById(existingData.purchases, clientData.purchases, delPo);
      const mergedSales = mergeListById(existingData.sales, clientData.sales, delSales);
      const mergedCashflow = mergeListById(existingData.cashflow, clientData.cashflow, delCf);
      const mergedSettings = { ...(existingData.settings || {}), ...(clientData.settings || {}) };

      const storeData = {
        products: mergedProducts,
        purchases: mergedPurchases,
        sales: mergedSales,
        cashflow: mergedCashflow,
        settings: mergedSettings,
        deletedIds: allDeleted,
        lastUpdated: now,
        updatedBy: payload.deviceName || 'Điện thoại'
      };

      // Ghi vào Vercel KV / Upstash (Lưu chuỗi JSON chuẩn, KHÔNG double stringify)
      const resp = await fetch(`${KV_URL}/set/${safeKey}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${KV_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(storeData)
      });

      if (!resp.ok) {
        throw new Error(`KV set status ${resp.status}`);
      }

      return res.status(200).json({
        success: true,
        data: storeData,
        message: 'Đã đồng bộ lên Cloud thành công!',
        lastUpdated: now
      });
    }

    return res.status(405).json({ error: 'Phương thức không được hỗ trợ.' });
  } catch (err) {
    console.error('Sync API Error:', err);
    return res.status(500).json({
      error: 'Lỗi máy chủ khi xử lý đồng bộ: ' + err.message
    });
  }
};
