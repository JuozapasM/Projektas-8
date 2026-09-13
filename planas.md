# "Auksinis Protas" Žaidimo Organizavimo Platformos Planas

## Technologinė sudėtis (Tech Stack)
- **Kūrimo karkasas (Framework)**: Next.js 15 (App Router, Server Actions, React Server Components)
- **Programavimo kalba**: TypeScript
- **Stiliai ir UI**: Tailwind CSS + Lucide Icons
- **Duomenų bazė ir Autentifikacija**: Supabase (PostgreSQL, Supabase Auth, Row Level Security, Supabase Realtime)
- **Talpinimas ir Versijavimas**: Vercel platforma + GitHub repozitorija

---

## Duomenų Bazės Schema ir Logika (`supabase/schema.sql`)

### 1. Lentelės
- **`profiles`**:
  - `id` (UUID, primary key, susieta su `auth.users`)
  - `username` (TEXT, UNIQUE) - žaidėjo vardas prisijungimui ir vaizdavimui
  - `role` (TEXT: `'player'` | `'admin'`, default `'player'`)
  - `created_at` (TIMESTAMPTZ)

- **`seats`**:
  - `id` (UUID, primary key)
  - `table_number` (INT, 1..6) – stalo numeris (1-6)
  - `seat_number` (INT, 1..4) – vietos numeris prie stalo (1-4)
  - `user_id` (UUID, UNIQUE, NULLABLE) – priskirtas žaidėjas
  - `updated_at` (TIMESTAMPTZ)

- **`seat_history`**:
  - `id` (UUID, primary key)
  - `user_id` (UUID, references profiles.id)
  - `username` (TEXT)
  - `table_number` (INT)
  - `seat_number` (INT)
  - `action` (TEXT: `'RESERVED'`, `'CANCELLED'`, `'ADMIN_REMOVED'`)
  - `created_at` (TIMESTAMPTZ)

### 2. Atominės SQL procedūros (Atomic Transactions)
- **`assign_random_seat(p_user_id)`**:
  - Užrakina laisvas vietas paieškai (`FOR UPDATE`), atsitiktiniu būdu išrenka laisvą vietą (`WHERE user_id IS NULL ORDER BY RANDOM() LIMIT 1`), priskiria jį žaidėjui ir įrašo audito logą į `seat_history`.
- **`cancel_seat_reservation(p_user_id)`**:
  - Atlaisvina žaidėjo vietą (`user_id = NULL`) ir įrašo `'CANCELLED'` veiksmą į `seat_history`.

---

## Projekto Struktūra (Folderiai ir Failai)

```
.
├── src/
│   ├── app/
│   │   ├── admin/
│   │   │   ├── history/
│   │   │   │   └── page.tsx        # Administratoriaus vietų keitimosi istorija
│   │   │   └── page.tsx            # Administratoriaus visų žaidėjų ir vietų sąrašas
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   │   └── page.tsx        # Prisijungimo puslapis (Vardas + Slaptažodis)
│   │   │   └── register/
│   │   │       └── page.tsx        # Registracijos puslapis
│   │   ├── layout.tsx              # Pagrindinis maketas su navigacija
│   │   ├── page.tsx                # Pradinis langas su 6 stalais (Supabase Realtime)
│   │   └── globals.css
│   ├── components/
│   │   ├── HallMap.tsx             # 6 stalų erdvė su gyvu atsinaujinimu (Realtime)
│   │   ├── TableCard.tsx           # Atskiras stalas (4 vietos)
│   │   ├── SeatSquare.tsx          # Vietos kvadratas (žalias tuščias / užimtas su vardu)
│   │   ├── UserControls.tsx        # Žaidėjo rezervavimo/atšaukimo skydelis
│   │   ├── AdminTable.tsx          # Administratoriaus žaidėjų lentelė
│   │   └── AdminHistoryTable.tsx   # Chronologinė užimtų/atlaisvintų vietų istorija
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts           # Browser Supabase klientas su Realtime
│   │   │   ├── server.ts           # Server Supabase klientas (Server Actions)
│   │   │   └── middleware.ts       # Apsaugotų maršrutų middleware
│   │   └── actions/
│   │       ├── auth.ts             # Registracija ir Prisijungimas
│   │       └── seats.ts            # Vietos rezervacijos ir atšaukimo veiksmai
│   └── types/
│       └── database.ts             # Duomenų bazės TypeScript tipai
├── supabase/
│   └── schema.sql                  # Pilnas SQL skriptas (DB schema + initial data)
├── .env.local.example              # Aplinkos kintamųjų pavyzdys
├── .gitignore                      # Git ignoravimo taisyklės
├── next.config.js                  # Next.js konfigūracija
├── package.json
└── README.md
```

---

## Įgyvendinimo Fazės

1. **1 Fazė: Bazinis karkasas ir Supabase DB skriptas**
   - Parengti projekto failus, `.gitignore`, TypeScript bei Tailwind konfigūraciją.
   - Paruošti `supabase/schema.sql` su 24 pradinėmis vietomis bei atominėmis funkcijomis.

2. **2 Fazė: Autentifikacija**
   - Vartotojo vardo ir slaptažodžio registracija / prisijungimas per Supabase Auth.
   - Middleware patikra administratoriaus teisių valdymui.

3. **3 Fazė: Pradinis Langas su Gyvu Stalų Būsenos Atsinaujinimu (Realtime)**
   - Stalų ir vietų vaizdavimas (tušti žali kvadratai arba žaidėjo vardas).
   - Supabase Realtime prenumerata stalų būsenos atsinaujinimui gyvai.
   - Automatinis atsitiktinis vietos priskirimimas registruotam žaidėjui bei galimybė atšaukti rezervaciją.

4. **4 Fazė: Administratoriaus skydelis ir Istorija**
   - Registruotų žaidėjų ir jų stalų/vietų peržiūra.
   - Chronologinės užimtų ir atlaisvintų vietų istorijos peržiūra.
