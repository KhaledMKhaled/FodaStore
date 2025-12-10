import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import type { User } from "@shared/schema";
import {
  insertSupplierSchema,
  insertShipmentSchema,
  insertShipmentItemSchema,
  insertExchangeRateSchema,
  insertShipmentPaymentSchema,
} from "@shared/schema";

export async function registerRoutes(httpServer: Server, app: Express): Promise<void> {
  // Setup authentication
  await setupAuth(app);

  // Auth routes
  app.get("/api/auth/user", async (req, res) => {
    if (req.isAuthenticated()) {
      const userId = (req.user as any)?.claims?.sub;
      if (userId) {
        const user = await storage.getUser(userId);
        return res.json(user);
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

  app.post("/api/suppliers", isAuthenticated, async (req, res) => {
    try {
      const data = insertSupplierSchema.parse(req.body);
      const supplier = await storage.createSupplier(data);
      res.json(supplier);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.patch("/api/suppliers/:id", isAuthenticated, async (req, res) => {
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

  app.delete("/api/suppliers/:id", isAuthenticated, async (req, res) => {
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

  app.post("/api/shipments", isAuthenticated, async (req, res) => {
    try {
      const { items, ...shipmentData } = req.body;
      const userId = (req.user as any)?.id;

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

      // Calculate totals
      const allItems = await storage.getShipmentItems(shipment.id);
      const totalPurchaseCostRmb = allItems.reduce(
        (sum, item) => sum + parseFloat(item.totalPurchaseCostRmb || "0"),
        0
      );

      await storage.updateShipment(shipment.id, {
        purchaseCostRmb: totalPurchaseCostRmb.toFixed(2),
      });

      res.json(shipment);
    } catch (error) {
      console.error("Error creating shipment:", error);
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.patch("/api/shipments/:id", isAuthenticated, async (req, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      const { step, shipmentData, items, shippingData } = req.body;

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

      // Calculate final total if at summary step
      if (step === 4) {
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
          const balanceEgp = finalTotalCostEgp - totalPaidEgp;

          await storage.updateShipment(shipmentId, {
            finalTotalCostEgp: finalTotalCostEgp.toFixed(2),
            balanceEgp: balanceEgp.toFixed(2),
          });
        }
      }

      const updatedShipment = await storage.getShipment(shipmentId);
      res.json(updatedShipment);
    } catch (error) {
      console.error("Error updating shipment:", error);
      res.status(500).json({ message: "Error updating shipment" });
    }
  });

  app.delete("/api/shipments/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteShipment(parseInt(req.params.id));
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

  app.post("/api/exchange-rates", isAuthenticated, async (req, res) => {
    try {
      const data = insertExchangeRateSchema.parse(req.body);
      const rate = await storage.createExchangeRate(data);
      res.json(rate);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  // Payments
  app.get("/api/payments", isAuthenticated, async (req, res) => {
    try {
      const payments = await storage.getAllPayments();
      // Include shipment info
      const paymentsWithShipments = await Promise.all(
        payments.map(async (payment) => {
          const shipment = await storage.getShipment(payment.shipmentId);
          return { ...payment, shipment };
        })
      );
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

  app.post("/api/payments", isAuthenticated, async (req, res) => {
    try {
      const data = insertShipmentPaymentSchema.parse(req.body);
      const userId = (req.user as any)?.id;
      const payment = await storage.createPayment({
        ...data,
        createdByUserId: userId,
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
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Error fetching users" });
    }
  });

  app.patch("/api/users/:id/role", isAuthenticated, async (req, res) => {
    try {
      const { role } = req.body;
      const currentUser = req.user as any;

      // Only admins can change roles
      if (currentUser?.role !== "مدير") {
        return res.status(403).json({ message: "غير مصرح" });
      }

      const user = await storage.updateUserRole(req.params.id, role);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Error updating user role" });
    }
  });
}
