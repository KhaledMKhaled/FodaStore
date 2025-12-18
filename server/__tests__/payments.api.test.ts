import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "../errors";
import { createPaymentHandler } from "../routes";

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

function createHandler(overrides: { createPayment?: (...args: any[]) => any } = {}) {
  const storage = {
    createPayment: overrides.createPayment || (async () => ({ id: 99 })),
  } as any;

  const handler = createPaymentHandler({ storage, logAuditEvent: () => {} });
  return { handler, storage };
}

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
