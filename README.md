# Smart POS — Restaurant Point of Sale System

A modern, tablet-optimized Restaurant POS web application built with Next.js, TypeScript, Tailwind CSS, shadcn/ui, Prisma ORM, and PostgreSQL.

---

## Features

### Waiter POS
- PIN-based login (4-digit)
- Table overview with live status (Available / Occupied / Waiting Payment)
- Order screen: browse menu by category, add items, set quantities, add notes
- Send orders to kitchen, complete payment, cancel orders

### Admin Dashboard
- Username/password login
- Dashboard with today's sales, order count, popular items, recent orders
- User management — create/edit/delete waiters and admins, toggle active
- Table management — create/edit/delete tables, update status
- Menu management — categories and items CRUD, toggle availability
- Restaurant settings — name, address, phone, currency, tax rate, receipt footer

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | iron-session (encrypted cookies) |
| Password Hashing | bcryptjs |

---

## Prerequisites

- Node.js 18+
- PostgreSQL database (local or cloud)

---

## Setup

### 1. Clone and install dependencies

```bash
cd smart_pos
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/smart_pos_db"
SESSION_SECRET="your-random-secret-at-least-32-characters-long"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Set up the database

```bash
# Generate Prisma client
npx prisma generate

# Run migrations (creates all tables)
npx prisma migrate dev --name init

# Seed with sample data
npx prisma db seed
```

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Default Credentials (from seed)

### Admin
- URL: `/admin/login`
- Username: `admin`
- Password: `admin123`

### Waiters (PIN login at `/pos/login`)
| Name | PIN |
|---|---|
| Ahmed | 1234 |
| Fatima | 5678 |

---

## Project Structure

```
smart_pos/
├── prisma/
│   ├── schema.prisma       # Database models
│   └── seed.ts             # Sample data
├── src/
│   ├── actions/            # Next.js Server Actions
│   │   ├── auth.ts
│   │   ├── menu.ts
│   │   ├── orders.ts
│   │   ├── settings.ts
│   │   ├── tables.ts
│   │   └── users.ts
│   ├── app/
│   │   ├── admin/          # Admin dashboard pages
│   │   │   ├── dashboard/
│   │   │   ├── login/
│   │   │   ├── menu/
│   │   │   ├── settings/
│   │   │   ├── tables/
│   │   │   └── users/
│   │   ├── api/            # API routes
│   │   ├── pos/            # Waiter POS pages
│   │   │   ├── login/
│   │   │   ├── order/[id]/
│   │   │   └── tables/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx        # Root redirect
│   ├── components/
│   │   ├── admin/          # Admin UI components
│   │   ├── pos/            # POS UI components
│   │   └── ui/             # shadcn/ui base components
│   └── lib/
│       ├── auth.ts         # Auth helpers
│       ├── prisma.ts       # Prisma client
│       ├── session.ts      # iron-session config
│       └── utils.ts        # Utility functions
```

---

## Production Build

```bash
npm run build
npm start
```

---

## Database Management

```bash
# Open Prisma Studio (visual DB browser)
npx prisma studio

# Reset database and re-seed
npx prisma migrate reset
```
