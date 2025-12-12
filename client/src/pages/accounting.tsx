import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Ship, 
  Package, 
  Truck, 
  FileText,
  AlertCircle,
  HelpCircle,
  Filter,
} from "lucide-react";
import type { Supplier } from "@shared/schema";

interface AccountingDashboard {
  totalPurchaseRmb: string;
  totalPurchaseEgp: string;
  totalShippingRmb: string;
  totalShippingEgp: string;
  totalCommissionRmb: string;
  totalCommissionEgp: string;
  totalCustomsEgp: string;
  totalTakhreegEgp: string;
  totalCostEgp: string;
  totalPaidEgp: string;
  totalBalanceEgp: string;
  unsettledShipmentsCount: number;
}

function formatCurrency(value: string | number, currency: string = "EGP") {
  const num = typeof value === "string" ? parseFloat(value) : value;
  const formatted = new Intl.NumberFormat("ar-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num || 0);
  return `${formatted} ${currency === "RMB" ? "رممبي" : "جنيه"}`;
}

export default function AccountingPage() {
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [shipmentStatus, setShipmentStatus] = useState<string>("all");
  const [paymentStatus, setPaymentStatus] = useState<string>("all");
  const [includeArchived, setIncludeArchived] = useState(false);

  const queryParams = new URLSearchParams();
  if (dateFrom) queryParams.append("dateFrom", dateFrom);
  if (dateTo) queryParams.append("dateTo", dateTo);
  if (supplierId) queryParams.append("supplierId", supplierId);
  if (shipmentStatus && shipmentStatus !== "all") queryParams.append("shipmentStatus", shipmentStatus);
  if (paymentStatus && paymentStatus !== "all") queryParams.append("paymentStatus", paymentStatus);
  if (includeArchived) queryParams.append("includeArchived", "true");

  const { data: stats, isLoading } = useQuery<AccountingDashboard>({
    queryKey: ["/api/accounting/dashboard", dateFrom, dateTo, supplierId, shipmentStatus, paymentStatus, includeArchived],
    queryFn: async () => {
      const response = await fetch(`/api/accounting/dashboard?${queryParams.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch");
      return response.json();
    },
  });

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setSupplierId("");
    setShipmentStatus("all");
    setPaymentStatus("all");
    setIncludeArchived(false);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" dir="rtl">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold">المحاسبة</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Calculator className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">المحاسبة</h1>
            <p className="text-muted-foreground text-sm">ملخص التكاليف والمدفوعات</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="w-5 h-5" />
            الفلاتر
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            <div className="space-y-2">
              <Label>من تاريخ</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                data-testid="input-date-from"
              />
            </div>
            <div className="space-y-2">
              <Label>إلى تاريخ</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                data-testid="input-date-to"
              />
            </div>
            <div className="space-y-2">
              <Label>المورد</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger data-testid="select-supplier">
                  <SelectValue placeholder="جميع الموردين" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الموردين</SelectItem>
                  {suppliers?.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>حالة الشحنة</Label>
              <Select value={shipmentStatus} onValueChange={setShipmentStatus}>
                <SelectTrigger data-testid="select-shipment-status">
                  <SelectValue placeholder="جميع الحالات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="جديدة">جديدة</SelectItem>
                  <SelectItem value="في انتظار الشحن">في انتظار الشحن</SelectItem>
                  <SelectItem value="جاهزة للاستلام">جاهزة للاستلام</SelectItem>
                  <SelectItem value="مستلمة بنجاح">مستلمة بنجاح</SelectItem>
                  <SelectItem value="مؤرشفة">مؤرشفة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>حالة السداد</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger data-testid="select-payment-status">
                  <SelectValue placeholder="الكل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="لم يتم دفع أي مبلغ">لم يتم دفع أي مبلغ</SelectItem>
                  <SelectItem value="مدفوعة جزئياً">مدفوعة جزئياً</SelectItem>
                  <SelectItem value="مسددة بالكامل">مسددة بالكامل</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>تضمين المؤرشفة</Label>
              <div className="flex items-center h-9">
                <Switch
                  checked={includeArchived}
                  onCheckedChange={setIncludeArchived}
                  data-testid="switch-include-archived"
                />
              </div>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={clearFilters} data-testid="button-clear-filters">
                مسح الفلاتر
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          ملخص التكاليف
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="إجمالي قيمة الفواتير"
            valueRmb={stats?.totalPurchaseRmb}
            valueEgp={stats?.totalPurchaseEgp}
            icon={Package}
            tooltip="إجمالي تكلفة البضاعة من جميع الشحنات"
          />
          <StatCard
            title="إجمالي تكلفة الشحن"
            valueRmb={stats?.totalShippingRmb}
            valueEgp={stats?.totalShippingEgp}
            icon={Truck}
            tooltip="إجمالي تكلفة الشحن من الصين"
          />
          <StatCard
            title="إجمالي قيمة العمولة"
            valueRmb={stats?.totalCommissionRmb}
            valueEgp={stats?.totalCommissionEgp}
            icon={DollarSign}
            tooltip="إجمالي العمولات المدفوعة"
          />
          <StatCard
            title="إجمالي قيمة الجمرك"
            valueEgp={stats?.totalCustomsEgp}
            icon={FileText}
            tooltip="إجمالي الرسوم الجمركية"
          />
          <StatCard
            title="إجمالي قيمة التخريج"
            valueEgp={stats?.totalTakhreegEgp}
            icon={Ship}
            tooltip="إجمالي تكلفة تخريج البضاعة من الميناء"
          />
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                إجمالي تكلفة الشحنات
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    مجموع جميع التكاليف (بضاعة + شحن + عمولة + جمرك + تخريج)
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <Calculator className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary" data-testid="text-total-cost">
                {formatCurrency(stats?.totalCostEgp || "0")}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-green-600" />
          المدفوعات والأرصدة
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                إجمالي المدفوع
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    مجموع جميع الدفعات التي تم تسديدها
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <TrendingDown className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-total-paid">
                {formatCurrency(stats?.totalPaidEgp || "0")}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                إجمالي المتبقي
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    المبلغ المتبقي من الشحنات غير المسددة بالكامل
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600" data-testid="text-total-balance">
                {formatCurrency(stats?.totalBalanceEgp || "0")}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                شحنات غير مسددة
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    عدد الشحنات التي لم يتم سداد كامل تكلفتها
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <Ship className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-unsettled-count">
                {stats?.unsettledShipmentsCount || 0} شحنة
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  valueRmb,
  valueEgp,
  icon: Icon,
  tooltip,
}: {
  title: string;
  valueRmb?: string;
  valueEgp?: string;
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {title}
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="w-4 h-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        </CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {valueRmb && (
          <div className="text-lg font-bold">{formatCurrency(valueRmb, "RMB")}</div>
        )}
        <div className={valueRmb ? "text-sm text-muted-foreground" : "text-lg font-bold"}>
          {formatCurrency(valueEgp || "0")}
        </div>
      </CardContent>
    </Card>
  );
}
