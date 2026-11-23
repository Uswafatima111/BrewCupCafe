# Automation (n8n Cloud)

Four workflows on the n8n website (n8n Cloud), sharing one menu stored in an n8n Data Table.
The JSON files here are backups/handoff copies. Docker is only for the demo (`docker ps`).

| File | What it does |
|---|---|
| `order-workflow.json` | Validates the order, takes prices from the Data Table, order ID, customer email, staff email |
| `customer-support-workflow.json` | Telephone AI assistant (Groq gpt-oss-20b); menu loaded live from the Data Table |
| `menu-workflow.json` | `GET` menu for the website |
| `admin-add-item-workflow.json` | Admin adds a menu item (name, price, photo URLs). 3D step is a placeholder node |
| `menu-seed.csv` | The 8 starting menu items to import into the Data Table |
| `menu.json` | Reference copy of the starting menu |
| `API-CONTRACT.md` | Request/response formats and values to share with the team |
| `docker-compose.yml` | Optional local n8n for the Docker demo |
| `tests/` | Sample request bodies |

## 1. Create the Data Table (do this first)
n8n -> Overview -> Data tables -> Create. Name it **menu_items** with these columns:

| Column | Type |
|---|---|
| itemId | string |
| name | string |
| price | number |
| category | string |
| description | string |
| imageUrl | string |
| photoUrls | string |
| modelUrl | string |
| modelStatus | string |
| active | boolean |

Then import `menu-seed.csv` into it (Import CSV) and check the 8 rows and the `price`/`active` values.

## 2. Import the four workflows
Workflows -> Create workflow -> "..." -> Import from file, once per JSON file.

## 3. Pick the Data Table in each node
In each of these nodes choose **From list -> menu_items** and check the operation:
- order-workflow: "Get Menu Items" (Get row(s), return all)
- customer-support-workflow: "Get Menu Items"
- menu-workflow: "Get Menu Items"
- admin-add-item-workflow: "Insert Menu Item" (Insert row, auto-map input data)

If a Data Table node shows an error after import, delete it and add a fresh Data table node with the same settings.

## 4. Credentials and constants
- Order workflow: both Gmail nodes -> Gmail OAuth2 ("Sign in with Google").
  In "Validate & Price Order" change `STAFF_EMAIL`.
- Support workflow: "Groq Chat Model" -> add your Groq API key (model `openai/gpt-oss-20b`).
- Admin workflow: in "Validate Admin Input" change `ADMIN_PASSCODE` from `CHANGE_ME`.

## 5. Test (Test URL)
Open a workflow -> Webhook node -> Test URL -> click **Execute workflow** -> send ONE request.
Examples (PowerShell/curl/browser console) are in `API-CONTRACT.md`; request bodies are in `tests/`.

Check:
- menu: returns the 8 items
- add item: returns success, and the new row appears in the Data Table and in the next menu call
- order: order the NEW item, you get an order ID and an email
- support: ask about the new item, the assistant knows it
- invalid order / wrong passcode: 400 / 401

## 6. Publish
Publish all four workflows and copy each Production URL (`/webhook/`).

## 7. Git
    git checkout -b feature/n8n-automation
    git add automation
    git commit -m "feat: add n8n workflows with dynamic menu"
    git push origin feature/n8n-automation
Do NOT commit your real admin passcode or staff email: if you re-export workflows, set
`ADMIN_PASSCODE` back to `CHANGE_ME` and `STAFF_EMAIL` to a placeholder first.

## 8. Docker demo
    cd automation
    docker compose up -d
    docker ps

## Later: 3D generation
`admin-add-item-workflow.json` has a placeholder node "3D Generation (add later)".
The table already has `photoUrls`, `modelUrl` and `modelStatus` ready for it.
