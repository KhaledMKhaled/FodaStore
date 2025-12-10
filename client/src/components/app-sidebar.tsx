import { Link, useLocation } from "wouter";
import {
  Ship,
  Users,
  DollarSign,
  Package,
  CreditCard,
  Shield,
  LayoutDashboard,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const menuItems = [
  {
    title: "لوحة التحكم",
    url: "/",
    icon: LayoutDashboard,
    tooltip: "نظرة عامة على جميع الشحنات والمدفوعات",
  },
  {
    title: "الشحنات",
    url: "/shipments",
    icon: Ship,
    tooltip: "إدارة جميع الشحنات من لحظة الشراء حتى الاستلام",
  },
  {
    title: "الموردون",
    url: "/suppliers",
    icon: Users,
    tooltip: "إضافة وتعديل بيانات الموردين المرتبطين بكل صنف",
  },
  {
    title: "أسعار الصرف",
    url: "/exchange-rates",
    icon: DollarSign,
    tooltip: "إدارة أسعار تحويل العملات بين الرممبي والجنيه وباقي العملات",
  },
  {
    title: "المخزون",
    url: "/inventory",
    icon: Package,
    tooltip: "متابعة الأصناف المستلمة وتكلفتها في المخزون",
  },
  {
    title: "سداد الشحنات",
    url: "/payments",
    icon: CreditCard,
    tooltip: "متابعة إجمالي ما تم دفعه وما هو متبقي على جميع الشحنات",
  },
];

const adminItems = [
  {
    title: "المستخدمون والصلاحيات",
    url: "/users",
    icon: Shield,
    tooltip: "إدارة حسابات المستخدمين والصلاحيات",
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const isAdmin = user?.role === "مدير";

  return (
    <Sidebar side="right" collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center">
            <Ship className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-semibold text-lg">Repit.AI</span>
            <span className="text-xs text-muted-foreground">إدارة الشحنات</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>القائمة الرئيسية</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.url}
                        data-testid={`nav-${item.url.replace("/", "") || "dashboard"}`}
                      >
                        <Link href={item.url}>
                          <item.icon className="w-5 h-5" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      {item.tooltip}
                    </TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>الإدارة</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          asChild
                          isActive={location === item.url}
                          data-testid={`nav-${item.url.replace("/", "")}`}
                        >
                          <Link href={item.url}>
                            <item.icon className="w-5 h-5" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs">
                        {item.tooltip}
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={user?.profileImageUrl || ""} className="object-cover" />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "م"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-medium text-sm">
              {user?.firstName && user?.lastName
                ? `${user.firstName} ${user.lastName}`
                : user?.email || "مستخدم"}
            </span>
            <span className="text-xs text-muted-foreground">{user?.role || "مشاهد"}</span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                asChild
                className="group-data-[collapsible=icon]:hidden"
                data-testid="button-logout"
              >
                <a href="/api/logout">
                  <LogOut className="w-4 h-4" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">تسجيل الخروج</TooltipContent>
          </Tooltip>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
