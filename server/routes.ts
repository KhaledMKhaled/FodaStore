import type { Express, RequestHandler } from "express";
import type { Server } from "http";
import { storage, type IStorage } from "./storage";
import { setupAuth, isAuthenticated, requireRole } from "./auth";
import { normalizePaymentAmounts } from "./services/currency";
import { logAuditEvent } from "./audit";
import { getPaymentsWithShipments } from "./payments";
import { createShipmentWithItems, updateShipmentWithItems } from "./shipmentService";
import { ApiError, formatError, success } from "./errors";
import type { User } from "@shared/schema";
import {
  insertSupplierSchema,
  insertShippingCompanySchema,
  insertProductTypeSchema,
  insertExchangeRateSchema,
} from "@shared/schema";
import { calculatePaymentSnapshot, parseAmountOrZero } from "./services/paymentCalculations";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { ZodError } from "zod";

// Configure multer for item image uploads
const itemImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = "uploads/items";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `item-${uniqueSuffix}${ext}`);
  },
});

const uploadItemImage = multer({
  storage: itemImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

const MAX_PAYMENT_ATTACHMENT_SIZE = 2 * 1024 * 1024;

const paymentAttachmentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = "uploads/payments";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `payment-${uniqueSuffix}${ext}`);
  },
});

const uploadPaymentAttachment = multer({
  storage: paymentAttachmentStorage,
  limits: { fileSize: MAX_PAYMENT_ATTACHMENT_SIZE },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

const handlePaymentAttachmentUpload: RequestHandler = (req, res, next) => {
  uploadPaymentAttachment.single("attachment")(req, res, (err) => {
    if (!err) {
      return next();
    }

    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: {
          code: "PAYMENT_ATTACHMENT_TOO_LARGE",
          message: "Image must be 2MB or less.",
        },
      });
    }

    if (err.message === "Only image files are allowed") {
      return res.status(400).json({
        error: {
          code: "PAYMENT_ATTACHMENT_INVALID_TYPE",
          message: "Only image files are allowed.",
        },
      });
    }

    return res.status(400).json({
      error: {
        code: "PAYMENT_ATTACHMENT_UPLOAD_FAILED",
        message: "تعذر رفع صورة الدفعة. حاول مرة أخرى.",
      },
    });
  });
};

type RouteDependencies = {
  storage?: IStorage;
  auditLogger?: typeof logAuditEvent;
  shipments?: {
    createShipmentWithItems: typeof createShipmentWithItems;
    updateShipmentWithItems: typeof updateShipmentWithItems;
  };
  auth?: {
    setupAuth: (app: Express) => Promise<void>;
    isAuthenticated: RequestHandler;
    requireRole: (roles: string[]) => RequestHandler;
  };
};

type CreatePaymentHandlerDeps = {
  storage: Pick<
    IStorage,
    "createPayment" | "getSupplier" | "getShippingCompany" | "getShipmentSupplierContext"
  >;
  logAuditEvent: (event: Parameters<typeof logAuditEvent>[0]) => void;
};

const PURCHASE_COST_COMPONENT = "تكلفة البضاعة";
const SHIPPING_COST_COMPONENTS = new Set(["الشحن", "العمولة", "الجمرك", "التخريج"]);

