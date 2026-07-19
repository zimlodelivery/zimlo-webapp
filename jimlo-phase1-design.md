# Jimlo — Phase 1 Design Document
### Hyperlocal On-Demand Delivery Platform | Pilukhedi, Rajgarh District, MP

---

## 1. Scope of Phase 1

WhatsApp Business + Web App (PWA). No native apps. All order **acceptance, pricing, and assignment is manual**, done by a human admin. The software's job in Phase 1 is to:

1. Give customers a dead-simple way to *ask for anything* (structured where possible, freeform when not).
2. Give the admin a single queue to see, price, accept/reject, and assign every request.
3. Keep a record (customer history, orders, basic delivery tracking) so Phase 2 can automate on top of real data instead of guesses.

Everything below is designed so that **nothing has to be thrown away** when Phase 2 adds live menus, online payment, and live tracking — the schema and APIs already have the right shape, just with manual fallbacks instead of automation.

---

## 2. User Flows

### 2.1 Customer — Core Flow (all categories)

```
Open Web App (PWA)
   │
   ▼
Home Screen — "आज क्या चाहिए?"
   │
   ├─ Tap category (Food / Grocery / Medicine / Bakery / Parcel / Custom)
   │
   ▼
Category-specific request screen
   │  (free text + optional structured fields, see 2.2–2.6)
   │
   ▼
Review & Submit
   │  → creates Order in status = REQUESTED
   │  → customer sees "भेज दिया! Jimlo will confirm shortly"
   │  → WhatsApp message auto-sent to admin number (via WhatsApp Business API
   │     or, in the manual-only fallback, a formatted message the admin can
   │     copy-send)
   │
   ▼
Admin reviews in Admin Dashboard (see 3)
   │
   ├─ REJECTED → customer gets WhatsApp/SMS + in-app status update, reason shown
   │
   └─ ACCEPTED → admin sets price → status = CONFIRMED
                     │
                     ▼
              Admin assigns delivery partner → status = ASSIGNED
                     │
                     ▼
              Delivery partner marks PICKED_UP → OUT_FOR_DELIVERY
                     │
                     ▼
              OTP given to customer verbally/WhatsApp; delivery partner enters
              OTP on delivery → status = DELIVERED
                     │
                     ▼
              Customer rates order (1–5 + optional comment)
```

Every order — regardless of category — is fundamentally the same object: *"customer described a need, admin priced and fulfilled it."* This is why one `orders` table with a `category` field works, instead of six separate order types.

