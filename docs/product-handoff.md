# Produkto perdavimas

Patikra: 2026-09-13. Versija: 0.1.0. Next.js 15.5.25, Node.js 24.19.0.

## Kas paruošta

Renginių kalendorius, individualios rezervacijos, 2–4 žmonių komandos, privatūs pakvietimai, laukiančiųjų eilė, asmeniniai QR bilietai, atvykimo registracija ir paskelbtų rezultatų istorija. „Mano bilietai“ leidžia rasti rezervaciją ir žaidimui prasidėjus. Naujos paskyros registruojamos su tikru el. paštu; yra paskyros patvirtinimas, pakartotinis patvirtinimo siuntimas ir slaptažodžio atkūrimas.

Esamas „Juozapas“ prisijungimas bei administratoriaus vaidmuo išsaugoti. Ankstesnės salės rezervacijos atskirtos nuo naujų renginių ir pasiekiamos `/hall`. Esamai Supabase bazei abi migracijos jau pritaikytos ankstesniame darbo etape; šios patikros metu bazės duomenys nekeičiami.

## Ištaisytos problemos

- Komandos dydis parenkamas pagal laisvas vietas prie vieno stalo. Komandai laikomos vietos neskaičiuojamos kaip laisvos.
- Kapitonui rodomas tikras likusių komandos vietų skaičius.
- Rezultato taškų laukas tikrinamas serveryje: neįvesti taškai negali virsti nuliu. Nulis lieka galimas sąmoningai įvestas rezultatas.
- Duomenų užklausų klaidos atskiriamos nuo tuščių sąrašų bei pasibaigusių kvietimų.
- Nepasiekiant salės ar registracijos duomenų, rezervavimo veiksmai nerodomi kaip galimas pasirinkimas.
- Keli vienos transakcijos vietų pranešimai sujungiami į vieną atnaujinimą. Nutraukiamos senos užklausos; matomame salės puslapyje būseną papildomai tikriname kas 30 sekundžių ir grįžus į langą.
- Privatūs bilietų ir slaptažodžio puslapiai apsaugoti prieš turinio pateikimą. Sesijos atnaujinimo slapukai išlaikomi nukreipiant.
- Atvykimo paieška priima ir visą QR nuorodą, ir bilieto kodą. Vien nuorodos atidarymas atvykimo nepažymi.
- Įprastas atsijungimas bei atmestas prisijungimas neuždaro kitų įrenginių sesijų.
- Administratoriaus lentelių datos visada rodomos Lietuvos laiku, išvengiant serverio ir naršyklės laiko juostų neatitikimo.
- Supaprastinta navigacija, pridėta programos piktograma, vieningas 404 bei klaidos puslapis. CSS importui naudojama konkreti deklaracija ir įjungta šalutinių importų tipų patikra.
- Eilės testas naudoja kontroliuojamus registracijų laikus, todėl jo rezultatas nepriklauso nuo vienodų milisekundžių.

## Patikros

| Patikra | Rezultatas |
| --- | --- |
| ESLint | Praėjo |
| TypeScript, įskaitant CSS importą | Praėjo |
| Auth, SQL/RLS, formų validacija ir maršrutų apsauga | 24 testai praėjo |
| Gamybinis Next.js surinkimas | Praėjo |
| npm audit, įskaitant kūrimo priklausomybes | 0 aptiktų pažeidžiamumų |
| Vietiniai HTTP maršrutai, nukreipimai ir CSS | 17 maršrutų ir CSS patikra praėjo |
| Tikras Supabase ryšys ir administratoriaus paskyra | Prisijungimas, admin vaidmuo, 6 lentelės ir 5 privatūs SSR puslapiai patikrinti; 24 senosios salės vietos išliko |
| Naršyklė | Administravimo meniu, mano bilietai, salės paieška ir gyvo ryšio prisijungimas patikrinti |
| ZIP archyvo vientisumas | Praėjo; visų įtrauktų failų SHA256SUMS patikrintos, vietinis `.env.local`, Git, priklausomybių katalogas ir surinkimo talpykla neįtraukti |
| Išpakuotas šaltinio paketas | ESLint, TypeScript, 24 testai ir gamybinis surinkimas praėjo be vietinio `.env.local` |

