import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export interface CartItem {
  id: string;
  description: string;
  brand: string;
  supplier: string;
  unitOfMeasure: string;
  unitPrice: number;
  quantity: number;
  date: Date;
  markup?: number;
}

const CONSULDATA_LOGO_URL = 'https://www.consuldata.com.br/wp-content/uploads/2022/08/LOGO-SITE-1.png';

const getBase64ImageFromUrl = async (url: string): Promise<string> => {
  const fetchWithTimeout = async (resource: string, options: RequestInit & { timeout?: number } = {}) => {
    const { timeout = 5000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal  
    });
    clearTimeout(id);
    return response;
  };

  try {
    // Try via proxy first to bypass CORS
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const res = await fetchWithTimeout(proxyUrl);
    
    if (!res.ok) throw new Error('Proxy failed');
    
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("Failed to load logo via proxy, trying direct...", e);
    try {
      // Fallback to direct fetch (might fail due to CORS, but worth trying)
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error('Direct fetch failed');
      
      const blob = await res.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e2) {
      console.error("Failed to load logo completely", e2);
      return '';
    }
  }
};

export const exportToPDF = async (items: CartItem[], total: number) => {
  try {
    const doc = new jsPDF();
    
    // Try to add logo
    try {
      const logoBase64 = await getBase64ImageFromUrl(CONSULDATA_LOGO_URL);
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', 14, 10, 40, 15);
      } else {
        doc.setFontSize(20);
        doc.setTextColor(30, 139, 195); // ConsulData Blue
        doc.text("ConsulData", 14, 20);
      }
    } catch (e) {
      doc.setFontSize(20);
      doc.setTextColor(30, 139, 195);
      doc.text("ConsulData", 14, 20);
    }

    doc.setFontSize(16);
    doc.setTextColor(51, 51, 51);
    doc.text("Prévia de Cotação / Pedido", 14, 35);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Data de Geração: ${new Date().toLocaleDateString('pt-BR')}`, 14, 42);

    const tableColumn = ["Descrição", "Marca", "Fornecedor", "UN", "Qtd", "Preço Forn.", "Subtotal Forn.", "Margem", "Preço Final", "Subtotal Final"];
    const tableRows = items.map(item => {
      const markup = item.markup || 0;
      const finalUnitPrice = item.unitPrice * (1 + markup / 100);
      return [
        item.description,
        item.brand || '-',
        item.supplier,
        item.unitOfMeasure,
        item.quantity.toString(),
        `R$ ${item.unitPrice.toFixed(2)}`,
        `R$ ${(item.unitPrice * item.quantity).toFixed(2)}`,
        `${markup}%`,
        `R$ ${finalUnitPrice.toFixed(2)}`,
        `R$ ${(finalUnitPrice * item.quantity).toFixed(2)}`
      ];
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 50,
      theme: 'striped',
      headStyles: { fillColor: [0, 32, 96], textColor: [255, 255, 255] }, // ConsulData Dark Blue
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 40 }, // Descrição
        1: { cellWidth: 15 }, // Marca
        2: { cellWidth: 20 }, // Fornecedor
        3: { cellWidth: 8 }, // UN
        4: { cellWidth: 8, halign: 'center' }, // Qtd
        5: { cellWidth: 18, halign: 'right' }, // Preço Forn.
        6: { cellWidth: 18, halign: 'right' }, // Subtotal Forn.
        7: { cellWidth: 12, halign: 'center' }, // Margem
        8: { cellWidth: 18, halign: 'right' }, // Preço Final
        9: { cellWidth: 18, halign: 'right' }, // Subtotal Final
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 50;
    
    // Calculate totals
    const totalForn = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const totalFinal = items.reduce((sum, item) => sum + (item.unitPrice * (1 + (item.markup || 0) / 100) * item.quantity), 0);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Total Fornecedor: R$ ${totalForn.toFixed(2)}`, 14, finalY + 10);
    
    doc.setFontSize(12);
    doc.setTextColor(0, 32, 96); // ConsulData Dark Blue
    doc.setFont("helvetica", "bold");
    doc.text(`Total Estimado Final: R$ ${totalFinal.toFixed(2)}`, 14, finalY + 16);

    // Footer
    const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text("Desenvolvido por Jucimar Lopes", doc.internal.pageSize.width - 60, pageHeight - 10);

    doc.save(`cotacao_consuldata_${new Date().getTime()}.pdf`);
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    alert("Ocorreu um erro ao gerar o PDF. Verifique o console para mais detalhes.");
  }
};

