# Repit.AI - نظام إدارة الشحنات والتكاليف والمدفوعات

## Overview
A comprehensive multi-user Arabic RTL web application for shipment costing, inventory, and payments settlement. The system manages shipments through a 4-step workflow (Import → Shipping → Customs & Takhreej → Summary) with dual-currency support (RMB/EGP), multiple payment methods including overpayment tracking, supplier management, exchange rate management, and role-based access control.

## Architecture

### Stack
- **Frontend**: React + TypeScript + Vite + Wouter (routing)
- **Backend**: Express.js + Node.js
- **Database**: PostgreSQL (Neon-backed, via Drizzle ORM)
- **Authentication**: Replit Auth (OpenID Connect)
- **UI Components**: shadcn/ui + Tailwind CSS
- **State Management**: TanStack Query

### Key Files Structure
```
client/src/
├── App.tsx              # Main app with routing and sidebar layout
├── components/
│   ├── app-sidebar.tsx  # Navigation sidebar (RTL)
│   ├── theme-toggle.tsx # Light/dark mode toggle
│   └── ui/             # shadcn/ui components
├── hooks/
│   ├── useAuth.ts      # Authentication hook
│   ├── useTheme.ts     # Theme management hook
│   └── use-toast.ts    # Toast notifications
├── pages/
│   ├── landing.tsx     # Public landing page
│   ├── dashboard.tsx   # Main dashboard with stats
│   ├── shipments.tsx   # Shipments list
│   ├── shipment-wizard.tsx # 4-step shipment creation/edit
│   ├── suppliers.tsx   # Supplier management
│   ├── exchange-rates.tsx # Currency exchange rates
│   ├── payments.tsx    # Payment tracking
│   ├── inventory.tsx   # Inventory movements
│   └── users.tsx       # User management (admin)
└── lib/
    ├── queryClient.ts  # React Query configuration
    └── authUtils.ts    # Auth utility functions

server/
├── index.ts            # Express server entry
├── routes.ts           # API route handlers
├── storage.ts          # Database operations (IStorage interface)
├── auth.ts             # Replit Auth setup
└── db.ts               # Drizzle database connection

shared/
└── schema.ts           # Database schema and types (Drizzle + Zod)
```

## Database Schema

### Core Tables
- **users**: User accounts with roles (مدير, محاسب, مسؤول مخزون, مشاهد)
- **sessions**: Session storage for Replit Auth
- **suppliers**: Supplier information
- **products**: Product catalog
- **shipments**: Main shipment records with cost breakdown
- **shipment_items**: Individual items within a shipment
- **shipment_shipping_details**: Shipping costs and exchange rates
- **shipment_customs_details**: Customs and clearance costs
- **exchange_rates**: Currency conversion rates history
- **shipment_payments**: Payment records
- **inventory_movements**: Inventory tracking
- **audit_logs**: Change history

## User Roles & Permissions
1. **مدير (Admin)**: Full access to all features
2. **محاسب (Accountant)**: Shipments, costs, and payments
3. **مسؤول مخزون (Inventory Manager)**: View shipments and inventory
4. **مشاهد (Viewer)**: Read-only access

## Currency System
- **RMB (¥)**: Purchase currency (China)
- **EGP (ج.م)**: Final accounting currency (Egypt)
- **USD ($)**: Reference for shipping costs

## Shipment Workflow
1. **الاستيراد (Import)**: Enter shipment details and items
2. **بيانات الشحن (Shipping)**: Commission and shipping costs
3. **الجمارك والتخريج (Customs)**: Customs and clearance fees
4. **ملخص الشحنة (Summary)**: Final review and totals

## Development

### Running the Project
```bash
npm run dev        # Start development server
npm run db:push    # Push database schema changes
```

### Key Design Decisions
- All UI is in Arabic with RTL layout
- Cairo and Tajawal fonts for Arabic text
- Dual-currency display throughout the application
- Real-time cost calculations in the shipment wizard
- Overpayment tracking with negative balance display

## Recent Changes
- Initial implementation of complete shipment management system
- RTL Arabic UI with proper fonts and layout
- 4-step shipment wizard with cost calculations
- Payment tracking with multiple methods
- Supplier and exchange rate management
- Inventory movement tracking
- Role-based access control
