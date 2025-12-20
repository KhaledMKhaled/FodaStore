import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { eq } from "drizzle-orm";

process.env.DATABASE_URL ||= process.env.TEST_DATABASE_URL || "postgres://localhost:5432/test";

const { db, pool } = await import("../db");
const { suppliers, shipments, shipmentItems } = await import("@shared/schema");
const { createShipmentWithItems, updateShipmentWithItems } = await import("../shipmentService");

async function createSupplier(overrides: Partial<typeof suppliers.$inferInsert> = {}) {
  const [supplier] = await db
    .insert(suppliers)
    .values({
      name: `Supplier ${Math.random().toString(16).slice(2, 6)}`,
      isHidden: false,
      ...overrides,
    })
    .returning();
  return supplier;
}

async function cleanupShipment(shipmentId: number) {
  await db.delete(shipmentItems).where(eq(shipmentItems.shipmentId, shipmentId));
  await db.delete(shipments).where(eq(shipments.id, shipmentId));
}

async function cleanupSupplier(supplierId: number) {
  await db.delete(suppliers).where(eq(suppliers.id, supplierId));
}

describe("shipmentService shipping company supplier", () => {
  after(async () => {
    await pool.end();
  });

  it("creates shipments with a hidden shipping company supplier", async () => {
    const hiddenSupplier = await createSupplier({
      name: "Hidden Shipping Supplier",
      isHidden: true,
    });

    const payload = {
      shipmentCode: `SHIP-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      shipmentName: "Hidden Shipping Supplier Shipment",
      purchaseDate: new Date("2024-02-01"),
      purchaseRmbToEgpRate: "7.10",
      shippingCompanySupplierId: hiddenSupplier.id,
    };

    let shipmentId: number | null = null;

    try {
      const shipment = await createShipmentWithItems(payload);
      shipmentId = shipment.id;

      assert.equal(shipment.shippingCompanySupplierId, hiddenSupplier.id);
    } finally {
      if (shipmentId) {
        await cleanupShipment(shipmentId);
      }
      await cleanupSupplier(hiddenSupplier.id);
    }
  });

  it("updates shippingCompanySupplierId for existing shipments", async () => {
    const initialSupplier = await createSupplier({ name: "Initial Shipping Supplier" });
    const updatedSupplier = await createSupplier({
      name: "Updated Shipping Supplier",
      isHidden: true,
    });

    const payload = {
      shipmentCode: `SHIP-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      shipmentName: "Shipping Supplier Update",
      purchaseDate: new Date("2024-02-05"),
      purchaseRmbToEgpRate: "7.20",
      shippingCompanySupplierId: initialSupplier.id,
    };

    let shipmentId: number | null = null;

    try {
      const shipment = await createShipmentWithItems(payload);
      shipmentId = shipment.id;

      const updatedShipment = await updateShipmentWithItems(shipment.id, {
        shipmentData: {
          shippingCompanySupplierId: updatedSupplier.id,
        },
      });

      assert.equal(updatedShipment.shippingCompanySupplierId, updatedSupplier.id);
    } finally {
      if (shipmentId) {
        await cleanupShipment(shipmentId);
      }
      await cleanupSupplier(initialSupplier.id);
      await cleanupSupplier(updatedSupplier.id);
    }
  });
});
