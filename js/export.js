/**
 * export.js - Xử lý Xuất/Nhập File Excel (XLSX/CSV), Sao Lưu Dữ Liệu và In Hóa Đơn
 */

const ExportManager = {
  /**
   * Tải về file từ chuỗi dữ liệu (Blob)
   */
  downloadBlob(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  },

  /**
   * Tạo chuỗi CSV định dạng UTF-8 có BOM (để mở trong Excel tiếng Việt không bị lỗi font)
   */
  convertToCSV(headers, rows) {
    const escapeCell = (cell) => {
      if (cell === null || cell === undefined) return '""';
      const str = String(cell).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headerLine = headers.map(escapeCell).join(',');
    const rowLines = rows.map(row => row.map(escapeCell).join(','));

    // \uFEFF là UTF-8 BOM bắt buộc để Excel hiển thị đúng dấu tiếng Việt
    return '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
  },

  /**
   * Xuất danh sách sản phẩm & tồn kho
   */
  exportProducts(products) {
    const filename = `Danh_Sach_Hang_Hoa_${new Date().toISOString().slice(0, 10)}`;

    if (window.XLSX) {
      const data = products.map((p, idx) => ({
        'STT': idx + 1,
        'Mã hàng (SKU)': p.sku,
        'Tên hàng hóa': p.name,
        'Danh mục': p.category,
        'Đơn vị tính': p.unit,
        'Khối lượng (kg)': p.weight !== undefined ? p.weight : 0.2,
        'Phân loại chi tiết': Array.isArray(p.variants) && p.variants.length > 0 ? p.variants.map(v => `${[v.model ? `Mẫu: ${v.model}` : '', v.color ? `Màu: ${v.color}` : '', v.size ? `Size: ${v.size}` : ''].filter(Boolean).join(' • ')} (${v.quantity})`).join(', ') : '',
        'Phân loại màu': Array.isArray(p.colors) && p.colors.length > 0 ? p.colors.map(c => `${c.name} (${c.quantity})`).join(', ') : '',
        'Kích cỡ (Size)': Array.isArray(p.sizes) && p.sizes.length > 0 ? p.sizes.join(', ') : '',
        'Tồn kho': p.stock,
        'Cảnh báo tồn tối thiểu': p.minStock,
        'Giá vốn (VNĐ)': p.costPrice,
        'Giá bán niêm yết (VNĐ)': p.sellingPrice,
        'Tổng giá trị tồn (VNĐ)': (p.stock || 0) * (p.costPrice || 0),
        'Ghi chú': p.notes || ''
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'HangHoa');
      XLSX.writeFile(wb, `${filename}.xlsx`);
      return;
    }

    // Fallback sang CSV chuẩn UTF-8
    const headers = ['STT', 'Mã hàng (SKU)', 'Tên hàng hóa', 'Danh mục', 'Đơn vị tính', 'Khối lượng (kg)', 'Phân loại màu', 'Kích cỡ (Size)', 'Tồn kho', 'Cảnh báo tồn', 'Giá vốn', 'Giá bán niêm yết', 'Tổng giá trị tồn', 'Ghi chú'];
    const rows = products.map((p, idx) => [
      idx + 1,
      p.sku,
      p.name,
      p.category,
      p.unit,
      p.weight !== undefined ? p.weight : 0.2,
      Array.isArray(p.colors) && p.colors.length > 0 ? p.colors.map(c => `${c.name} (${c.quantity})`).join(', ') : '',
      Array.isArray(p.sizes) && p.sizes.length > 0 ? p.sizes.join(', ') : '',
      p.stock,
      p.minStock,
      p.costPrice,
      p.sellingPrice,
      (p.stock || 0) * (p.costPrice || 0),
      p.notes || ''
    ]);

    const csvContent = this.convertToCSV(headers, rows);
    this.downloadBlob(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
  },

  /**
   * Xuất lịch sử bán hàng & phân tích lãi/lỗ
   */
  exportSales(sales) {
    const filename = `Lich_Su_Ban_Hang_${new Date().toISOString().slice(0, 10)}`;

    if (window.XLSX) {
      const data = sales.map((s, idx) => {
        const itemNames = (s.items || []).map(i => `${i.productName}${i.color ? ` [Màu ${i.color}]` : ''}${i.size ? ` [Size ${i.size}]` : ''} (x${i.quantity})`).join(', ');
        return {
          'STT': idx + 1,
          'Mã đơn hàng': s.code,
          'Ngày bán': s.date,
          'Khách hàng': s.customerName,
          'Số điện thoại': s.customerPhone || '',
          'Kênh bán': s.channel,
          'Sản phẩm': itemNames,
          'Phí ship': s.shippingFee,
          'Bên chịu ship': s.shippingPayer === 'shop' ? 'Shop chịu (Freeship)' : 'Khách trả',
          'Giảm giá': s.discount,
          'Tổng tiền bill (VNĐ)': s.totalAmount,
          'Tổng giá vốn (COGS)': s.totalCOGS,
          'Lợi nhuận gộp (VNĐ)': s.grossProfit,
          'Biên lợi nhuận': Calculations.formatPercent(s.grossMargin),
          'Trạng thái thanh toán': s.paymentStatus === 'paid' ? 'Đã thanh toán đủ' : (s.paymentStatus === 'partial' ? 'Khách cọc' : 'Nhận hàng thanh toán'),
          'Ghi chú': s.notes || ''
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'DonHang');
      XLSX.writeFile(wb, `${filename}.xlsx`);
      return;
    }

    const headers = ['STT', 'Mã đơn hàng', 'Ngày bán', 'Khách hàng', 'Số điện thoại', 'Kênh bán', 'Sản phẩm', 'Phí ship', 'Bên chịu ship', 'Giảm giá', 'Tổng bill', 'Tổng giá vốn', 'Lợi nhuận gộp', 'Biên lợi nhuận', 'Thanh toán', 'Ghi chú'];
    const rows = sales.map((s, idx) => [
      idx + 1,
      s.code,
      s.date,
      s.customerName,
      s.customerPhone || '',
      s.channel,
      (s.items || []).map(i => `${i.productName}${i.color ? ` [Màu ${i.color}]` : ''}${i.size ? ` [Size ${i.size}]` : ''} (x${i.quantity})`).join('; '),
      s.shippingFee,
      s.shippingPayer === 'shop' ? 'Shop chịu' : 'Khách trả',
      s.discount,
      s.totalAmount,
      s.totalCOGS,
      s.grossProfit,
      Calculations.formatPercent(s.grossMargin),
      s.paymentStatus === 'paid' ? 'Đã thanh toán đủ' : (s.paymentStatus === 'partial' ? 'Khách cọc' : 'Nhận hàng thanh toán'),
      s.notes || ''
    ]);

    const csvContent = this.convertToCSV(headers, rows);
    this.downloadBlob(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
  },

  /**
   * Xuất báo cáo kết quả tài chính tổng hợp
   */
  exportFinancialReport(summary, filter) {
    const filename = `Bao_Cao_Tai_Chinh_${new Date().toISOString().slice(0, 10)}`;

    const rows = [
      ['CHỈ SỐ TÀI CHÍNH', 'GIÁ TRỊ (VNĐ)'],
      ['Khoảng thời gian', `${filter.startDate || 'Bắt đầu'} đến ${filter.endDate || 'Hiện tại'}`],
      ['Tổng Doanh thu thuần', summary.totalRevenue],
      ['Tổng Giá vốn hàng bán (COGS)', summary.totalCOGS],
      ['Phí ship shop chịu cho khách (Freeship)', summary.totalShopOutboundShip],
      ['Lợi nhuận gộp từ bán hàng', summary.totalGrossProfit],
      ['Tỷ suất lợi nhuận gộp', Calculations.formatPercent(summary.grossMargin)],
      ['---', '---'],
      ['Thu nhập khác ngoài bán hàng', summary.totalOtherIncome],
      ['Chi phí vận hành (Bao bì, Ads, mặt bằng...)', summary.totalOperatingExpense],
      ['LỢI NHUẬN RÒNG (NET PROFIT)', summary.totalNetProfit],
      ['Tỷ suất lợi nhuận ròng', Calculations.formatPercent(summary.netMargin)],
      ['---', '---'],
      ['Tổng giá trị hàng tồn kho hiện có', summary.totalInventoryValue],
      ['Tổng số đơn hàng phát sinh', summary.totalOrdersCount],
      ['Tiền hàng khách còn nợ chưa thu', summary.pendingPaymentAmount]
    ];

    if (window.XLSX) {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'BaoCaoTaiChinh');
      XLSX.writeFile(wb, `${filename}.xlsx`);
      return;
    }

    const csvContent = this.convertToCSV(['CHỈ SỐ', 'GIÁ TRỊ'], rows.slice(1));
    this.downloadBlob(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
  },

  /**
   * Sao lưu toàn bộ dữ liệu ra file JSON
   */
  backupData() {
    const data = window.appStore.exportAllData();
    const str = JSON.stringify(data, null, 2);
    const filename = `QuanLyHangHoa_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    this.downloadBlob(str, filename, 'application/json');
  },

  /**
   * Khôi phục dữ liệu từ file JSON do người dùng tải lên
   */
  restoreData(file, callback) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        await window.appStore.importData(parsed);
        callback(null, 'Khôi phục dữ liệu thành công!');
      } catch (err) {
        callback(err, 'Lỗi định dạng file sao lưu không hợp lệ.');
      }
    };
    reader.onerror = () => callback(new Error('Lỗi khi đọc file'), 'Không thể đọc file.');
    reader.readAsText(file);
  },

  /**
   * In hóa đơn / phiếu bán hàng trực tiếp trên trình duyệt
   */
  printInvoice(sale) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Vui lòng cho phép popup để mở phiếu in hóa đơn.');
      return;
    }

    const storeName = window.appStore.state.settings.storeName || 'CỬA HÀNG CÁ NHÂN';
    const itemsHtml = (sale.items || []).map((it, idx) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${idx + 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">
          <strong>${it.productName}</strong>
          ${it.color ? `<span style="font-size: 11px; color: #6d28d9; margin-left: 4px;">[Màu: ${it.color}]</span>` : ''}
          ${it.size ? `<span style="font-size: 11px; color: #15803d; margin-left: 4px;">[Size: ${it.size}]</span>` : ''}
          ${it.sku ? `<div style="font-size: 11px; color: #666;">SKU: ${it.sku}</div>` : ''}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${it.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${Calculations.formatNumber(it.sellingPrice)} đ</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold;">${Calculations.formatNumber(it.quantity * it.sellingPrice)} đ</td>
      </tr>
    `).join('');

    const merchandiseTotal = (sale.items || []).reduce((sum, it) => sum + (it.quantity * it.sellingPrice), 0);
    const shipPayerText = sale.shippingPayer === 'shop' ? '(Shop miễn phí ship)' : '';

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <title>Hóa đơn ${sale.code}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 20px; color: #333; max-width: 650px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px dashed #999; padding-bottom: 15px; margin-bottom: 15px; }
          .store-name { font-size: 22px; font-weight: bold; text-transform: uppercase; color: #1e293b; }
          .invoice-title { font-size: 16px; margin: 8px 0; color: #475569; font-weight: 600; }
          .meta-grid { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 15px; }
          th { background: #f1f5f9; padding: 8px; text-align: left; border-bottom: 2px solid #cbd5e1; }
          .totals-table { width: 100%; font-size: 13px; }
          .totals-table td { padding: 4px 8px; }
          .footer { text-align: center; margin-top: 30px; border-top: 1px dashed #ccc; padding-top: 15px; font-size: 12px; color: #64748b; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="store-name">${storeName}</div>
          <div class="invoice-title">HÓA ĐƠN BÁN HÀNG</div>
          <div style="font-size: 12px; color: #666;">Mã đơn: <strong>${sale.code}</strong> | Ngày: ${Calculations.formatDate(sale.date)}</div>
        </div>

        <div class="meta-grid">
          <div>
            <div><strong>Khách hàng:</strong> ${sale.customerName}</div>
            ${sale.customerPhone ? `<div><strong>Điện thoại:</strong> ${sale.customerPhone}</div>` : ''}
          </div>
          <div style="text-align: right;">
            <div><strong>Kênh bán:</strong> ${sale.channel}</div>
            <div><strong>Thanh toán:</strong> ${sale.paymentStatus === 'paid' ? 'Đã thanh toán đủ' : (sale.paymentStatus === 'partial' ? `Khách cọc (${Calculations.formatNumber(sale.paidAmount)} đ)` : 'Nhận hàng thanh toán')}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">STT</th>
              <th>Mặt hàng</th>
              <th style="width: 60px; text-align: center;">SL</th>
              <th style="width: 100px; text-align: right;">Đơn giá</th>
              <th style="width: 110px; text-align: right;">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <table class="totals-table">
          <tr>
            <td style="text-align: right; width: 75%;">Tiền hàng:</td>
            <td style="text-align: right; font-weight: 500;">${Calculations.formatNumber(merchandiseTotal)} đ</td>
          </tr>
          ${sale.discount > 0 ? `
          <tr>
            <td style="text-align: right; color: #dc2626;">Chiết khấu / Giảm giá:</td>
            <td style="text-align: right; color: #dc2626;">-${Calculations.formatNumber(sale.discount)} đ</td>
          </tr>` : ''}
          ${sale.shippingFee > 0 ? `
          <tr>
            <td style="text-align: right;">Phí vận chuyển:</td>
            <td style="text-align: right;">${Calculations.formatNumber(sale.shippingFee)} đ <small style="color: #666;">${shipPayerText}</small></td>
          </tr>` : ''}
          <tr style="font-size: 16px; font-weight: bold; border-top: 1px solid #cbd5e1;">
            <td style="text-align: right; padding-top: 8px;">TỔNG THANH TOÁN:</td>
            <td style="text-align: right; padding-top: 8px; color: #0f172a;">${Calculations.formatCurrency(sale.totalAmount)}</td>
          </tr>
        </table>

        ${sale.notes ? `<div style="margin-top: 15px; font-size: 12px; font-style: italic; background: #f8fafc; padding: 8px; border-radius: 4px;">Ghi chú: ${sale.notes}</div>` : ''}

        <div class="footer">
          <p>Cảm ơn quý khách đã mua sắm và ủng hộ!</p>
          <p>Chúc quý khách một ngày tuyệt vời!</p>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
};