SQL scenarijai vykdomi atskiroje PGlite bazėje. Jie apima eilės perkėlimą, komandų laikomas vietas, kvietimų ir QR žetonų negaliojimą atšaukus, administratoriaus teises, rezultatų privatumo bei publikavimo taisykles. Testai nekeičia tikros Supabase bazės.

Išpakuoto paketo patikrai naudotos jau įdiegtos šio projekto užrakintų versijų priklausomybės; naujas jų atsisiuntimas per `npm ci` atskirai netikrintas. Naršyklėje peržiūrėta darbalaukio versija; mažo telefono ekrano vaizdas atskirai netikrintas.

Patikrintos versijos vaizdai: [pradžia](product-check/home.png), [mano bilietai](product-check/tickets.png), [salė](product-check/hall.png).

Pakartojimas:

```bash
npm ci
npm run verify
npm audit
npm run start
```

Kitame terminale, serveriui veikiant:

```bash
npm run smoke -- http://localhost:3000
npm run release:package
```

Vietinė patikrinta versija paleidžiama `http://localhost:3001`, kad nesikirstų su jau veikiančiu kūrimo serveriu. Šaltinio paketas yra `artifacts/auksinis-protas-0.1.0.zip`. Išskleistame pakete `SHA256SUMS` leidžia patikrinti failų vientisumą.

## Pirmojo renginio paleidimas

1. Prisijunkite esama administratoriaus paskyra. Meniu „Valdymas“ pasirinkite „Renginių valdymas“.
2. Įveskite tikrą pavadinimą, būsimą datą, vietą ir aprašymą. Kūrimo formos laikas yra pagal jūsų įrenginį; žaidėjams laikas rodomas Lietuvos laiko juostoje.
3. Sukūrus renginį automatiškai paruošiamos 24 vietos ir atidaroma registracija. Renginys rodomas kalendoriuje.
4. Žaidėjas rezervuoja vietą sau arba komandai. Kapitonas dalinasi privačiu pakvietimu; visi komandos nariai sėdi prie vieno stalo.
5. Pilnoje salėje žaidėjas gali stoti į laukiančiųjų eilę. Laisvinant individualią vietą ar kapitono komandą, vietos automatiškai paskirstomos eilėje. Komandos nario atlaisvinta vieta lieka laikoma jo komandai.
6. Atvykus organizatorius nuskenuoja bilietą ir patvirtina atvykimą. Prisijungimo nukreipimas išlaiko bilieto tikrinimo nuorodą.
7. Pasibaigus žaidimui pažymėkite renginį kaip pasibaigusį, įrašykite stalų rezultatus ir juos paskelbkite.

Atšaukti renginį reikia patvirtinti. Atšaukimas panaikina jo rezervacijas bei pakvietimus; pasibaigusio ar atšaukto renginio iš naujo atidaryti negalima. Juodraštis paslepia renginį nuo žaidėjų.

## Viešo paleidimo nustatymai ir patikros ribos

- Talpinimo aplinkoje nustatykite viešus Supabase URL bei anon raktą ir tikrą HTTPS `NEXT_PUBLIC_SITE_URL`. Jis reikalingas telefono QR ir el. pašto nuorodoms.
- Supabase nustatykite atitinkamą Site URL, leidžiamus patvirtinimo nukreipimus ir laiškų siuntimą. Tikras laiškų pristatymas į gavėjų dėžutes šioje patikroje netikrintas. Pakartotinio patvirtinimo bei atkūrimo veiksmai tikrinti su Auth imitacija, nesiunčiant laiškų kitiems asmenims.
- QR nuskaitymas tikru telefonu ir realus kelių žaidėjų darbas Supabase Realtime infrastruktūroje dar turi būti patikrinti viešoje aplinkoje. PGlite nenaudoja kelių lygiagrečių PostgreSQL jungčių.
- Ankstesniame `.env.local.example` buvo service role raktas. Jei jis dar nepakeistas po bendrinimo, pakeiskite jį Supabase nustatymuose. Šiai programai tokio rakto nereikia; pakete aplinkos paslapčių ir Git istorijos nėra.

Šiame etape paruošiamas ir tikrinamas vietinis produktas bei jo šaltinio paketas. Viešos Vercel versijos diegimas šiame etape neatliekamas.
