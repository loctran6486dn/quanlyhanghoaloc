/**
 * calculations.js - Động cơ tính toán tài chính & giá vốn cho ứng dụng Quản lý Hàng hóa
 */

const Calculations = {
  /**
   * Định dạng tiền tệ VND (ví dụ: 150.000 đ)
   */
  formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) return '0 đ';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(Math.round(value));
  },

  /**
   * Định dạng số nguyên có phân tách phần ngàn
   */
  formatNumber(value) {
    if (value === null || value === undefined || isNaN(value)) return '0';
    return new Intl.NumberFormat('vi-VN').format(Math.round(value));
  },

  /**
   * Định dạng phần trăm (%)
   */
  formatPercent(value) {
    if (value === null || value === undefined || isNaN(value)) return '0%';
    return (value * 100).toFixed(1) + '%';
  },

  /**
   * Định dạng ngày tháng kiểu Việt Nam (DD/MM/YYYY)
   */
  formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  },

  /**
   * Định dạng số điện thoại hiển thị rõ ràng, dễ nhìn (ví dụ: 0968 199 919)
   */
  formatPhone(phone) {
    if (!phone) return '';
    const cleaned = String(phone).trim().replace(/\D/g, '');
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
    } else if (cleaned.length === 11) {
      return cleaned.replace(/(\d{4})(\d{3})(\d{4})/, '$1 $2 $3');
    }
    return phone;
  },

  /**
   * Chuyển đổi chuỗi số thập phân (hỗ trợ cả dấu phẩy ',' và dấu chấm '.')
   * Cần thiết cho bàn phím số iOS Safari tiếng Việt hiển thị dấu phẩy ','
   */
  parseDecimal(value, defaultValue = 0) {
    if (value === null || value === undefined || value === '') return defaultValue;
    if (typeof value === 'number') return isNaN(value) ? defaultValue : value;
    const str = String(value).trim().replace(',', '.');
    const parsed = parseFloat(str);
    return isNaN(parsed) ? defaultValue : parsed;
  },

  /**
   * Tính giá vốn thực tế khi nhập hàng (Landed Cost)
   * Hỗ trợ phân bổ theo cân nặng (by_weight), theo số lượng (by_quantity), hoặc theo giá trị (by_value)
   * @param {Array} items - Danh sách mặt hàng nhập [{ productId, quantity, purchasePrice, weight }]
   * @param {number} shippingCost - Tiền ship từ nhà cung cấp về kho
   * @param {number} otherFee - Phụ phí khác (nếu có)
   * @param {string} method - 'by_weight', 'by_quantity', hoặc 'by_value'
   * @param {number} pricePerKg - Đơn giá ship mỗi kg (VNĐ/kg) nếu có
   * @returns {Array} Danh sách items kèm landedCostPerUnit và totalLandedCost
   */
  calculateInboundAllocation(items, shippingCost = 0, otherFee = 0, method = 'by_weight', pricePerKg = 0) {
    let totalExtraFee = Number(shippingCost || 0) + Number(otherFee || 0);
    const validItems = items || [];

    const totalQuantity = validItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalRawValue = validItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.purchasePrice !== undefined ? item.purchasePrice : (item.costPrice || 0))), 0);
    const totalWeight = validItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.weight || 0)), 0);

    // Nếu tính theo giá mỗi kg và có đơn giá ship/kg
    if (method === 'by_weight' && Number(pricePerKg || 0) > 0 && totalWeight > 0 && totalExtraFee === 0) {
      totalExtraFee = Math.round(totalWeight * Number(pricePerKg));
    }

    return validItems.map(item => {
      const qty = Number(item.quantity || 0);
      const price = Number(item.purchasePrice !== undefined ? item.purchasePrice : (item.costPrice || 0));
      const weightPerUnit = Number(item.weight || 0);
      const itemTotalWeight = qty * weightPerUnit;
      let allocatedFee = 0;

      if (totalExtraFee > 0) {
        if (method === 'by_weight' && totalWeight > 0) {
          // Phân bổ trực tiếp theo tỷ lệ cân nặng kg
          allocatedFee = (itemTotalWeight / totalWeight) * totalExtraFee;
        } else if (method === 'by_value' && totalRawValue > 0) {
          const itemValue = qty * price;
          allocatedFee = (itemValue / totalRawValue) * totalExtraFee;
        } else if (totalQuantity > 0) {
          allocatedFee = (qty / totalQuantity) * totalExtraFee;
        }
      }

      const allocatedFeePerUnit = qty > 0 ? (allocatedFee / qty) : 0;
      const landedCostPerUnit = price + allocatedFeePerUnit;
      const totalItemCost = (price * qty) + allocatedFee;

      return {
        ...item,
        weight: weightPerUnit,
        totalWeight: Number(itemTotalWeight.toFixed(3)),
        allocatedFeePerUnit: Math.round(allocatedFeePerUnit),
        landedCostPerUnit: Math.round(landedCostPerUnit),
        totalCost: Math.round(totalItemCost)
      };
    });
  },

  /**
   * Tính toán doanh thu và lợi nhuận cho một đơn bán hàng
   * @param {Array} items - [{ productId, quantity, sellingPrice, costPrice }]
   * @param {number} discount - Giảm giá cho khách
   * @param {number} shippingFee - Phí vận chuyển giao hàng
   * @param {string} shippingPayer - 'customer' (khách trả) hoặc 'shop' (shop chịu / freeship)
   */
  calculateOrderProfit(items, discount = 0, shippingFee = 0, shippingPayer = 'customer') {
    const validItems = items || [];
    const numDiscount = Number(discount || 0);
    const numShippingFee = Number(shippingFee || 0);

    // Tiền hàng gốc theo giá bán
    let grossMerchandiseValue = 0;
    // Tổng giá vốn của các mặt hàng trong đơn
    let totalCOGS = 0;

    validItems.forEach(item => {
      const qty = Number(item.quantity || 0);
      const sellPrice = Number(item.sellingPrice || 0);
      const costPrice = Number(item.costPrice || 0);

      grossMerchandiseValue += qty * sellPrice;
      totalCOGS += qty * costPrice;
    });

    // Doanh thu từ tiền hàng
    const netMerchandiseRevenue = Math.max(0, grossMerchandiseValue - numDiscount);

    // Tổng tiền khách phải thanh toán (Tổng bill)
    const totalCustomerPayment = shippingPayer === 'customer' 
      ? (netMerchandiseRevenue + numShippingFee)
      : netMerchandiseRevenue;

    // Chi phí ship shop phải tự chịu (Freeship)
    const shopShippingCost = shippingPayer === 'shop' ? numShippingFee : 0;

    // Lợi nhuận gộp của đơn hàng = Doanh thu tiền hàng - Giá vốn - Phí ship shop chịu
    const grossProfit = netMerchandiseRevenue - totalCOGS - shopShippingCost;

    // Tỷ suất lợi nhuận gộp trên doanh thu hàng
    const grossMargin = netMerchandiseRevenue > 0 ? (grossProfit / netMerchandiseRevenue) : 0;

    return {
      grossMerchandiseValue,
      discount: numDiscount,
      netMerchandiseRevenue,
      shippingFee: numShippingFee,
      shippingPayer,
      totalCustomerPayment,
      totalCOGS,
      shopShippingCost,
      grossProfit,
      grossMargin
    };
  },

  /**
   * Tổng hợp báo cáo tài chính toàn diện theo khoảng thời gian
   * @param {Object} data - { sales, purchases, cashflow, products }
   * @param {Object} filter - { startDate, endDate }
   */
  generateFinancialSummary(data, filter = {}) {
    const { sales = [], purchases = [], cashflow = [], products = [] } = data;

    // Lọc theo khoảng ngày nếu có
    const isWithinDateRange = (dateStr) => {
      if (!dateStr) return false;
      const d = dateStr.slice(0, 10);
      if (filter.startDate && d < filter.startDate) return false;
      if (filter.endDate && d > filter.endDate) return false;
      return true;
    };

    const filteredSales = sales.filter(s => isWithinDateRange(s.date) && s.status !== 'cancelled');
    const filteredPurchases = purchases.filter(p => isWithinDateRange(p.date));
    const filteredCashflow = cashflow.filter(c => isWithinDateRange(c.date));

    // 1. Phân tích Bán hàng
    let totalRevenue = 0;            // Doanh thu bán hàng
    let totalCOGS = 0;               // Giá vốn hàng đã bán
    let totalShopOutboundShip = 0;   // Phí ship khách mà shop chịu
    let totalCustomerOutboundShip = 0; // Phí ship khách tự trả
    let totalDiscounts = 0;          // Tổng tiền chiết khấu
    let totalOrdersCount = filteredSales.length;
    let completedOrdersCount = 0;
    let pendingPaymentAmount = 0;    // Công nợ khách còn thiếu

    filteredSales.forEach(order => {
      const financials = this.calculateOrderProfit(
        order.items,
        order.discount,
        order.shippingFee,
        order.shippingPayer
      );

      totalRevenue += financials.netMerchandiseRevenue;
      totalCOGS += financials.totalCOGS;
      totalShopOutboundShip += financials.shopShippingCost;
      if (order.shippingPayer === 'customer') {
        totalCustomerOutboundShip += financials.shippingFee;
      }
      totalDiscounts += financials.discount;

      if (order.paymentStatus === 'paid') {
        completedOrdersCount++;
      } else if (order.paymentStatus === 'partial') {
        const paid = Number(order.paidAmount || 0);
        pendingPaymentAmount += Math.max(0, financials.totalCustomerPayment - paid);
      } else {
        // unpaid
        pendingPaymentAmount += financials.totalCustomerPayment;
      }
    });

    // Lợi nhuận gộp từ bán hàng
    const totalGrossProfit = totalRevenue - totalCOGS - totalShopOutboundShip;
    const grossMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) : 0;

    // 2. Phân tích Nhập hàng & Phí ship đầu vào
    let totalInboundValue = 0;       // Tổng giá trị nhập hàng (gồm giá mua + ship)
    let totalInboundShipping = 0;    // Tổng tiền ship từ nhà cung cấp về kho

    filteredPurchases.forEach(po => {
      totalInboundShipping += Number(po.shippingCost || 0);
      const itemsCost = (po.items || []).reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.purchasePrice || 0)), 0);
      totalInboundValue += itemsCost + Number(po.shippingCost || 0) + Number(po.otherFee || 0);
    });

    // 3. Phân tích Sổ quỹ Thu - Chi vận hành (Bao bì, quảng cáo, v.v.)
    let totalOtherIncome = 0;        // Thu nhập khác ngoài bán hàng
    let totalOperatingExpense = 0;   // Chi phí vận hành khác (mặt bằng, hộp, marketing...)

    const expenseByCategory = {};

    filteredCashflow.forEach(entry => {
      const amount = Number(entry.amount || 0);
      if (entry.type === 'income') {
        totalOtherIncome += amount;
      } else {
        totalOperatingExpense += amount;
        const cat = entry.category || 'Chi phí khác';
        expenseByCategory[cat] = (expenseByCategory[cat] || 0) + amount;
      }
    });

    // 4. Lợi nhuận ròng tổng thể (Net Profit)
    // Lợi nhuận ròng = Lợi nhuận gộp + Thu nhập khác - Chi phí vận hành
    const totalNetProfit = totalGrossProfit + totalOtherIncome - totalOperatingExpense;
    const netMargin = totalRevenue > 0 ? (totalNetProfit / totalRevenue) : 0;

    // 5. Giá trị tồn kho hiện tại (Tính trên toàn bộ danh mục sản phẩm)
    let totalInventoryValue = 0;
    let totalInventoryUnits = 0;
    let lowStockCount = 0;

    products.forEach(p => {
      const stock = Number(p.stock || 0);
      const cost = Number(p.costPrice || 0);
      const minStock = Number(p.minStock || 5);

      if (stock > 0) {
        totalInventoryValue += stock * cost;
        totalInventoryUnits += stock;
      }
      if (stock <= minStock) {
        lowStockCount++;
      }
    });

    // 6. Tổng hợp chi phí toàn bộ cho biểu đồ phân tích cơ cấu chi phí
    const totalExpensesBreakdown = {
      cogs: totalCOGS,
      shopShipping: totalShopOutboundShip,
      operatingExpense: totalOperatingExpense,
      inboundShippingInPeriod: totalInboundShipping
    };

    return {
      // Doanh thu
      totalRevenue,
      totalDiscounts,
      totalOrdersCount,
      completedOrdersCount,
      pendingPaymentAmount,

      // Chi phí & Giá vốn
      totalCOGS,
      totalShopOutboundShip,
      totalCustomerOutboundShip,
      totalOperatingExpense,
      expenseByCategory,
      totalExpensesBreakdown,

      // Nhập hàng
      totalInboundValue,
      totalInboundShipping,

      // Lợi nhuận
      totalGrossProfit,
      grossMargin,
      totalOtherIncome,
      totalNetProfit,
      netMargin,

      // Tồn kho
      totalInventoryValue,
      totalInventoryUnits,
      lowStockCount
    };
  }
};

// Xuất cho môi trường trình duyệt và kiểm thử nếu có
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Calculations;
}
