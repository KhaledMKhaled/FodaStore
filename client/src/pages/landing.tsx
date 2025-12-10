import { useState } from "react";
import { Ship, Package, CreditCard, BarChart3, Shield, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function Landing() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/login", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      window.location.href = "/";
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في تسجيل الدخول",
        description: error.message || "اسم المستخدم أو كلمة المرور غير صحيحة",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال اسم المستخدم وكلمة المرور",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate({ username, password });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-bl from-primary/10 via-background to-background" />
        <div className="relative max-w-7xl mx-auto px-6 py-16">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            {/* Left side - Branding */}
            <div className="flex flex-col items-center lg:items-start text-center lg:text-right space-y-6 flex-1">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-primary flex items-center justify-center shadow-lg">
                  <Ship className="w-10 h-10 text-primary-foreground" />
                </div>
                <h1 className="text-4xl md:text-5xl font-bold">Repit.AI</h1>
              </div>
              
              <h2 className="text-2xl md:text-3xl font-semibold text-foreground max-w-xl leading-relaxed">
                نظام متكامل لإدارة الشحنات والتكاليف والمدفوعات
              </h2>
              
              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                تتبع شحناتك من لحظة الشراء حتى الاستلام، مع حساب دقيق للتكاليف 
                بالجنيه المصري والرممبي الصيني
              </p>
            </div>

            {/* Right side - Login Form */}
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="text-center">تسجيل الدخول</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">اسم المستخدم</Label>
                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="أدخل اسم المستخدم"
                      dir="ltr"
                      disabled={loginMutation.isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">كلمة المرور</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="أدخل كلمة المرور"
                      dir="ltr"
                      disabled={loginMutation.isPending}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loginMutation.isPending}
                    data-testid="button-login"
                  >
                    {loginMutation.isPending ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        جاري تسجيل الدخول...
                      </>
                    ) : (
                      "تسجيل الدخول"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <h3 className="text-2xl font-semibold text-center mb-12">المميزات الرئيسية</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon={Ship}
            title="إدارة الشحنات"
            description="تتبع جميع شحناتك من مرحلة الشراء والشحن حتى الجمارك والتخريج والاستلام"
          />
          <FeatureCard
            icon={BarChart3}
            title="حساب التكاليف"
            description="حساب دقيق لتكلفة الشراء والعمولة والشحن والجمارك والتخريج بالعملتين"
          />
          <FeatureCard
            icon={CreditCard}
            title="متابعة السداد"
            description="تسجيل المدفوعات ومتابعة الأرصدة مع دعم الدفع الزائد"
          />
          <FeatureCard
            icon={Package}
            title="المخزون"
            description="ربط الشحنات بالمخزون تلقائياً عند الاستلام مع حساب تكلفة الوحدة"
          />
          <FeatureCard
            icon={Globe}
            title="أسعار الصرف"
            description="إدارة أسعار التحويل بين الرممبي والجنيه والدولار مع حفظ تاريخي"
          />
          <FeatureCard
            icon={Shield}
            title="الصلاحيات"
            description="نظام صلاحيات متكامل مع أدوار متعددة: مدير، محاسب، مسؤول مخزون، ومشاهد"
          />
        </div>
      </div>

      {/* Currencies Section */}
      <div className="bg-card border-y border-border">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <h3 className="text-2xl font-semibold text-center mb-8">العملات المدعومة</h3>
          <div className="flex flex-wrap justify-center gap-8">
            <div className="flex items-center gap-3 bg-background rounded-lg px-6 py-4 border">
              <span className="text-3xl font-bold text-primary">¥</span>
              <div>
                <p className="font-semibold">رممبي صيني</p>
                <p className="text-sm text-muted-foreground">RMB / CNY</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-background rounded-lg px-6 py-4 border">
              <span className="text-3xl font-bold text-primary">ج.م</span>
              <div>
                <p className="font-semibold">جنيه مصري</p>
                <p className="text-sm text-muted-foreground">EGP</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 text-center">
        <p className="text-muted-foreground">
          © {new Date().getFullYear()} Repit.AI - نظام إدارة الشحنات والتكاليف
        </p>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Ship;
  title: string;
  description: string;
}) {
  return (
    <Card className="hover-elevate transition-all duration-200">
      <CardContent className="p-6">
        <div className="flex flex-col gap-4">
          <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center">
            <Icon className="w-6 h-6 text-primary" />
          </div>
          <h4 className="text-lg font-semibold">{title}</h4>
          <p className="text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
