My structure folder and their function file

│
├── src/
│   ├── db/
│   │   ├── connection.ts      ← connect to SQLite
│   │   ├── migrations/
│   │   │     └── init.sql     ← create all tables
│   │   └── seed.ts            ← optional seeding (consent types, etc.)
│   │
│   ├── services/              ← logic for each table
 │    ├ user.service.ts
 │    ├ consent.service.ts
 │    ├ user-consent.service.ts
 │    ├ metrics/
 │    │      ├ app-usage.service.ts
 │    │      ├ screen-interaction.service.ts
 │    │      ├ device-usage.service.ts
 │    │      ├ mobility.service.ts
 │    │      ├ location.service.ts
 │    │      ├ physiology.service.ts
 │    │      ├ activity.service.ts
 │    │      ├ sleep.service.ts
 │    │      └ social.service.ts
│   ├── routes/                ← API endpoints
│   └── index.ts               ← main server
│
├── database.sqlite            ← your actual SQLite DB file
├── tsconfig.json
└── package.json