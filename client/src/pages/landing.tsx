import { Ship, Package, CreditCard, BarChart3, Shield, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-bl from-primary/10 via-background to-background" />
        <div className="relative max-w-7xl mx-auto px-6 py-24">
          <div className="flex flex-col items-center text-center space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg bg-primary flex items-center justify-center shadow-lg">
                <Ship className="w-10 h-10 text-primary-foreground" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold">Repit.AI</h1>
            </div>
            
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground max-w-3xl leading-relaxed">
              نظام متكامل لإدارة الشحنات والتكاليف والمدفوعات
            </h2>
            
            <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
              تتبع شحناتك من لحظة الشراء حتى الاستلام، مع حساب دقيق للتكاليف 
              بالجنيه المصري والرممبي الصيني
            </p>
            
            <Button size="lg" asChild className="text-lg px-8" data-testid="button-login">
              <a href="/api/login">تسجيل الدخول</a>
            </Button>
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
