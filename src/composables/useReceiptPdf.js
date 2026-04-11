import html2pdf from "html2pdf.js";

/**
 * Composable for handling receipt PDF generation and printing
 * @returns {Object} - { generatePDF, printReceipt }
 */
export function useReceiptPdf() {
  /**
   * Generate PDF from receipt element
   * @param {string} orderNumber - Order number for filename
   * @returns {Promise<void>}
   */
  async function generatePDF(orderNumber) {
    const receiptElement = document.getElementById("receipt-container");

    if (!receiptElement) {
      console.error("Receipt container not found");
      return;
    }

    // Configure PDF options
    const pdfOptions = {
      margin: 0,
      filename: `receipt-${orderNumber}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: {
        orientation: "portrait",
        unit: "mm",
        format: "a4", // Can be changed to thermal printer size
        compress: true,
      },
    };

    try {
      // Generate and download PDF
      await html2pdf().set(pdfOptions).from(receiptElement).save();
    } catch (error) {
      console.error("Error generating PDF:", error);
      throw new Error("Failed to generate PDF. Please try again.");
    }
  }

  /**
   * Print receipt using browser print dialog
   * @param {string} orderNumber - Order number (for reference)
   * @returns {void}
   */
  function printReceipt(orderNumber) {
    const receiptElement = document.getElementById("receipt-container");

    if (!receiptElement) {
      console.error("Receipt container not found");
      return;
    }

    // Create a new window for printing
    const printWindow = window.open("", "", "width=800,height=600");

    if (!printWindow) {
      alert(
        "Please allow pop-ups to enable the print feature. Then try again.",
      );
      return;
    }

    // Clone the receipt element for printing
    const receiptClone = receiptElement.cloneNode(true);

    // Write HTML to print window
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Receipt - ${orderNumber}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: 'Courier New', monospace;
              background: white;
              padding: 20px;
              color: #1e293b;
            }

            #receipt-container {
              width: 80mm;
              max-width: 100%;
              margin: 0 auto;
              background: white;
              padding: 20px;
              font-size: 13px;
              line-height: 1.5;
            }

            h1 {
              font-size: 20px;
              font-weight: bold;
              margin: 0;
            }

            .text-center {
              text-align: center;
            }

            .text-left {
              text-align: left;
            }

            .text-right {
              text-align: right;
            }

            .border-b {
              border-bottom: 1px solid #cbd5e1;
            }

            .border-b-2 {
              border-bottom: 2px solid #cbd5e1;
            }

            .space-y-2 > * + * {
              margin-top: 8px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
            }

            thead tr {
              border-bottom: 1px solid #cbd5e1;
              font-weight: bold;
            }

            th, td {
              padding: 4px;
              text-align: left;
            }

            th {
              text-align: left;
              font-weight: bold;
              font-size: 11px;
            }

            tbody tr {
              border-bottom: 1px solid #ede9de;
            }

            .font-bold {
              font-weight: bold;
            }

            .font-semibold {
              font-weight: 600;
            }

            .text-xs {
              font-size: 11px;
            }

            .text-sm {
              font-size: 12px;
            }

            .text-slate-600 {
              color: #475569;
            }

            .text-slate-700 {
              color: #334155;
            }

            .text-slate-900 {
              color: #0f172a;
            }

            .text-emerald-600 {
              color: #059669;
            }

            .text-emerald-700 {
              color: #047857;
            }

            .bg-slate-50 {
              background-color: #f8fafc;
              padding: 8px;
              border-radius: 4px;
              margin-top: 4px;
            }

            .mb-2 { margin-bottom: 8px; }
            .mb-4 { margin-bottom: 16px; }
            .mb-6 { margin-bottom: 24px; }
            .mt-1 { margin-top: 4px; }
            .mt-2 { margin-top: 8px; }
            .mt-4 { margin-top: 16px; }
            .pt-2 { padding-top: 8px; }
            .pb-4 { padding-bottom: 16px; }
            .py-1 { padding-top: 4px; padding-bottom: 4px; }
            .py-2 { padding-top: 8px; padding-bottom: 8px; }
            .p-2 { padding: 8px; }

            .tracking-wide {
              letter-spacing: 0.05em;
            }

            .uppercase {
              text-transform: uppercase;
            }

            @media print {
              body {
                margin: 0;
                padding: 0;
              }

              #receipt-container {
                width: 80mm;
                page-break-after: avoid;
              }
            }
          </style>
        </head>
        <body>
          ${receiptClone.outerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();

    // Wait for content to load, then trigger print
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }

  return {
    generatePDF,
    printReceipt,
  };
}
