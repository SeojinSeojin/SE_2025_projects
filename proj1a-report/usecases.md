# D2 — 20 use cases

Format: [usecases0.md](https://github.com/txt/se26f/blob/main/docs/submit/1/usecases0.md).
Main scenario = happy path only; all branching in extensions; `file:line`
citations are from this repo (`proj2/`). Terminology: we say "delivery
partner" throughout; the API calls the same actor `riderId`.

**Global finding (applies to every UC):** `server/middleware/auth.js` defines
auth/role middleware, but **no route ever uses it** — every API endpoint is
unauthenticated and trusts whatever `customerId`/`ownerId`/`riderId` the
caller sends. We cite it once here instead of repeating it in all 20 UCs.

---

## UC1: Sign up with a role

| Part | Content |
|---|---|
| **Name** | Sign up with a role |
| **Primary actor** | New user (customer, restaurant, or delivery partner) |
| **Stakeholders** | User: an account matching their role. Platform: valid, deduplicated accounts. |
| **Preconditions** | None (public endpoint). |
| **Trigger** | User submits the signup form. |
| **Main success scenario** | 1. User picks a role and fills the role-specific profile. 2. User provides a delivery address. 3. System validates the input. 4. System creates the account. 5. User is taken to their role's dashboard. |
| **Extensions** | 2a: Address is picked on a map; the reverse-geocode lookup needs a Google Maps key and throws without one (`client/src/pages/SignupPage.tsx:43–50`). 3a: Invalid email / password under 6 chars / unknown role → rejected (`routes/auth.js:8–11`). 3b: Email already registered → refused (`auth.js:23–26`). 4a: **Not handled** — password stored in plain text; the code itself admits it ("In production, hash this password", `auth.js:31`). |
| **Postconditions** | Account exists with role and profile; user can log in. |

## UC2: Log in

| Part | Content |
|---|---|
| **Name** | Log in |
| **Primary actor** | Registered user |
| **Stakeholders** | User: reach their dashboard. Platform: keep accounts private. |
| **Preconditions** | Account exists. |
| **Trigger** | User submits email + password. |
| **Main success scenario** | 1. User enters credentials. 2. System verifies them against the stored account. 3. System returns the user record. 4. Client routes user to the dashboard for their role. |
| **Extensions** | 2a: Unknown email or wrong password → 401 (`routes/auth.js:60–69`). 2b: **Not handled** — the live check is plain-text string equality (`auth.js:67`); no session or token is issued afterward, so "being logged in" exists only in client state. |
| **Postconditions** | Client holds the user record and shows the role dashboard. |

## UC3: Manage profile

| Part | Content |
|---|---|
| **Name** | Manage profile |
| **Primary actor** | Any logged-in user |
| **Stakeholders** | User: current contact/address data. Platform: deliverable addresses. |
| **Preconditions** | Account exists. (Profile updates are spread over four endpoints with different contracts: `auth.js`, `customer.js`, `restaurant.js`, `users.js`.) |
| **Trigger** | User edits their profile page. |
| **Main success scenario** | 1. User opens their profile. 2. User edits fields (address, phone, …). 3. System validates and saves. 4. User sees the updated profile. |
| **Extensions** | 3a: Address change triggers re-geocoding; if geocoding fails or no Maps key is set, the **old coordinates silently survive** the address change (`models/User.js:121–123`), so distance sorting (UC4) uses a stale location. |
| **Postconditions** | Profile updated; distance-based features use the new address. |

## UC4: Browse nearby restaurants

| Part | Content |
|---|---|
| **Name** | Browse nearby restaurants |
| **Primary actor** | Customer |
| **Stakeholders** | Customer: find food nearby. Restaurants: be discovered. |
| **Preconditions** | Customer logged in; restaurants registered. |
| **Trigger** | Customer opens the home/restaurant list. |
| **Main success scenario** | 1. Customer opens the restaurant list. 2. System returns registered restaurants with their ratings. 3. Customer sorts by distance from their saved address. 4. Customer opens a restaurant's menu. |
| **Extensions** | 2a: Each restaurant's rating average is **recomputed on every list read by scanning all of its orders** (`routes/customer.js:97–122`); no stored average exists. 3a: Customer record missing → 404 (`customer.js:183`). 3b: Customer has no saved location → 400, no distance sort (`customer.js:188`). |
| **Postconditions** | Customer is viewing a menu they can order from. |

## UC5: Build a cart

| Part | Content |
|---|---|
| **Name** | Build a cart |
| **Primary actor** | Customer |
| **Stakeholders** | Customer: assemble one order. Restaurant: receive a coherent order. |
| **Preconditions** | Customer is viewing a menu. |
| **Trigger** | Customer adds a first item. |
| **Main success scenario** | 1. Customer adds items and adjusts quantities. 2. System keeps a running total. 3. Customer proceeds to checkout. |
| **Extensions** | 1a: **Not handled server-side** — the cart lives only in client state (`client/src/contexts/CartContext.tsx`); a page refresh empties it. 1b: **Not handled** — no stock/availability re-check when adding items. 3a: A cart spanning several restaurants is silently split into one order per restaurant at checkout (`client/src/components/customer/Cart.tsx:106`) — see UC6/UC10. |
| **Postconditions** | Cart contents and total are ready to submit (UC6). |

## UC6: Place an order

| Part | Content |
|---|---|
| **Name** | Place an order |
| **Primary actor** | Customer |
| **Stakeholders** | Customer: get the meal. Restaurant: accurate order. Platform: order volume feeds donations (UC20). |
| **Preconditions** | Cart has items; customer has a delivery address. |
| **Trigger** | Customer confirms checkout. |
| **Main success scenario** | 1. Customer submits the cart. 2. System checks the order request is complete. 3. System creates the order(s) in `pending` state. 4. Customer sees confirmation; restaurant sees the order (UC12). |
| **Extensions** | 2a: Missing restaurantId/customerId/items → 400 (`routes/orders.js:34–45`). 2b: Checks are presence-only (`notEmpty()`): restaurant, items, and customer are never verified to exist, prices are not re-checked against the menu, and a negative `totalAmount` is accepted (`orders.js:34–40`). 3a: One checkout can create several orders (one per restaurant, `Cart.tsx:106`), each fired without awaiting the result. 4a: **Not handled** — no payment step exists anywhere; orders are created unpaid. |
| **Postconditions** | Order(s) exist in `pending`, visible to customer and restaurant. |

## UC7: Track my order

| Part | Content |
|---|---|
| **Name** | Track my order |
| **Primary actor** | Customer |
| **Stakeholders** | Customer: know when food arrives. |
| **Preconditions** | Customer has at least one order. |
| **Trigger** | Customer opens their orders page. |
| **Main success scenario** | 1. Customer opens order history. 2. System lists the customer's orders with current status. 3. Customer refreshes until delivered. |
| **Extensions** | 2a: Missing customerId → 400 (`routes/orders.js:89`). 2b: Status vocabulary is a fixed enum (`orders.js:184`); **no push/live updates** — changes appear only on refetch. 2c: `confirmedAt` is stamped when the status becomes `preparing`, not `confirmed` (`orders.js:202`), so shown timing misleads. |
| **Postconditions** | Customer has seen the current recorded status. |

## UC8: Rate a delivered order

| Part | Content |
|---|---|
| **Name** | Rate a delivered order |
| **Primary actor** | Customer |
| **Stakeholders** | Customer: give feedback. Restaurant: earn reputation. |
| **Preconditions** | Order status is `delivered`. |
| **Trigger** | Customer opens a delivered order to rate it. |
| **Main success scenario** | 1. Customer picks a star rating (1–5). 2. System checks the order belongs to this customer, is delivered, and is unrated. 3. System records the rating on the order. |
| **Extensions** | 1a: Rating outside 1–5 or not an integer → 400 (`routes/orders.js:246`). 2a: Order not found → 404 (`orders.js:262`). 2b: Order belongs to someone else → 403 (`orders.js:269`). 2c: Not delivered yet → 400 (`orders.js:273`). 2d: Already rated → 400 (`orders.js:278`). 3a: No stored average is updated — the restaurant's average is derived at read time from all its orders (`customer.js:97–122`), see UC4 2a. |
| **Postconditions** | Rating stored once; restaurant averages derived from it. |

## UC9: Earn and view points

| Part | Content |
|---|---|
| **Name** | Earn and view points |
| **Primary actor** | Customer |
| **Stakeholders** | Customer: rewards for loyalty. Platform: retention. |
| **Preconditions** | Customer has orders being delivered. |
| **Trigger** | A delivery partner marks the customer's order delivered (UC16). |
| **Main success scenario** | 1. System awards points when the order is marked delivered. 2. Points are added to the customer's balance with an "earned" transaction. 3. Customer views balance and history on the dashboard. |
| **Extensions** | 1a: **Docs/code disagree** — README promises "10% of bill" (15% for Local Legends, `README.md:102–103`); code awards `Math.floor(orderTotal)` = 1 point per dollar, no Local Legends bonus (`routes/points.js:195`, called from `delivery.js:255`). 2a: Stored history is capped at 50 entries in the earn path (`points.js:226–229`). 3a: First visit with no points record → system creates an empty one (`points.js:21–33`). |
| **Postconditions** | Balance and history reflect the delivery. |

## UC10: Redeem points for a discount

| Part | Content |
|---|---|
| **Name** | Redeem points for a discount |
| **Primary actor** | Customer |
| **Stakeholders** | Customer: pay less. Platform: credible gamification loop. |
| **Preconditions** | Customer has a positive points balance (UC9). |
| **Trigger** | Customer applies points while paying. |
| **Main success scenario** | 1. Customer views balance. 2. Customer enters points to redeem. 3. System verifies the balance covers it. 4. System converts at 1 point = $0.01. 5. System deducts points and logs a redemption. 6. Customer sees the discount applied. |
| **Extensions** | 2a: Points < 1 or non-integer → 400 (`routes/points.js:69`). 3a: Insufficient balance → 400 with available vs. requested (`points.js:92–97`). 3b: No points record → 404 (`points.js:85–88`). 5a: **Not handled** — no transaction around read-then-update; concurrent redemptions can double-spend (`points.js:82–127`). 5b: **Not handled** — points are deducted before the order is created, and order creation is fired without awaiting (`Cart.tsx:84–85`, `Cart.tsx:120`); if it fails, there is no rollback. 6a: In a multi-restaurant cart the same discount is subtracted from **every** per-restaurant order (`Cart.tsx:106–125`) — one deduction, N discounts. |
| **Postconditions** | Balance reduced; redemption logged; discount applied at checkout. |

## UC11: Control the app by voice

| Part | Content |
|---|---|
| **Name** | Control the app by voice |
| **Primary actor** | Customer |
| **Stakeholders** | Customer: hands-free navigation. Platform: differentiation. |
| **Preconditions** | Server configured with a Gemini API key. |
| **Trigger** | Customer speaks a command. |
| **Main success scenario** | 1. Customer's speech is sent as text. 2. System asks Gemini to classify it into one of five commands (logout, open profile, go home, open cart, total price — `routes/voice.js:6–12`). 3. Client performs the matched navigation action (`client/src/features/voice/utils/performAction.ts:11–27`). |
| **Extensions** | 1a: Empty text → 400 (`voice.js:36`). 2a: No `GEMINI_API_KEY` → 500, feature dead (`voice.js:39–41`). 2b: Model reply unparseable → 422 (`voice.js:73`). 3a: **Not handled** — no command can add an item or place an order: the voice feature of a food-ordering app cannot order food. |
| **Postconditions** | The spoken command navigated the app. |

## UC12: Handle an incoming order

| Part | Content |
|---|---|
| **Name** | Handle an incoming order |
| **Primary actor** | Restaurant |
| **Stakeholders** | Restaurant: manageable queue. Customer: quick decision, fresh status. Delivery partner: pickup timing. |
| **Preconditions** | Restaurant logged in; order in `pending`. |
| **Trigger** | New order appears on the restaurant dashboard. |
| **Main success scenario** | 1. Restaurant reviews the incoming order. 2. Restaurant accepts it. 3. Restaurant starts cooking and later marks the food ready. 4. The order becomes visible to delivery partners (UC15). |
| **Extensions** | 2a: Restaurant rejects → order `cancelled`; **no refund/compensation flow exists** (no payment ever happened, UC6 4a). 2b: **Not handled** — no timeout: an ignored `pending` order stays `pending` forever; the customer is never notified. 3a: Status values outside the enum → 400 (`routes/orders.js:184`); but **no transition rules** — any enum value is accepted from any state, e.g. `delivered` straight from `pending`, skipping the side effects tied to skipped states (points, UC9). 3b: Status update never checks the order exists — a bad id yields a 500, not 404 (`orders.js:199`). |
| **Postconditions** | Order state reflects the kitchen's actual decision and progress. |

## UC13: Review sales performance

| Part | Content |
|---|---|
| **Name** | Review sales performance |
| **Primary actor** | Restaurant |
| **Stakeholders** | Restaurant: know what sells. Platform: sticky dashboard. |
| **Preconditions** | Restaurant has order history. |
| **Trigger** | Restaurant opens its insights dashboard. |
| **Main success scenario** | 1. Restaurant opens the insights view. 2. System aggregates the restaurant's orders into volume and revenue over time. 3. Restaurant switches between chart views to inspect trends. |
| **Extensions** | 2a: Missing restaurantId → 400 (`routes/orders.js:119`). 2b: Aggregation happens in the browser over the full raw order list (`client/src/components/restaurant/Insights.tsx:1–45`) — cost grows with order history and every view refetches it. |
| **Postconditions** | Restaurant has seen sales trends derived from real orders. |

## UC14: Manage the menu

| Part | Content |
|---|---|
| **Name** | Manage the menu |
| **Primary actor** | Restaurant |
| **Stakeholders** | Restaurant: sell current items. Customer: order what exists. |
| **Preconditions** | Restaurant account exists. |
| **Trigger** | Restaurant edits its menu. |
| **Main success scenario** | 1. Restaurant opens menu management. 2. Restaurant adds/edits items (name, price, availability). 3. System validates and saves. 4. Customers see the updated menu. |
| **Extensions** | 1a: Missing ownerId → 400 (`routes/restaurant.js:83`). 3a: Validation failure → 400 (`restaurant.js:116`). 3b: Restaurant/menu not found → 404 (`restaurant.js:131`). 3c: The profile endpoint silently **creates** the restaurant record if none exists (`restaurant.js:58`) — onboarding and editing share one code path. |
| **Postconditions** | Menu as stored matches what the restaurant intends to sell. |

## UC15: Claim a delivery job

| Part | Content |
|---|---|
| **Name** | Claim a delivery job |
| **Primary actor** | Delivery partner |
| **Stakeholders** | Partner: earnings. Customer: food actually moves. |
| **Preconditions** | Partner registered; some order is `ready`. |
| **Trigger** | Partner opens the available-jobs list. |
| **Main success scenario** | 1. Partner browses orders that are ready for pickup. 2. Partner accepts one. 3. System assigns the order to the partner. |
| **Extensions** | 2a: Another partner got it first → 409 (`routes/delivery.js:111`). 2b: Order no longer `ready` → 400 (`delivery.js:116`). 2c: Partner record not found → 400 (`delivery.js:123`). 2d: Partner already has an active order → 400, one-at-a-time rule (`delivery.js:134`). 2e: Partner may instead reject an offered job (POST /reject). 3a: Accepting **already sets the order to `out_for_delivery`** (`delivery.js:141–146`) — before any pickup happened; see UC16 1a. |
| **Postconditions** | Exactly one partner owns the delivery. |

## UC16: Pick up and deliver an order

| Part | Content |
|---|---|
| **Name** | Pick up and deliver an order |
| **Primary actor** | Delivery partner |
| **Stakeholders** | Customer: receive food; earn points. Partner: get paid. |
| **Preconditions** | Partner has an assigned order (UC15). |
| **Trigger** | Partner arrives at the restaurant. |
| **Main success scenario** | 1. Partner confirms pickup at the restaurant. 2. Partner hands over the food and confirms delivery. 3. System closes the order, awards the customer's points (UC9), and credits the partner's earnings. |
| **Extensions** | 1a: The pickup confirmation re-sets a status the order already has (set at acceptance, `delivery.js:141–146`) and **never checks the order exists** — it updates blind (`delivery.js:204–209`). 2a: Order not found at delivery → 404 (`delivery.js:234–236`). 2b: **Not handled** — the submitted rider id is never compared with the assigned partner: any caller can mark any order delivered and be credited for it (`delivery.js:223–268`). 3a: **Not handled** — no proof of delivery (no customer confirmation, photo, or code). 3b: The pay credited is `deliveryFee + tipAmount` (`delivery.js:244`, `models/User.js:153–166`) — both values arrive **from the customer's browser** at order creation, validated only as numeric (`orders.js:39–40`). |
| **Postconditions** | Order closed as delivered; points and earnings recorded. |

## UC17: Watch my delivery on a map

| Part | Content |
|---|---|
| **Name** | Watch my delivery on a map |
| **Primary actor** | Customer |
| **Stakeholders** | Customer: reassurance the food is moving. |
| **Preconditions** | Customer has a saved location and an active order (`client/src/components/customer/Orders.tsx:501`). |
| **Trigger** | Customer opens the map on their order page. |
| **Main success scenario** | 1. Customer opens the delivery map. 2. System shows restaurant and destination markers. 3. Customer watches the courier marker travel to their address. |
| **Extensions** | 3a: **Not handled** — the courier position is **fabricated**: the marker is linearly interpolated from restaurant to customer over a hardcoded 20 seconds (`DeliveryMap.tsx:26–29`, `84–105`), started by a "Start Delivery" button the customer presses themselves (`DeliveryMap.tsx:110–112`); it has no relation to the real partner's location or the order status. The UI even labels it "Delivery Simulation" (`Orders.tsx:503`). |
| **Postconditions** | Customer has watched an animation — not the delivery. |

## UC18: Review my delivery earnings

| Part | Content |
|---|---|
| **Name** | Review my delivery earnings |
| **Primary actor** | Delivery partner |
| **Stakeholders** | Partner: fair pay records. |
| **Preconditions** | Partner has completed deliveries (UC16). |
| **Trigger** | Partner opens their insights/earnings page. |
| **Main success scenario** | 1. Partner opens the earnings view. 2. System presents earnings per delivery and totals. 3. Partner reviews history. |
| **Extensions** | 2a: Totals are recomputed in the browser from the partner's order list (`client/src/components/delivery/Insights.tsx:23–43`); the server-maintained `totalEarnings` field (`models/User.js:153–166`) is **written on every delivery but read by no screen** — two bookkeeping systems that can disagree. 2b: **Not handled** — no payout mechanism exists; `totalEarnings` is a number that only grows. |
| **Postconditions** | Partner has seen earnings derived from recorded orders. |

## UC19: Earn and view badges

| Part | Content |
|---|---|
| **Name** | Earn and view badges |
| **Primary actor** | Customer |
| **Stakeholders** | Customer: recognition. Platform: engagement. |
| **Preconditions** | Customer has activity (orders, ratings). |
| **Trigger** | Customer opens the badges panel. |
| **Main success scenario** | 1. Customer opens their badges. 2. System computes activity stats and evaluates badge rules. 3. Customer sees earned and locked badges. |
| **Extensions** | 1a: Missing customerId → 400 (`routes/badges.js:12–17`). 2a: Badge rules live at `src/badges/` (imported by `server/services/badgeService.js:3–4`) **and are duplicated** in the client (`client/src/badges/badgeDefinitions.ts`) — two rule sets that can drift apart. |
| **Postconditions** | Badge display matches recorded activity. |

## UC20: See the donation impact (Meal-for-a-Meal)

| Part | Content |
|---|---|
| **Name** | See the donation impact |
| **Primary actor** | Customer (any dashboard visitor) |
| **Stakeholders** | Customer: feel-good feedback. Platform: social-impact story. |
| **Preconditions** | Orders have been delivered. |
| **Trigger** | Customer views the donation counter. |
| **Main success scenario** | 1. Customer opens the donation counter. 2. System computes meals donated as one meal per ten delivered orders (`⌊delivered/10⌋`). 3. Customer sees the count. |
| **Extensions** | 2a: The rule lives at `routes/donations.js:15`, but a separate endpoint lets **any unauthenticated caller inflate the stored counter without bound** (`donations.js:59` increments; `donations.js:47` only rejects zero/negative amounts), permanently desynchronizing it from the derived value. |
| **Postconditions** | Displayed count matches the recorded (possibly tampered) counter. |
