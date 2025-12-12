import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  CreditCard,
  Plus,
  Search,
  Ship,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  FileText,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Shipment, ShipmentPayment, InsertShipmentPayment } from "@shared/schema";

const PAYMENT_METHODS = [
  { value: "نقدي", label: "نقدي" },
  { value: "فودافون كاش", label: "فودافون كاش" },
  { value: "إنستاباي", label: "إنستاباي" },
  { value: "تحويل بنكي", label: "تحويل بنكي" },
  { value: "أخرى", label: "أخرى" },
];

const COST_COMPONENTS = [
  { value: "تكلفة البضاعة", label: "تكلفة البضاعة" },
  { value: "الشحن", label: "الشحن" },
  { value: "الجمرك والتخريج", label: "الجمرك والتخريج" },
];

interface PaymentsStats {
  totalCostEgp: string;
  totalPaidEgp: string;
  totalBalanceEgp: string;
  lastPayment: ShipmentPayment | null;
}

export default function Payments() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState<number | null>(null);
  const [paymentCurrency, setPaymentCurrency] = useState("EGP");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [costComponent, setCostComponent] = useState("");
  const [activeShipment, setActiveShipment] = useState<Shipment | null>(null);
  const { toast } = useToast();

  const { data: stats, isLoading: loadingStats } = useQuery<PaymentsStats>({
    queryKey: ["/api/payments/stats"],
  });

  const { data: shipments, isLoading: loadingShipments } = useQuery<Shipment[]>({
    queryKey: ["/api/shipments"],
  });

  const { data: payments, isLoading: loadingPayments } = useQuery<
    (ShipmentPayment & { shipment?: Shipment })[]
  >({
    queryKey: ["/api/payments"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertShipmentPayment) => {
      return apiRequest("POST", "/api/payments", data);
    },
    onSuccess: () => {
      toast({ title: "تم تسجيل الدفعة بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/stats"] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "حدث خطأ", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setSelectedShipmentId(null);
    setPaymentCurrency("EGP");
    setPaymentMethod("");
    setCostComponent("");
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (!selectedShipmentId) {
      toast({ title: "يرجى اختيار الشحنة", variant: "destructive" });
      return;
    }

    if (!costComponent) {
      toast({ title: "يرجى اختيار بند التكلفة", variant: "destructive" });
      return;
    }

    const amountOriginal = formData.get("amountOriginal") as string;
    const exchangeRate = formData.get("exchangeRateToEgp") as string;
    const amountEgp =
      paymentCurrency === "EGP"
        ? amountOriginal
        : (parseFloat(amountOriginal) * parseFloat(exchangeRate || "1")).toFixed(2);

    const data: InsertShipmentPayment = {
      shipmentId: selectedShipmentId,
      paymentDate: new Date(formData.get("paymentDate") as string),
      paymentCurrency,
      amountOriginal,
      exchangeRateToEgp: paymentCurrency === "RMB" ? exchangeRate : null,
      amountEgp,
      costComponent,
      paymentMethod,
      cashReceiverName: (formData.get("cashReceiverName") as string) || null,
      referenceNumber: (formData.get("referenceNumber") as string) || null,
      note: (formData.get("note") as string) || null,
    };

    createMutation.mutate(data);
  };

  const formatCurrency = (value: string | number | null) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("ar-EG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num || 0);
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("ar-EG");
  };

  const filteredShipments = shipments?.filter(
    (s) =>
      !search ||
      s.shipmentName.toLowerCase().includes(search.toLowerCase()) ||
      s.shipmentCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">سداد الشحنات</h1>
          <p className="text-muted-foreground mt-1">
            متابعة إجمالي ما تم دفعه وما هو متبقي على جميع الشحنات
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-payment">
              <Plus className="w-4 h-4 ml-2" />
              إضافة دفعة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>تسجيل دفعة جديدة</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>اختر الشحنة *</Label>
                <Select
                  value={selectedShipmentId?.toString() || ""}
                  onValueChange={(v) => setSelectedShipmentId(parseInt(v))}
                >
                  <SelectTrigger data-testid="select-shipment">
                    <SelectValue placeholder="اختر الشحنة" />
                  </SelectTrigger>
                  <SelectContent>
                    {shipments?.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.shipmentCode} - {s.shipmentName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="paymentDate">تاريخ الدفع *</Label>
                  <Input
                    id="paymentDate"
                    name="paymentDate"
                    type="date"
                    defaultValue={new Date().toISOString().split("T")[0]}
                    required
                    data-testid="input-payment-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>عملة الدفع *</Label>
                  <Select value={paymentCurrency} onValueChange={setPaymentCurrency}>
                    <SelectTrigger data-testid="select-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EGP">جنيه مصري (ج.م)</SelectItem>
                      <SelectItem value="RMB">رممبي صيني (¥)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amountOriginal">المبلغ *</Label>
                  <Input
                    id="amountOriginal"
                    name="amountOriginal"
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    data-testid="input-amount"
                  />
                </div>
                {paymentCurrency === "RMB" && (
                  <div className="space-y-2">
                    <Label htmlFor="exchangeRateToEgp">سعر الصرف (RMB→EGP) *</Label>
                    <Input
                      id="exchangeRateToEgp"
                      name="exchangeRateToEgp"
                      type="number"
                      step="0.0001"
                      required
                      placeholder="7.00"
                      data-testid="input-exchange-rate"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>تحت حساب أي جزء؟ *</Label>
                <Select value={costComponent} onValueChange={setCostComponent}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر البند" />
                  </SelectTrigger>
                  <SelectContent>
                    {COST_COMPONENTS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>طريقة الدفع *</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger data-testid="select-payment-method">
                    <SelectValue placeholder="اختر طريقة الدفع" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {paymentMethod === "نقدي" && (
                <div className="space-y-2">
                  <Label htmlFor="cashReceiverName">اسم مستلم الكاش *</Label>
                  <Input
                    id="cashReceiverName"
                    name="cashReceiverName"
                    required
                    data-testid="input-cash-receiver"
                  />
                </div>
              )}

              {paymentMethod && paymentMethod !== "نقدي" && (
                <div className="space-y-2">
                  <Label htmlFor="referenceNumber">الرقم المرجعي</Label>
                  <Input
                    id="referenceNumber"
                    name="referenceNumber"
                    data-testid="input-reference"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="note">ملاحظات</Label>
                <Textarea
                  id="note"
                  name="note"
                  rows={2}
                  data-testid="input-note"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={createMutation.isPending}
                  data-testid="button-save-payment"
                >
                  {createMutation.isPending ? "جاري الحفظ..." : "حفظ الدفعة"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                >
                  إلغاء
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      {loadingStats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            title="إجمالي تكلفة الشحنات"
            value={`${formatCurrency(stats?.totalCostEgp || 0)} ج.م`}
            icon={Ship}
          />
          <StatCard
            title="إجمالي المدفوع"
            value={`${formatCurrency(stats?.totalPaidEgp || 0)} ج.م`}
            icon={CreditCard}
            trend="up"
          />
          <StatCard
            title="إجمالي المتبقي"
            value={`${formatCurrency(stats?.totalBalanceEgp || 0)} ج.م`}
            icon={TrendingDown}
            trend={parseFloat(stats?.totalBalanceEgp || "0") > 0 ? "down" : undefined}
          />
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="shipments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="shipments" data-testid="tab-shipments">
            الشحنات والأرصدة
          </TabsTrigger>
          <TabsTrigger value="ledger" data-testid="tab-ledger">
            كشف حركة السداد
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shipments" className="space-y-4">
          {/* Search */}
          <Card>
            <CardContent className="p-4">
              <div className="relative max-w-md">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="بحث بالشحنة..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-10"
                  data-testid="input-search-payments"
                />
              </div>
            </CardContent>
          </Card>

          {/* Shipments Payment Table */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Ship className="w-5 h-5" />
                أرصدة الشحنات
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingShipments ? (
                <TableSkeleton />
              ) : filteredShipments && filteredShipments.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">رقم الشحنة</TableHead>
                          <TableHead className="text-right">اسم الشحنة</TableHead>
                          <TableHead className="text-right">الحالة</TableHead>
                          <TableHead className="text-right">التكلفة (ج.م)</TableHead>
                          <TableHead className="text-right">المدفوع (ج.م)</TableHead>
                          <TableHead className="text-right">الرصيد</TableHead>
                          <TableHead className="text-right">آخر سداد</TableHead>
                          <TableHead className="text-right">إجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredShipments.map((shipment) => (
                          <TableRow
                            key={shipment.id}
                            data-testid={`row-payment-${shipment.id}`}
                          >
                            <TableCell className="font-medium">
                              {shipment.shipmentCode}
                            </TableCell>
                            <TableCell>
                              <button
                                type="button"
                                className="underline underline-offset-2"
                                onClick={() => setActiveShipment(shipment)}
                              >
                                {shipment.shipmentName}
                              </button>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{shipment.status}</Badge>
                            </TableCell>
                            <TableCell>
                              {formatCurrency(shipment.finalTotalCostEgp)}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(shipment.totalPaidEgp)}
                            </TableCell>
                            <TableCell>
                              <BalanceBadge
                                cost={shipment.finalTotalCostEgp}
                                paid={shipment.totalPaidEgp}
                              />
                            </TableCell>
                            <TableCell>
                              {formatDate(shipment.lastPaymentDate)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedShipmentId(shipment.id);
                                  setIsDialogOpen(true);
                                }}
                              >
                                <Plus className="w-4 h-4 ml-1" />
                                دفعة
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {activeShipment && (
                    <div className="mt-6 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold">
                          سجل مدفوعات الشحنة {activeShipment.shipmentName}
                        </h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedShipmentId(activeShipment.id);
                            setIsDialogOpen(true);
                          }}
                        >
                          إضافة دفعة
                        </Button>
                      </div>
                      <div className="grid gap-3">
                        {payments
                          ?.filter((p) => p.shipmentId === activeShipment.id)
                          .map((payment) => (
                            <div
                              key={payment.id}
                              className="p-3 border rounded-md bg-muted/40 flex flex-wrap gap-3 justify-between"
                            >
                              <div className="space-y-1">
                                <div className="text-sm text-muted-foreground">
                                  {new Date(payment.paymentDate).toLocaleString("ar-EG")}
                                </div>
                                <div className="font-semibold">
                                  {payment.paymentCurrency === "RMB" ? "¥" : "ج.م"}
                                  {" "}
                                  {formatCurrency(payment.amountOriginal)}
                                  <span className="text-sm text-muted-foreground mr-2">
                                    ({payment.amountEgp} ج.م)
                                  </span>
                                </div>
                                <div className="text-sm">طريقة الدفع: {payment.paymentMethod}</div>
                              </div>
                              <div className="text-sm space-y-1 text-right">
                                <div>تحت حساب: {payment.costComponent}</div>
                                {payment.cashReceiverName && (
                                  <div>المستلم: {payment.cashReceiverName}</div>
                                )}
                                {payment.referenceNumber && (
                                  <div>المرجع: {payment.referenceNumber}</div>
                                )}
                                {payment.note && <div>ملاحظة: {payment.note}</div>}
                              </div>
                            </div>
                          ))}
                        {payments?.filter((p) => p.shipmentId === activeShipment.id).length === 0 && (
                          <div className="text-sm text-muted-foreground">لا توجد مدفوعات بعد لهذه الشحنة.</div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState
                  icon={Ship}
                  title="لا توجد شحنات"
                  description="أضف شحنات لبدء تتبع المدفوعات"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ledger" className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                كشف حركة السداد
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPayments ? (
                <TableSkeleton />
              ) : payments && payments.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">التاريخ</TableHead>
                        <TableHead className="text-right">الشحنة</TableHead>
                        <TableHead className="text-right">تحت حساب</TableHead>
                        <TableHead className="text-right">المبلغ الأصلي</TableHead>
                        <TableHead className="text-right">المبلغ (ج.م)</TableHead>
                        <TableHead className="text-right">طريقة الدفع</TableHead>
                        <TableHead className="text-right">المستلم/المرجع</TableHead>
                        <TableHead className="text-right">ملاحظات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow
                          key={payment.id}
                          data-testid={`row-ledger-${payment.id}`}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              {formatDate(payment.paymentDate)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {payment.shipment?.shipmentCode || "-"}
                          </TableCell>
                          <TableCell>{payment.costComponent}</TableCell>
                          <TableCell>
                            <span className="font-mono">
                              {payment.paymentCurrency === "RMB" ? "¥" : "ج.م"}{" "}
                              {formatCurrency(payment.amountOriginal)}
                            </span>
                          </TableCell>
                          <TableCell className="font-bold">
                            {formatCurrency(payment.amountEgp)} ج.م
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{payment.paymentMethod}</Badge>
                          </TableCell>
                          <TableCell>
                            {payment.paymentMethod === "نقدي" ? (
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {payment.cashReceiverName}
                              </div>
                            ) : (
                              payment.referenceNumber || "-"
                            )}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {payment.note || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyState
                  icon={CreditCard}
                  title="لا توجد مدفوعات"
                  description="سجل أول دفعة لبدء التتبع"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string;
  icon: typeof Ship;
  trend?: "up" | "down";
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <div
            className={`w-12 h-12 rounded-md flex items-center justify-center ${
              trend === "up"
                ? "bg-green-100 dark:bg-green-900/30"
                : trend === "down"
                ? "bg-red-100 dark:bg-red-900/30"
                : "bg-primary/10"
            }`}
          >
            <Icon
              className={`w-6 h-6 ${
                trend === "up"
                  ? "text-green-600 dark:text-green-400"
                  : trend === "down"
                  ? "text-red-600 dark:text-red-400"
                  : "text-primary"
              }`}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BalanceBadge({
  cost,
  paid,
}: {
  cost: string | number | null;
  paid: string | number | null;
}) {
  const costValue = typeof cost === "string" ? parseFloat(cost) : cost || 0;
  const paidValue = typeof paid === "string" ? parseFloat(paid) : paid || 0;
  const remaining = Math.max(0, costValue - paidValue);

  const formatCurrency = (num: number) =>
    new Intl.NumberFormat("ar-EG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);

  if (remaining === 0) {
    return (
      <Badge
        variant="outline"
        className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      >
        مسددة
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    >
      متبقي: {formatCurrency(remaining)} ج.م
    </Badge>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Ship;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
        <Icon className="w-10 h-10 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-medium mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
