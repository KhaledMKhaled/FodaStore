import { eq, desc, and, sql } from "drizzle-orm";
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
    totalOverpaidEgp: string;
    recentShipments: Shipment[];
    pendingShipments: number;
    completedShipments: number;
  }>;

  // Payment Stats
  getPaymentStats(): Promise<{
    totalCostEgp: string;
    totalPaidEgp: string;
    totalBalanceEgp: string;
    totalOverpaidEgp: string;
    lastPayment: ShipmentPayment | null;
  }>;

  // Inventory Stats
  getInventoryStats(): Promise<{
    totalPieces: number;
    totalCostEgp: string;
    totalItems: number;
    avgUnitCostEgp: string;
  }>;
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
    const [payment] = await db.insert(shipmentPayments).values(data).returning();

    // Update shipment totals
    const allPayments = await this.getShipmentPayments(data.shipmentId);
    const totalPaid = allPayments.reduce(
      (sum, p) => sum + parseFloat(p.amountEgp),
      0
    );

    // Ensure we persist the actual latest payment date (not the server time)
    const latestPaymentDate =
      allPayments.reduce<Date | null>((latest, payment) => {
        const candidate = payment.paymentDate || payment.createdAt || null;
        if (!candidate) return latest;
        if (!latest || candidate.getTime() > latest.getTime()) {
          return candidate;
        }
        return latest;
      }, null) || data.paymentDate || new Date();

    const shipment = await this.getShipment(data.shipmentId);
    if (shipment) {
      const finalCost = parseFloat(shipment.finalTotalCostEgp || "0");
      // remaining should never be negative; keep overpaid separately (derived on the client)
      const remaining = Math.max(0, finalCost - totalPaid);

      await this.updateShipment(data.shipmentId, {
        totalPaidEgp: totalPaid.toFixed(2),
        balanceEgp: remaining.toFixed(2),
        lastPaymentDate: latestPaymentDate,
      });
    }

    return payment;
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

    // Calculate remaining and overpaid correctly
    // remaining = max(0, cost - paid) per shipment
    // overpaid = max(0, paid - cost) per shipment
    let totalBalanceEgp = 0;
    let totalOverpaidEgp = 0;

    allShipments.forEach((s) => {
      const cost = parseFloat(s.finalTotalCostEgp || "0");
      const paid = parseFloat(s.totalPaidEgp || "0");
      const remaining = Math.max(0, cost - paid);
      const overpaid = Math.max(0, paid - cost);
      totalBalanceEgp += remaining;
      totalOverpaidEgp += overpaid;
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
      totalOverpaidEgp: totalOverpaidEgp.toFixed(2),
      recentShipments,
      pendingShipments,
      completedShipments,
    };
  }

  // Payment Stats
  async getPaymentStats() {
    const allShipments = await this.getAllShipments();
    const allPayments = await this.getAllPayments();

    const totalCostEgp = allShipments.reduce(
      (sum, s) => sum + parseFloat(s.finalTotalCostEgp || "0"),
      0
    );

    const totalPaidEgp = allShipments.reduce(
      (sum, s) => sum + parseFloat(s.totalPaidEgp || "0"),
      0
    );

    // Calculate remaining and overpaid correctly
    // remaining = max(0, cost - paid) per shipment
    // overpaid = max(0, paid - cost) per shipment
    let totalBalanceEgp = 0;
    let totalOverpaidEgp = 0;

    allShipments.forEach((s) => {
      const cost = parseFloat(s.finalTotalCostEgp || "0");
      const paid = parseFloat(s.totalPaidEgp || "0");
      const remaining = Math.max(0, cost - paid);
      const overpaid = Math.max(0, paid - cost);
      totalBalanceEgp += remaining;
      totalOverpaidEgp += overpaid;
    });

    const lastPayment = allPayments.length > 0 ? allPayments[0] : null;

    return {
      totalCostEgp: totalCostEgp.toFixed(2),
      totalPaidEgp: totalPaidEgp.toFixed(2),
      totalBalanceEgp: totalBalanceEgp.toFixed(2),
      totalOverpaidEgp: totalOverpaidEgp.toFixed(2),
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
}

export const storage = new DatabaseStorage();