export const exportToExcel = async (items: CartItem[], total: number) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Cotação');

    // Add Logo
    try {
      const logoBase64 = await getBase64ImageFromUrl(CONSULDATA_LOGO_URL);
      if (logoBase64) {
        const imageId = workbook.addImage({
          base64: logoBase64,
          extension: 'png',
        });
        worksheet.addImage(imageId, {
          tl: { col: 0, row: 0 },
          ext: { width: 140, height: 40 }
        });
      }
    } catch (e) {
      console.error("Failed to add logo to Excel", e);
    }

    // Title
    worksheet.mergeCells('D1:H2');
    const titleCell = worksheet.getCell('D1');
    titleCell.value = 'ConsulData - Prévia de Cotação';
    titleCell.font = { size: 16, bold: true, color: { argb: 'FF002060' } }; // ConsulData Dark Blue
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Adjust row heights for the header area
    worksheet.getRow(1).height = 25;
    worksheet.getRow(2).height = 25;
    worksheet.getRow(3).height = 15; // Spacer

    // Headers start at row 4
    const headerRow = worksheet.getRow(4);
    headerRow.values = [
      'Descrição', 'Marca', 'Fornecedor', 'Data Cotação', 'UN', 'Quantidade', 'Preço Forn. (R$)', 'Subtotal Forn. (R$)', 'Margem (%)', 'Preço Final (R$)', 'Subtotal Final (R$)'
    ];
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF002060' } // ConsulData Dark Blue
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Data
    items.forEach((item, index) => {
      const row = worksheet.getRow(5 + index);
      const markup = item.markup || 0;
      const finalUnitPrice = item.unitPrice * (1 + markup / 100);
      
      row.values = [
        item.description,
        item.brand || '-',
        item.supplier,
        item.date.toLocaleDateString('pt-BR'),
        item.unitOfMeasure,
        item.quantity,
        item.unitPrice,
        item.unitPrice * item.quantity,
        markup / 100, // Excel percentage format expects 0.1 for 10%
        finalUnitPrice,
        finalUnitPrice * item.quantity
      ];
      
      // Format numbers
      row.getCell(6).alignment = { horizontal: 'center' };
      row.getCell(7).numFmt = '"R$" #,##0.00';
      row.getCell(8).numFmt = '"R$" #,##0.00';
      row.getCell(9).numFmt = '0.00%';
      row.getCell(9).alignment = { horizontal: 'center' };
      row.getCell(10).numFmt = '"R$" #,##0.00';
      row.getCell(11).numFmt = '"R$" #,##0.00';
      
      // Alternate row colors
      if (index % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9FAFB' } // Tailwind gray-50
        };
      }
    });

    // Total
    const totalRowIndex = 5 + items.length;
    
    const totalForn = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const totalFinal = items.reduce((sum, item) => sum + (item.unitPrice * (1 + (item.markup || 0) / 100) * item.quantity), 0);

    const totalRow = worksheet.getRow(totalRowIndex);
    totalRow.getCell(1).value = 'TOTAL ESTIMADO';
    totalRow.getCell(1).font = { bold: true, color: { argb: 'FF002060' } };
    
    totalRow.getCell(8).value = totalForn;
    totalRow.getCell(8).font = { bold: true, color: { argb: 'FF002060' } };
    totalRow.getCell(8).numFmt = '"R$" #,##0.00';

    totalRow.getCell(11).value = totalFinal;
    totalRow.getCell(11).font = { bold: true, color: { argb: 'FF002060' } };
    totalRow.getCell(11).numFmt = '"R$" #,##0.00';

    // Column widths
    worksheet.columns = [
      { width: 40 }, // Descrição
      { width: 15 }, // Marca
      { width: 20 }, // Fornecedor
      { width: 15 }, // Data Cotação
      { width: 10 }, // UN
      { width: 12 }, // Quantidade
      { width: 18 }, // Preço Forn.
      { width: 18 }, // Subtotal Forn.
      { width: 12 }, // Margem
      { width: 18 }, // Preço Final
      { width: 18 }, // Subtotal Final
    ];

    // Footer
    worksheet.getCell(`A${totalRowIndex + 2}`).value = 'Desenvolvido por Jucimar Lopes';
    worksheet.getCell(`A${totalRowIndex + 2}`).font = { italic: true, color: { argb: 'FF888888' } };

    // Generate and save
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `cotacao_consuldata_${new Date().getTime()}.xlsx`);
  } catch (error) {
    console.error("Erro ao gerar Excel:", error);
    alert("Ocorreu um erro ao gerar o Excel. Verifique o console para mais detalhes.");
  }
};
