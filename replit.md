# Tracker - نظام إدارة الشحنات والتكاليف والمدفوعات

## Overview
A comprehensive multi-user Arabic RTL web application for shipment costing, inventory, and payments settlement. The system manages shipments through a 5-step workflow (Import → Shipping → Customs & Takhreej → Missing Pieces → Summary) with dual-currency support (RMB/EGP), multiple payment methods including overpayment tracking, supplier management, exchange rate management, role-based access control, and missing pieces tracking.

**Platform Name**: Tracker (formerly Replit.AI)

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
│   ├── shipment-wizard.tsx # 5-step shipment creation/edit
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
4. **النواقص (Missing Pieces)**: Track damaged/lost items and calculate deductions
5. **ملخص الشحنة (Summary)**: Final review and totals

## Development

### Running the Project
```bash
npm run dev        # Start development server
npm run db:push    # Push database schema changes
```

### Payments: supplier attribution rules
- **When `supplierId` is required**: `POST /api/payments` requires a supplier when the shipment has supplier attribution (i.e., `getShipmentSuppliers` finds supplier IDs on shipment items). If exactly one supplier is present, the handler defaults to it; otherwise the request must provide `supplierId`.
- **Matching rules vs shipment suppliers**: the resolved `supplierId` must be one of the shipment’s suppliers. If it is not, `/api/payments` returns a supplier mismatch error.
- **Reporting preference**: reporting and statement views prefer `payment.supplierId` when present, and only fall back to shipment-item suppliers when it is missing. See storage methods like `getAccountingDashboard`, `getSupplierBalances`, `getSupplierStatement`, and `getMovementReport`.

### Suppliers: hidden flag usage
- **Field name**: `suppliers.is_hidden` (`isHidden` in the API payloads).
- **Default supplier list**: `GET /api/suppliers` excludes hidden suppliers by default for shipment creation.
- **Payments and reporting**: use `GET /api/suppliers?includeHidden=true` to include hidden suppliers so accounting, reports, and payment attribution remain complete.

### Key Design Decisions
- All UI is in Arabic with RTL layout
- Cairo and Tajawal fonts for Arabic text
- Dual-currency display throughout the application
- Real-time cost calculations in the shipment wizard
- Overpayment tracking with negative balance display

## Recent Changes
- **January 2026**: Persistent Payment Attachment Storage
  - Extended Object Storage implementation to payment attachments
  - New 3-step presigned URL upload flow: request URL → direct upload → finalize
  - Backend endpoints: `POST /api/upload/payment-attachment/request-url` and `POST /api/upload/payment-attachment/finalize`
  - Payment attachments now use `/objects/uploads/{uuid}` paths (persistent)
  - Backend supports both Object Storage URLs (new) and multer file uploads (legacy fallback)
  - Frontend uploads attachment to Object Storage before submitting payment form
  - Upload progress indicated with "جاري رفع المرفق..." button text
- **January 2026**: Apply to All Feature in Customs Step
  - Added "تطبيق على الكل" (Apply to All) checkboxes in Step 3 (Customs & Clearance)
  - Two separate checkboxes: one for customs, one for takhreeg (clearance)
  - When checked, copies item #1's value to all other items
  - Real-time sync: editing item #1 while checkbox is checked updates all items
  - All input fields remain editable for manual overrides
- **January 2026**: Automatic Missing Cost Recalculation
  - Missing pieces cost (missingCostEgp) now automatically recalculates when shipment costs change
  - Recalculation happens in updateShipmentWithItems when any cost component is updated
  - Ensures accurate missing deductions even if costs are modified after entering missing pieces
- **January 2026**: Persistent Item Image Storage (Verified Working)
  - Fixed critical bug where item images were lost after server restart
  - Implemented Replit Object Storage for persistent image uploads
  - New 3-step presigned URL upload flow: request URL → direct upload → finalize
  - Created reusable ItemImage component with loading states and fallback UI
  - Image paths: New uploads use `/objects/uploads/{uuid}` (persistent), old uploads used `/uploads/items/` (ephemeral)
  - Added upload logging for debugging: `[Upload] Request URL`, `[Upload] Generated`, `[Upload] Finalize`, `[Upload] Finalized`
- **January 2026**: PDF Export for Shipment Summary (Phase B Complete)
  - Added PDF export button to Step 5 (Summary) of shipment wizard
  - Uses html2canvas for RTL-compatible content capture
  - Uses jsPDF for PDF generation with multi-page support
  - Fixed pagination logic to prevent blank trailing pages
  - PDF filename format: shipment-{code}-{date}.pdf
  - Includes all summary data: shipment info, items table, costs breakdown, missing pieces deductions
