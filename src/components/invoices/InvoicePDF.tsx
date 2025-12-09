import { type Invoice } from "./InvoiceCard";

interface Project {
  name: string;
  fee: number;
}

interface UserProfile {
  full_name?: string;
  email?: string;
  phone?: string;
  company_name?: string;
}

export const generateInvoicePDF = async (
  invoice: Invoice,
  projects: Project[],
  clientName: string,
  userProfile?: UserProfile
) => {
  const invoiceDate = new Date(invoice.created_at).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  // Derive month from invoice.month or fallback to created_at date
  const invoiceMonth = invoice.month || new Date(invoice.created_at).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }) : null;

  const invoiceNumber = invoice.invoice_number || `INV-${invoice.id.slice(0, 8).toUpperCase()}`;

  const projectRows = projects.map(project => `
    <tr>
      <td>${project.name}</td>
      <td class="amount">₹${Number(project.fee).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
    </tr>
  `).join('');

  // Calculate deductions if any
  const totalProjectFee = projects.reduce((sum, p) => sum + Number(p.fee || 0), 0);
  const deduction = totalProjectFee - Number(invoice.total_amount);
  const hasDeduction = deduction > 0;

  const statusClass = invoice.status === 'paid' ? 'paid' : invoice.status === 'pending' ? 'pending' : 'draft';
  const statusLabel = invoice.status === 'paid' ? 'Paid' : invoice.status === 'pending' ? 'Pending' : 'Draft';

  const invoiceHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice - ${invoiceNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          padding: 40px; 
          background: #f5f5f5; 
          color: #333;
        }
        .invoice { 
          max-width: 800px; 
          margin: 0 auto; 
          background: white; 
          padding: 40px; 
          border-radius: 12px; 
          box-shadow: 0 4px 20px rgba(0,0,0,0.1); 
        }
        .header { 
          display: flex; 
          justify-content: space-between; 
          align-items: flex-start; 
          margin-bottom: 40px; 
          border-bottom: 3px solid #22c55e; 
          padding-bottom: 20px; 
        }
        .logo { 
          font-size: 28px; 
          font-weight: bold; 
          color: #22c55e; 
        }
        .logo span { color: #333; }
        .invoice-info { text-align: right; }
        .invoice-info h2 { 
          font-size: 28px; 
          color: #333; 
          margin-bottom: 8px; 
          letter-spacing: 2px;
        }
        .invoice-info p { color: #666; font-size: 14px; margin: 4px 0; }
        .invoice-info strong { color: #22c55e; }
        .section { margin-bottom: 30px; }
        .section-title { 
          font-size: 12px; 
          font-weight: 600; 
          color: #888; 
          text-transform: uppercase; 
          letter-spacing: 1px;
          margin-bottom: 10px; 
        }
        .details-grid { 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 40px; 
        }
        .detail-box p { margin: 6px 0; color: #555; font-size: 14px; }
        .detail-box strong { color: #111; font-size: 16px; }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 10px; 
        }
        th { 
          background: #f8f9fa; 
          padding: 14px 16px; 
          text-align: left; 
          font-size: 12px; 
          font-weight: 600;
          color: #666; 
          text-transform: uppercase;
          letter-spacing: 1px;
          border-bottom: 2px solid #e9ecef; 
        }
        td { 
          padding: 16px; 
          border-bottom: 1px solid #f0f0f0; 
          color: #333;
          font-size: 14px;
        }
        .amount { text-align: right; font-weight: 600; color: #111; }
        .subtotal-row td { 
          padding-top: 20px; 
          font-weight: 500;
          border-bottom: none;
        }
        .deduction-row td { 
          color: #f59e0b;
          font-weight: 500;
          border-bottom: none;
        }
        .total-row td { 
          font-size: 18px; 
          font-weight: bold; 
          border-top: 3px solid #22c55e; 
          padding-top: 20px;
          color: #22c55e;
        }
        .status { 
          display: inline-block; 
          padding: 6px 16px; 
          border-radius: 20px; 
          font-size: 12px; 
          font-weight: 600; 
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .status.paid { background: #dcfce7; color: #166534; }
        .status.pending { background: #fef3c7; color: #92400e; }
        .status.draft { background: #f3f4f6; color: #6b7280; }
        .payment-info {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin-top: 20px;
        }
        .payment-info h4 {
          font-size: 14px;
          color: #333;
          margin-bottom: 12px;
        }
        .payment-row {
          display: flex;
          justify-content: space-between;
          margin: 8px 0;
          font-size: 14px;
        }
        .payment-row span:first-child { color: #666; }
        .payment-row span:last-child { font-weight: 600; color: #333; }
        .notes-box {
          background: #fffbeb;
          border: 1px solid #fef3c7;
          padding: 16px;
          border-radius: 8px;
          margin-top: 20px;
        }
        .notes-box h4 {
          font-size: 12px;
          color: #92400e;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }
        .notes-box p {
          font-size: 14px;
          color: #78350f;
          white-space: pre-wrap;
        }
        .footer { 
          margin-top: 40px; 
          padding-top: 20px; 
          border-top: 1px solid #e9ecef; 
          text-align: center; 
          color: #888; 
          font-size: 12px; 
        }
        .footer p { margin: 4px 0; }
        @media print { 
          body { padding: 0; background: white; } 
          .invoice { box-shadow: none; } 
        }
      </style>
    </head>
    <body>
      <div class="invoice">
        <div class="header">
          <div class="logo">${userProfile?.company_name || ''}</div>
          <div class="invoice-info">
            <h2>INVOICE</h2>
            <p><strong>${invoiceNumber}</strong></p>
            <p>Date: ${invoiceDate}</p>
            ${dueDate ? `<p>Due: ${dueDate}</p>` : ''}
            <p style="margin-top: 8px;"><span class="status ${statusClass}">${statusLabel}</span></p>
          </div>
        </div>
        
        <div class="section">
          <div class="details-grid">
            <div class="detail-box">
              <div class="section-title">From</div>
              <p><strong>${userProfile?.full_name || 'Service Provider'}</strong></p>
              ${userProfile?.email ? `<p>${userProfile.email}</p>` : ''}
              ${userProfile?.phone ? `<p>${userProfile.phone}</p>` : ''}
              ${userProfile?.company_name ? `<p>${userProfile.company_name}</p>` : ''}
            </div>
            <div class="detail-box">
              <div class="section-title">Invoice To</div>
              <p><strong>${clientName}</strong></p>
              <p>Month: ${invoiceMonth}</p>
            </div>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">Projects</div>
          <table>
            <thead>
              <tr>
                <th>Project Name</th>
                <th class="amount">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.monthly_fee && Number(invoice.monthly_fee) > 0 ? `
              <tr>
                <td>Monthly Fee / Retainer</td>
                <td class="amount">₹${Number(invoice.monthly_fee).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
              ` : ''}
              ${projectRows}
              ${hasDeduction ? `
              <tr class="subtotal-row">
                <td>Subtotal</td>
                <td class="amount">₹${totalProjectFee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr class="deduction-row">
                <td>Advance Deduction</td>
                <td class="amount">-₹${deduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
              ` : ''}
              <tr class="total-row">
                <td>Total Amount</td>
                <td class="amount">₹${Number(invoice.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>

        ${(invoice.paid_amount && Number(invoice.paid_amount) > 0) ? `
        <div class="payment-info">
          <h4>Payment Summary</h4>
          <div class="payment-row">
            <span>Total Amount</span>
            <span>₹${Number(invoice.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="payment-row">
            <span>Paid Amount</span>
            <span style="color: #22c55e;">₹${Number(invoice.paid_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="payment-row">
            <span>Remaining Amount</span>
            <span style="color: ${Number(invoice.remaining_amount) > 0 ? '#ef4444' : '#22c55e'};">
              ₹${Number(invoice.remaining_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          ${invoice.payment_method ? `
          <div class="payment-row">
            <span>Payment Method</span>
            <span>${invoice.payment_method}</span>
          </div>
          ` : ''}
          ${invoice.paid_date ? `
          <div class="payment-row">
            <span>Paid Date</span>
            <span>${new Date(invoice.paid_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
          ` : ''}
        </div>
        ` : ''}

        ${invoice.notes ? `
        <div class="notes-box">
          <h4>Notes</h4>
          <p>${invoice.notes}</p>
        </div>
        ` : ''}
        
        <div class="footer">
          <p>Thank you for your business!</p>
          <p style="margin-top: 8px; color: #aaa;">This is a computer-generated invoice and does not require a signature.</p>
          <p style="margin-top: 12px; font-size: 11px; color: #22c55e;">Created with XrozenWorkflow</p>
        </div>
      </div>
      <script>
        document.title = 'Invoice - ${invoiceNumber}';
        window.print();
      </script>
    </body>
    </html>
  `;

  // Open invoice in new window for printing
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(invoiceHTML);
    printWindow.document.close();
  }
};
