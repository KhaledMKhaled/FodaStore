import assert from "node:assert/strict";
import test, { mock } from "node:test";

import { createPaymentHandler } from "../routes";

const actor = {
  id: "actor-1",
  username: "tester",
  firstName: "Test",
  lastName: "User",
  role: "مدير",
};

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
    amount: payload.amountEgp,
    currency: payload.paymentCurrency,
    method: payload.paymentMethod,
  });

  mock.restoreAll();
});
