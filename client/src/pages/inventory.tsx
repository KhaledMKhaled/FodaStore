import { useQuery } from "@tanstack/react-query";
import {
  Package,
  Search,
  Ship,
  Calendar,
  DollarSign,
  TrendingUp,
  Filter,
} from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import type { InventoryMovement, ShipmentItem, Shipment } from "@shared/schema";

interface InventoryStats {
  totalPieces: number;
  totalCostEgp: string;
  totalItems: number;
  avgUnitCostEgp: string;
}

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [shipmentCodeFilter, setShipmentCodeFilter] = useState("");

  const { data: stats, isLoading: loadingStats } = useQuery<InventoryStats>({
    queryKey: ["/api/inventory/stats"],
  });

  const { data: movements, isLoading: loadingMovements } = useQuery<
    (InventoryMovement & { shipmentItem?: ShipmentItem; shipment?: Shipment })[]
  >({
    queryKey: ["/api/inventory"],
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

  const filteredMovements = movements?.filter((m) => {
    const matchesSearch =
      !search ||
      m.shipmentItem?.productName?.toLowerCase().includes(search.toLowerCase()) ||
      m.shipment?.shipmentCode?.toLowerCase().includes(search.toLowerCase());

    const matchesShipmentCode =
      !shipmentCodeFilter ||
      m.shipment?.shipmentCode?.toLowerCase().includes(shipmentCodeFilter.toLowerCase());

    // Date range filter
    let matchesDateRange = true;
    if (dateFrom || dateTo) {
      const movementDate = m.movementDate ? new Date(m.movementDate) : null;
      if (movementDate) {
        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          if (movementDate < fromDate) matchesDateRange = false;
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (movementDate > toDate) matchesDateRange = false;
        }
      }
    }

    return matchesSearch && matchesShipmentCode && matchesDateRange;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold">المخزون</h1>
        <p className="text-muted-foreground mt-1">
          متابعة الأصناف المستلمة وتكلفتها في المخزون
        </p>
      </div>

      {/* Stats Cards */}
      {loadingStats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="إجمالي الأصناف"
            value={stats?.totalItems?.toString() || "0"}
            icon={Package}
          />
          <StatCard
            title="إجمالي القطع"
            value={new Intl.NumberFormat("ar-EG").format(stats?.totalPieces || 0)}
            icon={Ship}
          />
          <StatCard
            title="إجمالي التكلفة"
            value={`${formatCurrency(stats?.totalCostEgp || 0)} ج.م`}
            icon={DollarSign}
          />
          <StatCard
            title="متوسط تكلفة الوحدة"
            value={`${formatCurrency(stats?.avgUnitCostEgp || 0)} ج.م`}
            icon={TrendingUp}
          />
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالمنتج..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
                data-testid="input-search-inventory"
              />
            </div>
            <div className="flex items-center gap-2">
              <Ship className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="رقم الشحنة..."
                value={shipmentCodeFilter}
                onChange={(e) => setShipmentCodeFilter(e.target.value)}
                className="w-[150px]"
                data-testid="input-shipment-code-filter"
              />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">من:</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-[140px]"
                  data-testid="input-date-from"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">إلى:</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-[140px]"
                  data-testid="input-date-to"
                />
              </div>
              {(dateFrom || dateTo || shipmentCodeFilter) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                    setShipmentCodeFilter("");
                  }}
                >
                  مسح الفلاتر
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="w-5 h-5" />
            حركات المخزون
            {filteredMovements && (
              <Badge variant="secondary" className="mr-2">
                {filteredMovements.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingMovements ? (
            <TableSkeleton />
          ) : filteredMovements && filteredMovements.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">الشحنة</TableHead>
                    <TableHead className="text-right">المنتج</TableHead>
                    <TableHead className="text-right">عدد القطع</TableHead>
                    <TableHead className="text-right">تكلفة الوحدة (RMB)</TableHead>
                    <TableHead className="text-right">تكلفة الوحدة (ج.م)</TableHead>
                    <TableHead className="text-right">إجمالي التكلفة (ج.م)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovements.map((movement) => (
                    <TableRow
                      key={movement.id}
                      data-testid={`row-inventory-${movement.id}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {formatDate(movement.movementDate)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {movement.shipment?.shipmentCode || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {movement.shipmentItem?.productName || "-"}
                      </TableCell>
                      <TableCell>
                        {new Intl.NumberFormat("ar-EG").format(
                          movement.totalPiecesIn || 0
                        )}
                      </TableCell>
                      <TableCell>
                        {movement.unitCostRmb
                          ? `¥ ${formatCurrency(movement.unitCostRmb)}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(movement.unitCostEgp)} ج.م
                      </TableCell>
                      <TableCell className="font-bold">
                        {formatCurrency(movement.totalCostEgp)} ج.م
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

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: typeof Package;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center">
            <Icon className="w-6 h-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
        <Package className="w-10 h-10 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-medium mb-2">لا توجد حركات مخزون</h3>
      <p className="text-muted-foreground">
        ستظهر الأصناف هنا بعد استلام الشحنات
      </p>
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
