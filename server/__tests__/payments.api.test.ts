import assert from "node:assert/strict";
import test, { mock } from "node:test";

import { ApiError } from "../errors";
import { createPaymentHandler } from "../routes";

const actor = {
  id: "actor-1",
  username: "tester",
  firstName: "Test",
  lastName: "User",
  role: "مدير",
};

function createResponse() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  } as any;
}

const baseBody = {
  paymentDate: "2024-01-02",
  shipmentId: 1,
  paymentCurrency: "EGP",
  amountOriginal: "100",
  amountEgp: "100",
  costComponent: "شراء",
  paymentMethod: "نقدي",
};

function createHandler(
  overrides: {
    createPayment?: (...args: any[]) => any;
    getShipmentSuppliers?: (...args: any[]) => any;
    getSupplier?: (...args: any[]) => any;
  } = {},
) {
  const storage = {
    createPayment: overrides.createPayment || (async () => ({ id: 99 })),
    getShipmentSuppliers: overrides.getShipmentSuppliers || (async () => []),
    getSupplier: overrides.getSupplier || (async (id: number) => ({ id })),
  } as any;

  const handler = createPaymentHandler({ storage, logAuditEvent: () => {} });
  return { handler, storage };
}

test("POST /api/payments writes an audit log entry", async () => {
  process.env.DATABASE_URL ||= "postgres://example.com:5432/test";
  const storageMock = {
    createPayment: mock.fn(async (data) => ({
      ...data,
      id: 501,
      paymentCurrency: data.paymentCurrency,
      amountEgp: data.amountEgp,
      paymentMethod: data.paymentMethod,
      shipmentId: data.shipmentId,
      createdAt: new Date("2024-02-02"),
      updatedAt: new Date("2024-02-02"),
    })),
    getShipmentSuppliers: mock.fn(async () => []),
    getSupplier: mock.fn(async (id) => ({ id })),
  };

  const auditLogger = mock.fn();

  const handler = createPaymentHandler({
    storage: storageMock as any,
    logAuditEvent: auditLogger as any,
  });

  const payload = {
    shipmentId: 42,
    paymentDate: new Date("2024-02-01").toISOString(),
    paymentCurrency: "EGP",
    amountOriginal: "150.00",
    exchangeRateToEgp: null,
    amountEgp: "150.00",
    costComponent: "purchase",
    paymentMethod: "نقدي",
    cashReceiverName: "Ali",
    referenceNumber: "REF-123",
  };

  const req = {
    body: payload,
    user: actor,
    isAuthenticated: () => true,
  } as any;

  const res = {
    statusCode: 200,
    body: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.body = body;
      return this;
    },
  } as any;

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.ok, true);

  assert.equal(storageMock.createPayment.mock.calls.length, 1);
  const { arguments: [paymentInput] } = storageMock.createPayment.mock.calls[0];
  assert.equal(paymentInput.createdByUserId, actor.id);
  assert.ok(paymentInput.paymentDate instanceof Date);

  assert.equal(auditLogger.mock.calls.length, 1);
  const { arguments: [auditEvent] } = auditLogger.mock.calls[0];

  assert.equal(auditEvent.entityType, "PAYMENT");
  assert.equal(auditEvent.actionType, "CREATE");
  assert.equal(auditEvent.userId, actor.id);
  assert.deepEqual(auditEvent.details, {
    shipmentId: payload.shipmentId,
    supplierId: null,
    supplierRule: {
      shipmentSuppliers: [],
      required: false,
      defaulted: false,
    },
    amount: payload.amountEgp,
    currency: payload.paymentCurrency,
    method: payload.paymentMethod,
  });

  mock.restoreAll();
});

test("accepts payment creation with a valid supplierId", async () => {
  const createPayment = mock.fn(async (data) => ({ id: 10, ...data }));
  const getShipmentSuppliers = mock.fn(async () => [55]);
  const getSupplier = mock.fn(async (id: number) => (id === 55 ? { id } : undefined));

  const { handler } = createHandler({
    createPayment,
    getShipmentSuppliers,
    getSupplier,
  });

  const req = {
    body: { ...baseBody, supplierId: 55 },
    user: { id: "user-1" },
  } as any;
  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(createPayment.mock.calls.length, 1);
  assert.equal(createPayment.mock.calls[0].arguments[0].supplierId, 55);
});