export function createPaymentHandler(deps: CreatePaymentHandlerDeps): RequestHandler {
  return async (req, res) => {
    try {
      const {
        shipmentId,
        partyType,
        partyId,
        paymentDate,
        paymentCurrency,
        amountOriginal,
        exchangeRateToEgp,
        costComponent,
        paymentMethod,
        cashReceiverName,
        referenceNumber,
        note,
        notes,
      } = req.body;
      const actorId = (req.user as any)?.id;
      const attachment = req.file;
      const parsedShipmentId = Number(shipmentId);
      const parsedPartyId =
        partyId !== undefined && partyId !== null && partyId !== ""
          ? Number(partyId)
          : null;
      const normalizedPartyType =
        partyType === "supplier" || partyType === "shipping_company" ? partyType : null;

      if (Number.isNaN(parsedShipmentId)) {
        return res.status(400).json({
          error: {
            code: "PAYMENT_PAYLOAD_INVALID",
            message: "بيانات الدفعة غير مكتملة أو غير صحيحة. راجع الحقول المطلوبة.",
            details: { field: "shipmentId" },
          },
        });
      }
      const { itemSuppliers, shippingCompanyId, shipmentSuppliers } =
        await deps.storage.getShipmentSupplierContext(parsedShipmentId);
      const isShippingComponent = SHIPPING_COST_COMPONENTS.has(costComponent);
      const isPurchaseComponent = costComponent === PURCHASE_COST_COMPONENT;
      const allowedSuppliers = isPurchaseComponent ? itemSuppliers : shipmentSuppliers;
      const allowedShippingCompanies = shippingCompanyId ? [shippingCompanyId] : [];

      const allowedPartyTypes = new Map<
        "supplier" | "shipping_company",
        number[]
      >();

      if (!isShippingComponent) {
        allowedPartyTypes.set("supplier", allowedSuppliers);
      }

      if (!isPurchaseComponent) {
        allowedPartyTypes.set("shipping_company", allowedShippingCompanies);
      }

      const allowedPartyCandidates = Array.from(allowedPartyTypes.entries()).flatMap(
        ([type, ids]) => ids.map((id) => ({ type, id })),
      );

      const shouldRequireParty = allowedPartyCandidates.length > 0;
      const shouldDefaultParty =
        !normalizedPartyType &&
        parsedPartyId === null &&
        allowedPartyCandidates.length === 1;
      const resolvedParty =
        shouldDefaultParty ? allowedPartyCandidates[0] : null;

      const resolvedPartyType = resolvedParty?.type ?? normalizedPartyType;
      const resolvedPartyId = resolvedParty?.id ?? parsedPartyId;

      if (shouldRequireParty && (!resolvedPartyType || !resolvedPartyId)) {
        return res.status(400).json({
          error: {
            code: "PARTY_REQUIRED",
            message: "يجب تحديد الطرف المرتبط بهذه الشحنة.",
            details: { field: "partyId", shipmentSuppliers },
          },
        });
      }

      if (resolvedPartyType && resolvedPartyId) {
        const allowedIds = allowedPartyTypes.get(resolvedPartyType) ?? [];
        if (allowedIds.length === 0 || !allowedIds.includes(resolvedPartyId)) {
        return res.status(400).json({
          error: {
            code: "PARTY_MISMATCH",
            message: "الطرف المحدد لا يطابق أطراف الشحنة.",
            details: {
              field: "partyId",
              partyId: resolvedPartyId,
              shipmentSuppliers,
            },
          },
        });
        }
      }

      // Validate payment date
      const parsedDate = new Date(paymentDate);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          error: {
            code: "PAYMENT_DATE_INVALID",
            message: "تاريخ الدفع غير صالح. الرجاء اختيار تاريخ بصيغة YYYY-MM-DD.",
            details: { field: "paymentDate" },
          },
        });
      }

      // Validate amount is numeric
      const originalAmount = parseFloat(amountOriginal);
      if (isNaN(originalAmount)) {
        return res.status(400).json({
          error: {
            code: "PAYMENT_PAYLOAD_INVALID",
            message: "المبلغ الأصلي يجب أن يكون رقمًا صحيحًا",
            details: { field: "amountOriginal" },
          },
        });
      }

      // Validate exchange rate for RMB payments
      if (paymentCurrency === "RMB") {
        const rate = parseFloat(exchangeRateToEgp);
        if (isNaN(rate)) {
          return res.status(400).json({
            error: {
              code: "PAYMENT_RATE_MISSING",
              message: "سعر الصرف لليوان يجب أن يكون رقمًا صحيحًا",
              details: { field: "exchangeRateToEgp" },
            },
          });
        }
        if (rate <= 0) {
          return res.status(400).json({
            error: {
              code: "PAYMENT_RATE_MISSING",
              message: "سعر الصرف لليوان يجب أن يكون أكبر من صفر",
              details: { field: "exchangeRateToEgp" },
            },
          });
        }
      }

      // Validate party if provided
      if (resolvedPartyType && resolvedPartyId) {
        if (resolvedPartyType === "supplier") {
          const supplier = await deps.storage.getSupplier(resolvedPartyId);
          if (!supplier) {
            return res.status(400).json({
              error: {
                code: "SUPPLIER_NOT_FOUND",
                message: "المورد المحدد غير موجود",
                details: { field: "partyId", partyId: resolvedPartyId },
              },
            });
          }
        }
        if (resolvedPartyType === "shipping_company") {
          const company = await deps.storage.getShippingCompany(resolvedPartyId);
          if (!company) {
            return res.status(400).json({
              error: {
                code: "SHIPPING_COMPANY_NOT_FOUND",
                message: "شركة الشحن المحددة غير موجودة",
                details: { field: "partyId", partyId: resolvedPartyId },
              },
            });
          }
        }
      }

      // Normalize payment amounts
      const normalizedAmounts = normalizePaymentAmounts({
        paymentCurrency,
        amountOriginal: originalAmount,
        exchangeRateToEgp: paymentCurrency === "RMB" ? parseFloat(exchangeRateToEgp) : null,
      });

      const payment = await deps.storage.createPayment({
        shipmentId: parsedShipmentId,
        partyType: resolvedPartyType,
        partyId: resolvedPartyId || null,
        paymentDate: parsedDate,
        paymentCurrency,
        amountOriginal: amountOriginal.toString(),
        exchangeRateToEgp: normalizedAmounts.exchangeRateToEgp?.toString() || null,
        amountEgp: normalizedAmounts.amountEgp.toFixed(2),
        costComponent,
        paymentMethod,
        cashReceiverName: cashReceiverName || null,
        referenceNumber: referenceNumber || null,
        note: note || notes || null,
        attachmentUrl: attachment ? `/uploads/payments/${attachment.filename}` : null,
        attachmentMimeType: attachment?.mimetype ?? null,
        attachmentSize: attachment?.size ?? null,
        attachmentOriginalName: attachment?.originalname ?? null,
        attachmentUploadedAt: attachment ? new Date() : null,
        createdByUserId: actorId,
      });

      deps.logAuditEvent({
        userId: actorId,
        entityType: "PAYMENT",
        entityId: payment.id,
        actionType: "CREATE",
        details: {
          shipmentId,
          partyType: resolvedPartyType,
          partyId: resolvedPartyId || null,
          partyRule: {
            shipmentSuppliers,
            required: shouldRequireParty,
            defaulted: shouldDefaultParty,
          },
          amount: normalizedAmounts.amountEgp.toString(),
          currency: paymentCurrency,
          method: paymentMethod,
          hasAttachment: Boolean(attachment),
        },
      });

      res.json(success(payment));
    } catch (error) {
      const { status, body } = formatError(error, {
        code: "PAYMENT_FETCH_FAILED",
        status: 500,
      });
      res.status(status).json(body);
    }
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
  deps: RouteDependencies = {},
): Promise<void> {
  const routeStorage: IStorage = deps.storage ?? storage;
  const auth = deps.auth ?? { setupAuth, isAuthenticated, requireRole };
  const auditLogger = deps.auditLogger ?? ((event: Parameters<typeof logAuditEvent>[0]) => logAuditEvent(event, routeStorage));
  const shipmentService = deps.shipments ?? { createShipmentWithItems, updateShipmentWithItems };
  // Setup authentication
  await auth.setupAuth(app);

  // Auth routes
  app.get("/api/auth/user", async (req, res) => {
    if (req.isAuthenticated() && req.user) {
      const user = await routeStorage.getUser(req.user.id);
      if (user) {
        const { password: _, ...userWithoutPassword } = user;
        return res.json(userWithoutPassword);
      }
    }
    res.status(401).json({ message: "Unauthorized" });
  });

  // Image upload for items
  app.post("/api/upload/item-image", isAuthenticated, uploadItemImage.single("image"), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "لم يتم رفع صورة" });
      }
      const imageUrl = `/uploads/items/${req.file.filename}`;
      res.json({ imageUrl });
    } catch (error) {
      console.error("Error uploading image:", error);
      res.status(500).json({ message: "خطأ في رفع الصورة" });
    }
  });

  // Dashboard
  app.get("/api/dashboard/stats", isAuthenticated, async (req, res) => {
    try {
      const stats = await routeStorage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Error fetching dashboard stats" });
    }
  });

  // Suppliers
  app.get("/api/suppliers", isAuthenticated, async (req, res) => {
    try {
      const suppliers = await routeStorage.getAllSuppliers();
      res.json(suppliers);
    } catch (error) {
      res.status(500).json({ message: "Error fetching suppliers" });
    }
  });

  app.get("/api/suppliers/:id", isAuthenticated, async (req, res) => {
    try {
      const supplier = await routeStorage.getSupplier(parseInt(req.params.id));
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
      const supplier = await routeStorage.createSupplier(data);
      res.json(supplier);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.patch("/api/suppliers/:id", requireRole(["مدير", "محاسب"]), async (req, res) => {
    try {
      const supplier = await routeStorage.updateSupplier(parseInt(req.params.id), req.body);
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
      await routeStorage.deleteSupplier(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Error deleting supplier" });
    }
  });

  // Shipping Companies
  app.get("/api/shipping-companies", isAuthenticated, async (_req, res) => {
    try {
      const companies = await routeStorage.getAllShippingCompanies();
      res.json(companies);
    } catch (error) {
      res.status(500).json({ message: "Error fetching shipping companies" });
    }
  });

  app.get("/api/shipping-companies/:id", isAuthenticated, async (req, res) => {
    try {
      const company = await routeStorage.getShippingCompany(parseInt(req.params.id));
      if (!company) {
        return res.status(404).json({ message: "Shipping company not found" });
      }
      res.json(company);
    } catch (error) {
      res.status(500).json({ message: "Error fetching shipping company" });
    }
  });

  app.post(
    "/api/shipping-companies",
    requireRole(["مدير", "محاسب"]),
    async (req, res) => {
      try {
        const data = insertShippingCompanySchema.parse(req.body);
        const existing = await routeStorage.getShippingCompanyByName(data.name);
        if (existing) {
          throw new ApiError("SHIPPING_COMPANY_NAME_EXISTS", undefined, 409, {
            field: "name",
            value: data.name,
          });
        }
        const company = await routeStorage.createShippingCompany(data);

        auditLogger({
          userId: (req.user as any)?.id,
          entityType: "SHIPPING_COMPANY",
          entityId: String(company.id),
          actionType: "CREATE",
          details: { name: company.name },
        });

        res.json(company);
      } catch (error) {
        if (error instanceof ZodError) {
          const details = {
            fields: error.errors.map((issue) => ({
              field: issue.path.join(".") || "name",
              message: issue.message,
            })),
          };
          const { status, body } = formatError(
            new ApiError("VALIDATION_ERROR", undefined, 400, details),
          );
          return res.status(status).json(body);
        }
        if (error instanceof ApiError) {
          const { status, body } = formatError(error);
          return res.status(status).json(body);
        }
        console.error("Error creating shipping company:", error);
        res.status(500).json({ message: "تعذر إنشاء شركة الشحن حالياً. حاول مرة أخرى." });
      }
    },
  );

  app.patch(
    "/api/shipping-companies/:id",
    requireRole(["مدير", "محاسب"]),
    async (req, res) => {
      try {
        const company = await routeStorage.updateShippingCompany(
          parseInt(req.params.id),
          req.body,
        );
        if (!company) {
          return res.status(404).json({ message: "Shipping company not found" });
        }

        auditLogger({
          userId: (req.user as any)?.id,
          entityType: "SHIPPING_COMPANY",
          entityId: String(company.id),
          actionType: "UPDATE",
          details: { name: company.name },
        });

        res.json(company);
      } catch (error) {
        res.status(500).json({ message: "Error updating shipping company" });
      }
    },
  );

  app.delete(
    "/api/shipping-companies/:id",
    requireRole(["مدير", "محاسب"]),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        await routeStorage.deleteShippingCompany(id);

        auditLogger({
          userId: (req.user as any)?.id,
          entityType: "SHIPPING_COMPANY",
          entityId: String(id),
          actionType: "DELETE",
        });

        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ message: "Error deleting shipping company" });
      }
    },
  );

  // Product Types
  app.get("/api/product-types", isAuthenticated, async (req, res) => {
    try {
      const types = await routeStorage.getAllProductTypes();
      res.json(types);
    } catch (error) {
      res.status(500).json({ message: "Error fetching product types" });
    }
  });

  app.post("/api/product-types", requireRole(["مدير", "محاسب"]), async (req, res) => {
    try {
      const data = insertProductTypeSchema.parse(req.body);
      const type = await routeStorage.createProductType(data);
      res.json(type);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.patch("/api/product-types/:id", requireRole(["مدير", "محاسب"]), async (req, res) => {
    try {
      const type = await routeStorage.updateProductType(parseInt(req.params.id), req.body);
      if (!type) {
        return res.status(404).json({ message: "Product type not found" });
      }
      res.json(type);
    } catch (error) {
      res.status(500).json({ message: "Error updating product type" });
    }
  });

  app.delete("/api/product-types/:id", requireRole(["مدير", "محاسب"]), async (req, res) => {
    try {
      await routeStorage.deleteProductType(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Error deleting product type" });
    }
  });

  // Shipments
  app.get("/api/shipments", isAuthenticated, async (req, res) => {
    try {
      const shipments = await routeStorage.getAllShipments();
      res.json(shipments);
    } catch (error) {
      res.status(500).json({ message: "Error fetching shipments" });
    }
  });

  app.get("/api/shipments/:id", isAuthenticated, async (req, res) => {
    try {
      const shipment = await routeStorage.getShipment(parseInt(req.params.id));
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
      const shipment = await shipmentService.createShipmentWithItems(req.body, userId);
      
      auditLogger({
        userId,
        entityType: "SHIPMENT",
        entityId: shipment.id,
        actionType: "CREATE",
        details: {
          status: shipment.status,
          shippingCompanyId: shipment.shippingCompanyId ?? null,
        },
      });
      
      res.json(shipment);
    } catch (error) {
      console.error("Error creating shipment:", error);
      res.status(400).json({ message: (error as Error)?.message || "تعذر إنشاء الشحنة" });
    }
  });

  app.patch("/api/shipments/:id", requireRole(["مدير", "محاسب"]), async (req, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      const userId = (req.user as any)?.id;
      
      const existingShipment = await routeStorage.getShipment(shipmentId);
      const previousStatus = existingShipment?.status;
      const previousShippingCompanyId =
        existingShipment?.shippingCompanyId ?? null;
      
      const updatedShipment = await shipmentService.updateShipmentWithItems(shipmentId, req.body);
      const nextShippingCompanyId =
        updatedShipment?.shippingCompanyId ?? null;
      
      auditLogger({
        userId,
        entityType: "SHIPMENT",
        entityId: shipmentId,
        actionType: "UPDATE",
        details: {
          step: req.body.step,
          status: updatedShipment?.status,
          shippingCompanyId: nextShippingCompanyId,
          shippingCompanyChange:
            previousShippingCompanyId !== nextShippingCompanyId
              ? {
                  from: previousShippingCompanyId,
                  to: nextShippingCompanyId,
                }
              : undefined,
        },
      });
      
      if (updatedShipment && updatedShipment.status !== previousStatus) {
        auditLogger({
          userId,
          entityType: "SHIPMENT",
          entityId: shipmentId,
          actionType: "STATUS_CHANGE",
          details: { from: previousStatus, to: updatedShipment.status },
        });
      }
      
      res.json(updatedShipment);
    } catch (error) {
      console.error("Error updating shipment:", error);
      const message = (error as Error)?.message || "حدث خطأ أثناء حفظ بيانات الشحنة";
      const status = message === "الشحنة غير موجودة" ? 404 : 400;
      res.status(status).json({ message });
    }
  });

  app.delete("/api/shipments/:id", requireRole(["مدير", "محاسب"]), async (req, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      const userId = (req.user as any)?.id;
      
      await routeStorage.deleteShipment(shipmentId);
      
      auditLogger({
        userId,
        entityType: "SHIPMENT",
        entityId: shipmentId,
        actionType: "DELETE",
      });
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Error deleting shipment" });
    }
  });

  // Shipment Items
  app.get("/api/shipments/:id/items", isAuthenticated, async (req, res) => {
    try {
      const items = await routeStorage.getShipmentItems(parseInt(req.params.id));
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Error fetching items" });
    }
  });

  // Shipment Shipping Details
  app.get("/api/shipments/:id/shipping", isAuthenticated, async (req, res) => {
    try {
      const details = await routeStorage.getShippingDetails(parseInt(req.params.id));
      res.json(details || null);
    } catch (error) {
      res.status(500).json({ message: "Error fetching shipping details" });
    }
  });

  // Invoice Summary - breakdown by currency
  app.get("/api/shipments/:id/invoice-summary", isAuthenticated, async (req, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      const shipment = await routeStorage.getShipment(shipmentId);
      
      if (!shipment) {
        return res.status(404).json({ message: "الشحنة غير موجودة" });
      }
      
      const payments = await routeStorage.getShipmentPayments(shipmentId);
      const paymentAllowance = await routeStorage.getPaymentAllowance(shipmentId, { shipment });
      
      const paymentSnapshot = await calculatePaymentSnapshot({
        shipment,
        payments,
        loadRecoveryData: async () => {
          const items = await routeStorage.getShipmentItems(shipmentId);
          const rate = await routeStorage.getLatestRate("RMB", "EGP");

          return {
            items,
            rmbToEgpRate: rate ? parseAmountOrZero(rate.rateValue) : undefined,
          };
        },
      });

      const paidRmb = paymentSnapshot.paidByCurrency.RMB?.original ?? 0;
      const paidEgp = paymentSnapshot.paidByCurrency.EGP?.original ?? 0;

      // RMB costs breakdown
      const goodsTotalRmb = parseAmountOrZero(shipment.purchaseCostRmb || "0");
      const shippingTotalRmb = parseAmountOrZero(
        shipment.shippingCostRmb || "0",
      );
      const commissionTotalRmb = parseAmountOrZero(
        shipment.commissionCostRmb || "0",
      );
      const rmbSubtotal = goodsTotalRmb + shippingTotalRmb + commissionTotalRmb;
      const rmbRemaining = Math.max(0, rmbSubtotal - paidRmb);
      
      // EGP costs breakdown
      const customsTotalEgp = parseAmountOrZero(shipment.customsCostEgp || "0");
      const takhreegTotalEgp = parseAmountOrZero(
        shipment.takhreegCostEgp || "0",
      );
      const egpSubtotal = customsTotalEgp + takhreegTotalEgp;
      const egpRemaining = Math.max(0, egpSubtotal - paidEgp);

      // Calculate per-component paid and remaining amounts
      const paidByComponent: { [key: string]: number } = {};
      const paidByComponentRmb: { [key: string]: number } = {};
      const componentTotals: { [key: string]: number } = {
        "تكلفة البضاعة": goodsTotalRmb,
        "الشحن": shippingTotalRmb,
        "العمولة": commissionTotalRmb,
        "الجمرك": customsTotalEgp,
        "التخريج": takhreegTotalEgp,
      };

      // Calculate paid amounts per component
      // For RMB components: sum by amountOriginal (in RMB) when payment is RMB
      // For EGP components: sum by amountEgp when payment is in EGP
      payments?.forEach(payment => {
        const costComp = payment.costComponent;
        if (!paidByComponent[costComp]) {
          paidByComponent[costComp] = 0;
          paidByComponentRmb[costComp] = 0;
        }
        
        // Add to EGP tracking
        paidByComponent[costComp] += parseAmountOrZero(payment.amountEgp);
        
        // For RMB components, track RMB payments
        if (costComp === "تكلفة البضاعة" || costComp === "الشحن" || costComp === "العمولة") {
          if (payment.paymentCurrency === "RMB") {
            paidByComponentRmb[costComp] += parseAmountOrZero(payment.amountOriginal);
          } else if (payment.paymentCurrency === "EGP" && payment.exchangeRateToEgp) {
            // Convert EGP back to RMB
            const rmbAmount = parseAmountOrZero(payment.amountEgp) / parseAmountOrZero(payment.exchangeRateToEgp);
            paidByComponentRmb[costComp] += rmbAmount;
          }
        }
      });

      const remainingByComponent = {
        "تكلفة البضاعة": Math.max(0, goodsTotalRmb - (paidByComponentRmb["تكلفة البضاعة"] ?? 0)),
        "الشحن": Math.max(0, shippingTotalRmb - (paidByComponentRmb["الشحن"] ?? 0)),
        "العمولة": Math.max(0, commissionTotalRmb - (paidByComponentRmb["العمولة"] ?? 0)),
        "الجمرك": Math.max(0, customsTotalEgp - (paidByComponent["الجمرك"] ?? 0)),
        "التخريج": Math.max(0, takhreegTotalEgp - (paidByComponent["التخريج"] ?? 0)),
      };

      const paidByCurrency = Object.fromEntries(
        Object.entries(paymentSnapshot.paidByCurrency).map(([currency, values]) => [
          currency,
          {
            original: values.original.toFixed(2),
            convertedToEgp: values.convertedToEgp.toFixed(2),
          },
        ]),
      );

      res.json({
        shipmentId,
        shipmentCode: shipment.shipmentCode,
        shipmentName: shipment.shipmentName,
        knownTotalCost: paymentSnapshot.knownTotalCost.toFixed(2),
        totalPaidEgp: paymentSnapshot.totalPaidEgp.toFixed(2),
        remainingAllowed: paymentSnapshot.remainingAllowed.toFixed(2),
        paidByCurrency,
        rmb: {
          goodsTotal: goodsTotalRmb.toFixed(2),
          shippingTotal: shippingTotalRmb.toFixed(2),
          commissionTotal: commissionTotalRmb.toFixed(2),
          subtotal: rmbSubtotal.toFixed(2),
          paid: paidRmb.toFixed(2),
          remaining: rmbRemaining.toFixed(2),
        },
        egp: {
          customsTotal: customsTotalEgp.toFixed(2),
          takhreegTotal: takhreegTotalEgp.toFixed(2),
          subtotal: egpSubtotal.toFixed(2),
          paid: paidEgp.toFixed(2),
          remaining: egpRemaining.toFixed(2),
        },
        paidByComponent: {
          "تكلفة البضاعة": (paidByComponentRmb["تكلفة البضاعة"] ?? 0).toFixed(2),
          "الشحن": (paidByComponentRmb["الشحن"] ?? 0).toFixed(2),
          "العمولة": (paidByComponentRmb["العمولة"] ?? 0).toFixed(2),
          "الجمرك": (paidByComponent["الجمرك"] ?? 0).toFixed(2),
          "التخريج": (paidByComponent["التخريج"] ?? 0).toFixed(2),
        },
        remainingByComponent: {
          "تكلفة البضاعة": remainingByComponent["تكلفة البضاعة"].toFixed(2),
          "الشحن": remainingByComponent["الشحن"].toFixed(2),
          "العمولة": remainingByComponent["العمولة"].toFixed(2),
          "الجمرك": remainingByComponent["الجمرك"].toFixed(2),
          "التخريج": remainingByComponent["التخريج"].toFixed(2),
        },
        paymentAllowance: {
          knownTotalEgp: paymentAllowance.knownTotal.toFixed(2),
          alreadyPaidEgp: paymentAllowance.alreadyPaid.toFixed(2),
          remainingAllowedEgp: paymentAllowance.remainingAllowed.toFixed(2),
          source: paymentAllowance.recoveredFromItems ? "recovered" : "declared",
        },
        computedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching invoice summary:", error);
      res.status(500).json({ message: "خطأ في جلب ملخص الفاتورة" });
    }
  });

  // Exchange Rates
  app.get("/api/exchange-rates", isAuthenticated, async (req, res) => {
    try {
      const rates = await routeStorage.getAllExchangeRates();
      res.json(rates);
    } catch (error) {
      res.status(500).json({ message: "Error fetching exchange rates" });
    }
  });

  app.post("/api/exchange-rates", requireRole(["مدير", "محاسب"]), async (req, res) => {
    try {
      const data = insertExchangeRateSchema.parse(req.body);
      const userId = (req.user as any)?.id;
      const rate = await routeStorage.createExchangeRate(data);
      
      auditLogger({
        userId,
        entityType: "EXCHANGE_RATE",
        entityId: rate.id,
        actionType: "CREATE",
        details: { from: rate.fromCurrency, to: rate.toCurrency },
      });
      
      res.json(rate);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  // Manual/automatic refresh - simulate external update
  app.post("/api/exchange-rates/refresh", requireRole(["مدير", "محاسب"]), async (req, res) => {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const latestRmb = await routeStorage.getLatestRate("RMB", "EGP");
      const latestUsd = await routeStorage.getLatestRate("USD", "RMB");
      const userId = (req.user as any)?.id;

      const refreshed = await Promise.all([
        routeStorage.createExchangeRate({
          rateDate: todayStr,
          fromCurrency: "RMB",
          toCurrency: "EGP",
          rateValue: latestRmb?.rateValue || "7.0000",
          source: "تحديث تلقائي",
        }),
        routeStorage.createExchangeRate({
          rateDate: todayStr,
          fromCurrency: "USD",
          toCurrency: "RMB",
          rateValue: latestUsd?.rateValue || "7.2000",
          source: "تحديث تلقائي",
        }),
      ]);

      refreshed.forEach((rate) => {
        auditLogger({
          userId,
          entityType: "EXCHANGE_RATE",
          entityId: rate.id,
          actionType: "CREATE",
          details: { from: rate.fromCurrency, to: rate.toCurrency },
        });
      });

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
      const paymentsWithShipments = await getPaymentsWithShipments(routeStorage);
      res.json(paymentsWithShipments);
    } catch (error) {
      const { status, body } = formatError(error, {
        code: "PAYMENT_FETCH_FAILED",
        status: 500,
      });
      res.status(status).json(body);
    }
  });

  app.get("/api/payments/stats", isAuthenticated, async (req, res) => {
    try {
      const stats = await routeStorage.getPaymentStats();
      res.json(stats);
    } catch (error) {
      const { status, body } = formatError(error, {
        code: "PAYMENT_FETCH_FAILED",
        status: 500,
      });
      res.status(status).json(body);
    }
  });

  app.post(
    "/api/payments",
    requireRole(["مدير", "محاسب"]),
    handlePaymentAttachmentUpload,
    createPaymentHandler({ storage: routeStorage, logAuditEvent: auditLogger }),
  );

  const sendPaymentAttachment = async (
    req: Parameters<RequestHandler>[0],
    res: Parameters<RequestHandler>[1],
    options: { inline: boolean },
  ) => {
    const paymentId = Number(req.params.paymentId);
    if (Number.isNaN(paymentId)) {
      return res.status(400).json({
        error: {
          code: "PAYMENT_ATTACHMENT_INVALID_ID",
          message: "معرّف الدفعة غير صالح.",
        },
      });
    }

    const payment = await routeStorage.getPaymentById(paymentId);
    if (!payment || !payment.attachmentUrl) {
      return res.status(404).json({
        error: {
          code: "PAYMENT_ATTACHMENT_NOT_FOUND",
          message: "لا يوجد مرفق لهذه الدفعة.",
        },
      });
    }

    const relativePath = payment.attachmentUrl.replace(/^\/+/, "");
    const absolutePath = path.resolve(process.cwd(), relativePath);
    const uploadsRoot = path.resolve(process.cwd(), "uploads");
    if (!absolutePath.startsWith(uploadsRoot)) {
      return res.status(400).json({
        error: {
          code: "PAYMENT_ATTACHMENT_INVALID_PATH",
          message: "مسار المرفق غير صالح.",
        },
      });
    }

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        error: {
          code: "PAYMENT_ATTACHMENT_MISSING",
          message: "الملف غير موجود على الخادم.",
        },
      });
    }

    const disposition = options.inline ? "inline" : "attachment";
    const filename = payment.attachmentOriginalName || path.basename(absolutePath);
    res.setHeader("Content-Type", payment.attachmentMimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
    return res.sendFile(absolutePath);
  };

  app.get(
    "/api/payments/:paymentId/attachment/preview",
    requireRole(["مدير", "محاسب"]),
    async (req, res) => {
      await sendPaymentAttachment(req, res, { inline: true });
    },
  );

  app.get(
    "/api/payments/:paymentId/attachment",
    requireRole(["مدير", "محاسب"]),
    async (req, res) => {
      await sendPaymentAttachment(req, res, { inline: false });
    },
  );

  // Inventory
  app.get("/api/inventory", isAuthenticated, async (req, res) => {
    try {
      const movements = await routeStorage.getAllInventoryMovements();
      // Include shipment, shipping details and item info for cost calculations
      const movementsWithDetails = await Promise.all(
        movements.map(async (movement) => {
          const shipment = movement.shipmentId
            ? await routeStorage.getShipment(movement.shipmentId)
            : null;
          const shippingDetails = movement.shipmentId
            ? await routeStorage.getShippingDetails(movement.shipmentId)
            : null;
          const shipmentItems = movement.shipmentId
            ? await routeStorage.getShipmentItems(movement.shipmentId)
            : [];
          const shipmentItem = shipmentItems.find(
            (item) => item.id === movement.shipmentItemId
          );
          // Calculate total pieces in shipment for cost distribution
          const totalShipmentPieces = shipmentItems.reduce((sum, item) => sum + (item.totalPiecesCou || 0), 0);
          return { ...movement, shipment, shipmentItem, shippingDetails, totalShipmentPieces };
        })
      );
      res.json(movementsWithDetails);
    } catch (error) {
      res.status(500).json({ message: "Error fetching inventory" });
    }
  });

  app.get("/api/inventory/stats", isAuthenticated, async (req, res) => {
    try {
      const stats = await routeStorage.getInventoryStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Error fetching inventory stats" });
    }
  });

  // Users
  app.get("/api/users", isAuthenticated, async (req, res) => {
    try {
      const allUsers = await routeStorage.getAllUsers();
      const usersWithoutPasswords = allUsers.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ message: "Error fetching users" });
    }
  });

  // Create new user (admin only)
  app.post("/api/users", requireRole(["مدير"]), async (req, res) => {
    try {
      const { username, password, firstName, lastName, role } = req.body;
      const actorId = (req.user as any)?.id;
      
      if (!username || !password) {
        return res.status(400).json({ message: "اسم المستخدم وكلمة المرور مطلوبان" });
      }

      const existingUser = await routeStorage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "اسم المستخدم موجود بالفعل" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await routeStorage.createUser({
        username,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        role: role || "مشاهد",
      });

      const { password: _, ...userWithoutPassword } = user;
      
      auditLogger({
        userId: actorId,
        entityType: "USER",
        entityId: user.id,
        actionType: "CREATE",
        details: { role: user.role },
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
        return res.status(403).json({ message: "لا تملك صلاحية لتعديل مستخدمين آخرين" });
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

      const user = await routeStorage.updateUser(id, updateData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password: _, ...userWithoutPassword } = user;
      
      auditLogger({
        userId: actorId,
        entityType: "USER",
        entityId: user.id,
        actionType: "UPDATE",
        details: { updatedFields: Object.keys(updateData) },
      });
      
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Error updating user" });
    }
  });

  app.patch("/api/users/:id/role", requireRole(["مدير"]), async (req, res) => {
    try {
      const { role } = req.body;
      const user = await routeStorage.updateUserRole(req.params.id, role);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password: _, ...userWithoutPassword } = user;
      
      auditLogger({
        userId: (req.user as any)?.id,
        entityType: "USER",
        entityId: user.id,
        actionType: "UPDATE",
        details: { role: user.role },
      });
      
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Error updating user role" });
    }
  });

  // Delete user (admin only)
  app.delete("/api/users/:id", requireRole(["مدير"]), async (req, res) => {
    try {
      const { id } = req.params;
      const currentUser = req.user!;
      const actorId = (req.user as any)?.id;

      // Prevent deleting yourself
      if (currentUser.id === id) {
        return res.status(400).json({ message: "لا يمكن حذف حسابك الخاص" });
      }

      // Prevent deleting root user
      const targetUser = await routeStorage.getUser(id);
      if (targetUser?.username === "root") {
        return res.status(400).json({ message: "لا يمكن حذف حساب الجذر" });
      }

      await routeStorage.deleteUser(id);
      
      auditLogger({
        userId: actorId,
        entityType: "USER",
        entityId: id,
        actionType: "DELETE",
      });
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Error deleting user" });
    }
  });

  // Accounting Routes
  app.get("/api/accounting/dashboard", isAuthenticated, async (req, res) => {
    try {
      const filters = {
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        partyType: req.query.partyType as "supplier" | "shipping_company" | undefined,
        partyId: req.query.partyId ? parseInt(req.query.partyId as string) : undefined,
        shipmentCode: req.query.shipmentCode as string | undefined,
        shipmentStatus: req.query.shipmentStatus as string | undefined,
        paymentStatus: req.query.paymentStatus as string | undefined,
        includeArchived: req.query.includeArchived === "true",
      };
      const stats = await routeStorage.getAccountingDashboard(filters);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching accounting dashboard:", error);
      res.status(500).json({ message: "Error fetching accounting dashboard" });
    }
  });

  app.get("/api/accounting/supplier-balances", isAuthenticated, async (req, res) => {
    try {
      const filters = {
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        supplierId: req.query.supplierId ? parseInt(req.query.supplierId as string) : undefined,
        balanceType: req.query.balanceType as 'owing' | 'credit' | 'all' | undefined,
      };
      const balances = await routeStorage.getSupplierBalances(filters);
      res.json(balances);
    } catch (error) {
      console.error("Error fetching supplier balances:", error);
      res.status(500).json({ message: "Error fetching supplier balances" });
    }
  });

  app.get("/api/accounting/supplier-statement/:supplierId", isAuthenticated, async (req, res) => {
    try {
      const supplierId = parseInt(req.params.supplierId);
      const filters = {
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
      };
      const statement = await routeStorage.getSupplierStatement(supplierId, filters);
      res.json(statement);
    } catch (error) {
      console.error("Error fetching supplier statement:", error);
      res.status(500).json({ message: "Error fetching supplier statement" });
    }
  });

  app.get("/api/accounting/shipping-company-balances", isAuthenticated, async (req, res) => {
    try {
      const filters = {
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        shippingCompanyId: req.query.shippingCompanyId
          ? parseInt(req.query.shippingCompanyId as string)
          : undefined,
        balanceType: req.query.balanceType as 'owing' | 'credit' | 'all' | undefined,
      };
      const balances = await routeStorage.getShippingCompanyBalances(filters);
      res.json(balances);
    } catch (error) {
      console.error("Error fetching shipping company balances:", error);
      res.status(500).json({ message: "Error fetching shipping company balances" });
    }
  });

  app.get(
    "/api/accounting/shipping-company-statement/:shippingCompanyId",
    isAuthenticated,
    async (req, res) => {
      try {
        const shippingCompanyId = parseInt(req.params.shippingCompanyId);
        const filters = {
          dateFrom: req.query.dateFrom as string | undefined,
          dateTo: req.query.dateTo as string | undefined,
        };
        const statement = await routeStorage.getShippingCompanyStatement(
          shippingCompanyId,
          filters,
        );
        res.json(statement);
      } catch (error) {
        console.error("Error fetching shipping company statement:", error);
        res
          .status(500)
          .json({ message: "Error fetching shipping company statement" });
      }
    },
  );

  app.get("/api/accounting/movement-report", isAuthenticated, async (req, res) => {
    try {
      const filters = {
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        shipmentId: req.query.shipmentId ? parseInt(req.query.shipmentId as string) : undefined,
        partyType: req.query.partyType as "supplier" | "shipping_company" | undefined,
        partyId: req.query.partyId ? parseInt(req.query.partyId as string) : undefined,
        movementType: req.query.movementType as string | undefined,
        costComponent: req.query.costComponent as string | undefined,
        paymentMethod: req.query.paymentMethod as string | undefined,
        shipmentStatus: req.query.shipmentStatus as string | undefined,
        paymentStatus: req.query.paymentStatus as string | undefined,
        includeArchived: req.query.includeArchived === "true",
      };
      const report = await routeStorage.getMovementReport(filters);
      res.json(report);
    } catch (error) {
      console.error("Error fetching movement report:", error);
      res.status(500).json({ message: "Error fetching movement report" });
    }
  });

  app.get("/api/accounting/payment-methods-report", isAuthenticated, async (req, res) => {
    try {
      const filters = {
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
      };
      const report = await routeStorage.getPaymentMethodsReport(filters);
      res.json(report);
    } catch (error) {
      console.error("Error fetching payment methods report:", error);
      res.status(500).json({ message: "Error fetching payment methods report" });
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

      const user = await routeStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "كلمة المرور الحالية غير صحيحة" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await routeStorage.updateUser(userId, { password: hashedPassword });

      auditLogger({
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
