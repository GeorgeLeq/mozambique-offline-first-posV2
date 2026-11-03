import React from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Product } from '../../../lib/api';
import { getDB } from '../../../lib/db';
import toast from 'react-hot-toast';
import { checkProductCatalogLimit } from '../services/productLimitService';

export function exportProductsPDF(products: Product[], isAdminUnlocked: boolean) {
  if (products.length === 0) {
    toast.error('Nenhum produto para exportar.');
    return;
  }
  const doc = new jsPDF();
  doc.text('Catálogo de Produtos', 14, 15);
  
  const tableData = products.map(p => [
    p.barcode,
    p.name,
    p.category || '-',
    isAdminUnlocked ? `${p.cost_price_mt || 0} MT` : 'RESTRITO',
    `${p.price_mt} MT`,
    p.stock_quantity || 0,
    p.is_fractional ? 'Sim' : 'Não'
  ]);
  
  autoTable(doc, {
    startY: 20,
    head: [['Código de Barras', 'Nome do Produto', 'Categoria', 'Preço Custo', 'Preço Venda', 'Stock', 'A Granel']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [79, 70, 229] }
  });
  
  doc.save(`catalogo_produtos_${new Date().toISOString().split('T')[0]}.pdf`);
  toast.success('Catálogo PDF gerado com sucesso!');
}

export function exportProductsCSV(products: Product[], isAdminUnlocked: boolean) {
  if (products.length === 0) {
    toast.error('Nenhum produto para exportar.');
    return;
  }
  const headers = ['id', 'barcode', 'name', 'category', 'price_mt', 'cost_price_mt', 'stock_quantity', 'min_stock_alert', 'is_fractional'];
  const csvContent = [
    headers.join(';'),
    ...products.map(p => 
      [
        p.id,
        p.barcode,
        `"${(p.name || '').replace(/"/g, '""')}"`,
        `"${(p.category || '').replace(/"/g, '""')}"`,
        p.price_mt,
        isAdminUnlocked ? (p.cost_price_mt ?? 0) : 0,
        p.stock_quantity ?? 0,
        p.min_stock_alert ?? 0,
        p.is_fractional ? 1 : 0
      ].join(';')
    )
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `produtos_${new Date().toISOString().split('T')[0]}.csv`);
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast.success('Ficheiro CSV exportado com sucesso!');
}

export function downloadCSVTemplate() {
  const csvContent = "barcode;name;category;price_mt;cost_price_mt;stock_quantity;min_stock_alert;is_fractional\n5601234567890;Produto Exemplo;Bebidas;150.00;100.00;50;10;0\n";
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'modelo_importacao_produtos.csv');
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast.success('Modelo CSV descarregado com sucesso!');
}

export async function importProductsCSV(
  e: React.ChangeEvent<HTMLInputElement>, 
  onSuccess: () => void,
  onQuotaExceeded?: () => void
) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    const text = event.target?.result as string;
    if (!text) return;
    
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length <= 1) {
      toast.error('O arquivo parece estar vazio ou sem dados.');
      return;
    }
    
    // Detect separator (comma or semicolon)
    const separator = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(separator).map(h => h.trim().toLowerCase());
    const expectedHeaders = ['barcode', 'name', 'price_mt'];
    
    const missing = expectedHeaders.filter(h => !headers.includes(h));
    if (missing.length > 0) {
      toast.error(`Cabeçalhos ausentes obrigatórios: ${missing.join(', ')}`);
      return;
    }

    try {
      const db = await getDB();
      let importedCount = 0;
      let limitHit = false;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        // Split by the detected separator, ignoring separators inside quotes
        const regex = separator === ';' 
          ? /;(?=(?:(?:[^"]*"){2})*[^"]*$)/
          : /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
        
        const values = line.split(regex).map(v => v.replace(/^"|"$/g, '').trim());

        if (values.length < headers.length) continue;

        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });

        const barcode = row.barcode;
        const name = row.name;
        const category = row.category || 'Geral';
        const price_mt = parseFloat(row.price_mt || '0');
        const cost_price_mt = parseFloat(row.cost_price_mt || '0');
        const stock_quantity = parseFloat(row.stock_quantity || '0');
        const min_stock_alert = parseFloat(row.min_stock_alert || '5');
        const is_fractional = parseInt(row.is_fractional || '0') === 1 ? 1 : 0;

        if (!barcode || !name || isNaN(price_mt)) continue;

        const existing = await db.select('SELECT id FROM products WHERE barcode = ?', [barcode]) as any[];
        if (existing.length > 0) {
          await db.execute(
            'UPDATE products SET name = ?, category = ?, price_mt = ?, cost_price_mt = ?, stock_quantity = ?, min_stock_alert = ?, is_fractional = ? WHERE barcode = ?',
            [name, category, price_mt, cost_price_mt, stock_quantity, min_stock_alert, is_fractional, barcode]
          );
          importedCount++;
        } else {
          // Check quota limit before adding a brand new product
          const limitCheck = await checkProductCatalogLimit(1);
          if (!limitCheck.allowed) {
            limitHit = true;
            toast.error(`Limite do catálogo atingido (${limitCheck.limit} produtos). Atualize para o Plano Pro para importar sem limites.`, { duration: 6000 });
            if (onQuotaExceeded) onQuotaExceeded();
            break;
          }

          await db.execute(
            'INSERT INTO products (id, barcode, name, category, price_mt, cost_price_mt, stock_quantity, min_stock_alert, is_fractional, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [crypto.randomUUID(), barcode, name, category, price_mt, cost_price_mt, stock_quantity, min_stock_alert, is_fractional, '']
          );
          importedCount++;
        }
      }

      if (importedCount > 0) {
        toast.success(`${importedCount} produtos importados/atualizados com sucesso!`);
      }
      onSuccess();
    } catch (err) {
      console.error('Error importing CSV', err);
      toast.error('Falha ao importar produtos.');
    }
  };
  reader.readAsText(file);
}