### 2.2 Food
Browse restaurant list (name, cuisine tag, approx delivery time — no live menu) → pick restaurant → free-text "what do you want to eat" (chip suggestions like "Thali", "Poha", "Chai" pulled from that restaurant's `common_items`) → submit.

### 2.3 Grocery
Free-text item list, added one at a time as chips ("Tomato 1kg", "Atta 5kg") → optional note → submit. No inventory; admin sources from a tagged local shop.

### 2.4 Medicine
Upload prescription photo (optional but flagged if request looks like a scheduled/controlled drug) + free-text medicine names → submit. Admin verifies prescription before purchase for anything requiring one.

### 2.5 Bakery
Same pattern as Food, scoped to bakery-tagged shops; supports "custom cake" as a special sub-type with a date-needed field.

### 2.6 Parcel
Structured form only (no free text needed): pickup address, drop address, sender name/phone, receiver name/phone, approximate size (Small/Medium/Large), notes. Price shown as an estimate, confirmed by admin.

### 2.7 Custom Order
Just a textarea. This is intentionally the least structured — it's the "anything" promise. Admin triages these first since intent is unknown.

### 2.8 Admin Flow
```
Orders queue (sorted: Custom/Medicine first — need triage — then by age)
   │
   ├─ Open order → see customer, category, request text, address, history
   ├─ Set price → Accept  |  Reject (with reason)
   ├─ Assign delivery partner from available list
   ├─ Track status as partner updates it
   └─ Mark payment received (Cash/UPI manual confirmation)
```

### 2.9 Delivery Partner Flow (can literally be a WhatsApp group in Phase 1, or a lightweight web view)
```
See assigned order → Navigate (opens Google Maps link) → Call customer
   → Mark Picked Up → Mark Out for Delivery → Enter OTP on delivery
   → Marked Delivered → shows in Daily Earnings
```

---

## 3. Database Schema (Phase 1)

Relational (Postgres-shaped); works equally on MySQL/SQLite for an MVP.

```sql
-- ============ USERS & AUTH ============
CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone           VARCHAR(15) UNIQUE NOT NULL,
    name            VARCHAR(100),
    created_at      TIMESTAMP DEFAULT now(),
    is_blocked      BOOLEAN DEFAULT false
);

CREATE TABLE otp_verifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone           VARCHAR(15) NOT NULL,
    otp_code        VARCHAR(6) NOT NULL,
    purpose         VARCHAR(20) DEFAULT 'login', -- login, delivery_confirmation
    expires_at      TIMESTAMP NOT NULL,
    verified_at     TIMESTAMP
);

CREATE TABLE addresses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID REFERENCES customers(id),
    label           VARCHAR(30),        -- Home, Work, Other
    line1           TEXT NOT NULL,
    landmark        VARCHAR(150),
    lat             DECIMAL(9,6),
    lng             DECIMAL(9,6),
    is_default      BOOLEAN DEFAULT false
);

CREATE TABLE admins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100),
    phone           VARCHAR(15) UNIQUE,
    role            VARCHAR(20) DEFAULT 'admin' -- admin, super_admin
);

CREATE TABLE delivery_partners (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100),
    phone           VARCHAR(15) UNIQUE,
    vehicle_type    VARCHAR(20),         -- cycle, bike, on-foot
    is_active       BOOLEAN DEFAULT true,
    is_available    BOOLEAN DEFAULT true
);

-- ============ CATALOG (LIGHTWEIGHT) ============
CREATE TABLE shops (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(150) NOT NULL,
    category         VARCHAR(20) NOT NULL, -- food, grocery, medicine, bakery
    address         TEXT,
    phone           VARCHAR(15),
    is_active       BOOLEAN DEFAULT true,
    common_items    JSONB DEFAULT '[]'    -- ["Poha","Thali","Chai"] chip suggestions
);

-- ============ ORDERS (core, category-agnostic) ============
CREATE TABLE orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number        SERIAL,                 -- human-friendly e.g. #JML1042
    customer_id         UUID REFERENCES customers(id),
    category            VARCHAR(20) NOT NULL,   -- food, grocery, medicine, bakery, parcel, custom
    shop_id             UUID REFERENCES shops(id),      -- nullable (custom/parcel won't have one)
    request_text        TEXT,                   -- freeform description of what's needed
    structured_data      JSONB DEFAULT '{}',      -- parcel fields, prescription flag, etc.
    delivery_address_id UUID REFERENCES addresses(id),
    status              VARCHAR(20) DEFAULT 'REQUESTED',
                         -- REQUESTED, REJECTED, CONFIRMED, ASSIGNED,
                         -- PICKED_UP, OUT_FOR_DELIVERY, DELIVERED, CANCELLED
    rejection_reason    TEXT,
    item_price          DECIMAL(10,2),          -- set by admin at CONFIRMED
    delivery_charge     DECIMAL(10,2) DEFAULT 0,
    total_price         DECIMAL(10,2),
    payment_method      VARCHAR(10),            -- cod, upi
    payment_status      VARCHAR(10) DEFAULT 'pending', -- pending, paid
    delivery_partner_id UUID REFERENCES delivery_partners(id),
    delivery_otp        VARCHAR(6),
    coupon_id           UUID REFERENCES coupons(id),
    created_at          TIMESTAMP DEFAULT now(),
    confirmed_at        TIMESTAMP,
    delivered_at        TIMESTAMP
);

CREATE TABLE order_attachments (      -- prescription photos etc.
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID REFERENCES orders(id),
    file_url    TEXT NOT NULL,
    type        VARCHAR(20)          -- prescription, reference_photo
);

CREATE TABLE order_status_history (   -- audit trail, powers "Live Status"
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID REFERENCES orders(id),
    status      VARCHAR(20),
    changed_by  VARCHAR(20),          -- admin, delivery_partner, system
    changed_at  TIMESTAMP DEFAULT now()
);

CREATE TABLE ratings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID REFERENCES orders(id) UNIQUE,
    stars       SMALLINT CHECK (stars BETWEEN 1 AND 5),
    comment     TEXT,
    created_at  TIMESTAMP DEFAULT now()
);

CREATE TABLE coupons (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(20) UNIQUE,
    discount_type   VARCHAR(10),      -- flat, percent
    discount_value  DECIMAL(10,2),
    valid_from      TIMESTAMP,
    valid_till      TIMESTAMP,
    max_uses        INT
);

CREATE TABLE notifications_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id),
    order_id    UUID REFERENCES orders(id),
    channel     VARCHAR(10),          -- whatsapp, sms, push
    message     TEXT,
    sent_at     TIMESTAMP DEFAULT now()
);
```

**Why this shape:**
- One `orders` table, not six — `category` + `structured_data` (JSONB) absorbs the differences between Food/Parcel/Custom without schema changes every time you add a category.
- `structured_data` is the deliberate escape hatch for Phase 1's "no inventory, no live menu" reality — instead of premature normalization (a `line_items` table implying a catalog we don't have yet), category-specific shape lives in JSON until Phase 2 makes menus real.
- `order_status_history` exists from day one so "Live Status" and analytics aren't retrofitted later.

