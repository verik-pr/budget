# Budget Agent API

Programmatischer Zugriff auf die Budget-App — gedacht für Claude und andere automatisierte Clients.

## Authentifizierung

Alle Requests brauchen den Header:
```
Authorization: Bearer <AGENT_API_KEY>
```

Der Key wird in Coolify als Umgebungsvariable `AGENT_API_KEY` gesetzt.

---

## GET /api/agent

Gibt Kategorien, Konten und die letzten 20 Transaktionen zurück.

```bash
curl https://budget.venstein.ch/api/agent \
  -H "Authorization: Bearer <KEY>"
```

**Response:**
```json
{
  "categories": [
    { "id": "...", "name": "Lebensmittel", "icon": "🛒", "type": "expense" }
  ],
  "accounts": [
    { "id": "...", "name": "Gemeinsames Konto", "icon": "🏦", "color": "#6366f1" }
  ],
  "transactions": [
    {
      "id": "...",
      "amount": 45.80,
      "description": "Migros",
      "date": "2026-05-04T00:00:00.000Z",
      "category": { "name": "Lebensmittel", "icon": "🛒" },
      "account": { "name": "Gemeinsames Konto" }
    }
  ]
}
```

---

## POST /api/agent

Erstellt eine neue Transaktion.

```bash
curl -X POST https://budget.venstein.ch/api/agent \
  -H "Authorization: Bearer <KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 45.80,
    "categoryName": "Lebensmittel",
    "description": "Migros Wocheneinkauf",
    "date": "2026-05-04",
    "contributor": null,
    "accountName": "Gemeinsames Konto"
  }'
```

**Body-Felder:**

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `amount` | number | ✅ | Betrag in CHF (positiv) |
| `categoryId` | string | ✅* | ID der Kategorie |
| `categoryName` | string | ✅* | Name der Kategorie (Alternative zu categoryId) |
| `description` | string | — | Beschreibung / Händlername |
| `date` | string | — | ISO-Datum `YYYY-MM-DD` (Default: heute) |
| `contributor` | string\|null | — | `null` / `"eltern_erik"` / `"eltern_celine"` |
| `accountId` | string | — | ID des Kontos |
| `accountName` | string | — | Name des Kontos (Alternative zu accountId) |

*Eines von beiden muss angegeben werden.

**Response (201):**
```json
{
  "ok": true,
  "transaction": {
    "id": "...",
    "amount": 45.80,
    "description": "Migros Wocheneinkauf",
    "date": "2026-05-04T00:00:00.000Z",
    "category": { "name": "Lebensmittel", "icon": "🛒", "type": "expense" },
    "account": { "name": "Gemeinsames Konto" }
  }
}
```

---

## Bekannte Kategorien (Beispiele)

| Name | Icon | Typ |
|---|---|---|
| Lebensmittel | 🛒 | expense |
| Restaurants | 🍽️ | expense |
| Mobilität | 🚗 | expense |
| Gesundheit | 💊 | expense |
| Baby & Kind | 👶 | expense |
| Beitrag Familie | 💝 | expense |
| Wohnen | 🏠 | expense |
| Freizeit | 🎯 | expense |
| Lohn | 💰 | income |
| Sonstiges | 📦 | expense |

→ Aktuelle Liste: `GET /api/agent`

## Contributor-Werte

| Wert | Bedeutung |
|---|---|
| `null` | Eigenausgabe (Erik oder Céline selbst) |
| `"eltern_erik"` | Eriks Eltern |
| `"eltern_celine"` | Célines Eltern |
