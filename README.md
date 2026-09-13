# "Auksinis Protas" Stalų Rezervavimo Platforma

Ši platforma skirta "Auksinis Protas" žaidimo stalų (6 stalai x 4 vietos = 24 vietos) rezervacijai. Žaidėjai registruojasi su savo vardu ir slaptažodžiu, o sistema juos automatiškai atsitiktine tvarka priskiria prie laisvo stalo ir vietos.

## Tech Stack
- **Framework**: Next.js 15 (App Router, Server Actions)
- **Kalba**: TypeScript
- **Stiliai**: Tailwind CSS
- **Duomenų bazė / Realtime / Auth**: Supabase
- **Hostingas & Git**: Vercel + GitHub

---

## 🚀 Diegimo Instrukcija

### 1. Duomenų bazės parengimas (Supabase)
1. Eikite į [Supabase Console](https://supabase.com) ir sukurkite naują projektą.
2. Eikite į **SQL Editor** ir nukopijuokite visą turinį iš projekto failo `supabase/schema.sql`.
3. Įvykdykite SQL užklausą (`Run`). Tai sukurs:
   - `profiles`, `seats` (24 pradinės vietos) ir `seat_history` lenteles.
   - Atominias transakcijų funkcijas (`assign_random_seat`, `cancel_seat_reservation`, `admin_remove_seat`).
   - Supabase Realtime prenumeratą stalų būsenos atsinaujinimui gyvai.

### 2. Administratoriaus paskyros suteikimas
Norėdami suteikti registruotam vartotojui administratoriaus teises, Supabase SQL Editor įvykdykite:
```sql
UPDATE public.profiles
SET role = 'admin'
WHERE username = 'JUSU_ADMIN_VARDAS';
```

### 3. Aplinkos kintamieji (`.env.local`)
Sukurkite `.env.local` failą šaknineme kataloge su šiais kintamaisiais iš Supabase Settings -> API:
```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

### 4. Vietinis paleidimas
```bash
npm install
npm run dev
```
Atidarykite naršyklėje [http://localhost:3000](http://localhost:3000).

---

## 📦 Talpinimas Vercel platformoje bei GitHub
1. Įkelkite šį projektą į savo **GitHub** repozitoriją:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
2. Prisijunkite prie [Vercel](https://vercel.com) ir importuokite šią GitHub repozitoriją.
3. Vercel projekto nustatymuose įtraukite `NEXT_PUBLIC_SUPABASE_URL` ir `NEXT_PUBLIC_SUPABASE_ANON_KEY` aplinkos kintamuosius.
4. Spustelėkite **Deploy**.
