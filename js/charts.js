/**
 * charts.js - Vẽ Biểu Đồ Thống Kê Tài Chính (Hỗ trợ Chart.js và Tự Động Vẽ SVG Độc Lập Khi Offline)
 */

const ChartsManager = {
  chartInstances: {},

  /**
   * Vẽ biểu đồ xu hướng Doanh thu - Chi phí - Lợi nhuận
   */
  renderTrendChart(containerId, sales, purchases, cashflow, days = 7) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Chuẩn bị dữ liệu theo các ngày gần nhất
    const labels = [];
    const dateKeys = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const isoStr = d.toISOString().slice(0, 10);
      dateKeys.push(isoStr);
      labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
    }

    const revenueData = new Array(days).fill(0);
    const expenseData = new Array(days).fill(0);
    const profitData = new Array(days).fill(0);

    // Tính doanh thu và chi phí giá vốn theo ngày
    (sales || []).forEach(s => {
      if (s.status === 'cancelled') return;
      const idx = dateKeys.indexOf(s.date);
      if (idx !== -1) {
        const netRev = Math.max(0, (s.items || []).reduce((sum, it) => sum + (it.quantity * it.sellingPrice), 0) - (s.discount || 0));
        const cogs = Number(s.totalCOGS || 0);
        const shopShip = s.shippingPayer === 'shop' ? Number(s.shippingFee || 0) : 0;
        
        revenueData[idx] += netRev;
        expenseData[idx] += (cogs + shopShip);
        profitData[idx] += (netRev - cogs - shopShip);
      }
    });

    // Cộng thêm chi phí vận hành từ sổ quỹ
    (cashflow || []).forEach(c => {
      const idx = dateKeys.indexOf(c.date);
      if (idx !== -1) {
        const amt = Number(c.amount || 0);
        if (c.type === 'expense') {
          expenseData[idx] += amt;
          profitData[idx] -= amt;
        } else if (c.type === 'income') {
          revenueData[idx] += amt;
          profitData[idx] += amt;
        }
      }
    });

    // Kiểm tra nếu chưa có bất kỳ giao dịch nào
    const hasTrendData = revenueData.some(v => v !== 0) || expenseData.some(v => v !== 0) || profitData.some(v => v !== 0);
    if (!hasTrendData) {
      if (this.chartInstances[containerId]) {
        this.chartInstances[containerId].destroy();
        delete this.chartInstances[containerId];
      }
      container.innerHTML = `
        <div style="height: 240px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; font-size: 13.5px; text-align: center; padding: 20px;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: #f1f5f9; color: #94a3b8; display: flex; align-items: center; justify-content: center; margin-bottom: 12px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>
          <div style="font-weight: 700; color: #475569;">Chưa có dữ liệu giao dịch trong 7 ngày qua</div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Số liệu sẽ tự động hiển thị khi bạn tạo đơn bán hàng đầu tiên</div>
        </div>
      `;
      return;
    }

    // Kiểm tra nếu có Chart.js
    if (window.Chart) {
      if (this.chartInstances[containerId]) {
        this.chartInstances[containerId].destroy();
      }

      container.innerHTML = '<canvas id="trendChartCanvas" style="width: 100%; height: 280px;"></canvas>';
      const ctx = document.getElementById('trendChartCanvas').getContext('2d');

      this.chartInstances[containerId] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Doanh thu',
              data: revenueData,
              backgroundColor: 'rgba(99, 102, 241, 0.85)', // Indigo
              borderRadius: 8
            },
            {
              label: 'Tổng Chi phí',
              data: expenseData,
              backgroundColor: 'rgba(244, 63, 94, 0.8)', // Coral Rose
              borderRadius: 8
            },
            {
              label: 'Lợi nhuận',
              data: profitData,
              backgroundColor: 'rgba(16, 185, 129, 0.9)', // Emerald Mint
              borderRadius: 8
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return `${context.dataset.label}: ${Calculations.formatCurrency(context.raw)}`;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function(value) {
                  if (value >= 1000000) return (value / 1000000).toFixed(1) + ' tr';
                  if (value >= 1000) return (value / 1000).toFixed(0) + ' k';
                  return value;
                }
              }
            }
          }
        }
      });
      return;
    }

    // Fallback: Tự sinh SVG Bar Chart cực nhẹ, đẹp mắt, 100% độc lập không cần thư viện
    this.renderCustomSvgBarChart(container, labels, [
      { name: 'Doanh thu', data: revenueData, color: '#6366f1' },
      { name: 'Chi phí', data: expenseData, color: '#f43f5e' },
      { name: 'Lợi nhuận', data: profitData, color: '#10b981' }
    ]);
  },

  /**
   * Vẽ biểu đồ cơ cấu chi phí (Breakdown Pie/Donut Chart)
   */
  renderBreakdownChart(containerId, breakdown) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!breakdown) breakdown = {};

    const items = [
      { key: 'cogs', label: 'Giá vốn (COGS)', val: Math.max(0, breakdown.cogs || 0), color: '#f59e0b', lightBg: '#fef3c7', textColor: '#b45309' },
      { key: 'shopShipping', label: 'Phí ship shop chịu', val: Math.max(0, breakdown.shopShipping || 0), color: '#8b5cf6', lightBg: '#ede9fe', textColor: '#6d28d9' },
      { key: 'operatingExpense', label: 'Chi phí vận hành', val: Math.max(0, breakdown.operatingExpense || 0), color: '#ec4899', lightBg: '#fce7f3', textColor: '#be185d' }
    ];

    const total = items.reduce((sum, it) => sum + it.val, 0);

    // Xử lý khi chưa có dữ liệu chi phí nào (0 đ)
    if (total === 0) {
      container.innerHTML = `
        <div style="padding: 24px 16px; text-align: center; color: #94a3b8;">
          <div style="width: 100px; height: 100px; margin: 0 auto 12px; border-radius: 50%; border: 12px solid #f1f5f9; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; color: #cbd5e1;">
            0 đ
          </div>
          <div style="font-weight: 700; color: #475569; font-size: 13.5px; margin-bottom: 4px;">Chưa phát sinh chi phí</div>
          <div style="font-size: 12px; color: #94a3b8;">Khi có đơn bán hoặc chi phí trong kỳ, biểu đồ sẽ tự động phân tích tại đây.</div>
        </div>
      `;
      return;
    }

    const activeCount = items.filter(it => it.val > 0).length;

    // Danh sách chú thích chi tiết hiển thị bên dưới biểu đồ kèm số tiền và %
    const legendListHtml = `
      <div class="cost-breakdown-list" style="margin-top: 14px; display: flex; flex-direction: column; gap: 8px;">
        ${items.map(it => {
          const pctVal = total > 0 ? ((it.val / total) * 100).toFixed(1) : '0';
          const isZero = it.val === 0;
          return `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: ${isZero ? '#f8fafc' : '#ffffff'}; border-radius: 12px; border: 1.5px solid ${isZero ? '#f1f5f9' : '#e2e8f0'}; transition: all 0.15s ease;">
              <div style="display: flex; align-items: center; gap: 9px;">
                <span style="width: 12px; height: 12px; border-radius: 50%; background: ${it.color}; display: inline-block; flex-shrink: 0; box-shadow: 0 1px 3px ${it.color}44;"></span>
                <span style="font-size: 13px; font-weight: 700; color: ${isZero ? '#64748b' : '#1e293b'};">${it.label}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13px; font-weight: 800; color: ${isZero ? '#94a3b8' : '#0f172a'};">${Calculations.formatCurrency(it.val)}</span>
                <span style="font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 999px; background: ${isZero ? '#f1f5f9' : it.lightBg}; color: ${isZero ? '#94a3b8' : it.textColor}; min-width: 44px; text-align: center;">
                  ${pctVal}%
                </span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    if (window.Chart) {
      if (this.chartInstances[containerId]) {
        this.chartInstances[containerId].destroy();
      }

      container.innerHTML = `
        <div style="position: relative; width: 100%; height: 210px; margin: 0 auto;">
          <canvas id="breakdownChartCanvas"></canvas>
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; pointer-events: none; width: 130px;">
            <div style="font-size: 10.5px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Tổng chi phí</div>
            <div style="font-size: 17px; font-weight: 900; color: #09090b; line-height: 1.2;">${Calculations.formatCurrency(total)}</div>
          </div>
        </div>
        ${legendListHtml}
      `;

      const ctx = document.getElementById('breakdownChartCanvas').getContext('2d');

      // Khi chỉ có 1 thành phần duy nhất (100%), bỏ hoàn toàn viền trắng (borderWidth = 0) để không tạo vạch cắt đôi ở góc 12h
      const borderWidth = activeCount > 1 ? 2.5 : 0;

      this.chartInstances[containerId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: items.map(it => it.label),
          datasets: [{
            data: items.map(it => it.val),
            backgroundColor: items.map(it => it.color),
            borderWidth: borderWidth,
            borderColor: '#ffffff',
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          plugins: {
            legend: { display: false }, // Đã có danh sách chú thích thẻ đẹp phía dưới
            tooltip: {
              backgroundColor: '#18181b',
              titleFont: { size: 12, weight: 'bold' },
              bodyFont: { size: 13, weight: 'bold' },
              padding: 10,
              cornerRadius: 10,
              callbacks: {
                label: function(context) {
                  const val = context.raw;
                  const pct = total > 0 ? ((val / total) * 100).toFixed(1) + '%' : '0%';
                  return ` ${context.label}: ${Calculations.formatCurrency(val)} (${pct})`;
                }
              }
            }
          }
        }
      });
      return;
    }

    // Fallback khi không tải được Chart.js
    container.innerHTML = `
      <div style="padding: 10px 0;">
        <div style="text-align: center; margin-bottom: 12px;">
          <div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Tổng chi phí</div>
          <div style="font-size: 18px; font-weight: 900; color: #0f172a;">${Calculations.formatCurrency(total)}</div>
        </div>
        <div style="display: flex; height: 20px; border-radius: 10px; overflow: hidden; margin-bottom: 16px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
          ${items.filter(it => it.val > 0).map(it => {
            const pct = ((it.val / total) * 100).toFixed(1);
            return `<div style="width: ${pct}%; background-color: ${it.color};" title="${it.label}: ${Calculations.formatCurrency(it.val)} (${pct}%)"></div>`;
          }).join('')}
        </div>
        ${legendListHtml}
      </div>
    `;
  },

  /**
   * Tự tạo SVG Bar Chart mượt mà khi không có thư viện bên ngoài
   */
  renderCustomSvgBarChart(container, labels, series) {
    const width = container.clientWidth || 500;
    const height = 260;
    const paddingLeft = 45;
    const paddingRight = 15;
    const paddingTop = 25;
    const paddingBottom = 40;

    const chartW = width - paddingLeft - paddingRight;
    const chartH = height - paddingTop - paddingBottom;

    // Tìm giá trị max
    let maxVal = 100000;
    series.forEach(s => {
      s.data.forEach(v => {
        if (v > maxVal) maxVal = v;
      });
    });

    const numGroups = labels.length;
    const groupW = chartW / numGroups;
    const barW = Math.max(4, (groupW - 14) / series.length);

    let barsSvg = '';

    labels.forEach((label, gIdx) => {
      const groupX = paddingLeft + (gIdx * groupW);

      series.forEach((s, sIdx) => {
        const val = Math.max(0, s.data[gIdx] || 0);
        const barH = (val / maxVal) * chartH;
        const x = groupX + 7 + (sIdx * barW);
        const y = paddingTop + chartH - barH;

        barsSvg += `
          <rect x="${x}" y="${y}" width="${barW - 2}" height="${barH}" fill="${s.color}" rx="2">
            <title>${s.name}: ${Calculations.formatCurrency(val)}</title>
          </rect>
        `;
      });

      // Nhãn ngày ở đáy
      barsSvg += `
        <text x="${groupX + (groupW / 2)}" y="${height - 15}" text-anchor="middle" font-size="11" fill="#64748b">
          ${label}
        </text>
      `;
    });

    // Đường lưới ngang
    let gridSvg = '';
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const y = paddingTop + (chartH / steps) * i;
      const gridVal = maxVal * (1 - (i / steps));
      const valStr = gridVal >= 1000000 ? (gridVal / 1000000).toFixed(1) + 'M' : (gridVal / 1000).toFixed(0) + 'k';

      gridSvg += `
        <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="#e2e8f0" stroke-dasharray="3,3" />
        <text x="${paddingLeft - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="#94a3b8">${valStr}</text>
      `;
    }

    // Chú thích (Legend)
    let legendHtml = `
      <div style="display: flex; justify-content: center; gap: 16px; margin-bottom: 8px; font-size: 12px;">
        ${series.map(s => `
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="width: 10px; height: 10px; border-radius: 2px; background-color: ${s.color};"></span>
            <span>${s.name}</span>
          </div>
        `).join('')}
      </div>
    `;

    container.innerHTML = `
      ${legendHtml}
      <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow: visible;">
        ${gridSvg}
        ${barsSvg}
      </svg>
    `;
  }
};
