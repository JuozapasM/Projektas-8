# „Auksinis Protas“ renginių platforma

Next.js 15, TypeScript, Tailwind CSS ir Supabase programa žaidimų vakarams organizuoti. Kiekvienas renginys turi atskiras 24 vietas (6 stalai po 4 vietas).

## Funkcijos

- Renginių kalendorius su data, vieta ir registracijos būsena.
- Individualios rezervacijos bei 2–4 žmonių komandos prie vieno stalo. Kapitonas dalinasi privačia kvietimo nuoroda.
- Laukiančiųjų eilė: atsilaisvinusi vieta automatiškai atitenka anksčiausiai užsiregistravusiam laukiančiam žaidėjui.
- Asmeninis QR bilietas ir administratoriaus patvirtinama atvykimo registracija.
- Administratoriaus renginių, dalyvių ir rezultatų valdymas; paskelbtų rezultatų istorija.
- Registracija su tikru el. paštu, paskyros patvirtinimas ir slaptažodžio atkūrimas.

Ankstesnė salė ir jos rezervacijos pasiekiamos `/hall`. Senų paskyrų prisijungimas vartotojo vardu išlaikytas. Esamas „Juozapas“ administratoriaus vaidmuo bei prisijungimo duomenys nekeičiami. Naujos paskyros gauna žaidėjo vaidmenį.

## Paleidimas

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Į `.env.local` įrašykite savo projekto viešą Supabase URL ir anon raktą. `NEXT_PUBLIC_SITE_URL` nurodo programos adresą, naudojamą el. pašto ir QR nuorodoms. Viešai veikiančiai programai naudokite jos HTTPS adresą. Vietinis adresas telefono QR skaitytuvui nebus pasiekiamas.

Atidarykite [http://localhost:3000](http://localhost:3000). Administratoriaus renginių valdymas: `/admin/events`. Tikrų renginių datos kuriamos administratoriaus formoje; programa neprideda pavyzdinių renginių į jūsų bazę.

## Duomenų bazė

Naujai Supabase bazei SQL Editor paleiskite visą `supabase/schema.sql`.

Esamai bazei migracijas paleiskite šia tvarka:

1. `supabase/migrations/20260913_reservation_security.sql`
2. `supabase/migrations/20260914_events_teams.sql`

Migracijos išlaiko esamas paskyras, administratorių vaidmenis ir senosios salės rezervacijas. Renginių lentelėms taikomas RLS; rezervacijos keičiamos tik per tikrinamas transakcines RPC funkcijas. Renginio eilutės užraktas serializuoja rezervavimo, komandų ir eilės pakeitimus.

Administratoriaus teises patikimam organizatoriui suteikite SQL Editor, pasirinkę konkrečią paskyrą:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = 'ORGANIZATORIAUS_PASKYROS_UUID';
```

## El. paštas ir diegimas

Supabase Authentication nustatymuose nustatykite tikrą **Site URL** ir į leidžiamus **Redirect URLs** įtraukite programos `/auth/callback` adresus su užklausos parametrais (pvz., `https://jusu-domenas.lt/auth/callback**`). Vietiniam darbui taip pat pridėkite `http://localhost:3000/auth/callback**`.

Naujos paskyros pateikia tikrą el. paštą, todėl **Confirm email** gali būti įjungtas. Kai jis įjungtas, po registracijos rodoma instrukcija patikrinti paštą. Kai išjungtas, prisijungiama iš karto. Patikimam laiškų pristatymui sukonfigūruokite SMTP. Laiškų pristatymas nebuvo tikrinamas siunčiant laiškus į tikras paskyras.

Programa palaiko standartinę patvirtinimo nuorodą su PKCE per `/auth/callback` ir nuorodas su `token_hash` per `/auth/confirm`. Atkūrimo nuorodos turi nukreipti į `/auth/reset-password`. Senoms paskyroms su vidiniu el. pašto adresu atkūrimo laiškai nepasiekiami; jų prisijungimas vardu veikia kaip anksčiau.

Vercel projekto aplinkoje pridėkite visus `.env.local.example` kintamuosius ir diekite kaip Next.js programą. Šiai programai `service_role` rakto nereikia.

`.env.local.example` leidžiamos tik pavyzdinės reikšmės. Ankstesnėje versijoje jame buvo `service_role` raktas; jei jis buvo bendrintas ar įkeltas į Git, pakeiskite jį Supabase nustatymuose. Pašalinimas iš failo nepašalina rakto iš Git istorijos.

## Patikros

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

SQL testai naudoja izoliuotą PGlite PostgreSQL bazę ir nekeičia Supabase duomenų. Jie tikrina RLS, administratoriaus teises, atskiras renginių rezervacijas, komandų vietų laikymą, eilės perkėlimą, QR žetonus ir rezultatų publikavimą. Auth testai tikrina el. pašto registraciją, saugius nukreipimus, seną prisijungimą ir slaptažodžio atkūrimo logiką.

Šie testai nepatikrina realaus laiškų pristatymo, telefono kameros ar Supabase Realtime infrastruktūros. SQL funkcijų užraktai tikrinami per elgesio scenarijus, tačiau testai nenaudoja kelių lygiagrečių PostgreSQL jungčių.

Ankstesnė vizualinė peržiūra: `docs/review/review.md`.