test("returns 400 for invalid supplierId", async () => {
  const createPayment = mock.fn(async (data) => ({ id: 10, ...data }));
  const getSupplier = mock.fn(async () => undefined);

  const { handler } = createHandler({
    createPayment,
    getSupplier,
  });

  const req = {
    body: { ...baseBody, supplierId: 999 },
    user: { id: "user-1" },
  } as any;
  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body?.error?.code, "SUPPLIER_NOT_FOUND");
  assert.equal(createPayment.mock.calls.length, 0);
});

test("requires supplierId when shipment has supplier attribution", async () => {
  const createPayment = mock.fn(async (data) => ({ id: 10, ...data }));
  const getShipmentSuppliers = mock.fn(async () => [5]);

  const { handler } = createHandler({
    createPayment,
    getShipmentSuppliers,
  });

  const req = {
    body: { ...baseBody, supplierId: null },
    user: { id: "user-1" },
  } as any;
  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body?.error?.code, "SUPPLIER_REQUIRED");
  assert.equal(createPayment.mock.calls.length, 0);
});

test("returns PAYMENT_DATE_INVALID for malformed paymentDate", async () => {
  const { handler } = createHandler();
  const req = {
    body: { ...baseBody, paymentDate: "invalid-date" },
    user: { id: "user-1" },
  } as any;
  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body?.error?.code, "PAYMENT_DATE_INVALID");
  assert.equal(
    res.body?.error?.message,
    "تاريخ الدفع غير صالح. الرجاء اختيار تاريخ بصيغة YYYY-MM-DD.",
  );
});

test("rejects non-numeric amountOriginal with clear message", async () => {
  const { handler } = createHandler();
  const req = {
    body: { ...baseBody, amountOriginal: "abc" },
    user: { id: "user-1" },
  } as any;
  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body?.error?.code, "PAYMENT_PAYLOAD_INVALID");
  assert.equal(res.body?.error?.message, "المبلغ الأصلي يجب أن يكون رقمًا صحيحًا");
  assert.equal(res.body?.error?.details?.field, "amountOriginal");
});

test("rejects non-numeric exchange rate for RMB payments", async () => {
  const { handler } = createHandler();
  const req = {
    body: {
      ...baseBody,
      paymentCurrency: "RMB",
      exchangeRateToEgp: "rate",
    },
    user: { id: "user-1" },
  } as any;
  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body?.error?.code, "PAYMENT_RATE_MISSING");
  assert.equal(res.body?.error?.message, "سعر الصرف لليوان يجب أن يكون رقمًا صحيحًا");
  assert.equal(res.body?.error?.details?.field, "exchangeRateToEgp");
});

test("rejects zero exchange rate for RMB payments", async () => {
  const { handler } = createHandler();
  const req = {
    body: {
      ...baseBody,
      paymentCurrency: "RMB",
      exchangeRateToEgp: "0",
    },
    user: { id: "user-1" },
  } as any;
  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body?.error?.code, "PAYMENT_RATE_MISSING");
  assert.equal(res.body?.error?.message, "سعر الصرف لليوان يجب أن يكون أكبر من صفر");
  assert.equal(res.body?.error?.details?.field, "exchangeRateToEgp");
});

test("returns 404 when shipment is missing", async () => {
  const missingShipmentError = new ApiError("SHIPMENT_NOT_FOUND", undefined, 404);
  let createPaymentCalled = 0;
  const { handler } = createHandler({
    createPayment: async () => {
      createPaymentCalled += 1;
      throw missingShipmentError;
    },
  });
  const req = {
    body: baseBody,
    user: { id: "user-1" },
  } as any;
  const res = createResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body?.error?.code, "SHIPMENT_NOT_FOUND");
  assert.equal(res.body?.error?.message, "الشحنة غير موجودة. تأكد من اختيار شحنة صحيحة.");
  assert.equal(createPaymentCalled, 1);
});
