import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Product } from '../../../lib/api';
import { getDB } from '../../../lib/db';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import { logAudit } from '../../../lib/audit';
import { sanitizeString, sanitizeNumeric } from '../../../lib/security/sanitizer';
import { ProductFormType } from '../ProductForm/ProductTypeTabs';
import { parseProductMetric } from '../../../lib/utils/productMetric';
import { checkProductCatalogLimit } from '../services/productLimitService';
import { getExpectedDeliveryInfoForProduct, ExpectedDeliveryProductInfo } from '../utils/deliveryInfo';

interface UseProductFormProps {
  editingProduct: Product | null;
  availableBarcodes: string[];
  onSave: () => void;
}

export function useProductForm({ editingProduct, availableBarcodes, onSave }: UseProductFormProps) {
  const { currentUser } = useAuth();
  const [productFormType, setProductFormType] = useState<ProductFormType>('unit');
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [priceMt, setPriceMt] = useState('');
  const [costPriceMt, setCostPriceMt] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [minStockAlert, setMinStockAlert] = useState('');
  const [isFractional, setIsFractional] = useState(false);
  const [unitMetric, setUnitMetric] = useState('kg');
  const [packageTotalQty, setPackageTotalQty] = useState('');
  const [packageCostPrice, setPackageCostPrice] = useState('');
  const [packagePrice, setPackagePrice] = useState('');
  const [portionQty, setPortionQty] = useState('1');
  const [promoPriceMt, setPromoPriceMt] = useState('');
  const [promoActive, setPromoActive] = useState(false);
  const [attributes, setAttributes] = useState<{ key: string; value: string }[]>([]);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Multi-Packaging Fields
  const [packType, setPackType] = useState<'pack' | 'box' | 'bundle' | 'other'>('pack');
  const [packUnitsCount, setPackUnitsCount] = useState('6');
  const [parentProductId, setParentProductId] = useState('');
  const [parentProductName, setParentProductName] = useState('');
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [expectedDeliveryInfo, setExpectedDeliveryInfo] = useState<ExpectedDeliveryProductInfo | null>(null);

  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  const scannerBuffer = useRef('');
  const lastKeystrokeTime = useRef(0);

  useEffect(() => {
    let isMounted = true;
    const fetchInitialData = async () => {
      try {
        const db = await getDB();
        const catResults = await db.select(
          'SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != "" ORDER BY category ASC'
        );
        if (isMounted) {
          setExistingCategories(catResults.map((r: any) => r.category));
        }

        const prods = await db.select('SELECT * FROM products ORDER BY name ASC');
        if (isMounted) {
          setAvailableProducts(prods);
        }
      } catch (err) {
        console.error('Failed to fetch product form initial data', err);
      }
    };
    fetchInitialData();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (editingProduct) {
      setBarcode(editingProduct.barcode);
      setName(editingProduct.name);
      setCategory(editingProduct.category || '');
      setPriceMt(editingProduct.price_mt.toString());
      setCostPriceMt(editingProduct.cost_price_mt?.toString() || '');
      setStockQuantity(editingProduct.stock_quantity?.toString() || '0');
      setMinStockAlert(editingProduct.min_stock_alert?.toString() || '');
      setIsFractional(!!editingProduct.is_fractional);
      setPromoPriceMt(editingProduct.promo_price_mt?.toString() || '');
      setPromoActive(!!editingProduct.promo_active);
      setError('');

      const parsedMetric = parseProductMetric(editingProduct.attributes, editingProduct.is_fractional);
      if (parsedMetric.productType === 'pack' || (parsedMetric.packUnitsCount && parsedMetric.packUnitsCount > 1)) {
        setProductFormType('pack');
        setPackType(parsedMetric.packType || 'pack');
        setPackUnitsCount(parsedMetric.packUnitsCount?.toString() || '6');
        setParentProductId(parsedMetric.parentProductId || '');
        setParentProductName(parsedMetric.parentProductName || '');
      } else if (editingProduct.is_fractional) {
        setProductFormType('bulk');
      } else {
        setProductFormType('unit');
      }

      let parsedAttrs: { key: string; value: string }[] = [];
      if (editingProduct.attributes) {
        try {
          const parsed = JSON.parse(editingProduct.attributes);
          if (parsed && typeof parsed === 'object') {
            if (parsed.unit_metric) setUnitMetric(String(parsed.unit_metric));
            if (parsed.package_total_qty !== undefined) setPackageTotalQty(String(parsed.package_total_qty));
            if (parsed.package_cost_price !== undefined) setPackageCostPrice(String(parsed.package_cost_price));
            if (parsed.package_price !== undefined) setPackagePrice(String(parsed.package_price));
            if (parsed.portion_qty !== undefined) setPortionQty(String(parsed.portion_qty));

            // Exclude internal keys from standard custom attributes list
            const internalKeys = [
              'unit_metric', 'package_total_qty', 'package_cost_price', 'package_price', 'portion_qty',
              'product_type', 'pack_type', 'pack_units_count', 'parent_product_id', 'parent_product_name'
            ];
            parsedAttrs = Object.entries(parsed)
              .filter(([k]) => !internalKeys.includes(k))
              .map(([k, v]) => ({ key: k, value: String(v) }));
          }
        } catch (e) {
          parsedAttrs = [{ key: 'Detalhes', value: editingProduct.attributes }];
        }
      }
      setAttributes(parsedAttrs);

      // Asynchronously fetch any linked Expected Delivery data
      getExpectedDeliveryInfoForProduct(editingProduct.id).then((info) => {
        setExpectedDeliveryInfo(info);
      }).catch((err) => {
        console.warn('Failed to load delivery info for product form', err);
      });
    } else {
      resetForm();
    }
  }, [editingProduct]);

  const resetForm = useCallback(() => {
    setExpectedDeliveryInfo(null);
    setProductFormType('unit');
    setBarcode('');
    setName('');
    setCategory('');
    setPriceMt('');
    setCostPriceMt('');
    setStockQuantity('');
    setMinStockAlert('');
    setIsFractional(false);
    setUnitMetric('kg');
    setPackageTotalQty('');
    setPackageCostPrice('');
    setPackagePrice('');
    setPortionQty('1');
    setPackType('pack');
    setPackUnitsCount('6');
    setParentProductId('');
    setParentProductName('');
    setPromoPriceMt('');
    setPromoActive(false);
    setAttributes([]);
    setError('');
  }, []);

  const handleChangeProductType = useCallback((type: ProductFormType) => {
    setProductFormType(type);
    if (type === 'bulk') {
      setIsFractional(true);
    } else {
      setIsFractional(false);
    }
  }, []);

  const handleAutoCalculateUnitPrices = useCallback(() => {
    const pkgQty = sanitizeNumeric(packageTotalQty, 0);
    const pkgCost = sanitizeNumeric(packageCostPrice, 0);
    const pkgPrice = sanitizeNumeric(packagePrice, 0);

    if (pkgQty <= 0) {
      toast.error('Informe o tamanho total da embalagem (ex: 25) para calcular.');
      return;
    }

    if (pkgCost > 0) {
      const unitCost = pkgCost / pkgQty;
      setCostPriceMt(unitCost.toFixed(2));
    }

    if (pkgPrice > 0) {
      const unitSale = pkgPrice / pkgQty;
      setPriceMt(unitSale.toFixed(2));
    }

    if (!stockQuantity || Number(stockQuantity) === 0) {
      setStockQuantity(pkgQty.toString());
    }

    toast.success(`⚡ Preços por unidade (${unitMetric}) e estoque (${pkgQty} ${unitMetric}) auto-calculados!`);
  }, [packageTotalQty, packageCostPrice, packagePrice, stockQuantity, unitMetric]);

  const handleBarcodeKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt') return;
    
    const now = Date.now();
    if (now - lastKeystrokeTime.current > 100) {
      scannerBuffer.current = e.key.length === 1 ? e.key : '';
    } else {
      if (e.key.length === 1) {
        scannerBuffer.current += e.key;
      }
    }
    
    lastKeystrokeTime.current = now;

    if (e.key === 'Enter') {
      e.preventDefault();
      if (scannerBuffer.current.length > 3) {
        setBarcode(scannerBuffer.current);
        setError('');
      } else {
        setError('Manual typing is disabled. Please scan a barcode or Use Generated.');
      }
      scannerBuffer.current = '';
    }
  }, []);

  const autofillBarcode = useCallback(() => {
    if (availableBarcodes.length > 0) {
      setBarcode(availableBarcodes[0]);
    } else {
      setError('No available generated barcodes. Please go to Barcode Engine to generate some.');
    }
  }, [availableBarcodes]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setError('');

    const cleanName = sanitizeString(name);
    const cleanCategory = sanitizeString(category);
    const price = sanitizeNumeric(priceMt, 0);
    const isExpectedDelivery = Boolean(editingProduct?.requires_verification) || Boolean(expectedDeliveryInfo);
    const costPrice = costPriceMt 
      ? sanitizeNumeric(costPriceMt, 0) 
      : (isExpectedDelivery ? (editingProduct?.cost_price_mt ?? 0) : 0);
    const stock = sanitizeNumeric(stockQuantity, 0);
    const minAlert = minStockAlert ? sanitizeNumeric(minStockAlert, 0) : null;
    const promoPrice = promoPriceMt ? sanitizeNumeric(promoPriceMt, 0) : null;

    if (!barcode || !cleanName || price <= 0 || costPrice < 0) {
      setError('Por favor preencha todos os campos obrigatórios (Código, Nome, Preço Venda).');
      return;
    }

    if (promoPriceMt !== '' && (promoPrice === null || promoPrice < 0)) {
      setError('Por favor, insira um preço promocional válido.');
      return;
    }

    setIsSaving(true);
    try {
      const db = await getDB();
      
      // Check if barcode is used in aliases
      const aliasCheck = await db.select('SELECT id FROM product_aliases WHERE barcode = ?', [barcode]);
      if (aliasCheck && aliasCheck.length > 0) {
        setError('Este código já está em uso como alias em outro produto.');
        return;
      }

      // Convert attributes to a single JSON string with sanitization
      const attrsObj: Record<string, string | number> = {};
      
      attrsObj.product_type = productFormType;

      // Persist Pack / Caixa attributes
      if (productFormType === 'pack') {
        attrsObj.pack_type = packType;
        const units = sanitizeNumeric(packUnitsCount, 6);
        attrsObj.pack_units_count = units > 0 ? units : 6;
        if (parentProductId) {
          attrsObj.parent_product_id = parentProductId;
          if (parentProductName) attrsObj.parent_product_name = parentProductName;
        }
      }

      // Persist bulk/metric parameters inside attributes
      if (isFractional || productFormType === 'bulk') {
        attrsObj.unit_metric = unitMetric || 'kg';
        if (packageTotalQty) attrsObj.package_total_qty = sanitizeNumeric(packageTotalQty, 0);
        if (packageCostPrice) attrsObj.package_cost_price = sanitizeNumeric(packageCostPrice, 0);
        if (packagePrice) attrsObj.package_price = sanitizeNumeric(packagePrice, 0);
        if (portionQty) attrsObj.portion_qty = sanitizeNumeric(portionQty, 1);
      }

      attributes.forEach(attr => {
        const k = sanitizeString(attr.key);
        const v = sanitizeString(attr.value);
        if (k && v) {
          attrsObj[k] = v;
        }
      });
      const attributesStr = JSON.stringify(attrsObj);

      if (editingProduct) {
        await db.execute(
          'UPDATE products SET barcode = ?, name = ?, category = ?, price_mt = ?, cost_price_mt = ?, stock_quantity = ?, is_fractional = ?, min_stock_alert = ?, promo_price_mt = ?, promo_active = ?, attributes = ?, requires_verification = 0, sync_status = 0 WHERE id = ?',
          [barcode, cleanName, cleanCategory, price, costPrice, stock, (isFractional || productFormType === 'bulk') ? 1 : 0, minAlert, promoPrice, promoActive ? 1 : 0, attributesStr, editingProduct.id]
        );

        if (expectedDeliveryInfo?.itemId) {
          try {
            await db.execute(
              'UPDATE expected_delivery_items SET received_quantity = ?, status = "received", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [stock, expectedDeliveryInfo.itemId]
            );
          } catch (e) {
            console.warn('Could not update expected_delivery_items status', e);
          }
        }

        await logAudit(
          currentUser?.id, 
          'PRODUCT_UPDATED', 
          JSON.stringify({
            name: cleanName,
            price_mt: price,
            cost_price_mt: costPrice,
            stock_quantity: stock,
            category: cleanCategory,
            unit: (isFractional || productFormType === 'bulk') ? 'Kg/Fracionado' : 'Unidade (un)'
          })
        );
      } else {
        const limitCheck = await checkProductCatalogLimit(1);
        if (!limitCheck.allowed) {
          setError(`Limite de catálogo atingido (${limitCheck.limit} produtos). Atualize para o Plano Pro para cadastrar produtos ilimitados.`);
          toast.error(`Capacidade máxima do catálogo atingida (${limitCheck.limit} produtos). Desbloqueie o Plano Pro para continuar.`);
          setIsSaving(false);
          return;
        }

        const newId = crypto.randomUUID();
        await db.execute(
          'INSERT INTO products (id, barcode, name, category, price_mt, cost_price_mt, stock_quantity, is_fractional, min_stock_alert, promo_price_mt, promo_active, attributes, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)',
          [newId, barcode, cleanName, cleanCategory, price, costPrice, stock, (isFractional || productFormType === 'bulk') ? 1 : 0, minAlert, promoPrice, promoActive ? 1 : 0, attributesStr]
        );
        await logAudit(
          currentUser?.id, 
          'PRODUCT_CREATED', 
          JSON.stringify({
            name: cleanName,
            price_mt: price,
            cost_price_mt: costPrice,
            stock_quantity: stock,
            category: cleanCategory,
            unit: (isFractional || productFormType === 'bulk') ? 'Kg/Fracionado' : 'Unidade (un)'
          })
        );
      }

      await db.execute(
        "UPDATE barcodes SET status = 'used' WHERE barcode = ?",
        [barcode]
      );

      toast.success('Produto guardado com sucesso!');
      onSave();
    } catch (err: any) {
      console.error('Failed to save product:', err);
      if (err.toString().includes('UNIQUE')) {
        setError('Já existe um produto com este código de barras.');
      } else {
        setError('Falha ao guardar produto. Verifique os dados.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return {
    productFormType,
    handleChangeProductType,
    packType,
    setPackType,
    packUnitsCount,
    setPackUnitsCount,
    parentProductId,
    setParentProductId,
    parentProductName,
    setParentProductName,
    availableProducts,
    barcode,
    setBarcode,
    name,
    setName,
    category,
    setCategory,
    priceMt,
    setPriceMt,
    costPriceMt,
    setCostPriceMt,
    stockQuantity,
    setStockQuantity,
    minStockAlert,
    setMinStockAlert,
    isFractional,
    setIsFractional,
    unitMetric,
    setUnitMetric,
    packageTotalQty,
    setPackageTotalQty,
    packageCostPrice,
    setPackageCostPrice,
    packagePrice,
    setPackagePrice,
    portionQty,
    setPortionQty,
    handleAutoCalculateUnitPrices,
    promoPriceMt,
    setPromoPriceMt,
    promoActive,
    setPromoActive,
    attributes,
    setAttributes,
    error,
    setError,
    existingCategories,
    isCategoryDropdownOpen,
    setIsCategoryDropdownOpen,
    categoryDropdownRef,
    handleBarcodeKeyDown,
    autofillBarcode,
    handleFormSubmit,
    isSaving,
    expectedDeliveryInfo,
    isExpectedDelivery: Boolean(editingProduct?.requires_verification) || Boolean(expectedDeliveryInfo),
  };
}