---

## 4. API Architecture (Phase 1)

REST over HTTPS, JSON. Auth via short-lived JWT issued after OTP verification (customers) and a separate admin/staff auth (can start as simple as a shared login for Phase 1, one login per role).

### Auth
```
POST   /api/auth/otp/request        { phone }
POST   /api/auth/otp/verify         { phone, otp }              → { token, customer }
```

### Customer-facing
```
GET    /api/shops?category=food                                → list for browsing
GET    /api/shops/:id                                           → detail + common_items

POST   /api/orders                  { category, shop_id?, request_text,
                                       structured_data?, address_id, attachments? }
GET    /api/orders                                              → my order history
GET    /api/orders/:id                                          → live status detail
POST   /api/orders/:id/reorder                                  → clones a past order as new REQUESTED
POST   /api/orders/:id/rating       { stars, comment }
DELETE /api/orders/:id                                          → cancel (only if REQUESTED/CONFIRMED)

GET    /api/addresses
POST   /api/addresses
PUT    /api/addresses/:id
DELETE /api/addresses/:id

GET    /api/coupons/active
```

### Admin-facing
```
GET    /api/admin/orders?status=REQUESTED                       → queue, filterable
PUT    /api/admin/orders/:id/price       { item_price, delivery_charge }
PUT    /api/admin/orders/:id/accept
PUT    /api/admin/orders/:id/reject      { reason }
PUT    /api/admin/orders/:id/assign      { delivery_partner_id }
PUT    /api/admin/orders/:id/payment     { payment_status }

GET    /api/admin/customers
GET    /api/admin/customers/:id/orders
GET    /api/admin/shops
POST   /api/admin/shops
PUT    /api/admin/shops/:id

GET    /api/admin/analytics/summary      → orders/day, revenue, top categories
```

### Delivery partner-facing
```
GET    /api/delivery/orders/assigned
PUT    /api/delivery/orders/:id/picked-up
PUT    /api/delivery/orders/:id/out-for-delivery
POST   /api/delivery/orders/:id/verify-otp   { otp }             → marks DELIVERED
GET    /api/delivery/earnings/today
```

### Notifications (internal service, triggered by status changes)
```
POST   /internal/notify   { customer_id, order_id, channel, template }
```
Phase 1: this can literally be a webhook into WhatsApp Business API (or a manually-sent message if that's not yet approved) triggered whenever `orders.status` changes.

---

## 5. What's deliberately manual vs. automated in Phase 1

| Function | Phase 1 | Why |
|---|---|---|
| Pricing | Manual (admin types price) | No live menus/rates exist yet |
| Menu/inventory | None — free text + chip suggestions | Avoids maintaining data no one will keep updated at day 1 volume |
| Payment collection | COD / UPI QR shown manually | Payment gateway integration isn't worth it below a certain order volume |
| Delivery assignment | Manual, admin picks from active partner list | 1–3 partners at launch; an algorithm has nothing to optimize yet |
| Notifications | WhatsApp-first | Matches where Pilukhedi customers already are — no app to check |

This table is really the Phase 1 → Phase 2 checklist: each manual row becomes a real feature once order volume justifies it.

---

*Next: Admin Dashboard UI, Delivery Partner view, and WhatsApp Business flow — to be built as separate modules per the roadmap.*
