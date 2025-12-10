import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Shield,
  Users,
  Edit,
  User,
  Mail,
  Calendar,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { User as UserType } from "@shared/schema";

const ROLES = [
  { value: "مدير", label: "مدير", description: "صلاحيات كاملة" },
  { value: "محاسب", label: "محاسب", description: "الشحنات والتكاليف والمدفوعات" },
  { value: "مسؤول مخزون", label: "مسؤول مخزون", description: "عرض الشحنات والمخزون" },
  { value: "مشاهد", label: "مشاهد", description: "عرض فقط" },
];

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [selectedRole, setSelectedRole] = useState("");
  const { toast } = useToast();

  const { data: users, isLoading } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return apiRequest("PATCH", `/api/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      toast({ title: "تم تحديث الصلاحية بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsDialogOpen(false);
      setEditingUser(null);
    },
    onError: () => {
      toast({ title: "حدث خطأ", variant: "destructive" });
    },
  });

  const openEditDialog = (user: UserType) => {
    setEditingUser(user);
    setSelectedRole(user.role || "مشاهد");
    setIsDialogOpen(true);
  };

  const handleSaveRole = () => {
    if (editingUser) {
      updateRoleMutation.mutate({ userId: editingUser.id, role: selectedRole });
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("ar-EG");
  };

  const getRoleBadgeColor = (role: string | null) => {
    switch (role) {
      case "مدير":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
      case "محاسب":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "مسؤول مخزون":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      default:
        return "";
    }
  };

  const isAdmin = currentUser?.role === "مدير";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold">المستخدمون والصلاحيات</h1>
        <p className="text-muted-foreground mt-1">
          إدارة حسابات المستخدمين والصلاحيات
        </p>
      </div>

      {/* Roles Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {ROLES.map((role) => (
          <Card key={role.value}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{role.label}</p>
                  <p className="text-xs text-muted-foreground">{role.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Users List */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            قائمة المستخدمين
            {users && (
              <Badge variant="secondary" className="mr-2">
                {users.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : users && users.length > 0 ? (
            <div className="space-y-4">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-4 p-4 rounded-md border bg-card hover-elevate"
                  data-testid={`user-row-${user.id}`}
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="w-12 h-12">
                      <AvatarImage
                        src={user.profileImageUrl || ""}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {user.firstName?.[0] || user.email?.[0]?.toUpperCase() || "م"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {user.firstName && user.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user.email || "مستخدم"}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-1">
                        {user.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          انضم: {formatDate(user.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={getRoleBadgeColor(user.role)}
                    >
                      {user.role || "مشاهد"}
                    </Badge>
                    {isAdmin && user.id !== currentUser?.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(user)}
                        data-testid={`button-edit-user-${user.id}`}
                      >
                        <Edit className="w-4 h-4 ml-1" />
                        تعديل
                      </Button>
                    )}
                    {user.id === currentUser?.id && (
                      <Badge variant="secondary">أنت</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل صلاحية المستخدم</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-md bg-muted/50">
                <Avatar>
                  <AvatarImage
                    src={editingUser.profileImageUrl || ""}
                    className="object-cover"
                  />
                  <AvatarFallback>
                    {editingUser.firstName?.[0] ||
                      editingUser.email?.[0]?.toUpperCase() ||
                      "م"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {editingUser.firstName && editingUser.lastName
                      ? `${editingUser.firstName} ${editingUser.lastName}`
                      : editingUser.email}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {editingUser.email}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>الصلاحية</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger data-testid="select-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div>
                          <p>{role.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {role.description}
                          </p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSaveRole}
                  className="flex-1"
                  disabled={updateRoleMutation.isPending}
                  data-testid="button-save-role"
                >
                  {updateRoleMutation.isPending ? "جاري الحفظ..." : "حفظ"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  إلغاء
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
        <Users className="w-10 h-10 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-medium mb-2">لا يوجد مستخدمون</h3>
      <p className="text-muted-foreground">
        سيظهر المستخدمون هنا بعد تسجيل الدخول
      </p>
    </div>
  );
}
