# D1 — Product choice

**Product:** Hungry Wolf — a gamified food-delivery platform (customers,
restaurants, delivery partners; points, rewards, donation counter).

**Repo:** https://github.com/tmddnrdl333/CSC510_SE26F (our fork of a Fall 2025
team's project; the product lives in `proj2/`).

**Why we picked it (draft — edit freely):**

We picked Hungry Wolf because it is a full-stack product (React 19 client,
Express server, Firestore database) that is large enough to hide real design
in its code but small enough to reverse-engineer in a month. It also passed
the assignment's survival test quickly: as inherited, the server cannot start
at all — it demands Firebase service-account credentials that were never
committed — but within one day we had it running against a local Firestore
emulator in Docker, without touching any application logic. That early success
(plus an inherited test suite that turned out to be unrunnable — a finding we
report in D4) convinced us this product would reward analysis rather than
consume the month in build repairs.

**Products tried first and abandoned:** none — this was our first pick and it
ran on day one.
