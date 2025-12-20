import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPaymentFormData,
  canAutoAllocatePayment,
  shouldShowAutoAllocationSection,
} from "./payments-utils";

test("auto allocation visibility rules", () => {
  assert.equal(
    shouldShowAutoAllocationSection({
      costComponent: "تكلفة البضاعة",
      partyType: "shipping_company",
      selectedShipmentId: 12,
    }),
    true,
  );

  assert.equal(
    shouldShowAutoAllocationSection({
      costComponent: "الشحن",
      partyType: "shipping_company",
      selectedShipmentId: 12,
    }),
    false,
  );

  assert.equal(
    shouldShowAutoAllocationSection({
      costComponent: "تكلفة البضاعة",
      partyType: "supplier",
      selectedShipmentId: 12,
    }),
    false,
  );

  assert.equal(
    shouldShowAutoAllocationSection({
      costComponent: "تكلفة البضاعة",
      partyType: "shipping_company",
      selectedShipmentId: null,
    }),
    false,
  );
});

test("auto allocate toggle requires RMB payments", () => {
  assert.equal(
    canAutoAllocatePayment({
      costComponent: "تكلفة البضاعة",
      partyType: "shipping_company",
      selectedShipmentId: 44,
      paymentCurrency: "RMB",
    }),
    true,
  );

  assert.equal(
    canAutoAllocatePayment({
      costComponent: "تكلفة البضاعة",
      partyType: "shipping_company",
      selectedShipmentId: 44,
      paymentCurrency: "EGP",
    }),
    false,
  );
});

test("buildPaymentFormData includes autoAllocate when enabled", () => {
  const payload = buildPaymentFormData({
    selectedShipmentId: 1,
    partyType: "shipping_company",
    partyId: 99,
    paymentDate: "2024-02-01",
    paymentCurrency: "RMB",
    amountOriginal: "50",
    exchangeRateToEgp: "10",
    amountEgp: "500.00",
    costComponent: "تكلفة البضاعة",
    paymentMethod: "نقدي",
    cashReceiverName: "",
    referenceNumber: "",
    note: "",
    autoAllocate: true,
    attachment: null,
  });

  const entries = new Map(payload.entries());
  assert.equal(entries.get("autoAllocate"), "true");
});
