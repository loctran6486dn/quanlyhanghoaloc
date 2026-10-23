/**
 * api/sync.js - Vercel Serverless Function đồng bộ dữ liệu đa thiết bị
 * Lưu trữ trên Vercel KV / Upstash Redis
 */

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

      let storeData = json.result;
      if (typeof storeData === 'string') {
        try {
          storeData = JSON.parse(storeData);
        } catch (e) {
          console.warn('Lỗi parse JSON storeData:', e);
        }
      }

      return res.status(200).json({
        success: true,
        data: storeData,
        lastUpdated: storeData.lastUpdated || Date.now()
      });
    }

    // ================= 2. POST: Đẩy dữ liệu từ máy lên Cloud =================
    if (req.method === 'POST') {
      const payload = req.body;
      if (!payload || !payload.data) {
        return res.status(400).json({ error: 'Thiếu dữ liệu cửa hàng để lưu.' });
      }

      const clientData = payload.data;
      const now = Date.now();

      const storeData = {
        products: Array.isArray(clientData.products) ? clientData.products : [],
        purchases: Array.isArray(clientData.purchases) ? clientData.purchases : [],
        sales: Array.isArray(clientData.sales) ? clientData.sales : [],
        cashflow: Array.isArray(clientData.cashflow) ? clientData.cashflow : [],
        settings: clientData.settings || {},
        lastUpdated: now,
        updatedBy: payload.deviceName || 'Điện thoại'
      };

      // Ghi vào Vercel KV (Lưu dạng chuỗi JSON)
      const resp = await fetch(`${KV_URL}/set/${safeKey}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${KV_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(JSON.stringify(storeData))
      });

      if (!resp.ok) {
        throw new Error(`KV set status ${resp.status}`);
      }

      return res.status(200).json({
        success: true,
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
}