- **January 2026**: Missing Pieces Tracking Feature (Phase A Complete)
  - Restructured shipment wizard from 4 to 5 steps, adding "النواقص" (Missing Pieces) as step 4
  - Added `missingPieces` and `missingCostEgp` columns to shipment_items schema
  - Added `totalMissingCostEgp` column to shipments schema
  - Backend service `updateMissingPieces` with unit landed cost calculation
  - API endpoint PATCH `/api/shipments/:id/missing-pieces` with audit logging
  - Missing cost formula: missingPieces × unitLandedCostEgp, where unitLandedCostEgp includes proportional share of all costs
  - Inventory movements now subtract missing pieces from received quantities
  - Final cost formula: sum of all costs - totalMissingCostEgp
  - Step 5 (formerly step 4) triggers "مستلمة بنجاح" status and inventory creation
  - Persistence fix: Step 4 save only calls /missing-pieces endpoint (not generic PATCH)
  - Backend fix: updateShipmentWithItems preserves existing missingPieces/missingCostEgp during item updates
- **December 27, 2025**: Large Shipment Performance, Line Numbering, and Item Search
  - Fixed critical bug where large shipments (100+ items) failed to save
  - Implemented chunked bulk inserts (CHUNK_SIZE = 50) for reliable large data handling
  - Added stable `lineNo` column to shipment_items with unique constraint per shipment
  - Line numbers are immutable once assigned - preserved on updates, gaps allowed on deletions
  - Items now ordered by lineNo when fetched (consistent display order)
  - Arabic error messages for validation and database failures
  - Design: shipmentService.ts uses UPDATE for existing items (preserving lineNo), INSERT only for new items
  - Added autocomplete search for items in shipment wizard (Step 1) - max 5 suggestions, navigates to item page and scrolls
  - Added duplicate item button (Copy icon) - creates a copy immediately after the original, without the attached image
- **December 17, 2025**: Branding and Landing Page Update
  - Renamed platform from "Replit.AI" to "Tracker" across all pages
  - Redesigned landing page with modern split-screen layout, gradient backgrounds, and backdrop blur
  - Fixed React key prop warnings in payments page
  - Added comprehensive test data for system validation
- **December 2025**: Inventory Cost Calculation Enhancement
  - Added per-piece cost breakdown in inventory: purchase price (RMB), shipping share (RMB), customs (EGP), clearance (EGP)
  - Shipping share formula: Total shipping cost RMB ÷ Total pieces in shipment
  - Clearance share formula: Total takhreeg cost ÷ Item pieces
  - Customs formula: Total customs cost ÷ Item pieces
  - Final cost: ((Purchase price + Shipping share) × Exchange rate) + Customs + Clearance
  - Enhanced inventory API to include shipping details and total shipment pieces
- **December 2025**: Shipment Wizard and Inventory Improvements
  - Made shipment details section sticky in Add Item step (Step 1) with real-time totals
  - Added items list pagination (10 items per page) with auto-scroll to newly added items
  - Changed customs calculation from per-carton to per-piece basis
  - Added partial discount field for purchase cost in Step 1
  - Added inventory page pagination (25 items per page) with page navigation
  - Added CSV export functionality for inventory movements
- **December 2025**: Implemented comprehensive accounting layer
  - New accounting dashboard with cost totals and payment summaries
  - Supplier balances page showing debts/credits per supplier with detailed statements
  - Movement report with comprehensive filters (date, supplier, shipment, cost component, payment method)
  - Payment methods report with charts showing distribution by payment method
  - All reports support CSV/Excel export
  - New sidebar section "المحاسبة والتقارير" (Accounting & Reports)
- **December 2025**: Fixed shipment display issue - costs now calculate at every step, not just step 4
  - POST /api/shipments now uses latest RMB→EGP exchange rate for preliminary purchase cost calculation
  - PATCH /api/shipments/:id now always recalculates finalTotalCostEgp on any update
  - Shipments created without completing all wizard steps now show accurate interim totals
- Initial implementation of complete shipment management system
- RTL Arabic UI with proper fonts and layout
- 5-step shipment wizard with cost calculations
- Payment tracking with multiple methods
- Supplier and exchange rate management
- Inventory movement tracking
- Role-based access control

## Test Data
Demo data has been created in the database:
- **Exchange Rates**: 3 rates (RMB→EGP: 7.15, USD→RMB: 7.10, USD→EGP: 50.75)
- **Suppliers**: 3 Chinese suppliers (شركة الصين للتجارة, مصنع قوانجو, شركة شنزن للتقنية)
- **Shipments**: 1 test shipment (SH-2024-001 - شحنة إلكترونيات ديسمبر)
  - 3 items: سماعات بلوتوث, كابلات شحن, باور بانك
  - Total cost: 36,550 EGP
  - Paid: 10,000 EGP
  - Balance: 26,550 EGP
- **Payments**: 1 bank transfer payment (10,000 EGP)
- **Inventory Movements**: 3 movements for all items in the shipment

## Root User Access
- Username: `root`
- Password: `123123123`
- Role: مدير (Admin)
