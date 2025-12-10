import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
 codex/add-role-based-middleware-for-requests
import { setupAuth, isAuthenticated, requireRole } from "./auth";
=======
 codex/add-audit-logging-for-write-operations
import { setupAuth, isAuthenticated, isAdmin } from "./auth";
import { logAuditEvent } from "./audit";
=======
import { setupAuth, isAuthenticated, requireRole } from "./auth";
 main
 main
import type { User } from "@shared/schema";
import {
  insertSupplierSchema,
  insertExchangeRateSchema,
  insertShipmentPaymentSchema,
} from "@shared/schema";
import bcrypt from "bcryptjs";
codex/refactor-shipment-flow-into-service
import { shipmentService, ShipmentServiceError } from "./services/shipments";
=======
 codex/modify-payments-listing-to-include-shipments
import { getPaymentsWithShipments } from "./payments";
=======
import { logAuditEvent } from "./audit";
main
main

export async function registerRoutes(httpServer: Server, app: Express): Promise<void> {
  // Setup authentication
  await setupAuth(app);

  // Auth routes
  app.get("/api/auth/user", async (req, res) => {
    if (req.isAuthenticated() && req.user) {
      const user = await storage.getUser(req.user.id);
      if (user) {
        const { password, ...userWithoutPassword } = user;
        return res.json(userWithoutPassword);
      }
    }
    res.status(401).json({ message: "Unauthorized" });
  });

  // Dashboard
  app.get("/api/dashboard/stats", isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Error fetching dashboard stats" });
    }
  });

  // Suppliers
  app.get("/api/suppliers", isAuthenticated, async (req, res) => {
    try {
      const suppliers = await storage.getAllSuppliers();
      res.json(suppliers);
    } catch (error) {
      res.status(500).json({ message: "Error fetching suppliers" });
    }
  });

  app.get("/api/suppliers/:id", isAuthenticated, async (req, res) => {
    try {
      const supplier = await storage.getSupplier(parseInt(req.params.id));
      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }
      res.json(supplier);
    } catch (error) {
      res.status(500).json({ message: "Error fetching supplier" });
    }
  });

  app.post("/api/suppliers", requireRole(["مدير", "محاسب"]), async (req, res) => {
    try {
      const data = insertSupplierSchema.parse(req.body);
      const supplier = await storage.createSupplier(data);
      res.json(supplier);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.patch("/api/suppliers/:id", requireRole(["مدير", "محاسب"]), async (req, res) => {
    try {
      const supplier = await storage.updateSupplier(parseInt(req.params.id), req.body);
      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }
      res.json(supplier);
    } catch (error) {
      res.status(500).json({ message: "Error updating supplier" });
    }
  });

  app.delete("/api/suppliers/:id", requireRole(["مدير", "محاسب"]), async (req, res) => {
    try {
      await storage.deleteSupplier(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Error deleting supplier" });
    }
  });

  // Shipments
  app.get("/api/shipments", isAuthenticated, async (req, res) => {
    try {
      const shipments = await storage.getAllShipments();
      res.json(shipments);
    } catch (error) {
      res.status(500).json({ message: "Error fetching shipments" });
    }
  });

  app.get("/api/shipments/:id", isAuthenticated, async (req, res) => {
    try {
      const shipment = await storage.getShipment(parseInt(req.params.id));
      if (!shipment) {
        return res.status(404).json({ message: "Shipment not found" });
      }
      res.json(shipment);
    } catch (error) {
      res.status(500).json({ message: "Error fetching shipment" });
    }
  });

  app.post("/api/shipments", requireRole(["مدير", "محاسب"]), async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
codex/refactor-shipment-flow-into-service
      const shipment = await shipmentService.createShipment(req.body, userId);
      res.json(shipment);
=======

      // Create shipment
      const shipment = await storage.createShipment({
        ...shipmentData,
        createdByUserId: userId,
      });

      // Create items if provided
      if (items && Array.isArray(items)) {
        for (const item of items) {
          await storage.createShipmentItem({
            ...item,
            shipmentId: shipment.id,
          });
        }
      }

      // Calculate totals from items
      const allItems = await storage.getShipmentItems(shipment.id);
      const totalPurchaseCostRmb = allItems.reduce(
        (sum, item) => sum + parseFloat(item.totalPurchaseCostRmb || "0"),
        0
      );

      const totalCustomsCostEgp = allItems.reduce((sum, item) => {
        const ctn = item.cartonsCtn || 0;
        const customsPerCarton = parseFloat(item.customsCostPerCartonEgp || "0");
        return sum + ctn * customsPerCarton;
      }, 0);

      const totalTakhreegCostEgp = allItems.reduce((sum, item) => {
        const ctn = item.cartonsCtn || 0;
        const takhreegPerCarton = parseFloat(item.takhreegCostPerCartonEgp || "0");
        return sum + ctn * takhreegPerCarton;
      }, 0);

      // Get latest exchange rate for preliminary purchase cost calculation
      const latestRmbRate = await storage.getLatestRate("RMB", "EGP");
      const rmbToEgp = latestRmbRate ? parseFloat(latestRmbRate.rateValue) : 7.15;
      const purchaseCostEgp = totalPurchaseCostRmb * rmbToEgp;

      // Calculate preliminary total including estimated purchase cost
      const finalTotalCostEgp = purchaseCostEgp + totalCustomsCostEgp + totalTakhreegCostEgp;

      await storage.updateShipment(shipment.id, {
        purchaseCostRmb: totalPurchaseCostRmb.toFixed(2),
        purchaseCostEgp: purchaseCostEgp.toFixed(2),
        customsCostEgp: totalCustomsCostEgp.toFixed(2),
        takhreegCostEgp: totalTakhreegCostEgp.toFixed(2),
        finalTotalCostEgp: finalTotalCostEgp.toFixed(2),
        balanceEgp: finalTotalCostEgp.toFixed(2),
      });

      const updatedShipment = await storage.getShipment(shipment.id);
 codex/add-audit-logging-for-write-operations

      logAuditEvent({
        userId,
        entityType: "SHIPMENT",
        entityId: shipment.id,
        actionType: "CREATE",
        details: {
          shipment: updatedShipment,
          items,
=======
      void logAuditEvent({
        userId,
        entityType: "SHIPMENT",
        entityId: shipment.id.toString(),
        actionType: "CREATE",
        details: {
          status: updatedShipment?.status,
          itemCount: allItems.length,
 main
        },
      });
      res.json(updatedShipment);
main
    } catch (error) {
      if (error instanceof ShipmentServiceError) {
        return res.status(error.status).json({ message: error.message });
      }
      console.error("Error creating shipment:", error);
      res.status(500).json({ message: "حدث خطأ أثناء إنشاء الشحنة" });
    }
  });

  app.patch("/api/shipments/:id", requireRole(["مدير", "محاسب"]), async (req, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
codex/refactor-shipment-flow-into-service
      const updatedShipment = await shipmentService.updateShipment(shipmentId, req.body);
=======
      const { step, shipmentData, items, shippingData } = req.body;
      const userId = (req.user as any)?.id;

      // Validate shipment exists
      const existingShipment = await storage.getShipment(shipmentId);
      if (!existingShipment) {
        return res.status(404).json({ message: "الشحنة غير موجودة" });
      }
      const previousStatus = existingShipment.status;

      // Update shipment basic data
      if (shipmentData) {
        await storage.updateShipment(shipmentId, shipmentData);
      }

      // Update items
      if (items && Array.isArray(items)) {
        // Delete existing items and re-create
        await storage.deleteShipmentItems(shipmentId);
        for (const item of items) {
          await storage.createShipmentItem({
            ...item,
            shipmentId,
          });
        }

        // Recalculate totals
        const allItems = await storage.getShipmentItems(shipmentId);
        const totalPurchaseCostRmb = allItems.reduce(
          (sum, item) => sum + parseFloat(item.totalPurchaseCostRmb || "0"),
          0
        );

        const totalCustomsCostEgp = allItems.reduce((sum, item) => {
          const ctn = item.cartonsCtn || 0;
          const customsPerCarton = parseFloat(item.customsCostPerCartonEgp || "0");
          return sum + ctn * customsPerCarton;
        }, 0);

        const totalTakhreegCostEgp = allItems.reduce((sum, item) => {
          const ctn = item.cartonsCtn || 0;
          const takhreegPerCarton = parseFloat(item.takhreegCostPerCartonEgp || "0");
          return sum + ctn * takhreegPerCarton;
        }, 0);

        await storage.updateShipment(shipmentId, {
          purchaseCostRmb: totalPurchaseCostRmb.toFixed(2),
          customsCostEgp: totalCustomsCostEgp.toFixed(2),
          takhreegCostEgp: totalTakhreegCostEgp.toFixed(2),
        });
      }

      // Update shipping details
      if (shippingData) {
        const rmbToEgp = parseFloat(shippingData.rmbToEgpRate || "1");
        const usdToRmb = parseFloat(shippingData.usdToRmbRate || "1");

        const shipment = await storage.getShipment(shipmentId);
        const totalPurchaseCostRmb = parseFloat(shipment?.purchaseCostRmb || "0");

        const commissionRmb =
          (totalPurchaseCostRmb * parseFloat(shippingData.commissionRatePercent || "0")) / 100;
        const commissionEgp = commissionRmb * rmbToEgp;

        const shippingCostUsd =
          parseFloat(shippingData.shippingAreaSqm || "0") *
          parseFloat(shippingData.shippingCostPerSqmUsdOriginal || "0");
        const shippingCostRmb = shippingCostUsd * usdToRmb;
        const shippingCostEgp = shippingCostRmb * rmbToEgp;

        await storage.upsertShippingDetails({
          shipmentId,
          totalPurchaseCostRmb: totalPurchaseCostRmb.toFixed(2),
          commissionRatePercent: shippingData.commissionRatePercent,
          commissionValueRmb: commissionRmb.toFixed(2),
          commissionValueEgp: commissionEgp.toFixed(2),
          shippingAreaSqm: shippingData.shippingAreaSqm,
          shippingCostPerSqmUsdOriginal: shippingData.shippingCostPerSqmUsdOriginal,
          totalShippingCostUsdOriginal: shippingCostUsd.toFixed(2),
          totalShippingCostRmb: shippingCostRmb.toFixed(2),
          totalShippingCostEgp: shippingCostEgp.toFixed(2),
          shippingDate: shippingData.shippingDate,
          rmbToEgpRateAtShipping: shippingData.rmbToEgpRate,
          usdToRmbRateAtShipping: shippingData.usdToRmbRate,
        });

        // Update shipment costs
        const purchaseCostEgp = totalPurchaseCostRmb * rmbToEgp;

        await storage.updateShipment(shipmentId, {
          purchaseCostEgp: purchaseCostEgp.toFixed(2),
          commissionCostRmb: commissionRmb.toFixed(2),
          commissionCostEgp: commissionEgp.toFixed(2),
          shippingCostRmb: shippingCostRmb.toFixed(2),
          shippingCostEgp: shippingCostEgp.toFixed(2),
        });
      }

      // Always calculate final total (running total at any step)
      const shipment = await storage.getShipment(shipmentId);
      if (shipment) {
        const purchaseCostEgp = parseFloat(shipment.purchaseCostEgp || "0");
        const commissionCostEgp = parseFloat(shipment.commissionCostEgp || "0");
        const shippingCostEgp = parseFloat(shipment.shippingCostEgp || "0");
        const customsCostEgp = parseFloat(shipment.customsCostEgp || "0");
        const takhreegCostEgp = parseFloat(shipment.takhreegCostEgp || "0");

        const finalTotalCostEgp =
          purchaseCostEgp + commissionCostEgp + shippingCostEgp + customsCostEgp + takhreegCostEgp;

        const totalPaidEgp = parseFloat(shipment.totalPaidEgp || "0");
        // Balance should never be negative; any overpayment is shown separately in the UI
        const balanceEgp = Math.max(0, finalTotalCostEgp - totalPaidEgp);

        // Auto-update status based on step
        let newStatus = shipment.status;
        if (step === 2 && shippingData) {
          // After shipping details are saved
          newStatus = "جاهزة للاستلام";
        } else if (step === 4) {
          // Final step - shipment completed
          newStatus = "مستلمة بنجاح";
        }

        await storage.updateShipment(shipmentId, {
          finalTotalCostEgp: finalTotalCostEgp.toFixed(2),
          balanceEgp: balanceEgp.toFixed(2),
          status: newStatus,
        });
      }

      const updatedShipment = await storage.getShipment(shipmentId);
 codex/add-audit-logging-for-write-operations
      logAuditEvent({
        userId,
        entityType: "SHIPMENT",
        entityId: shipmentId,
        actionType: "UPDATE",
        details: { step, shipmentData, items, shippingData, updatedShipment },
      });

      if (existingShipment && updatedShipment && existingShipment.status !== updatedShipment.status) {
        logAuditEvent({
          userId,
          entityType: "SHIPMENT",
          entityId: shipmentId,
          actionType: "STATUS_CHANGE",
          details: { from: existingShipment.status, to: updatedShipment.status },
        });
      }
=======
      void logAuditEvent({
        userId,
        entityType: "SHIPMENT",
        entityId: shipmentId.toString(),
        actionType: "UPDATE",
        details: {
          step,
          status: updatedShipment?.status,
        },
      });
      if (updatedShipment && updatedShipment.status !== previousStatus) {
        void logAuditEvent({
          userId,
          entityType: "SHIPMENT",
          entityId: shipmentId.toString(),
          actionType: "STATUS_CHANGE",
          details: { from: previousStatus, to: updatedShipment.status },
        });
      }
main
 main
      res.json(updatedShipment);
    } catch (error) {
      if (error instanceof ShipmentServiceError) {
        return res.status(error.status).json({ message: error.message });
      }
      console.error("Error updating shipment:", error);
      res.status(500).json({ message: "حدث خطأ أثناء حفظ بيانات الشحنة" });
    }
  });

  app.delete("/api/shipments/:id", requireRole(["مدير", "محاسب"]), async (req, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      await storage.deleteShipment(shipmentId);
 codex/add-audit-logging-for-write-operations
      const userId = (req.user as any)?.id;
      logAuditEvent({
        userId,
        entityType: "SHIPMENT",
        entityId: shipmentId,
        actionType: "DELETE",
        details: { shipmentId },
=======
      void logAuditEvent({
        userId: (req.user as any)?.id,
        entityType: "SHIPMENT",
        entityId: shipmentId.toString(),
        actionType: "DELETE",
 main
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Error deleting shipment" });
    }
  });

  // Shipment Items
  app.get("/api/shipments/:id/items", isAuthenticated, async (req, res) => {
    try {
      const items = await storage.getShipmentItems(parseInt(req.params.id));
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Error fetching items" });
    }
  });

  // Shipment Shipping Details
  app.get("/api/shipments/:id/shipping", isAuthenticated, async (req, res) => {
    try {
      const details = await storage.getShippingDetails(parseInt(req.params.id));
      res.json(details || null);
    } catch (error) {
      res.status(500).json({ message: "Error fetching shipping details" });
    }
  });

  // Exchange Rates
  app.get("/api/exchange-rates", isAuthenticated, async (req, res) => {
    try {
      const rates = await storage.getAllExchangeRates();
      res.json(rates);
    } catch (error) {
      res.status(500).json({ message: "Error fetching exchange rates" });
    }
  });

  app.post("/api/exchange-rates", requireRole(["مدير", "محاسب"]), async (req, res) => {
    try {
      const data = insertExchangeRateSchema.parse(req.body);
      const userId = (req.user as any)?.id;
      const rate = await storage.createExchangeRate(data);
 codex/add-audit-logging-for-write-operations
      const userId = (req.user as any)?.id;

      logAuditEvent({
        userId,
        entityType: "EXCHANGE_RATE",
        entityId: rate.id,
        actionType: "CREATE",
        details: rate,
=======
      void logAuditEvent({
        userId,
        entityType: "EXCHANGE_RATE",
        entityId: rate.id.toString(),
        actionType: "CREATE",
        details: { from: rate.fromCurrency, to: rate.toCurrency },
 main
      });
      res.json(rate);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  // Manual/automatic refresh - simulate external update
 codex/add-role-based-middleware-for-requests
  app.post(
    "/api/exchange-rates/refresh",
    requireRole(["مدير", "محاسب"]),
    async (_req, res) => {
=======
 codex/add-audit-logging-for-write-operations
  app.post("/api/exchange-rates/refresh", isAuthenticated, async (req, res) => {
=======
 codex/add-role-based-middleware-for-routes
  app.post("/api/exchange-rates/refresh", requireRole(["مدير", "محاسب"]), async (_req, res) => {
=======
  app.post("/api/exchange-rates/refresh", isAuthenticated, async (req, res) => {
main
 main
 main
    try {
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const latestRmb = await storage.getLatestRate("RMB", "EGP");
      const latestUsd = await storage.getLatestRate("USD", "RMB");
      const userId = (req.user as any)?.id;

      const refreshed = await Promise.all([
        storage.createExchangeRate({
          rateDate: todayStr,
          fromCurrency: "RMB",
          toCurrency: "EGP",
          rateValue: latestRmb?.rateValue || "7.0000",
          source: "تحديث تلقائي",
        }),
        storage.createExchangeRate({
          rateDate: todayStr,
          fromCurrency: "USD",
          toCurrency: "RMB",
          rateValue: latestUsd?.rateValue || "7.2000",
          source: "تحديث تلقائي",
        }),
      ]);

 codex/add-audit-logging-for-write-operations
      refreshed.forEach((rate) =>
        logAuditEvent({
          userId,
          entityType: "EXCHANGE_RATE",
          entityId: rate.id,
          actionType: "CREATE",
          details: rate,
        })
      );
=======
      refreshed.forEach((rate) => {
        void logAuditEvent({
          userId,
          entityType: "EXCHANGE_RATE",
          entityId: rate.id.toString(),
          actionType: "CREATE",
          details: { from: rate.fromCurrency, to: rate.toCurrency },
        });
      });
 main

      res.json({
        message: "تم تحديث الأسعار",
        lastUpdated: today,
        rates: refreshed,
      });
    } catch (error) {
      console.error("Error refreshing exchange rates", error);
      res.status(500).json({ message: "تعذر تحديث أسعار الصرف" });
    }
  });

  // Payments
  app.get("/api/payments", isAuthenticated, async (req, res) => {
    try {
 codex/optimize-shipment-retrieval-for-payments
      const payments = await storage.getAllPayments();
      const shipmentIds = Array.from(
        new Set(payments.map((payment) => payment.shipmentId))
      );
      const shipments = await storage.getShipmentsByIds(shipmentIds);
      const shipmentMap = new Map(shipments.map((shipment) => [shipment.id, shipment]));

      const paymentsWithShipments = payments.map((payment) => ({
        ...payment,
        shipment: shipmentMap.get(payment.shipmentId),
      }));
=======
      const paymentsWithShipments = await getPaymentsWithShipments(storage);
 main
      res.json(paymentsWithShipments);
    } catch (error) {
      res.status(500).json({ message: "Error fetching payments" });
    }
  });

  app.get("/api/payments/stats", isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getPaymentStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Error fetching payment stats" });
    }
  });

  app.post("/api/payments", requireRole(["مدير", "محاسب"]), async (req, res) => {
    try {
      // Convert paymentDate string to Date object and validate
      let paymentDate: Date | undefined;
      if (req.body.paymentDate) {
        paymentDate = new Date(req.body.paymentDate);
        if (Number.isNaN(paymentDate.getTime())) {
          return res.status(400).json({ message: "تاريخ الدفع غير صالح" });
        }
      }
      const bodyWithDate = {
        ...req.body,
        paymentDate,
      };
      const data = insertShipmentPaymentSchema.parse(bodyWithDate);
      const userId = (req.user as any)?.id;
      const payment = await storage.createPayment({
        ...data,
        createdByUserId: userId,
      });
 codex/add-audit-logging-for-write-operations

      logAuditEvent({
        userId,
        entityType: "PAYMENT",
        entityId: payment.id,
        actionType: "CREATE",
        details: payment,
=======
      void logAuditEvent({
        userId,
        entityType: "PAYMENT",
        entityId: payment.id.toString(),
        actionType: "CREATE",
        details: { shipmentId: payment.shipmentId },
 main
      });
      res.json(payment);
    } catch (error) {
      console.error("Error creating payment:", error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  // Inventory
  app.get("/api/inventory", isAuthenticated, async (req, res) => {
    try {
      const movements = await storage.getAllInventoryMovements();
      // Include shipment and item info
      const movementsWithDetails = await Promise.all(
        movements.map(async (movement) => {
          const shipment = movement.shipmentId
            ? await storage.getShipment(movement.shipmentId)
            : null;
          const shipmentItems = movement.shipmentId
            ? await storage.getShipmentItems(movement.shipmentId)
            : [];
          const shipmentItem = shipmentItems.find(
            (item) => item.id === movement.shipmentItemId
          );
          return { ...movement, shipment, shipmentItem };
        })
      );
      res.json(movementsWithDetails);
    } catch (error) {
      res.status(500).json({ message: "Error fetching inventory" });
    }
  });

  app.get("/api/inventory/stats", isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getInventoryStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Error fetching inventory stats" });
    }
  });

  // Users
  app.get("/api/users", isAuthenticated, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const usersWithoutPasswords = allUsers.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ message: "Error fetching users" });
    }
  });

  // Create new user (admin only)
 codex/add-role-based-middleware-for-requests
  app.post("/api/users", requireRole(["مدير", "محاسب"]), async (req, res) => {
=======
  app.post("/api/users", requireRole(["مدير"]), async (req, res) => {
 main
    try {
      const { username, password, firstName, lastName, role } = req.body;
      const actorId = (req.user as any)?.id;
      
      if (!username || !password) {
        return res.status(400).json({ message: "اسم المستخدم وكلمة المرور مطلوبان" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "اسم المستخدم موجود بالفعل" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        role: role || "مشاهد",
      });

      const { password: _, ...userWithoutPassword } = user;
 codex/add-audit-logging-for-write-operations
      const currentUserId = (req.user as any)?.id;
      logAuditEvent({
        userId: currentUserId,
        entityType: "USER",
        entityId: user.id,
        actionType: "CREATE",
        details: userWithoutPassword,
=======
      void logAuditEvent({
        userId: actorId,
        entityType: "USER",
        entityId: user.id,
        actionType: "CREATE",
        details: { role: user.role },
main
      });
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Error creating user" });
    }
  });

  // Update user (admin only, or self for password)
  app.patch("/api/users/:id", requireRole(["مدير", "محاسب"]), async (req, res) => {
    try {
      const { id } = req.params;
      const { password, firstName, lastName, role } = req.body;
      const currentUser = req.user!;
      const actorId = (req.user as any)?.id;

      // Only admin can update other users or roles
      if (currentUser.id !== id && currentUser.role !== "مدير") {
        return res
          .status(403)
          .json({ message: "لا تملك صلاحية لتعديل مستخدمين آخرين" });
      }

      // Non-admins can only update their own password
      if (currentUser.id === id && currentUser.role !== "مدير" && role) {
        return res.status(403).json({ message: "غير مصرح بتغيير الدور" });
      }

      const updateData: any = {};
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (role !== undefined && currentUser.role === "مدير") updateData.role = role;

      const user = await storage.updateUser(id, updateData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password: _, ...userWithoutPassword } = user;
 codex/add-audit-logging-for-write-operations
      logAuditEvent({
        userId: currentUser.id,
        entityType: "USER",
        entityId: user.id,
        actionType: "UPDATE",
        details: { updatedFields: Object.keys(updateData), user: userWithoutPassword },
=======
      void logAuditEvent({
        userId: actorId,
        entityType: "USER",
        entityId: user.id,
        actionType: "UPDATE",
        details: { updatedFields: Object.keys(updateData) },
main
      });
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Error updating user" });
    }
  });

 codex/add-role-based-middleware-for-requests
  app.patch("/api/users/:id/role", requireRole(["مدير", "محاسب"]), async (req, res) => {
=======
  app.patch("/api/users/:id/role", requireRole(["مدير"]), async (req, res) => {
 main
    try {
      const { role } = req.body;
      const user = await storage.updateUserRole(req.params.id, role);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password: _, ...userWithoutPassword } = user;
 codex/add-audit-logging-for-write-operations
      const currentUserId = (req.user as any)?.id;
      logAuditEvent({
        userId: currentUserId,
        entityType: "USER",
        entityId: user.id,
        actionType: "UPDATE",
        details: { role, user: userWithoutPassword },
=======
      void logAuditEvent({
        userId: (req.user as any)?.id,
        entityType: "USER",
        entityId: user.id,
        actionType: "UPDATE",
        details: { role: user.role },
 main
      });
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Error updating user role" });
    }
  });

  // Delete user (admin only)
 codex/add-role-based-middleware-for-requests
  app.delete("/api/users/:id", requireRole(["مدير", "محاسب"]), async (req, res) => {
=======
  app.delete("/api/users/:id", requireRole(["مدير"]), async (req, res) => {
 main
    try {
      const { id } = req.params;
      const currentUser = req.user!;
      const actorId = (req.user as any)?.id;

      // Prevent deleting yourself
      if (currentUser.id === id) {
        return res.status(400).json({ message: "لا يمكن حذف حسابك الخاص" });
      }

      // Prevent deleting root user
      const targetUser = await storage.getUser(id);
      if (targetUser?.username === "root") {
        return res.status(400).json({ message: "لا يمكن حذف حساب الجذر" });
      }

      await storage.deleteUser(id);
 codex/add-audit-logging-for-write-operations
      logAuditEvent({
        userId: currentUser.id,
        entityType: "USER",
        entityId: id,
        actionType: "DELETE",
        details: { deletedUserId: id },
=======
      void logAuditEvent({
        userId: actorId,
        entityType: "USER",
        entityId: id,
        actionType: "DELETE",
 main
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Error deleting user" });
    }
  });

  // Change own password
  app.post("/api/auth/change-password", isAuthenticated, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user!.id;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "كلمة المرور الحالية والجديدة مطلوبتان" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "كلمة المرور الحالية غير صحيحة" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(userId, { password: hashedPassword });

      logAuditEvent({
        userId,
        entityType: "USER",
        entityId: userId,
        actionType: "UPDATE",
        details: { action: "CHANGE_PASSWORD" },
      });

      res.json({ success: true, message: "تم تغيير كلمة المرور بنجاح" });
    } catch (error) {
      res.status(500).json({ message: "Error changing password" });
    }
  });
}
