# API contract (n8n Cloud)

Base URL: `https://YOURNAME.app.n8n.cloud/webhook/`  (Production URLs, after publishing)

| Purpose | Method | Path | Used by |
|---|---|---|---|
| Menu | GET | `brew-cup-menu` | Website menu |
| Order | POST | `brew-cup-order` | Cart / checkout |
| AI support | POST | `brew-cup-support` | Telephone chat |
| Admin add item | POST | `brew-cup-admin-add-item` | Admin page |

## Frontend .env (public values only)
    VITE_MENU_WEBHOOK_URL=https://YOURNAME.app.n8n.cloud/webhook/brew-cup-menu
    VITE_ORDER_WEBHOOK_URL=https://YOURNAME.app.n8n.cloud/webhook/brew-cup-order
    VITE_AI_WEBHOOK_URL=https://YOURNAME.app.n8n.cloud/webhook/brew-cup-support
    VITE_ADMIN_ADD_ITEM_URL=https://YOURNAME.app.n8n.cloud/webhook/brew-cup-admin-add-item
    VITE_CLOUDINARY_CLOUD_NAME=...        # only if photos are uploaded to Cloudinary
    VITE_CLOUDINARY_UPLOAD_PRESET=...     # an UNSIGNED upload preset

## GET menu
Response:
    {"success": true, "items": [
      {"id":"item-001","name":"Nutella Bomboloni","price":130,"category":"Desserts",
       "description":"...","imageUrl":"","modelUrl":"","modelStatus":"none"}]}
`modelStatus`: `none` | `processing` | `ready` | `failed`. Show the 3D model only when it is `ready` and `modelUrl` is set; otherwise show `imageUrl` (or a placeholder).
Never hardcode the menu in the frontend; always use this response.

## POST order
Request (price is NOT sent; the server looks it up):
    {"customer":{"name":"Test Customer","email":"customer@example.com","phone":"9876543210"},
     "items":[{"id":"item-001","quantity":2}]}
Success (200): `{"success":true,"orderId":"BC-2026-XXXXXXX","total":260,"message":"..."}`
Error (400): `{"success":false,"message":"Order could not be processed.","errors":["..."]}`

## POST support
Request: `{"message":"Which dessert would you recommend?","sessionId":"customer-001"}`
Response: `{"success":true,"reply":"..."}`   (use one stable sessionId per visitor)

## POST admin add item
Photos are uploaded by the frontend first (e.g. Cloudinary unsigned upload) and sent as https URLs (1-8).
Request:
    {"adminPasscode":"...","name":"Test Brownie","price":150,"category":"Desserts",
     "description":"Optional, max 300 chars","photoUrls":["https://.../front.jpg","https://.../side.jpg"]}
Success (200): `{"success":true,"message":"Menu item added.","item":{"id":"item-...","name":"...","price":150,"modelStatus":"none"}}`
Wrong passcode: 401. Invalid input: 400 with `errors`.
The admin types the passcode into the admin page; do not hardcode it in frontend code or commit it.

## Browser console test snippet
    fetch("URL", {method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(BODY)}).then(r=>r.json()).then(console.log)
For the GET menu use `fetch("URL").then(r=>r.json()).then(console.log)`.

## Who needs what
- Person 3 (website): the 4 URLs, this contract, the category names, Cloudinary values (if used).
- Person 2 (Blender, later): `modelUrl` / `modelStatus` fields.
- Keep private (never in the repo or frontend): Gmail login, Groq API key, admin passcode, staff email.
