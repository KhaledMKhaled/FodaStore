export type AutoAllocationVisibilityInput = {
  costComponent: string;
  partyType: "supplier" | "shipping_company";
  selectedShipmentId: number | null;
  paymentCurrency?: string;
};

export const shouldShowAutoAllocationSection = ({
  costComponent,
  partyType,
  selectedShipmentId,
}: AutoAllocationVisibilityInput): boolean =>
  costComponent === "تكلفة البضاعة" &&
  partyType === "shipping_company" &&
  Boolean(selectedShipmentId);

export const canAutoAllocatePayment = ({
  paymentCurrency,
  ...rest
}: AutoAllocationVisibilityInput): boolean =>
  shouldShowAutoAllocationSection(rest) && paymentCurrency === "RMB";

type SupplierGoodsSummaryInput = {
  costComponent: string;
  partyType: "supplier" | "shipping_company";
  shipmentId: number | null;
  partyId: number | null;
};

export const shouldUseSupplierGoodsSummary = ({
  costComponent,
  partyType,
  shipmentId,
  partyId,
}: SupplierGoodsSummaryInput): boolean =>
  costComponent === "تكلفة البضاعة" &&
  partyType === "supplier" &&
  Boolean(shipmentId) &&
  Boolean(partyId);

export type PaymentPayloadInput = {
  selectedShipmentId: number;
  partyType: "supplier" | "shipping_company" | null;
  partyId: number | null;
  paymentDate: string;
  paymentCurrency: string;
  amountOriginal: string;
  exchangeRateToEgp: string;
  amountEgp: string;
  costComponent: string;
  paymentMethod: string;
  cashReceiverName?: string;
  referenceNumber?: string;
  note?: string;
  autoAllocate?: boolean;
  attachment?: File | null;
};

export const buildPaymentFormData = (input: PaymentPayloadInput): FormData => {
  const payload = new FormData();
  payload.append("shipmentId", String(input.selectedShipmentId));
  if (input.partyType && input.partyId) {
    payload.append("partyType", input.partyType);
    payload.append("partyId", String(input.partyId));
  }
  payload.append("paymentDate", input.paymentDate);
  payload.append("paymentCurrency", input.paymentCurrency);
  payload.append("amountOriginal", input.amountOriginal);
  if (input.paymentCurrency === "RMB") {
    payload.append("exchangeRateToEgp", input.exchangeRateToEgp);
  }
  payload.append("amountEgp", input.amountEgp);
  payload.append("costComponent", input.costComponent);
  payload.append("paymentMethod", input.paymentMethod);
  payload.append("cashReceiverName", input.cashReceiverName ?? "");
  payload.append("referenceNumber", input.referenceNumber ?? "");
  payload.append("note", input.note ?? "");
  if (input.autoAllocate) {
    payload.append("autoAllocate", "true");
  }
  if (input.attachment) {
    payload.append("attachment", input.attachment);
  }
  return payload;
};
