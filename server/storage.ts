import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  suppliers,
  products,
  shipments,
  shipmentItems,
  shipmentShippingDetails,
  shipmentCustomsDetails,
  exchangeRates,
  shipmentPayments,
  inventoryMovements,
  auditLogs,
  type User,
  type UpsertUser,
  type Supplier,
  type InsertSupplier,
  type Product,
  type InsertProduct,
  type Shipment,
  type InsertShipment,
  type ShipmentItem,
  type InsertShipmentItem,
  type ShipmentShippingDetails,
  type InsertShipmentShippingDetails,
  type ShipmentCustomsDetails,
  type InsertShipmentCustomsDetails,
  type ExchangeRate,
  type InsertExchangeRate,
  type ShipmentPayment,
  type InsertShipmentPayment,
  type InventoryMovement,
  type InsertInventoryMovement,
  type AuditLog,
  type InsertAuditLog,
} from "@shared/schema";
import { normalizePaymentAmounts, roundAmount } from "./services/currency";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, data: Partial<UpsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  updateUserRole(id: string, role: string): Promise<User | undefined>;

  // Suppliers
  getAllSuppliers(): Promise<Supplier[]>;
  getSupplier(id: number): Promise<Supplier | undefined>;
  createSupplier(data: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: number, data: Partial<InsertSupplier>): Promise<Supplier | undefined>;
  deleteSupplier(id: number): Promise<boolean>;

  // Products
  getAllProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(data: InsertProduct): Promise<Product>;
  updateProduct(id: number, data: Partial<InsertProduct>): Promise<Product | undefined>;

  // Shipments
  getAllShipments(): Promise<Shipment[]>;
  getShipment(id: number): Promise<Shipment | undefined>;
  getShipmentsByIds(ids: number[]): Promise<Shipment[]>;
  createShipment(data: InsertShipment): Promise<Shipment>;
  updateShipment(id: number, data: Partial<InsertShipment>): Promise<Shipment | undefined>;
  deleteShipment(id: number): Promise<boolean>;

  // Shipment Items
  getShipmentItems(shipmentId: number): Promise<ShipmentItem[]>;
  createShipmentItem(data: InsertShipmentItem): Promise<ShipmentItem>;
  updateShipmentItem(id: number, data: Partial<InsertShipmentItem>): Promise<ShipmentItem | undefined>;
  deleteShipmentItem(id: number): Promise<boolean>;
  deleteShipmentItems(shipmentId: number): Promise<boolean>;

  // Shipping Details
  getShippingDetails(shipmentId: number): Promise<ShipmentShippingDetails | undefined>;
  upsertShippingDetails(data: InsertShipmentShippingDetails): Promise<ShipmentShippingDetails>;

  // Customs Details
  getCustomsDetails(shipmentId: number): Promise<ShipmentCustomsDetails | undefined>;
  upsertCustomsDetails(data: InsertShipmentCustomsDetails): Promise<ShipmentCustomsDetails>;

  // Exchange Rates
  getAllExchangeRates(): Promise<ExchangeRate[]>;
  getLatestRate(from: string, to: string): Promise<ExchangeRate | undefined>;
  createExchangeRate(data: InsertExchangeRate): Promise<ExchangeRate>;

  // Payments
  getAllPayments(): Promise<ShipmentPayment[]>;
  getShipmentPayments(shipmentId: number): Promise<ShipmentPayment[]>;
  createPayment(data: InsertShipmentPayment): Promise<ShipmentPayment>;

  // Inventory
  getAllInventoryMovements(): Promise<InventoryMovement[]>;
  createInventoryMovement(data: InsertInventoryMovement): Promise<InventoryMovement>;

  // Audit
  createAuditLog(data: InsertAuditLog): Promise<AuditLog>;

  // Dashboard Stats
  getDashboardStats(): Promise<{
    totalShipments: number;
    totalCostEgp: string;
    totalPaidEgp: string;
    totalBalanceEgp: string;
    recentShipments: Shipment[];
    pendingShipments: number;
    completedShipments: number;
  }>;

  // Payment Stats
  getPaymentStats(): Promise<{
    totalCostEgp: string;
    totalPaidEgp: string;
    totalBalanceEgp: string;
    lastPayment: ShipmentPayment | null;
  }>;

  // Inventory Stats
  getInventoryStats(): Promise<{
    totalPieces: number;
    totalCostEgp: string;
    totalItems: number;
    avgUnitCostEgp: string;
  }>;

  // Accounting Methods
  getAccountingDashboard(filters?: {
    dateFrom?: string;
    dateTo?: string;
    supplierId?: number;
    shipmentCode?: string;
    shipmentStatus?: string;
    paymentStatus?: string;
    includeArchived?: boolean;
  }): Promise<{
    totalPurchaseRmb: string;
    totalPurchaseEgp: string;
    totalShippingRmb: string;
    totalShippingEgp: string;
    totalCommissionRmb: string;
    totalCommissionEgp: string;
    totalCustomsEgp: string;
    totalTakhreegEgp: string;
    totalCostEgp: string;
    totalPaidEgp: string;
    totalBalanceEgp: string;
    unsettledShipmentsCount: number;
  }>;

  getSupplierBalances(filters?: {
    dateFrom?: string;
    dateTo?: string;
    supplierId?: number;
    balanceType?: 'owing' | 'credit' | 'all';
  }): Promise<Array<{
    supplierId: number;
    supplierName: string;
    totalCostEgp: string;
    totalPaidEgp: string;
    balanceEgp: string;
    balanceStatus: 'owing' | 'settled' | 'credit';
  }>>;

  getSupplierStatement(supplierId: number, filters?: {
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    supplier: Supplier;
    movements: Array<{
      date: Date | string;
      type: 'shipment' | 'payment';
      description: string;
      shipmentCode?: string;
      costEgp?: string;
      paidEgp?: string;
      runningBalance: string;
    }>;
  }>;

  getMovementReport(filters?: {
    dateFrom?: string;
    dateTo?: string;
    shipmentId?: number;
    supplierId?: number;
    movementType?: string;
    costComponent?: string;
    paymentMethod?: string;
    includeArchived?: boolean;
  }): Promise<{
    movements: Array<{
      date: Date | string;
      shipmentCode: string;
      shipmentName: string;
      supplierName?: string;
      supplierId?: number;
      movementType: string;
      costComponent?: string;
      paymentMethod?: string;
      originalCurrency?: string;
      amountOriginal?: string;
      amountEgp: string;
      direction: 'cost' | 'payment';
      userName?: string;
    }>;
    totalCostEgp: string;
    totalPaidEgp: string;
    netMovement: string;
  }>;

  getPaymentMethodsReport(filters?: {
    dateFrom?: string;
    dateTo?: string;
  }): Promise<Array<{
    paymentMethod: string;
    paymentCount: number;
    totalAmountEgp: string;
  }>>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<UpsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserRole(id: string, role: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Suppliers
  async getAllSuppliers(): Promise<Supplier[]> {
    return db.select().from(suppliers).orderBy(desc(suppliers.createdAt));
  }

  async getSupplier(id: number): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return supplier;
  }

  async createSupplier(data: InsertSupplier): Promise<Supplier> {
    const [supplier] = await db.insert(suppliers).values(data).returning();
    return supplier;
  }

  async updateSupplier(id: number, data: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const [supplier] = await db
      .update(suppliers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(suppliers.id, id))
      .returning();
    return supplier;
  }

  async deleteSupplier(id: number): Promise<boolean> {
    const result = await db.delete(suppliers).where(eq(suppliers.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Products
  async getAllProducts(): Promise<Product[]> {
    return db.select().from(products).orderBy(desc(products.createdAt));
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(data: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(data).returning();
    return product;
  }

  async updateProduct(id: number, data: Partial<InsertProduct>): Promise<Product | undefined> {
    const [product] = await db
      .update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  // Shipments
  async getAllShipments(): Promise<Shipment[]> {
    return db.select().from(shipments).orderBy(desc(shipments.createdAt));
  }

  async getShipment(id: number): Promise<Shipment | undefined> {
    const [shipment] = await db.select().from(shipments).where(eq(shipments.id, id));
    return shipment;
  }

  async getShipmentsByIds(ids: number[]): Promise<Shipment[]> {
    if (ids.length === 0) return [];
    return db.select().from(shipments).where(inArray(shipments.id, ids));
  }

  async createShipment(data: InsertShipment): Promise<Shipment> {
    const [shipment] = await db.insert(shipments).values(data).returning();
    return shipment;
  }

  async updateShipment(id: number, data: Partial<InsertShipment>): Promise<Shipment | undefined> {
    const [shipment] = await db
      .update(shipments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(shipments.id, id))
      .returning();
    return shipment;
  }

  async deleteShipment(id: number): Promise<boolean> {
    const result = await db.delete(shipments).where(eq(shipments.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Shipment Items
  async getShipmentItems(shipmentId: number): Promise<ShipmentItem[]> {
    return db.select().from(shipmentItems).where(eq(shipmentItems.shipmentId, shipmentId));
  }

  async createShipmentItem(data: InsertShipmentItem): Promise<ShipmentItem> {
    const [item] = await db.insert(shipmentItems).values(data).returning();
    return item;
  }

  async updateShipmentItem(id: number, data: Partial<InsertShipmentItem>): Promise<ShipmentItem | undefined> {
    const [item] = await db
      .update(shipmentItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(shipmentItems.id, id))
      .returning();
    return item;
  }

  async deleteShipmentItem(id: number): Promise<boolean> {
    const result = await db.delete(shipmentItems).where(eq(shipmentItems.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteShipmentItems(shipmentId: number): Promise<boolean> {
    await db.delete(shipmentItems).where(eq(shipmentItems.shipmentId, shipmentId));
    return true;
  }

  // Shipping Details
  async getShippingDetails(shipmentId: number): Promise<ShipmentShippingDetails | undefined> {
    const [details] = await db
      .select()
      .from(shipmentShippingDetails)
      .where(eq(shipmentShippingDetails.shipmentId, shipmentId));
    return details;
  }

  async upsertShippingDetails(data: InsertShipmentShippingDetails): Promise<ShipmentShippingDetails> {
    // Ensure date fields are properly handled (can be null, string, or Date)
    const cleanedData = {
      ...data,
      shippingDate: data.shippingDate || null,
    };
    const [details] = await db
      .insert(shipmentShippingDetails)
      .values(cleanedData)
      .onConflictDoUpdate({
        target: shipmentShippingDetails.shipmentId,
        set: { ...cleanedData, updatedAt: new Date() },
      })
      .returning();
    return details;
  }

  // Customs Details
  async getCustomsDetails(shipmentId: number): Promise<ShipmentCustomsDetails | undefined> {
    const [details] = await db
      .select()
      .from(shipmentCustomsDetails)
      .where(eq(shipmentCustomsDetails.shipmentId, shipmentId));
    return details;
  }

  async upsertCustomsDetails(data: InsertShipmentCustomsDetails): Promise<ShipmentCustomsDetails> {
    // Ensure date fields are properly handled (can be null, string, or Date)
    const cleanedData = {
      ...data,
      customsInvoiceDate: data.customsInvoiceDate || null,
    };
    const [details] = await db
      .insert(shipmentCustomsDetails)
      .values(cleanedData)
      .onConflictDoUpdate({
        target: shipmentCustomsDetails.shipmentId,
        set: { ...cleanedData, updatedAt: new Date() },
      })
      .returning();
    return details;
  }

  // Exchange Rates
  async getAllExchangeRates(): Promise<ExchangeRate[]> {
    return db.select().from(exchangeRates).orderBy(desc(exchangeRates.rateDate));
  }

  async getLatestRate(from: string, to: string): Promise<ExchangeRate | undefined> {
    const [rate] = await db
      .select()
      .from(exchangeRates)
      .where(
        and(eq(exchangeRates.fromCurrency, from), eq(exchangeRates.toCurrency, to))
      )
      .orderBy(desc(exchangeRates.rateDate))
      .limit(1);
    return rate;
  }

  async createExchangeRate(data: InsertExchangeRate): Promise<ExchangeRate> {
    const [rate] = await db.insert(exchangeRates).values(data).returning();
    return rate;
  }

  // Payments
  async getAllPayments(): Promise<ShipmentPayment[]> {
    return db.select().from(shipmentPayments).orderBy(desc(shipmentPayments.paymentDate));
  }

  async getShipmentPayments(shipmentId: number): Promise<ShipmentPayment[]> {
    return db
      .select()
      .from(shipmentPayments)
      .where(eq(shipmentPayments.shipmentId, shipmentId))
      .orderBy(desc(shipmentPayments.paymentDate));
  }

  async createPayment(data: InsertShipmentPayment): Promise<ShipmentPayment> {
    return db.transaction(async (tx) => {
      const lockedShipment = await tx.execute(sql<Shipment>`SELECT * FROM shipments WHERE id = ${data.shipmentId} FOR UPDATE`);
      const shipment = (lockedShipment.rows?.[0] as Shipment | undefined) || undefined;

      if (!shipment) {
        throw new Error("الشحنة غير موجودة");
      }

      const amountOriginal = parseFloat(data.amountOriginal as any);
      const exchangeRate = data.exchangeRateToEgp
        ? parseFloat(data.exchangeRateToEgp as any)
        : null;

      const { amountEgp, exchangeRateToEgp } = normalizePaymentAmounts({
        paymentCurrency: data.paymentCurrency,
        amountOriginal,
        exchangeRateToEgp: exchangeRate,
      });

      const currentPaid = parseFloat(shipment.totalPaidEgp || "0");
      const finalCost = parseFloat(shipment.finalTotalCostEgp || "0");
      const remainingBefore = Math.max(0, finalCost - currentPaid);

      if (amountEgp > remainingBefore + 0.0001) {
        throw new Error("لا يمكن دفع مبلغ أكبر من المتبقي على الشحنة.");
      }

      const [payment] = await tx
        .insert(shipmentPayments)
        .values({
          ...data,
          amountOriginal: roundAmount(amountOriginal, 2).toFixed(2),
          exchangeRateToEgp: exchangeRateToEgp ? roundAmount(exchangeRateToEgp, 4).toFixed(4) : null,
          amountEgp: roundAmount(amountEgp, 2).toFixed(2),
        })
        .returning();

      const [paymentTotals] = await tx
        .select({
          totalPaid: sql<string>`COALESCE(SUM(${shipmentPayments.amountEgp}), 0)`,
          lastPaymentDate: sql<Date>`MAX(${shipmentPayments.paymentDate})`,
        })
        .from(shipmentPayments)
        .where(eq(shipmentPayments.shipmentId, data.shipmentId));

      const totalPaidNumber = roundAmount(parseFloat(paymentTotals?.totalPaid || "0"));
      const balance = roundAmount(Math.max(0, finalCost - totalPaidNumber));
      const latestPaymentDate =
        paymentTotals?.lastPaymentDate || data.paymentDate || new Date();

      await tx
        .update(shipments)
        .set({
          totalPaidEgp: totalPaidNumber.toFixed(2),
          balanceEgp: balance.toFixed(2),
          lastPaymentDate: latestPaymentDate,
          updatedAt: new Date(),
        })
        .where(eq(shipments.id, data.shipmentId));

      return payment;
    });
  }

  // Inventory
  async getAllInventoryMovements(): Promise<InventoryMovement[]> {
    return db.select().from(inventoryMovements).orderBy(desc(inventoryMovements.movementDate));
  }

  async createInventoryMovement(data: InsertInventoryMovement): Promise<InventoryMovement> {
    const [movement] = await db.insert(inventoryMovements).values(data).returning();
    return movement;
  }

  // Audit
  async createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db.insert(auditLogs).values(data).returning();
    return log;
  }

  // Dashboard Stats
  async getDashboardStats() {
    const allShipments = await this.getAllShipments();

    const totalCostEgp = allShipments.reduce(
      (sum, s) => sum + parseFloat(s.finalTotalCostEgp || "0"),
      0
    );

    const totalPaidEgp = allShipments.reduce(
      (sum, s) => sum + parseFloat(s.totalPaidEgp || "0"),
      0
    );

    // Calculate remaining correctly
    // remaining = max(0, cost - paid) per shipment
    let totalBalanceEgp = 0;

    allShipments.forEach((s) => {
      const cost = parseFloat(s.finalTotalCostEgp || "0");
      const paid = parseFloat(s.totalPaidEgp || "0");
      const remaining = Math.max(0, cost - paid);
      totalBalanceEgp += remaining;
    });

    const pendingShipments = allShipments.filter(
      (s) => s.status !== "مستلمة بنجاح"
    ).length;

    const completedShipments = allShipments.filter(
      (s) => s.status === "مستلمة بنجاح"
    ).length;

    const recentShipments = allShipments.slice(0, 5);

    return {
      totalShipments: allShipments.length,
      totalCostEgp: totalCostEgp.toFixed(2),
      totalPaidEgp: totalPaidEgp.toFixed(2),
      totalBalanceEgp: totalBalanceEgp.toFixed(2),
      recentShipments,
      pendingShipments,
      completedShipments,
    };
  }

  // Payment Stats
  async getPaymentStats() {
    const allShipments = await this.getAllShipments();
    const allPayments = await this.getAllPayments();

    const unsettledShipments = allShipments.filter((s) => {
      const cost = parseFloat(s.finalTotalCostEgp || "0");
      const paid = parseFloat(s.totalPaidEgp || "0");
      return Math.max(0, cost - paid) > 0.0001;
    });

    const totalCostEgp = unsettledShipments.reduce(
      (sum, s) => sum + parseFloat(s.finalTotalCostEgp || "0"),
      0
    );

    const totalPaidEgp = unsettledShipments.reduce(
      (sum, s) => sum + parseFloat(s.totalPaidEgp || "0"),
      0
    );

    const totalBalanceEgp = unsettledShipments.reduce((sum, s) => {
      const cost = parseFloat(s.finalTotalCostEgp || "0");
      const paid = parseFloat(s.totalPaidEgp || "0");
      return sum + Math.max(0, cost - paid);
    }, 0);

    const lastPayment = allPayments.length > 0 ? allPayments[0] : null;

    return {
      totalCostEgp: totalCostEgp.toFixed(2),
      totalPaidEgp: totalPaidEgp.toFixed(2),
      totalBalanceEgp: totalBalanceEgp.toFixed(2),
      lastPayment,
    };
  }

  // Inventory Stats
  async getInventoryStats() {
    const movements = await this.getAllInventoryMovements();

    const totalPieces = movements.reduce(
      (sum, m) => sum + (m.totalPiecesIn || 0),
      0
    );

    const totalCostEgp = movements.reduce(
      (sum, m) => sum + parseFloat(m.totalCostEgp || "0"),
      0
    );

    const avgUnitCostEgp = totalPieces > 0 ? totalCostEgp / totalPieces : 0;

    return {
      totalPieces,
      totalCostEgp: totalCostEgp.toFixed(2),
      totalItems: movements.length,
      avgUnitCostEgp: avgUnitCostEgp.toFixed(4),
    };
  }

  // Accounting Dashboard
  async getAccountingDashboard(filters?: {
    dateFrom?: string;
    dateTo?: string;
    supplierId?: number;
    shipmentCode?: string;
    shipmentStatus?: string;
    paymentStatus?: string;
    includeArchived?: boolean;
  }) {
    const allShipments = await this.getAllShipments();
    const allPayments = await this.getAllPayments();
    const allItems = await Promise.all(
      allShipments.map(s => this.getShipmentItems(s.id))
    );

    let filteredShipments = allShipments;
    
    if (!filters?.includeArchived) {
      filteredShipments = filteredShipments.filter(s => s.status !== "مؤرشفة");
    }

    if (filters?.shipmentCode) {
      filteredShipments = filteredShipments.filter(s => 
        s.shipmentCode?.toLowerCase().includes(filters.shipmentCode!.toLowerCase())
      );
    }

    if (filters?.shipmentStatus && filters.shipmentStatus !== "all") {
      filteredShipments = filteredShipments.filter(s => s.status === filters.shipmentStatus);
    }

    if (filters?.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filteredShipments = filteredShipments.filter(s => {
        const purchaseDate = s.purchaseDate ? new Date(s.purchaseDate) : null;
        return purchaseDate && purchaseDate >= fromDate;
      });
    }

    if (filters?.dateTo) {
      const toDate = new Date(filters.dateTo);
      filteredShipments = filteredShipments.filter(s => {
        const purchaseDate = s.purchaseDate ? new Date(s.purchaseDate) : null;
        return purchaseDate && purchaseDate <= toDate;
      });
    }

    if (filters?.supplierId) {
      const shipmentItemsForFilter = allItems.flat();
      const shipmentIdsWithSupplier = new Set(
        shipmentItemsForFilter
          .filter(item => item.supplierId === filters.supplierId)
          .map(item => item.shipmentId)
      );
      filteredShipments = filteredShipments.filter(s => shipmentIdsWithSupplier.has(s.id));
    }

    if (filters?.paymentStatus && filters.paymentStatus !== "all") {
      filteredShipments = filteredShipments.filter((s) => {
        const cost = parseFloat(s.finalTotalCostEgp || "0");
        const paid = parseFloat(s.totalPaidEgp || "0");
        const balance = Math.max(0, cost - paid);
        if (filters.paymentStatus === "لم يتم دفع أي مبلغ") return paid <= 0.0001;
        if (filters.paymentStatus === "مسددة بالكامل") return balance <= 0.0001;
        if (filters.paymentStatus === "مدفوعة جزئياً") return paid > 0.0001 && balance > 0.0001;
        return true;
      });
    }

    const filteredShipmentIds = new Set(filteredShipments.map(s => s.id));
    const filteredPayments = allPayments.filter(p => filteredShipmentIds.has(p.shipmentId));

    const totalPurchaseRmb = filteredShipments.reduce(
      (sum, s) => sum + parseFloat(s.purchaseCostRmb || "0"), 0
    );
    const totalPurchaseEgp = filteredShipments.reduce(
      (sum, s) => sum + parseFloat(s.purchaseCostEgp || "0"), 0
    );
    const totalShippingRmb = filteredShipments.reduce(
      (sum, s) => sum + parseFloat(s.shippingCostRmb || "0"), 0
    );
    const totalShippingEgp = filteredShipments.reduce(
      (sum, s) => sum + parseFloat(s.shippingCostEgp || "0"), 0
    );
    const totalCommissionRmb = filteredShipments.reduce(
      (sum, s) => sum + parseFloat(s.commissionCostRmb || "0"), 0
    );
    const totalCommissionEgp = filteredShipments.reduce(
      (sum, s) => sum + parseFloat(s.commissionCostEgp || "0"), 0
    );
    const totalCustomsEgp = filteredShipments.reduce(
      (sum, s) => sum + parseFloat(s.customsCostEgp || "0"), 0
    );
    const totalTakhreegEgp = filteredShipments.reduce(
      (sum, s) => sum + parseFloat(s.takhreegCostEgp || "0"), 0
    );
    const totalCostEgp = filteredShipments.reduce(
      (sum, s) => sum + parseFloat(s.finalTotalCostEgp || "0"), 0
    );
    const totalPaidEgp = filteredPayments.reduce(
      (sum, p) => sum + parseFloat(p.amountEgp || "0"), 0
    );
    const totalBalanceEgp = filteredShipments.reduce((sum, s) => {
      const cost = parseFloat(s.finalTotalCostEgp || "0");
      const paid = parseFloat(s.totalPaidEgp || "0");
      return sum + Math.max(0, cost - paid);
    }, 0);

    const unsettledShipmentsCount = filteredShipments.filter(s => {
      const cost = parseFloat(s.finalTotalCostEgp || "0");
      const paid = parseFloat(s.totalPaidEgp || "0");
      return Math.max(0, cost - paid) > 0.0001;
    }).length;

    return {
      totalPurchaseRmb: totalPurchaseRmb.toFixed(2),
      totalPurchaseEgp: totalPurchaseEgp.toFixed(2),
      totalShippingRmb: totalShippingRmb.toFixed(2),
      totalShippingEgp: totalShippingEgp.toFixed(2),
      totalCommissionRmb: totalCommissionRmb.toFixed(2),
      totalCommissionEgp: totalCommissionEgp.toFixed(2),
      totalCustomsEgp: totalCustomsEgp.toFixed(2),
      totalTakhreegEgp: totalTakhreegEgp.toFixed(2),
      totalCostEgp: totalCostEgp.toFixed(2),
      totalPaidEgp: totalPaidEgp.toFixed(2),
      totalBalanceEgp: totalBalanceEgp.toFixed(2),
      unsettledShipmentsCount,
    };
  }

  // Supplier Balances
  async getSupplierBalances(filters?: {
    dateFrom?: string;
    dateTo?: string;
    supplierId?: number;
    balanceType?: 'owing' | 'credit' | 'all';
  }) {
    const allSuppliers = await this.getAllSuppliers();
    const allShipments = await this.getAllShipments();
    const allPayments = await this.getAllPayments();
    const allItems = await Promise.all(
      allShipments.map(s => this.getShipmentItems(s.id))
    );

    const result: Array<{
      supplierId: number;
      supplierName: string;
      totalCostEgp: string;
      totalPaidEgp: string;
      balanceEgp: string;
      balanceStatus: 'owing' | 'settled' | 'credit';
    }> = [];

    for (const supplier of allSuppliers) {
      if (filters?.supplierId && supplier.id !== filters.supplierId) continue;

      const supplierShipmentIds = new Set<number>();
      allItems.forEach((items, idx) => {
        if (items.some(item => item.supplierId === supplier.id)) {
          supplierShipmentIds.add(allShipments[idx].id);
        }
      });

      let supplierShipments = allShipments.filter(s => supplierShipmentIds.has(s.id));

      if (filters?.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        supplierShipments = supplierShipments.filter(s => {
          const purchaseDate = s.purchaseDate ? new Date(s.purchaseDate) : null;
          return purchaseDate && purchaseDate >= fromDate;
        });
      }

      if (filters?.dateTo) {
        const toDate = new Date(filters.dateTo);
        supplierShipments = supplierShipments.filter(s => {
          const purchaseDate = s.purchaseDate ? new Date(s.purchaseDate) : null;
          return purchaseDate && purchaseDate <= toDate;
        });
      }

      const supplierShipmentIdsFiltered = new Set(supplierShipments.map(s => s.id));
      const supplierPayments = allPayments.filter(p => supplierShipmentIdsFiltered.has(p.shipmentId));

      const totalCost = supplierShipments.reduce(
        (sum, s) => sum + parseFloat(s.finalTotalCostEgp || "0"), 0
      );
      const totalPaid = supplierPayments.reduce(
        (sum, p) => sum + parseFloat(p.amountEgp || "0"), 0
      );
      const balance = totalCost - totalPaid;

      let balanceStatus: 'owing' | 'settled' | 'credit' = 'settled';
      if (balance > 0.0001) balanceStatus = 'owing';
      else if (balance < -0.0001) balanceStatus = 'credit';

      if (filters?.balanceType && filters.balanceType !== 'all') {
        if (filters.balanceType === 'owing' && balanceStatus !== 'owing') continue;
        if (filters.balanceType === 'credit' && balanceStatus !== 'credit') continue;
      }

      result.push({
        supplierId: supplier.id,
        supplierName: supplier.name,
        totalCostEgp: totalCost.toFixed(2),
        totalPaidEgp: totalPaid.toFixed(2),
        balanceEgp: balance.toFixed(2),
        balanceStatus,
      });
    }

    return result;
  }

  // Supplier Statement
  async getSupplierStatement(supplierId: number, filters?: {
    dateFrom?: string;
    dateTo?: string;
  }) {
    const supplier = await this.getSupplier(supplierId);
    if (!supplier) {
      throw new Error("Supplier not found");
    }

    const allShipments = await this.getAllShipments();
    const allPayments = await this.getAllPayments();
    const allItems = await Promise.all(
      allShipments.map(s => this.getShipmentItems(s.id))
    );

    const supplierShipmentIds = new Set<number>();
    allItems.forEach((items, idx) => {
      if (items.some(item => item.supplierId === supplierId)) {
        supplierShipmentIds.add(allShipments[idx].id);
      }
    });

    let supplierShipments = allShipments.filter(s => supplierShipmentIds.has(s.id));
    let supplierPayments = allPayments.filter(p => supplierShipmentIds.has(p.shipmentId));

    if (filters?.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      supplierShipments = supplierShipments.filter(s => {
        const purchaseDate = s.purchaseDate ? new Date(s.purchaseDate) : null;
        return purchaseDate && purchaseDate >= fromDate;
      });
      supplierPayments = supplierPayments.filter(p => new Date(p.paymentDate) >= fromDate);
    }

    if (filters?.dateTo) {
      const toDate = new Date(filters.dateTo);
      supplierShipments = supplierShipments.filter(s => {
        const purchaseDate = s.purchaseDate ? new Date(s.purchaseDate) : null;
        return purchaseDate && purchaseDate <= toDate;
      });
      supplierPayments = supplierPayments.filter(p => new Date(p.paymentDate) <= toDate);
    }

    const movements: Array<{
      date: Date | string;
      type: 'shipment' | 'payment';
      description: string;
      shipmentCode?: string;
      costEgp?: string;
      paidEgp?: string;
      runningBalance: string;
    }> = [];

    supplierShipments.forEach(s => {
      movements.push({
        date: s.purchaseDate || s.createdAt || new Date(),
        type: 'shipment',
        description: `شحنة: ${s.shipmentName}`,
        shipmentCode: s.shipmentCode,
        costEgp: s.finalTotalCostEgp || "0",
        runningBalance: "0",
      });
    });

    supplierPayments.forEach(p => {
      const shipment = allShipments.find(s => s.id === p.shipmentId);
      movements.push({
        date: p.paymentDate,
        type: 'payment',
        description: `دفعة - ${p.costComponent}`,
        shipmentCode: shipment?.shipmentCode,
        paidEgp: p.amountEgp || "0",
        runningBalance: "0",
      });
    });

    movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    movements.forEach(m => {
      if (m.type === 'shipment') {
        runningBalance += parseFloat(m.costEgp || "0");
      } else {
        runningBalance -= parseFloat(m.paidEgp || "0");
      }
      m.runningBalance = runningBalance.toFixed(2);
    });

    return { supplier, movements };
  }

  // Movement Report
  async getMovementReport(filters?: {
    dateFrom?: string;
    dateTo?: string;
    shipmentId?: number;
    supplierId?: number;
    movementType?: string;
    costComponent?: string;
    paymentMethod?: string;
    shipmentStatus?: string;
    paymentStatus?: string;
    includeArchived?: boolean;
  }) {
    const allShipments = await this.getAllShipments();
    const allPayments = await this.getAllPayments();
    const allSuppliers = await this.getAllSuppliers();
    const allUsers = await this.getAllUsers();
    const allItems = await Promise.all(
      allShipments.map(s => this.getShipmentItems(s.id))
    );

    const supplierMap = new Map(allSuppliers.map(s => [s.id, s.name]));
    const userMap = new Map(allUsers.map(u => [u.id, u.firstName || u.username]));

    let filteredShipments = allShipments;
    
    if (!filters?.includeArchived) {
      filteredShipments = filteredShipments.filter(s => s.status !== "مؤرشفة");
    }

    if (filters?.shipmentStatus && filters.shipmentStatus !== "all") {
      filteredShipments = filteredShipments.filter((s) => s.status === filters.shipmentStatus);
    }

    if (filters?.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filteredShipments = filteredShipments.filter(s => {
        const purchaseDate = s.purchaseDate ? new Date(s.purchaseDate) : null;
        return purchaseDate && purchaseDate >= fromDate;
      });
    }

    if (filters?.dateTo) {
      const toDate = new Date(filters.dateTo);
      filteredShipments = filteredShipments.filter(s => {
        const purchaseDate = s.purchaseDate ? new Date(s.purchaseDate) : null;
        return purchaseDate && purchaseDate <= toDate;
      });
    }

    if (filters?.shipmentId) {
      filteredShipments = filteredShipments.filter(s => s.id === filters.shipmentId);
    }

    if (filters?.supplierId) {
      const shipmentIdsWithSupplier = new Set<number>();
      allItems.forEach((items, idx) => {
        if (items.some(item => item.supplierId === filters.supplierId)) {
          shipmentIdsWithSupplier.add(allShipments[idx].id);
        }
      });
      filteredShipments = filteredShipments.filter(s => shipmentIdsWithSupplier.has(s.id));
    }

    if (filters?.paymentStatus && filters.paymentStatus !== "all") {
      filteredShipments = filteredShipments.filter((s) => {
        const cost = parseFloat(s.finalTotalCostEgp || "0");
        const paid = parseFloat(s.totalPaidEgp || "0");
        const balance = Math.max(0, cost - paid);
        if (filters.paymentStatus === "لم يتم دفع أي مبلغ") return paid <= 0.0001;
        if (filters.paymentStatus === "مسددة بالكامل") return balance <= 0.0001;
        if (filters.paymentStatus === "مدفوعة جزئياً") return paid > 0.0001 && balance > 0.0001;
        return true;
      });
    }

    const filteredShipmentIds = new Set(filteredShipments.map(s => s.id));

    const movements: Array<{
      date: Date | string;
      shipmentCode: string;
      shipmentName: string;
      supplierName?: string;
      supplierId?: number;
      movementType: string;
      costComponent?: string;
      paymentMethod?: string;
      originalCurrency?: string;
      amountOriginal?: string;
      amountEgp: string;
      direction: 'cost' | 'payment';
      userName?: string;
    }> = [];

    const shipmentSupplierMap = new Map<number, number | undefined>();
    allItems.forEach((items, idx) => {
      const firstSupplier = items.find(i => i.supplierId)?.supplierId;
      shipmentSupplierMap.set(allShipments[idx].id, firstSupplier ?? undefined);
    });

    for (const s of filteredShipments) {
      const supplierId = shipmentSupplierMap.get(s.id);
      const supplierName = supplierId ? supplierMap.get(supplierId) : undefined;

      const costTypes = [
        { type: "تكلفة بضاعة", rmb: s.purchaseCostRmb, egp: s.purchaseCostEgp },
        { type: "تكلفة شحن", rmb: s.shippingCostRmb, egp: s.shippingCostEgp },
        { type: "عمولة", rmb: s.commissionCostRmb, egp: s.commissionCostEgp },
        { type: "جمرك", rmb: null, egp: s.customsCostEgp },
        { type: "تخريج", rmb: null, egp: s.takhreegCostEgp },
      ];

      for (const ct of costTypes) {
        const egpAmount = parseFloat(ct.egp || "0");
        if (egpAmount <= 0) continue;

        if (filters?.movementType && filters.movementType !== ct.type && filters.movementType !== 'all') {
          continue;
        }

        movements.push({
          date: s.purchaseDate || s.createdAt || new Date(),
          shipmentCode: s.shipmentCode,
          shipmentName: s.shipmentName,
          supplierName,
          supplierId,
          movementType: ct.type,
          originalCurrency: ct.rmb ? "RMB" : "EGP",
          amountOriginal: ct.rmb || ct.egp || "0",
          amountEgp: ct.egp || "0",
          direction: 'cost',
        });
      }
    }

    let filteredPayments = allPayments.filter(p => filteredShipmentIds.has(p.shipmentId));

    if (filters?.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filteredPayments = filteredPayments.filter(p => new Date(p.paymentDate) >= fromDate);
    }

    if (filters?.dateTo) {
      const toDate = new Date(filters.dateTo);
      filteredPayments = filteredPayments.filter(p => new Date(p.paymentDate) <= toDate);
    }

    if (filters?.costComponent) {
      filteredPayments = filteredPayments.filter(p => p.costComponent === filters.costComponent);
    }

    if (filters?.paymentMethod) {
      filteredPayments = filteredPayments.filter(p => p.paymentMethod === filters.paymentMethod);
    }

    for (const p of filteredPayments) {
      const shipment = allShipments.find(s => s.id === p.shipmentId);
      if (!shipment) continue;

      if (filters?.movementType && filters.movementType !== 'دفعة' && filters.movementType !== 'all') {
        continue;
      }

      const supplierId = shipmentSupplierMap.get(p.shipmentId);
      const supplierName = supplierId ? supplierMap.get(supplierId) : undefined;
      const userName = p.createdByUserId ? userMap.get(p.createdByUserId) : undefined;

      movements.push({
        date: p.paymentDate,
        shipmentCode: shipment.shipmentCode,
        shipmentName: shipment.shipmentName,
        supplierName,
        supplierId,
        movementType: "دفعة",
        costComponent: p.costComponent,
        paymentMethod: p.paymentMethod,
        originalCurrency: p.paymentCurrency,
        amountOriginal: p.amountOriginal || "0",
        amountEgp: p.amountEgp || "0",
        direction: 'payment',
        userName,
      });
    }

    movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const totalCostEgp = movements
      .filter(m => m.direction === 'cost')
      .reduce((sum, m) => sum + parseFloat(m.amountEgp), 0);

    const totalPaidEgp = movements
      .filter(m => m.direction === 'payment')
      .reduce((sum, m) => sum + parseFloat(m.amountEgp), 0);

    return {
      movements,
      totalCostEgp: totalCostEgp.toFixed(2),
      totalPaidEgp: totalPaidEgp.toFixed(2),
      netMovement: (totalCostEgp - totalPaidEgp).toFixed(2),
    };
  }

  // Payment Methods Report
  async getPaymentMethodsReport(filters?: {
    dateFrom?: string;
    dateTo?: string;
  }) {
    let allPayments = await this.getAllPayments();

    if (filters?.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      allPayments = allPayments.filter(p => new Date(p.paymentDate) >= fromDate);
    }

    if (filters?.dateTo) {
      const toDate = new Date(filters.dateTo);
      allPayments = allPayments.filter(p => new Date(p.paymentDate) <= toDate);
    }

    const methodStats = new Map<string, { count: number; total: number }>();

    for (const p of allPayments) {
      const method = p.paymentMethod || "أخرى";
      const current = methodStats.get(method) || { count: 0, total: 0 };
      current.count += 1;
      current.total += parseFloat(p.amountEgp || "0");
      methodStats.set(method, current);
    }

    return Array.from(methodStats.entries()).map(([method, stats]) => ({
      paymentMethod: method,
      paymentCount: stats.count,
      totalAmountEgp: stats.total.toFixed(2),
    }));
  }
}

export const storage = new DatabaseStorage();
