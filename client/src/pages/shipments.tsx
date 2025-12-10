import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Ship,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Shipment } from "@shared/schema";

export default function Shipments() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: shipments, isLoading } = useQuery<Shipment[]>({
    queryKey: ["/api/shipments", { search, status: statusFilter }],
  });

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

  const filteredShipments = shipments?.filter((shipment) => {
    const matchesSearch =
      !search ||
      shipment.shipmentName.toLowerCase().includes(search.toLowerCase()) ||
      shipment.shipmentCode.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || shipment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">الشحنات</h1>
          <p className="text-muted-foreground mt-1">
            إدارة جميع الشحنات من لحظة الشراء حتى الاستلام
          </p>
        </div>
        <Button asChild data-testid="button-add-shipment">
          <Link href="/shipments/new">
            <Plus className="w-4 h-4 ml-2" />
            إضافة شحنة جديدة
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث برقم أو اسم الشحنة..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
                data-testid="input-search-shipments"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                  <SelectValue placeholder="حالة الشحنة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="جديدة">جديدة</SelectItem>
                  <SelectItem value="في انتظار الشحن">في انتظار الشحن</SelectItem>
                  <SelectItem value="جاهزة للاستلام">جاهزة للاستلام</SelectItem>
                  <SelectItem value="مستلمة بنجاح">مستلمة بنجاح</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shipments Table */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Ship className="w-5 h-5" />
            قائمة الشحنات
            {filteredShipments && (
              <Badge variant="secondary" className="mr-2">
                {filteredShipments.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton />
          ) : filteredShipments && filteredShipments.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">رقم الشحنة</TableHead>
                    <TableHead className="text-right">اسم الشحنة</TableHead>
                    <TableHead className="text-right">تاريخ الشراء</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">التكلفة (ج.م)</TableHead>
                    <TableHead className="text-right">المدفوع (ج.م)</TableHead>
                    <TableHead className="text-right">الرصيد</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShipments.map((shipment) => (
                    <TableRow
                      key={shipment.id}
                      className="hover-elevate"
                      data-testid={`row-shipment-${shipment.id}`}
                    >
                      <TableCell className="font-medium">
                        {shipment.shipmentCode}
                      </TableCell>
                      <TableCell>{shipment.shipmentName}</TableCell>
                      <TableCell>{formatDate(shipment.purchaseDate)}</TableCell>
                      <TableCell>
                        <StatusBadge status={shipment.status} />
                      </TableCell>
                      <TableCell>
                        {formatCurrency(shipment.finalTotalCostEgp)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(shipment.totalPaidEgp)}
                      </TableCell>
                      <TableCell>
                        <BalanceBadge balance={shipment.balanceEgp} />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              إجراءات
                              <ChevronDown className="w-4 h-4 mr-1" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/shipments/${shipment.id}`}>
                                <Eye className="w-4 h-4 ml-2" />
                                عرض
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/shipments/${shipment.id}/edit`}>
                                <Edit className="w-4 h-4 ml-2" />
                                تعديل
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="w-4 h-4 ml-2" />
                              حذف
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    جديدة: "",
    "في انتظار الشحن":
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    "جاهزة للاستلام":
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    "مستلمة بنجاح":
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
  };

  return (
    <Badge variant="outline" className={colors[status] || ""}>
      {status}
    </Badge>
  );
}

function BalanceBadge({ balance }: { balance: string | null }) {
  const value = parseFloat(balance || "0");
  const formatCurrency = (num: number) =>
    new Intl.NumberFormat("ar-EG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(num));

  if (value === 0) {
    return (
      <Badge
        variant="outline"
        className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      >
        مسددة
      </Badge>
    );
  }

  if (value < 0) {
    return (
      <Badge
        variant="outline"
        className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
      >
        زيادة: {formatCurrency(value)} ج.م
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    >
      متبقي: {formatCurrency(value)} ج.م
    </Badge>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
        <Ship className="w-10 h-10 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-medium mb-2">لا توجد شحنات</h3>
      <p className="text-muted-foreground mb-6">
        ابدأ بإضافة شحنتك الأولى لتتبع التكاليف والمدفوعات
      </p>
      <Button asChild>
        <Link href="/shipments/new">
          <Plus className="w-4 h-4 ml-2" />
          إضافة شحنة جديدة
        </Link>
      </Button>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
