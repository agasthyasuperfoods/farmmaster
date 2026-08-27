export interface InvoiceOrder {
  _id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  deliveryDate?: string | null;
  deliverySlot?: string | null;
  customerId?: {
    _id?: string;
    name?: string;
    phone?: string;
    email?: string;
  };
  address?: {
    label?: string;
    fullAddress?: string;
    flat?: string;
    landmark?: string;
    pincode?: string;
  } | string;
  items: Array<{
    _id?: string;
    product?: string;
    name: string;
    price: number;
    quantity: number;
  }>;
}

export function downloadOrderInvoice(order: InvoiceOrder) {
  const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const invoiceNo = `INV-${order.orderNumber}`;
  const customerName = order.customerId?.name || 'Valued Customer';
  const customerPhone = order.customerId?.phone || 'N/A';
  const customerEmail = order.customerId?.email || '';

  let addressStr = 'N/A';
  if (typeof order.address === 'string') {
    addressStr = order.address;
  } else if (order.address && typeof order.address === 'object') {
    addressStr = [
      order.address.label ? `[${order.address.label}]` : '',
      order.address.flat,
      order.address.fullAddress,
      order.address.landmark ? `Landmark: ${order.address.landmark}` : '',
      order.address.pincode ? `PIN: ${order.address.pincode}` : ''
    ].filter(Boolean).join(', ');
  }

  const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = 0;
  const grandTotal = subtotal + deliveryFee;

  const itemsHtml = order.items.map((item, index) => {
    const itemTotal = item.price * item.quantity;
    return `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">${index + 1}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 700; color: #1e293b;">${item.name}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; color: #475569;">₹${item.price.toFixed(2)}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: center; font-weight: 700; color: #1e293b;">${item.quantity}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; font-weight: 700; color: #0f172a;">₹${itemTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice #${order.orderNumber} - Agasthya Super Foods</title>
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background: #f8fafc;
      padding: 24px;
    }
    .invoice-card {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 40px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.05);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 24px;
      border-bottom: 2px solid #f1f5f9;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .brand-sub {
      font-size: 12px;
      color: #64748b;
      font-weight: 600;
      margin-top: 4px;
    }
    .badge {
      display: inline-block;
      padding: 6px 14px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1d4ed8;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-align: right;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin: 28px 0;
    }
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 18px;
    }
    .meta-box h4 {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #94a3b8;
      font-weight: 800;
      margin-bottom: 8px;
    }
    .meta-box p {
      font-size: 13px;
      color: #334155;
      line-height: 1.5;
    }
    .meta-box .highlight {
      font-weight: 800;
      color: #0f172a;
      font-size: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
    }
    thead th {
      background: #f1f5f9;
      padding: 12px 16px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #475569;
    }
    .summary-section {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }
    .summary-box {
      width: 280px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 18px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      margin-bottom: 8px;
      color: #64748b;
      font-weight: 600;
    }
    .summary-total {
      display: flex;
      justify-content: space-between;
      font-size: 16px;
      font-weight: 900;
      color: #0f172a;
      padding-top: 10px;
      border-top: 2px dashed #cbd5e1;
      margin-top: 10px;
    }
    .footer {
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #94a3b8;
    }
    .actions {
      text-align: center;
      margin-top: 24px;
    }
    .print-btn {
      background: #0f172a;
      color: #ffffff;
      border: none;
      padding: 12px 28px;
      font-size: 14px;
      font-weight: 700;
      border-radius: 12px;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.25);
      transition: all 0.2s;
    }
    .print-btn:hover {
      background: #1e293b;
      transform: translateY(-1px);
    }
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .invoice-card {
        border: none;
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
      .actions {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <div style="display: flex; align-items: center; gap: 14px;">
        <img src="/logo.png" alt="Agasthya Nutromilk" style="width: 52px; height: 52px; object-fit: contain;" onerror="this.style.display='none'" />
        <div>
          <h1 class="brand-title">Agasthya Nutromilk</h1>
          <p class="brand-sub">Pure & Fresh Farm Milk • Premium Dairy</p>
        </div>
      </div>
      <div class="badge">
        <div>TAX INVOICE</div>
        <div style="font-size: 11px; color: #475569; margin-top: 2px;">#${order.orderNumber}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-box">
        <h4>Customer & Shipping Details</h4>
        <p class="highlight">${customerName}</p>
        <p>Phone: <strong>${customerPhone}</strong></p>
        ${customerEmail ? `<p>Email: ${customerEmail}</p>` : ''}
        <p style="margin-top: 6px; color: #64748b;">${addressStr}</p>
      </div>
      <div class="meta-box">
        <h4>Order & Payment Info</h4>
        <p>Invoice No: <strong>${invoiceNo}</strong></p>
        <p>Order Date: <strong>${orderDate}</strong></p>
        ${order.deliveryDate ? `<p>Delivery Date: <strong>${order.deliveryDate}</strong></p>` : ''}
        ${order.deliverySlot ? `<p>Delivery Slot: <strong>${order.deliverySlot}</strong></p>` : ''}
        <p>Status: <strong style="text-transform: uppercase; color: #1d4ed8;">${order.status}</strong></p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="text-align: left; width: 40px;">#</th>
          <th style="text-align: left;">Product Description</th>
          <th style="text-align: right; width: 100px;">Unit Price</th>
          <th style="text-align: center; width: 60px;">Qty</th>
          <th style="text-align: right; width: 120px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="summary-section">
      <div class="summary-box">
        <div class="summary-row">
          <span>Subtotal:</span>
          <span style="color: #0f172a; font-weight: 700;">₹${subtotal.toFixed(2)}</span>
        </div>
        <div class="summary-row">
          <span>Delivery Charges:</span>
          <span style="color: #16a34a; font-weight: 700;">FREE</span>
        </div>
        <div class="summary-total">
          <span>Grand Total:</span>
          <span style="color: #1d4ed8;">₹${grandTotal.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      <div>Thank you for choosing Agasthya Nutromilk!</div>
      <div>Computer generated invoice &bull; Valid without signature</div>
    </div>
  </div>

  <div class="actions">
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>

  <script>
    window.onload = function() {
      // Auto-trigger print dialog after small delay if needed
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  } else {
    // If pop-up blocked, fallback to iframe printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 500);
    }
  }
}
