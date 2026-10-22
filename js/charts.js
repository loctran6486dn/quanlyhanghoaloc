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

    const labels = ['Giá vốn (COGS)', 'Phí ship shop chịu', 'Chi phí vận hành'];
    const data = [
      Math.max(0, breakdown.cogs || 0),
      Math.max(0, breakdown.shopShipping || 0),
      Math.max(0, breakdown.operatingExpense || 0)
    ];
    const colors = ['#f59e0b', '#8b5cf6', '#ec4899'];

    const total = data.reduce((a, b) => a + b, 0);

    if (total === 0) {
      container.innerHTML = `
        <div style="height: 240px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 14px;">
          Chưa có phát sinh chi phí trong kỳ
        </div>
      `;
      return;
    }

    if (window.Chart) {
      if (this.chartInstances[containerId]) {
        this.chartInstances[containerId].destroy();
      }

      container.innerHTML = '<canvas id="breakdownChartCanvas" style="width: 100%; height: 260px;"></canvas>';
      const ctx = document.getElementById('breakdownChartCanvas').getContext('2d');

      this.chartInstances[containerId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const val = context.raw;
                  const pct = total > 0 ? ((val / total) * 100).toFixed(1) + '%' : '0%';
                  return `${context.label}: ${Calculations.formatCurrency(val)} (${pct})`;
                }
              }
            }
          }
        }
      });
      return;
    }

    // Fallback: Vẽ thanh tiến trình cơ cấu tỷ lệ phần trăm trực quan
    let barsHtml = `
      <div style="padding: 15px 0;">
        <div style="display: flex; height: 24px; border-radius: 12px; overflow: hidden; margin-bottom: 20px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
    `;

    data.forEach((val, idx) => {
      const pct = ((val / total) * 100).toFixed(1);
      if (val > 0) {
        barsHtml += `<div style="width: ${pct}%; background-color: ${colors[idx]};" title="${labels[idx]}: ${Calculations.formatCurrency(val)} (${pct}%)"></div>`;
      }
    });

    barsHtml += `</div><div style="display: flex; flex-direction: column; gap: 10px;">`;

    data.forEach((val, idx) => {
      const pct = ((val / total) * 100).toFixed(1);
      barsHtml += `
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="width: 12px; height: 12px; border-radius: 3px; background-color: ${colors[idx]}; display: inline-block;"></span>
            <span>${labels[idx]}</span>
          </div>
          <div style="font-weight: 600;">
            ${Calculations.formatCurrency(val)} <span style="color: #64748b; font-weight: normal;">(${pct}%)</span>
          </div>
        </div>
      `;
    });

    barsHtml += `</div></div>`;
    container.innerHTML = barsHtml;
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
