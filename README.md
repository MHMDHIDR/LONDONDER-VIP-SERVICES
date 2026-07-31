# Premium Receipt Generator

Create a modern, production-minded web application called "Generative Receipts" for a concierge/business-services company.

Terminology: use "service" everywhere (the user's phrase "surface" meant service). Use Lovable's standard full-stack TypeScript stack with Tailwind and shadcn/ui, and prepare it for Supabase PostgreSQL, Supabase Auth, and Supabase Storage.

Design:
- Sophisticated black, warm white, and restrained metallic-gold visual system; premium/VIP feel, not flashy.
- Fully responsive on desktop, tablet, and mobile.
- Accessible labels, keyboard navigation, visible focus states, loading/empty/error states, confirmation toasts.
- Clean app shell with logo/business name, Dashboard, Services, Settings, and Sign out.

Authentication:
- Secure email/password sign-up, sign-in, sign-out, forgot/reset password, protected routes, and session persistence.
- Never store passwords outside Supabase Auth.
- All user-owned data must be isolated using user_id and Row Level Security. No cross-user access.

Routes and features:
1. /auth
   - Login/sign-up card with email and password.
2. /dashboard
   - Google Docs-inspired responsive grid of large cards.
   - First card has a large plus icon and "Generate new receipt".
   - Remaining cards are saved receipts with receipt number, customer/service, date, amount, status, and actions to view/download.
   - Search, newest-first sort, empty state, and pagination or load-more.
3. /receipts/new
   - Editable receipt date prefilled to today's local date.
   - Optional customer/client name and email.
   - Service dropdown populated from active services.
   - Selecting a service resolves the historically correct price for the chosen receipt date, then prefills a line item with service name, description, quantity 1, and GBP unit price. Permit manual editing only for this receipt snapshot.
   - Inline "Add new service" dialog if service is missing, with name, description, effective-from date, and GBP price.
   - Multiple line items array: description/name, quantity, unit price, line total, add/remove item.
   - Optional expense evidence upload (image or PDF), with file type and size validation.
   - Fixed-height, non-resizable, scrollable notes textarea.
   - Live summary showing subtotal and total in GBP (£), receipt date, client, and selected service.
   - Prominent premium black/gold "Generate receipt" button.
   - Validate inputs, avoid duplicate submissions, and use decimal-safe money handling (integer pence).
4. /receipts/:id
   - Polished printable A4 receipt preview with current business logo/name, immutable receipt number, issue date, customer, item table, notes, subtotal/total in GBP.
   - Download generated PDF.
   - Share via WhatsApp and email. Use Web Share API when supported, with WhatsApp deep link and mailto fallbacks. Never expose private storage objects through permanent public URLs.
5. /services
   - List/search/create/edit/archive services.
   - Each service has name, description, status, created_at, updated_at.
   - Price history timeline per service, with amount in integer pence, currency GBP, valid_from, valid_to, created_at.
   - Editing a price must close the previous effective interval and create a new price-history row; never mutate old prices or previously generated receipts.
   - Allow scheduled future prices, prevent overlapping effective ranges, and show current/upcoming/history.
6. /settings
   - Business name and logo upload/replace/remove.
   - Validate image file type/size, show preview.
   - Settings are per authenticated account.
   - Existing generated receipts should remain historically accurate: receipt financial and business-brand fields are snapshotted when generated.

Data model:
- profiles (id references auth.users)
- business_settings (user_id unique, business_name, logo_path, timestamps)
- services (id, user_id, name, description, active, timestamps)
- service_prices (id, service_id, user_id, amount_pence bigint/check >=0, currency fixed GBP, valid_from timestamptz, valid_to nullable, timestamps)
- receipts (id, user_id, receipt_number unique per user, issue_date, customer_name/email, notes, subtotal_pence, total_pence, currency GBP, service_id nullable, service_name_snapshot, business_name_snapshot, logo_path_snapshot, pdf_path, timestamps)
- receipt_items (id, receipt_id, user_id, position, name, description, quantity numeric/check >0, unit_price_pence, line_total_pence, created_at)
- receipt_attachments (id, receipt_id, user_id, storage_path, filename, mime_type, size_bytes, created_at)
Use foreign keys, indexes, constraints, updated_at triggers, atomic receipt-number generation, and an atomic transaction/RPC for receipt creation.

Storage:
- Private buckets for business logos, receipt attachments, and generated receipt PDFs.
- User-scoped paths and strict storage policies.
- Use time-limited signed URLs for viewing/downloading private files.

Security/quality:
- RLS enabled and explicit owner-only policies on every application table.
- Validate all inputs client-side and server-side/database-side.
- Avoid raw HTML injection; do not leak service-role credentials.
- Build reusable typed components and a coherent schema.
- Seed a few clearly labeled sample services only for the signed-in user's demo experience, not globally.

For the first pass, build the complete UI and data integration structure. If backend provisioning is not yet available, keep the app compilable with graceful setup states, then wire it once Supabase is enabled.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/fc98eb26-1cc6-4b88-b1b7-b4f02e79d694).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
