import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import {
  Ship,
  Package,
  Truck,
  FileCheck,
  ClipboardCheck,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  Shipment,
  ShipmentItem,
  ShipmentShippingDetails,
  Supplier,
} from "@shared/schema";

const STEPS = [
  { id: 1, title: "الاستيراد", icon: Package, description: "بيانات الأصناف" },
  { id: 2, title: "بيانات الشحن", icon: Truck, description: "العمولة والشحن" },
  { id: 3, title: "الجمارك والتخريج", icon: FileCheck, description: "تكاليف التخليص" },
  { id: 4, title: "ملخص الشحنة", icon: ClipboardCheck, description: "مراجعة نهائية" },
];

export default function ShipmentWizard() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const isNew = !id || id === "new";

  // Form state
  const [shipmentData, setShipmentData] = useState({
    shipmentCode: "",
    shipmentName: "",
    purchaseDate: new Date().toISOString().split("T")[0],
    status: "جديدة",
  });

  const [items, setItems] = useState<Partial<ShipmentItem>[]>([
    createEmptyItem(),
  ]);

  const [shippingData, setShippingData] = useState({
    commissionRatePercent: "0",
    shippingAreaSqm: "0",
    shippingCostPerSqmUsdOriginal: "0",
    shippingDate: new Date().toISOString().split("T")[0],
    rmbToEgpRate: "7.0",
    usdToRmbRate: "7.2",
  });

  // Fetch existing shipment data
  const { data: existingShipment, isLoading: loadingShipment } = useQuery<Shipment>({
    queryKey: ["/api/shipments", id],
    enabled: !isNew,
  });

  const { data: existingItems } = useQuery<ShipmentItem[]>({
    queryKey: ["/api/shipments", id, "items"],
    enabled: !isNew,
  });

  const { data: existingShipping } = useQuery<ShipmentShippingDetails>({
    queryKey: ["/api/shipments", id, "shipping"],
    enabled: !isNew,
  });

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  // Load existing data
  useEffect(() => {
    if (existingShipment) {
      setShipmentData({
        shipmentCode: existingShipment.shipmentCode,
        shipmentName: existingShipment.shipmentName,
        purchaseDate: existingShipment.purchaseDate?.toString() || "",
        status: existingShipment.status,
      });
    }
  }, [existingShipment]);

  useEffect(() => {
    if (existingItems && existingItems.length > 0) {
      setItems(existingItems);
    }
  }, [existingItems]);

  useEffect(() => {
    if (existingShipping) {
      setShippingData({
        commissionRatePercent: existingShipping.commissionRatePercent?.toString() || "0",
        shippingAreaSqm: existingShipping.shippingAreaSqm?.toString() || "0",
        shippingCostPerSqmUsdOriginal:
          existingShipping.shippingCostPerSqmUsdOriginal?.toString() || "0",
        shippingDate: existingShipping.shippingDate?.toString() || "",
        rmbToEgpRate: existingShipping.rmbToEgpRateAtShipping?.toString() || "7.0",
        usdToRmbRate: existingShipping.usdToRmbRateAtShipping?.toString() || "7.2",
      });
    }
  }, [existingShipping]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: { step: number }): Promise<{ id?: number } | undefined> => {
      if (isNew && data.step === 1) {
        // Create new shipment
        const response = await apiRequest("POST", "/api/shipments", {
          ...shipmentData,
          items,
        });
        return response.json();
      } else {
        // Update existing
        await apiRequest("PATCH", `/api/shipments/${id}`, {
          step: data.step,
          shipmentData,
          items,
          shippingData,
        });
        return undefined;
      }
    },
    onSuccess: (result) => {
      toast({ title: "تم الحفظ بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      if (isNew && result?.id) {
        navigate(`/shipments/${result.id}/edit`);
      }
    },
    onError: () => {
      toast({ title: "حدث خطأ", variant: "destructive" });
    },
  });

  function createEmptyItem(): Partial<ShipmentItem> {
    return {
      productName: "",
      productType: "",
      countryOfOrigin: "الصين",
      cartonsCtn: 0,
      piecesPerCartonPcs: 0,
      totalPiecesCou: 0,
      purchasePricePerPiecePriRmb: "0",
      totalPurchaseCostRmb: "0",
    };
  }

  const addItem = () => {
    setItems([...items, createEmptyItem()]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    (newItems[index] as Record<string, unknown>)[field] = value;

    // Auto-calculate COU and total
    const item = newItems[index];
    const ctn = item.cartonsCtn || 0;
    const pcs = item.piecesPerCartonPcs || 0;
    const pri = parseFloat(item.purchasePricePerPiecePriRmb?.toString() || "0");
    const cou = ctn * pcs;
    item.totalPiecesCou = cou;
    item.totalPurchaseCostRmb = (cou * pri).toFixed(2);

    setItems(newItems);
  };

  // Calculate totals
  const totalPurchaseCostRmb = items.reduce(
    (sum, item) => sum + parseFloat(item.totalPurchaseCostRmb?.toString() || "0"),
    0
  );

  const commissionRmb =
    (totalPurchaseCostRmb * parseFloat(shippingData.commissionRatePercent)) / 100;

  const shippingCostUsd =
    parseFloat(shippingData.shippingAreaSqm) *
    parseFloat(shippingData.shippingCostPerSqmUsdOriginal);

  const shippingCostRmb = shippingCostUsd * parseFloat(shippingData.usdToRmbRate);

  const rmbToEgp = parseFloat(shippingData.rmbToEgpRate);
  const purchaseCostEgp = totalPurchaseCostRmb * rmbToEgp;
  const commissionEgp = commissionRmb * rmbToEgp;
  const shippingCostEgp = shippingCostRmb * rmbToEgp;

  // Calculate customs totals
  const totalCustomsCostEgp = items.reduce((sum, item) => {
    const ctn = item.cartonsCtn || 0;
    const customsPerCarton = parseFloat(item.customsCostPerCartonEgp?.toString() || "0");
    return sum + ctn * customsPerCarton;
  }, 0);

  const totalTakhreegCostEgp = items.reduce((sum, item) => {
    const ctn = item.cartonsCtn || 0;
    const takhreegPerCarton = parseFloat(item.takhreegCostPerCartonEgp?.toString() || "0");
    return sum + ctn * takhreegPerCarton;
  }, 0);

  const finalTotalCostEgp =
    purchaseCostEgp + commissionEgp + shippingCostEgp + totalCustomsCostEgp + totalTakhreegCostEgp;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("ar-EG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  if (!isNew && loadingShipment) {
    return <WizardSkeleton />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">
            {isNew ? "إضافة شحنة جديدة" : `تعديل الشحنة: ${shipmentData.shipmentName}`}
          </h1>
          <p className="text-muted-foreground mt-1">
            {STEPS[currentStep - 1].description}
          </p>
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;

          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => setCurrentStep(step.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isCompleted
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
                data-testid={`step-${step.id}`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium whitespace-nowrap">{step.title}</span>
              </button>
              {index < STEPS.length - 1 && (
                <ArrowLeft className="w-5 h-5 mx-2 text-muted-foreground" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {currentStep === 1 && (
            <Step1Import
              shipmentData={shipmentData}
              setShipmentData={setShipmentData}
              items={items}
              updateItem={updateItem}
              addItem={addItem}
              removeItem={removeItem}
              suppliers={suppliers || []}
              isNew={isNew}
            />
          )}

          {currentStep === 2 && (
            <Step2Shipping
              shippingData={shippingData}
              setShippingData={setShippingData}
              totalPurchaseCostRmb={totalPurchaseCostRmb}
              commissionRmb={commissionRmb}
              commissionEgp={commissionEgp}
              shippingCostUsd={shippingCostUsd}
              shippingCostRmb={shippingCostRmb}
              shippingCostEgp={shippingCostEgp}
            />
          )}

          {currentStep === 3 && (
            <Step3Customs
              items={items}
              updateItem={updateItem}
              totalCustomsCostEgp={totalCustomsCostEgp}
              totalTakhreegCostEgp={totalTakhreegCostEgp}
            />
          )}

          {currentStep === 4 && (
            <Step4Summary
              shipmentData={shipmentData}
              items={items}
              totalPurchaseCostRmb={totalPurchaseCostRmb}
              purchaseCostEgp={purchaseCostEgp}
              commissionRmb={commissionRmb}
              commissionEgp={commissionEgp}
              shippingCostRmb={shippingCostRmb}
              shippingCostEgp={shippingCostEgp}
              totalCustomsCostEgp={totalCustomsCostEgp}
              totalTakhreegCostEgp={totalTakhreegCostEgp}
              finalTotalCostEgp={finalTotalCostEgp}
            />
          )}
        </div>

        {/* Cost Summary Sidebar */}
        <Card className="h-fit lg:sticky lg:top-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">ملخص التكاليف</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SummaryRow
              label="تكلفة الشراء (RMB)"
              value={`¥ ${formatCurrency(totalPurchaseCostRmb)}`}
            />
            <SummaryRow
              label="تكلفة الشراء (ج.م)"
              value={`${formatCurrency(purchaseCostEgp)} ج.م`}
            />
            <hr className="border-border" />
            <SummaryRow
              label="العمولة (RMB)"
              value={`¥ ${formatCurrency(commissionRmb)}`}
            />
            <SummaryRow
              label="العمولة (ج.م)"
              value={`${formatCurrency(commissionEgp)} ج.م`}
            />
            <hr className="border-border" />
            <SummaryRow
              label="الشحن (RMB)"
              value={`¥ ${formatCurrency(shippingCostRmb)}`}
            />
            <SummaryRow
              label="الشحن (ج.م)"
              value={`${formatCurrency(shippingCostEgp)} ج.م`}
            />
            <hr className="border-border" />
            <SummaryRow
              label="الجمارك (ج.م)"
              value={`${formatCurrency(totalCustomsCostEgp)} ج.م`}
            />
            <SummaryRow
              label="التخريج (ج.م)"
              value={`${formatCurrency(totalTakhreegCostEgp)} ج.م`}
            />
            <hr className="border-border" />
            <div className="flex justify-between items-center font-bold text-lg">
              <span>الإجمالي النهائي</span>
              <span className="text-primary">{formatCurrency(finalTotalCostEgp)} ج.م</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
          disabled={currentStep === 1}
          data-testid="button-prev"
        >
          <ArrowRight className="w-4 h-4 ml-2" />
          السابق
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => saveMutation.mutate({ step: currentStep })}
            disabled={saveMutation.isPending}
            data-testid="button-save"
          >
            <Save className="w-4 h-4 ml-2" />
            {saveMutation.isPending ? "جاري الحفظ..." : "حفظ"}
          </Button>
          {currentStep < 4 ? (
            <Button
              onClick={() => setCurrentStep(currentStep + 1)}
              data-testid="button-next"
            >
              التالي
              <ArrowLeft className="w-4 h-4 mr-2" />
            </Button>
          ) : (
            <Button
              onClick={() => {
                saveMutation.mutate({ step: 4 });
                navigate("/shipments");
              }}
              data-testid="button-finish"
            >
              إنهاء واستلام
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Step 1: Import Items
function Step1Import({
  shipmentData,
  setShipmentData,
  items,
  updateItem,
  addItem,
  removeItem,
  suppliers,
  isNew,
}: {
  shipmentData: { shipmentCode: string; shipmentName: string; purchaseDate: string; status: string };
  setShipmentData: (data: typeof shipmentData) => void;
  items: Partial<ShipmentItem>[];
  updateItem: (index: number, field: string, value: string | number) => void;
  addItem: () => void;
  removeItem: (index: number) => void;
  suppliers: Supplier[];
  isNew: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Shipment Info */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Ship className="w-5 h-5" />
            بيانات الشحنة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shipmentCode">رقم الشحنة *</Label>
              <Input
                id="shipmentCode"
                value={shipmentData.shipmentCode}
                onChange={(e) =>
                  setShipmentData({ ...shipmentData, shipmentCode: e.target.value })
                }
                placeholder="SHP-001"
                data-testid="input-shipment-code"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipmentName">اسم الشحنة *</Label>
              <Input
                id="shipmentName"
                value={shipmentData.shipmentName}
                onChange={(e) =>
                  setShipmentData({ ...shipmentData, shipmentName: e.target.value })
                }
                placeholder="شحنة ملابس شتوية"
                data-testid="input-shipment-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchaseDate">تاريخ الشراء *</Label>
              <Input
                id="purchaseDate"
                type="date"
                value={shipmentData.purchaseDate}
                onChange={(e) =>
                  setShipmentData({ ...shipmentData, purchaseDate: e.target.value })
                }
                data-testid="input-purchase-date"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader className="pb-4 flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="w-5 h-5" />
            بنود الشحنة ({items.length})
          </CardTitle>
          <Button size="sm" onClick={addItem} data-testid="button-add-item">
            <Plus className="w-4 h-4 ml-2" />
            إضافة بند
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, index) => (
            <div
              key={index}
              className="p-4 border rounded-md space-y-4 bg-card"
              data-testid={`item-row-${index}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">البند {index + 1}</span>
                {items.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(index)}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>المورد</Label>
                  <Select
                    value={item.supplierId?.toString() || ""}
                    onValueChange={(value) =>
                      updateItem(index, "supplierId", parseInt(value))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المورد" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id.toString()}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>نوع الصنف (TYP)</Label>
                  <Input
                    value={item.productType || ""}
                    onChange={(e) => updateItem(index, "productType", e.target.value)}
                    placeholder="ملابس"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>اسم المنتج *</Label>
                  <Input
                    value={item.productName || ""}
                    onChange={(e) => updateItem(index, "productName", e.target.value)}
                    placeholder="قميص رجالي قطن"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label>بلد المنشأ</Label>
                  <Input
                    value={item.countryOfOrigin || "الصين"}
                    onChange={(e) => updateItem(index, "countryOfOrigin", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>عدد الكراتين (CTN)</Label>
                  <Input
                    type="number"
                    value={item.cartonsCtn || 0}
                    onChange={(e) =>
                      updateItem(index, "cartonsCtn", parseInt(e.target.value) || 0)
                    }
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>قطع/كرتونة (PCS)</Label>
                  <Input
                    type="number"
                    value={item.piecesPerCartonPcs || 0}
                    onChange={(e) =>
                      updateItem(index, "piecesPerCartonPcs", parseInt(e.target.value) || 0)
                    }
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>إجمالي القطع (COU)</Label>
                  <Input
                    value={item.totalPiecesCou || 0}
                    readOnly
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label>سعر القطعة (RMB)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.purchasePricePerPiecePriRmb || "0"}
                    onChange={(e) =>
                      updateItem(index, "purchasePricePerPiecePriRmb", e.target.value)
                    }
                    min="0"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <div className="bg-primary/10 px-4 py-2 rounded-md">
                  <span className="text-sm text-muted-foreground ml-2">
                    إجمالي البند:
                  </span>
                  <span className="font-bold text-primary">
                    ¥ {new Intl.NumberFormat("ar-EG").format(parseFloat(item.totalPurchaseCostRmb?.toString() || "0"))}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// Step 2: Shipping
function Step2Shipping({
  shippingData,
  setShippingData,
  totalPurchaseCostRmb,
  commissionRmb,
  commissionEgp,
  shippingCostUsd,
  shippingCostRmb,
  shippingCostEgp,
}: {
  shippingData: {
    commissionRatePercent: string;
    shippingAreaSqm: string;
    shippingCostPerSqmUsdOriginal: string;
    shippingDate: string;
    rmbToEgpRate: string;
    usdToRmbRate: string;
  };
  setShippingData: (data: typeof shippingData) => void;
  totalPurchaseCostRmb: number;
  commissionRmb: number;
  commissionEgp: number;
  shippingCostUsd: number;
  shippingCostRmb: number;
  shippingCostEgp: number;
}) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("ar-EG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  return (
    <div className="space-y-6">
      {/* Read-only Total */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">إجمالي تكلفة الشراء (RMB)</span>
            <span className="text-2xl font-bold text-primary">
              ¥ {formatCurrency(totalPurchaseCostRmb)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Commission */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">العمولة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>نسبة العمولة %</Label>
              <Input
                type="number"
                step="0.1"
                value={shippingData.commissionRatePercent}
                onChange={(e) =>
                  setShippingData({
                    ...shippingData,
                    commissionRatePercent: e.target.value,
                  })
                }
                min="0"
                data-testid="input-commission-rate"
              />
            </div>
            <div className="space-y-2">
              <Label>قيمة العمولة (RMB)</Label>
              <Input
                value={`¥ ${formatCurrency(commissionRmb)}`}
                readOnly
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label>قيمة العمولة (ج.م)</Label>
              <Input
                value={`${formatCurrency(commissionEgp)} ج.م`}
                readOnly
                className="bg-muted font-bold text-primary"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shipping Cost */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">تكلفة الشحن</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>مساحة الشحن (م²)</Label>
              <Input
                type="number"
                step="0.01"
                value={shippingData.shippingAreaSqm}
                onChange={(e) =>
                  setShippingData({ ...shippingData, shippingAreaSqm: e.target.value })
                }
                min="0"
                data-testid="input-shipping-area"
              />
            </div>
            <div className="space-y-2">
              <Label>سعر الشحن/م² (USD)</Label>
              <Input
                type="number"
                step="0.01"
                value={shippingData.shippingCostPerSqmUsdOriginal}
                onChange={(e) =>
                  setShippingData({
                    ...shippingData,
                    shippingCostPerSqmUsdOriginal: e.target.value,
                  })
                }
                min="0"
                data-testid="input-shipping-cost-usd"
              />
            </div>
            <div className="space-y-2">
              <Label>تاريخ الشحن</Label>
              <Input
                type="date"
                value={shippingData.shippingDate}
                onChange={(e) =>
                  setShippingData({ ...shippingData, shippingDate: e.target.value })
                }
                data-testid="input-shipping-date"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>سعر صرف USD → RMB</Label>
              <Input
                type="number"
                step="0.0001"
                value={shippingData.usdToRmbRate}
                onChange={(e) =>
                  setShippingData({ ...shippingData, usdToRmbRate: e.target.value })
                }
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label>سعر صرف RMB → EGP</Label>
              <Input
                type="number"
                step="0.0001"
                value={shippingData.rmbToEgpRate}
                onChange={(e) =>
                  setShippingData({ ...shippingData, rmbToEgpRate: e.target.value })
                }
                min="0"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            <div className="bg-muted/50 p-3 rounded-md">
              <p className="text-sm text-muted-foreground">إجمالي الشحن (USD)</p>
              <p className="text-lg font-bold">$ {formatCurrency(shippingCostUsd)}</p>
            </div>
            <div className="bg-muted/50 p-3 rounded-md">
              <p className="text-sm text-muted-foreground">إجمالي الشحن (RMB)</p>
              <p className="text-lg font-bold">¥ {formatCurrency(shippingCostRmb)}</p>
            </div>
            <div className="bg-primary/10 p-3 rounded-md">
              <p className="text-sm text-muted-foreground">إجمالي الشحن (ج.م)</p>
              <p className="text-lg font-bold text-primary">
                {formatCurrency(shippingCostEgp)} ج.م
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Step 3: Customs
function Step3Customs({
  items,
  updateItem,
  totalCustomsCostEgp,
  totalTakhreegCostEgp,
}: {
  items: Partial<ShipmentItem>[];
  updateItem: (index: number, field: string, value: string | number) => void;
  totalCustomsCostEgp: number;
  totalTakhreegCostEgp: number;
}) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("ar-EG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileCheck className="w-5 h-5" />
            الجمارك والتخريج
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, index) => {
            const ctn = item.cartonsCtn || 0;
            const customsPerCarton = parseFloat(
              item.customsCostPerCartonEgp?.toString() || "0"
            );
            const takhreegPerCarton = parseFloat(
              item.takhreegCostPerCartonEgp?.toString() || "0"
            );
            const totalCustoms = ctn * customsPerCarton;
            const totalTakhreeg = ctn * takhreegPerCarton;

            return (
              <div
                key={index}
                className="p-4 border rounded-md bg-card"
                data-testid={`customs-item-${index}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="font-medium">{item.productName || `البند ${index + 1}`}</span>
                    <span className="text-sm text-muted-foreground mr-2">
                      ({ctn} كرتونة)
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>جمرك/كرتونة (ج.م)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.customsCostPerCartonEgp || ""}
                      onChange={(e) =>
                        updateItem(index, "customsCostPerCartonEgp", e.target.value)
                      }
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>إجمالي الجمرك (ج.م)</Label>
                    <Input
                      value={formatCurrency(totalCustoms)}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>تخريج/كرتونة (ج.م)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.takhreegCostPerCartonEgp || ""}
                      onChange={(e) =>
                        updateItem(index, "takhreegCostPerCartonEgp", e.target.value)
                      }
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>إجمالي التخريج (ج.م)</Label>
                    <Input
                      value={formatCurrency(totalTakhreeg)}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            <div className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-md">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                إجمالي الجمارك للشحنة
              </p>
              <p className="text-2xl font-bold text-amber-900 dark:text-amber-200">
                {formatCurrency(totalCustomsCostEgp)} ج.م
              </p>
            </div>
            <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-md">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                إجمالي التخريج للشحنة
              </p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">
                {formatCurrency(totalTakhreegCostEgp)} ج.م
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Step 4: Summary
function Step4Summary({
  shipmentData,
  items,
  totalPurchaseCostRmb,
  purchaseCostEgp,
  commissionRmb,
  commissionEgp,
  shippingCostRmb,
  shippingCostEgp,
  totalCustomsCostEgp,
  totalTakhreegCostEgp,
  finalTotalCostEgp,
}: {
  shipmentData: { shipmentCode: string; shipmentName: string; purchaseDate: string; status: string };
  items: Partial<ShipmentItem>[];
  totalPurchaseCostRmb: number;
  purchaseCostEgp: number;
  commissionRmb: number;
  commissionEgp: number;
  shippingCostRmb: number;
  shippingCostEgp: number;
  totalCustomsCostEgp: number;
  totalTakhreegCostEgp: number;
  finalTotalCostEgp: number;
}) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("ar-EG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const totalCartons = items.reduce((sum, item) => sum + (item.cartonsCtn || 0), 0);
  const totalPieces = items.reduce((sum, item) => sum + (item.totalPiecesCou || 0), 0);

  return (
    <div className="space-y-6">
      {/* Shipment Info */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" />
            ملخص الشحنة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">رقم الشحنة</p>
              <p className="font-medium">{shipmentData.shipmentCode}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">اسم الشحنة</p>
              <p className="font-medium">{shipmentData.shipmentName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">تاريخ الشراء</p>
              <p className="font-medium">
                {new Date(shipmentData.purchaseDate).toLocaleDateString("ar-EG")}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">الحالة</p>
              <p className="font-medium">{shipmentData.status}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items Summary */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">ملخص البنود</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-muted/50 p-4 rounded-md">
              <p className="text-2xl font-bold">{items.length}</p>
              <p className="text-sm text-muted-foreground">عدد الأصناف</p>
            </div>
            <div className="bg-muted/50 p-4 rounded-md">
              <p className="text-2xl font-bold">{totalCartons}</p>
              <p className="text-sm text-muted-foreground">إجمالي الكراتين</p>
            </div>
            <div className="bg-muted/50 p-4 rounded-md">
              <p className="text-2xl font-bold">{totalPieces}</p>
              <p className="text-sm text-muted-foreground">إجمالي القطع</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cost Breakdown */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">تفصيل التكاليف</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <CostRow
            label="تكلفة الشراء"
            rmbValue={`¥ ${formatCurrency(totalPurchaseCostRmb)}`}
            egpValue={`${formatCurrency(purchaseCostEgp)} ج.م`}
          />
          <CostRow
            label="العمولة"
            rmbValue={`¥ ${formatCurrency(commissionRmb)}`}
            egpValue={`${formatCurrency(commissionEgp)} ج.م`}
          />
          <CostRow
            label="الشحن"
            rmbValue={`¥ ${formatCurrency(shippingCostRmb)}`}
            egpValue={`${formatCurrency(shippingCostEgp)} ج.م`}
          />
          <CostRow
            label="الجمارك"
            rmbValue="-"
            egpValue={`${formatCurrency(totalCustomsCostEgp)} ج.م`}
          />
          <CostRow
            label="التخريج"
            rmbValue="-"
            egpValue={`${formatCurrency(totalTakhreegCostEgp)} ج.م`}
          />
          <hr className="border-border my-4" />
          <div className="flex items-center justify-between p-4 bg-primary/10 rounded-md">
            <span className="text-xl font-bold">إجمالي تكلفة الشحنة</span>
            <span className="text-2xl font-bold text-primary">
              {formatCurrency(finalTotalCostEgp)} ج.م
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CostRow({
  label,
  rmbValue,
  egpValue,
}: {
  label: string;
  rmbValue: string;
  egpValue: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="font-medium">{label}</span>
      <div className="flex gap-8">
        <span className="text-muted-foreground w-32 text-left">{rmbValue}</span>
        <span className="font-medium w-32 text-left">{egpValue}</span>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function WizardSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="flex gap-2 justify-center">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-32" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );
}
