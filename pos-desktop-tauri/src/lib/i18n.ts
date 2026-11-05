/**
 * i18n Internationalization Engine for POS System
 * Supported languages:
 * - 'pt': Português (Moçambique)
 * - 'en': English
 * - 'sw': Kiswahili
 * - 'fr': Français
 */

export type LanguageCode = 'pt' | 'en' | 'sw' | 'fr';

export const translations = {
  pt: {
    // Top Bar & Tabs
    stockCheckerTab: 'Consulta Rápida',
    productListTab: 'Lista de Produtos',
    ordersTab: 'Encomendas / PO',
    backToMenu: 'Voltar ao menu',
    managerModeActive: 'Modo Gestor Ativo',
    unlockedSession: 'Desbloqueado (1h)',
    posCommercialHeader: 'Windows POS • Gestão Comercial & Inventário',
    stockCheckerTitle: 'Consulta de Stock',
    catalogTitle: 'Catálogo de Produtos',
    ordersTitle: 'Encomendas & Receção de Mercadoria',
    restockTitle: 'Gestão de Reposição & PO',
    restockSubtitle: 'Entrada de Mercadoria, Encomendas e Stock',
    shoppingListTab: 'Lista de Compras',
    historyTab: 'Histórico',

    // Sync Badges
    syncing: 'Sincronizando',
    synced: 'Sincronizado',
    offline: 'Offline',
    syncError: 'Erro de Sync',
    syncBackupMessage: 'Guardando dados na nuvem...',

    // Search & Toolbar
    searchProductPlaceholder: 'Pesquisar por nome, código de barras, categoria...',
    allCategories: 'Todas Categorias',
    productsTotal: 'Produtos',
    sortBy: 'Ordenar Por',
    nameAsc: 'Nome (A-Z)',
    stockDesc: 'Stock (Maior > Menor)',
    stockAsc: 'Stock (Menor > Maior)',
    priceDesc: 'Preço (Maior > Menor)',
    priceAsc: 'Preço (Menor > Maior)',
    refreshList: 'Atualizar Lista',

    // Product Table
    barcode: 'Código de Barras',
    productName: 'Nome do Produto',
    category: 'Categoria',
    stock: 'Stock Atual',
    price: 'Preço',
    costPrice: 'Preço Custo',
    actions: 'Ações',
    bulkActions: 'Ações em Massa',
    deleteSelected: 'Apagar Selecionados',
    noProductsFound: 'Nenhum produto encontrado',
    fractionalTag: 'A Granel (kg)',

    // Actions & Buttons
    newProduct: 'Novo Produto',
    exportPDF: 'Exportar PDF',
    exportCSV: 'Exportar CSV',
    importCSV: 'Importar CSV',
    downloadTemplate: 'Modelo CSV',
    editProduct: 'Editar Produto',
    deleteProduct: 'Apagar Produto',
    quickStock: 'Stock Rápido',
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Apagar',
    edit: 'Editar',
    confirm: 'Confirmar',

    // Consulta Rápida (Stock Checker)
    stockSearchPlaceholder: 'Digitalize o código de barras ou digite para pesquisar...',
    unitPrice: 'Preço Unitário',
    availableStock: 'Stock Disponível',
    lowStockAlert: 'Stock Baixo (Abaixo do Mínimo)',
    inStock: 'Em Stock',
    outOfStock: 'Sem Stock',
    searchPrompts: 'Digite o nome do produto ou passe no leitor...',

    // Purchase Orders (Encomendas PO)
    purchaseOrdersTitle: 'Encomendas de Fornecedores (PO)',
    pendingDeliveries: 'Entradas Pendentes',
    receivingHistory: 'Histórico de Receções',
    newPurchaseOrder: 'Nova Encomenda PO',
    poNumber: 'Nº PO',
    invoiceNumber: 'Nº Fatura',
    supplierName: 'Fornecedor',
    expectedDate: 'Data Prevista',
    status: 'Estado',
    receiveGoods: 'Receber Mercadoria',
    statusPending: 'Pendente',
    statusReceived: 'Recebido',
    statusPartial: 'Parcial',
    noDeliveriesFound: 'Nenhuma encomenda registada',

    // Admin PIN Modal
    enterAdminPin: 'Introduza o PIN de Administrador',
    pinRequiredMsg: 'Esta ação requer autorização de gestor/administrador.',
    invalidPin: 'PIN Incorreto. Tente novamente.',
    lockSession: 'Bloquear Sessão'
  },

  en: {
    // Top Bar & Tabs
    stockCheckerTab: 'Quick Stock Check',
    productListTab: 'Product Catalog',
    ordersTab: 'Purchase Orders & PO',
    backToMenu: 'Back to menu',
    managerModeActive: 'Manager Mode Active',
    unlockedSession: 'Unlocked (1h)',
    posCommercialHeader: 'Windows POS • Commercial & Inventory Management',
    stockCheckerTitle: 'Stock Checker',
    catalogTitle: 'Product Catalog',
    ordersTitle: 'Purchase Orders & Goods Receiving',
    restockTitle: 'Restock Management & PO',
    restockSubtitle: 'Goods Receiving, Orders and Stock',
    shoppingListTab: 'Shopping List',
    historyTab: 'History',

    // Sync Badges
    syncing: 'Syncing',
    synced: 'Synced',
    offline: 'Offline',
    syncError: 'Sync Error',
    syncBackupMessage: 'Backing up data to cloud...',

    // Search & Toolbar
    searchProductPlaceholder: 'Search by name, barcode, category...',
    allCategories: 'All Categories',
    productsTotal: 'Products',
    sortBy: 'Sort By',
    nameAsc: 'Name (A-Z)',
    stockDesc: 'Stock (High > Low)',
    stockAsc: 'Stock (Low > High)',
    priceDesc: 'Price (High > Low)',
    priceAsc: 'Price (Low > High)',
    refreshList: 'Refresh List',

    // Product Table
    barcode: 'Barcode',
    productName: 'Product Name',
    category: 'Category',
    stock: 'Current Stock',
    price: 'Price',
    costPrice: 'Cost Price',
    actions: 'Actions',
    bulkActions: 'Bulk Actions',
    deleteSelected: 'Delete Selected',
    noProductsFound: 'No products found',
    fractionalTag: 'Bulk / Loose (kg)',

    // Actions & Buttons
    newProduct: 'New Product',
    exportPDF: 'Export PDF',
    exportCSV: 'Export CSV',
    importCSV: 'Import CSV',
    downloadTemplate: 'CSV Template',
    editProduct: 'Edit Product',
    deleteProduct: 'Delete Product',
    quickStock: 'Quick Stock',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    confirm: 'Confirm',

    // Consulta Rápida (Stock Checker)
    stockSearchPlaceholder: 'Scan barcode or type to search product...',
    unitPrice: 'Unit Price',
    availableStock: 'Available Stock',
    lowStockAlert: 'Low Stock (Below Alert)',
    inStock: 'In Stock',
    outOfStock: 'Out of Stock',
    searchPrompts: 'Type product name or scan code...',

    // Purchase Orders (Encomendas PO)
    purchaseOrdersTitle: 'Purchase Orders (PO)',
    pendingDeliveries: 'Pending Deliveries',
    receivingHistory: 'Receiving History',
    newPurchaseOrder: 'New Purchase Order',
    poNumber: 'PO Number',
    invoiceNumber: 'Invoice Number',
    supplierName: 'Supplier Name',
    expectedDate: 'Expected Date',
    status: 'Status',
    receiveGoods: 'Receive Goods',
    statusPending: 'Pending',
    statusReceived: 'Received',
    statusPartial: 'Partial',
    noDeliveriesFound: 'No purchase orders recorded',

    // Admin PIN Modal
    enterAdminPin: 'Enter Admin PIN',
    pinRequiredMsg: 'This action requires manager or admin authorization.',
    invalidPin: 'Invalid PIN. Please try again.',
    lockSession: 'Lock Session'
  },

  sw: {
    // Top Bar & Tabs
    stockCheckerTab: 'Ukaguzi wa Haraka',
    productListTab: 'Orodha ya Bidhaa',
    ordersTab: 'Maagizo na PO',
    backToMenu: 'Rudi kwenye Menyu',
    managerModeActive: 'Hali ya Meneja',
    unlockedSession: 'Imefunguliwa (Saa 1)',
    posCommercialHeader: 'Windows POS • Usimamizi wa Biashara na Bidhaa',
    stockCheckerTitle: 'Ukaguzi wa Akiba',
    catalogTitle: 'Orodha ya Bidhaa',
    ordersTitle: 'Maagizo na Mapokezi ya Bidhaa',
    restockTitle: 'Usimamizi wa Ujazaji & PO',
    restockSubtitle: 'Mapokezi ya Bidhaa, Maagizo na Akiba',
    shoppingListTab: 'Orodha ya Ununuzi',
    historyTab: 'Historia',

    // Sync Badges
    syncing: 'Inasawazisha',
    synced: 'Imesawazishwa',
    offline: 'Nje ya Mtandao',
    syncError: 'Hitilafu ya Sync',
    syncBackupMessage: 'Inahifadhi data mtandaoni...',

    // Search & Toolbar
    searchProductPlaceholder: 'Tafuta kwa jina, msimbo wa pau, kategoria...',
    allCategories: 'Kategoria Zote',
    productsTotal: 'Bidhaa',
    sortBy: 'Panga Kwa',
    nameAsc: 'Jina (A-Z)',
    stockDesc: 'Akiba (Kubwa > Ndogo)',
    stockAsc: 'Akiba (Ndogo > Kubwa)',
    priceDesc: 'Bei (Juu > Chini)',
    priceAsc: 'Bei (Chini > Juu)',
    refreshList: 'Sasaisha Orodha',

    // Product Table
    barcode: 'Msimbo wa Pau',
    productName: 'Jina la Bidhaa',
    category: 'Kategoria',
    stock: 'Akiba ya Sasa',
    price: 'Bei',
    costPrice: 'Bei ya Gharama',
    actions: 'Vitendo',
    bulkActions: 'Vitendo vya Pamoja',
    deleteSelected: 'Futa Zilizochaguliwa',
    noProductsFound: 'Hakuna bidhaa zilizopatikana',
    fractionalTag: 'Kwa Kipimo (kg)',

    // Actions & Buttons
    newProduct: 'Bidhaa Mpya',
    exportPDF: 'Pakua PDF',
    exportCSV: 'Pakua CSV',
    importCSV: 'Ingiza CSV',
    downloadTemplate: 'Kigezo cha CSV',
    editProduct: 'Hariri Bidhaa',
    deleteProduct: 'Futa Bidhaa',
    quickStock: 'Akiba ya Haraka',
    save: 'Hifadhi',
    cancel: 'Ghairi',
    delete: 'Futa',
    edit: 'Hariri',
    confirm: 'Thibitisha',

    // Consulta Rápida (Stock Checker)
    stockSearchPlaceholder: 'Changanua msimbo au andika ili kutafuta...',
    unitPrice: 'Bei ya Kipimo',
    availableStock: 'Akiba Inayopatikana',
    lowStockAlert: 'Akiba Kidogo mno',
    inStock: 'Ipo Akiba',
    outOfStock: 'Imekwisha',
    searchPrompts: 'Andika jina la bidhaa au changanua...',

    // Purchase Orders (Encomendas PO)
    purchaseOrdersTitle: 'Maagizo ya Bidhaa (PO)',
    pendingDeliveries: 'Mapokezi Yaliyosubiriwa',
    receivingHistory: 'Historia ya Mapokezi',
    newPurchaseOrder: 'Agizo Jipya la PO',
    poNumber: 'Namba ya PO',
    invoiceNumber: 'Namba ya Invoisi',
    supplierName: 'Muuzaji',
    expectedDate: 'Tarehe Inayotarajiwa',
    status: 'Hali',
    receiveGoods: 'Pokea Bidhaa',
    statusPending: 'Inasubiri',
    statusReceived: 'Imepokelewa',
    statusPartial: 'Kiasi',
    noDeliveriesFound: 'Hakuna maagizo yaliyorekodiwa',

    // Admin PIN Modal
    enterAdminPin: 'Ingiza PIN ya Msimamizi',
    pinRequiredMsg: 'Kitendo hiki kinahitaji idhini ya meneja.',
    invalidPin: 'PIN Isiyo Sahihi. Jaribu tena.',
    lockSession: 'Funga Kipindi'
  },

  fr: {
    // Top Bar & Tabs
    stockCheckerTab: 'Vérification Rapide',
    productListTab: 'Catalogue Produits',
    ordersTab: 'Commandes & PO',
    backToMenu: 'Retour au menu',
    managerModeActive: 'Mode Gestionnaire Actif',
    unlockedSession: 'Déverrouillé (1h)',
    posCommercialHeader: 'Windows POS • Gestion Commerciale & Inventaire',
    stockCheckerTitle: 'Vérification de Stock',
    catalogTitle: 'Catalogue des Produits',
    ordersTitle: 'Commandes & Réception de Marchandise',
    restockTitle: 'Gestion du Réapprovisionnement & PO',
    restockSubtitle: 'Entrée de Marchandise, Commandes et Stock',
    shoppingListTab: 'Liste d\'Achats',
    historyTab: 'Historique',

    // Sync Badges
    syncing: 'Synchronisation',
    synced: 'Synchronisé',
    offline: 'Hors ligne',
    syncError: 'Erreur de Sync',
    syncBackupMessage: 'Sauvegarde des données dans le cloud...',

    // Search & Toolbar
    searchProductPlaceholder: 'Rechercher par nom, code-barres, catégorie...',
    allCategories: 'Toutes les catégories',
    productsTotal: 'Produits',
    sortBy: 'Trier par',
    nameAsc: 'Nom (A-Z)',
    stockDesc: 'Stock (Élevé > Bas)',
    stockAsc: 'Stock (Bas > Élevé)',
    priceDesc: 'Prix (Élevé > Bas)',
    priceAsc: 'Prix (Bas > Élevé)',
    refreshList: 'Actualiser la liste',

    // Product Table
    barcode: 'Code-barres',
    productName: 'Nom du Produit',
    category: 'Catégorie',
    stock: 'Stock Actuel',
    price: 'Prix',
    costPrice: 'Prix d\'achat',
    actions: 'Actions',
    bulkActions: 'Actions Groupées',
    deleteSelected: 'Supprimer la sélection',
    noProductsFound: 'Aucun produit trouvé',
    fractionalTag: 'En Vrac (kg)',

    // Actions & Buttons
    newProduct: 'Nouveau Produit',
    exportPDF: 'Exporter PDF',
    exportCSV: 'Exporter CSV',
    importCSV: 'Importer CSV',
    downloadTemplate: 'Modèle CSV',
    editProduct: 'Modifier Produit',
    deleteProduct: 'Supprimer Produit',
    quickStock: 'Stock Rapide',
    save: 'Enregistrer',
    cancel: 'Annuler',
    delete: 'Supprimer',
    edit: 'Modifier',
    confirm: 'Confirmer',

    // Consulta Rápida (Stock Checker)
    stockSearchPlaceholder: 'Scannez le code-barres ou tapez pour rechercher...',
    unitPrice: 'Prix Unitaire',
    availableStock: 'Stock Disponible',
    lowStockAlert: 'Stock Faible (Sous le Seuil)',
    inStock: 'En Stock',
    outOfStock: 'Rupture de Stock',
    searchPrompts: 'Saisissez le nom ou scannez un produit...',

    // Purchase Orders (Encomendas PO)
    purchaseOrdersTitle: 'Bons de Commande (PO)',
    pendingDeliveries: 'Livraisons En Attente',
    receivingHistory: 'Historique des Réceptions',
    newPurchaseOrder: 'Nouveau Bon de Commande',
    poNumber: 'N° de PO',
    invoiceNumber: 'N° de Facture',
    supplierName: 'Fournisseur',
    expectedDate: 'Date Prévue',
    status: 'Statut',
    receiveGoods: 'Recevoir la Marchandise',
    statusPending: 'En attente',
    statusReceived: 'Reçu',
    statusPartial: 'Partiel',
    noDeliveriesFound: 'Aucune commande enregistrée',

    // Admin PIN Modal
    enterAdminPin: 'Entrez le Code PIN Administrateur',
    pinRequiredMsg: 'Cette action nécessite l\'autorisation du gestionnaire.',
    invalidPin: 'Code PIN Incorrect. Veuillez réessayer.',
    lockSession: 'Verrouiller la Session'
  }
};

export function getLanguage(): LanguageCode {
  try {
    const saved = localStorage.getItem('locale_lang');
    if (saved && (saved === 'pt' || saved === 'en' || saved === 'sw' || saved === 'fr')) {
      return saved;
    }
  } catch {}
  return 'en';
}

export function useI18n(lang?: LanguageCode) {
  const currentLang = lang || getLanguage();
  return translations[currentLang] || translations.pt;
}
