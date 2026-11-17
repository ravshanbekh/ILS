# IT Live Score — tashqi AI agent ulash (MCP va REST)

Bu hujjat **tashqi AI agentni** IT Live Score'ga (itlivescore.uz) ulash uchun. Agent tizimni administrator huquqi bilan tahlil qiladi va boshqaradi. Bunday agent quyidagilardan biri bo'lishi mumkin:

- o'z serveringizdagi bot;
- n8n yoki Make;
- OpenAI, Claude yoki Gemini API ustida yozilgan agent;
- LangChain yoki boshqa freymvork.

Claude.ai (Pro) uchun alohida, login bilan ulanadigan connector bor: [MCP.md](../MCP.md). Bu hujjat esa login sahifasidan o'ta olmaydigan, **doimiy kalit** bilan ishlaydigan agentlar uchun.

```
Agent ──HTTPS──▶ itlivescore.uz ─┬─ POST /mcp               (MCP, Streamable HTTP)
  Authorization:                 └─ /api/agent/v1/*          (oddiy REST + OpenAPI)
  Bearer ils_ak_…                          │
                                           ▼
                       bir xil 46 ta amal (MCP amallari): o'qish, tahlil, SQL,
                       boshqarish, qo'lda tuzatish + undo → panel servislari
                       → audit_logs (kim, qaysi kalit, nima qildi)
```

## Qaysi yo'lni tanlash kerak

| Agent turi | Yo'l |
| --- | --- |
| MCP mijozi bor: Claude API (MCP connector), OpenAI Responses yoki Agents SDK, LangChain (`langchain-mcp-adapters`), n8n "MCP Client", Cursor, Claude Code | **MCP** — `https://itlivescore.uz/mcp` |
| Oddiy function calling: OpenAI Chat Completions, Gemini, o'zingiz yozgan sikl | **REST** — `GET /tools?format=openai` dan amallarni oling, `POST /tools/{nom}` bilan bajaring |
| ChatGPT (Custom GPT Actions), Make, Postman, Zapier | **REST** — `openapi.json` ni import qiling |

Ikkala yo'lda ham amallar, argumentlar, cheklovlar va natija bir xil. MCP amali qo'shilsa, u REST'da ham avtomatik paydo bo'ladi.

## 1. Kalit olish (admin, bir marta)

1. Panelga **admin** bo'lib kiring: **Sozlamalar → Claude va AI agentlar (MCP / API) → Tashqi AI agent (API kalit)**.
2. Formani to'ldiring:
   - **Nom** — keyin auditda shu nom ko'rinadi, masalan `Sotuv bot (n8n)`.
   - **Huquq:**
     - *Faqat o'qish* — 16 ta amal: hisobotlar, qidiruv, SQL tahlil.
     - *O'qish + boshqarish* — 46 ta amal: guruh, o'quvchi, baholash, muzlatish, istalgan yozuvni tuzatish va hokazo.
   - **Muddat:** 30, 90, 180, 365 kun yoki muddatsiz.
3. **Kalit yaratish** ni bosing. Kalit `ils_ak_` bilan boshlanadi (jami 50 belgi). U **faqat shu yerda bir marta** ko'rinadi: bazada faqat SHA-256 xeshi saqlanadi, qayta ko'rsatib bo'lmaydi. Yo'qotsangiz, bekor qilib yangisini yarating.
4. Shu oynada tayyor namunalar bor: MCP mijoz konfiguratsiyasi, `curl` va OpenAI formati.

Kalitni agentning **server tomonidagi** maxfiy sozlamasiga (env, n8n Credentials) qo'ying. Uni brauzer kodiga, mobil ilovaga yoki git'ga qo'ymang.

## 2. MCP orqali

- **URL:** `https://itlivescore.uz/mcp`
- **Transport:** Streamable HTTP, stateless. Faqat `POST`; SSE oqimi va sessiya yo'q.
- **Sarlavha:** `Authorization: Bearer ils_ak_…`

### Umumiy MCP konfiguratsiyasi (Cursor, Claude Code, ko'p mijozlar)

```json
{
  "mcpServers": {
    "it-live-score": {
      "type": "http",
      "url": "https://itlivescore.uz/mcp",
      "headers": { "Authorization": "Bearer ils_ak_…" }
    }
  }
}
```

### Claude API (Messages API, MCP connector)

Anthropic serverlari `/mcp` ga o'zi ulanadi. Ikki parametr birga kerak: `mcp_servers` va `tools` ichidagi `mcp_toolset`.

```python
import os
import anthropic

client = anthropic.Anthropic()
response = client.beta.messages.create(
    model="claude-opus-5-5",
    max_tokens=16000,
    betas=["mcp-client-2025-11-20"],
    mcp_servers=[{
        "type": "url",
        "url": "https://itlivescore.uz/mcp",
        "name": "it-live-score",
        "authorization_token": os.environ["ILS_AGENT_KEY"],  # ils_ak_…
    }],
    tools=[{"type": "mcp_toolset", "mcp_server_name": "it-live-score"}],
    messages=[{"role": "user", "content": "Bugungi umumiy holat: qaysi guruhlarda muammo bor?"}],
)
for block in response.content:
    if block.type == "text":
        print(block.text)
```

### OpenAI Responses API

```python
from openai import OpenAI

client = OpenAI()
resp = client.responses.create(
    model="gpt-5",
    tools=[{
        "type": "mcp",
        "server_label": "it_live_score",
        "server_url": "https://itlivescore.uz/mcp",
        "headers": {"Authorization": f"Bearer {ILS_AGENT_KEY}"},
        "require_approval": "always",  # yozish amallarini odam tasdiqlasin
    }],
    input="3 kundan beri tekshirilmagan normativlar ro'yxatini ber",
)
print(resp.output_text)
```

### LangChain (`langchain-mcp-adapters`)

```python
from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient({
    "ils": {
        "transport": "streamable_http",
        "url": "https://itlivescore.uz/mcp",
        "headers": {"Authorization": f"Bearer {ILS_AGENT_KEY}"},
    }
})
tools = await client.get_tools()  # agentingizga bering
```

### n8n

**AI Agent** tuguniga **MCP Client Tool** ulang va quyidagicha sozlang:
- Endpoint: `https://itlivescore.uz/mcp`
- Transport: *HTTP Streamable*
- Authentication: *Bearer* → kalit.

> Freymvork misollari (OpenAI, LangChain, n8n) shu kutubxonalarning hozirgi hujjatidan olingan. Versiya o'zgarsa, parametr nomlari biroz farq qilishi mumkin. Bizning tomonda o'zgarmaydigan narsa: URL, `POST` va `Authorization: Bearer`.

### Xom JSON-RPC (tekshirish uchun)

```bash
KEY=ils_ak_…
H=(-H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream")

curl -s "${H[@]}" https://itlivescore.uz/mcp \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}'

curl -s "${H[@]}" https://itlivescore.uz/mcp -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

curl -s "${H[@]}" https://itlivescore.uz/mcp \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"ils_overview","arguments":{}}}'
```

## 3. REST orqali (`/api/agent/v1`)

Asosiy manzil: `https://itlivescore.uz/api/agent/v1`. Har so'rovga `Authorization: Bearer ils_ak_…` sarlavhasi qo'shiladi.

| So'rov | Nima qiladi |
| --- | --- |
| `GET /whoami` | Agent kimning nomidan ishlaydi, huquq (`canWrite`), amallar soni |
| `GET /tools` | Amallar: `name`, `title`, `description`, `inputSchema` (JSON Schema), `destructive`, `readOnly` |
| `GET /tools?format=openai` | Shu ro'yxat OpenAI `tools` formatida: `[{type:"function", function:{name, description, parameters}}]` |
| `POST /tools/{nom}` | Amalni bajaradi. Body — argumentlar (JSON obyekt, argumentsiz amal uchun `{}`) |
| `GET /openapi.json` | OpenAPI 3.1: har amal alohida `POST` va `operationId = nom` |

### Javob formati

Muvaffaqiyat (`200`). `data` — amal natijasi, ko'pincha tayyor JSON obyekt:

```json
{ "success": true, "tool": "ils_list_groups", "data": { "total": 12, "groups": [ … ] } }
```

Xato:

```json
{ "success": false, "error": { "message": "…", "tool": "ils_update_user" } }
```

| Kod | Ma'nosi | Agent nima qiladi |
| --- | --- | --- |
| `400` | Argument noto'g'ri (sxemaga mos emas) | `error.message` ni o'qib, argumentni tuzatadi |
| `401` | Kalit yo'q, soxta, bekor qilingan yoki muddati tugagan; egasi o'zgargan | Qayta urinmaydi, adminga xabar beradi |
| `403` | Kalitda kerakli huquq yo'q | — |
| `404` | Bunday amal yo'q yoki kalit "faqat o'qish" | `GET /tools` dan ro'yxatni yangilaydi |
| `422` | Biznes qoidasi rad etdi (masalan, admin akkauntga tegib bo'lmaydi, guruh topilmadi) | Sababni foydalanuvchiga aytadi |
| `429` | Chegara: kalitga daqiqasiga 240 so'rov | `RateLimit-Reset` soniyadan keyin qayta uradi |
| `500` | Server xatosi (tafsilot server jurnalida) | Keyinroq qayta uradi |

### curl

```bash
KEY=ils_ak_…
BASE=https://itlivescore.uz/api/agent/v1

curl -H "Authorization: Bearer $KEY" $BASE/whoami
curl -H "Authorization: Bearer $KEY" "$BASE/tools?format=openai"
curl -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
     -d '{"search":"FN"}' $BASE/tools/ils_list_groups
```

### OpenAI function calling bilan to'liq sikl (Python)

```python
import json, os, requests
from openai import OpenAI

BASE = "https://itlivescore.uz/api/agent/v1"
HDR = {"Authorization": f"Bearer {os.environ['ILS_AGENT_KEY']}"}
tools = requests.get(f"{BASE}/tools", params={"format": "openai"}, headers=HDR).json()["data"]

def run_tool(name: str, args: dict) -> str:
    r = requests.post(f"{BASE}/tools/{name}", json=args, headers=HDR, timeout=90)
    return json.dumps(r.json(), ensure_ascii=False)  # xato bo'lsa ham modelga qaytaramiz

client = OpenAI()
messages = [
    {"role": "system", "content": "Sen IT Live Score administratori yordamchisisan. Yozish amallaridan oldin nima o'zgarishini ayt."},
    {"role": "user", "content": "Normativlarni eng sust bajarayotgan 5 o'quvchini top"},
]
while True:
    resp = client.chat.completions.create(model="gpt-5", messages=messages, tools=tools)
    msg = resp.choices[0].message
    messages.append(msg)
    if not msg.tool_calls:
        print(msg.content)
        break
    for call in msg.tool_calls:
        messages.append({
            "role": "tool",
            "tool_call_id": call.id,
            "content": run_tool(call.function.name, json.loads(call.function.arguments or "{}")),
        })
```

### ChatGPT Custom GPT / Make / Postman

1. `openapi.json` ni yuklab oling:
   ```bash
   curl -H "Authorization: Bearer ils_ak_…" https://itlivescore.uz/api/agent/v1/openapi.json -o ils-openapi.json
   ```
2. Faylni **Import** qiling.
3. Autentifikatsiyani **API key → Bearer** qilib, kalitni kiriting.

Ro'yxat kalit huquqiga bog'liq: "faqat o'qish" kalitidan olingan spetsifikatsiyada yozish amallari bo'lmaydi.

## 4. Amallar

To'liq jadval va har amalning tavsifi [MCP.md](../MCP.md) da (**Amallar** bo'limi). Agent uchun eng muhimlari:

- **Tahlil:** `ils_overview` → `ils_list_groups` / `ils_group_report` / `ils_student_report` / `ils_teacher_report`. Maxsus kesimlar uchun `ils_db_schema` + `ils_sql_query`: faqat `SELECT`, 8 soniya, 1000 qatorgacha.
- **Boshqarish:** `ils_create_group`, `ils_create_user`, `ils_transfer_student`, `ils_check_submission`, `ils_grade_lesson`, `ils_freeze_student`, `ils_send_notification` va boshqalar. Ular panel qoidalari va bildirishnomalarini bajaradi.
- **Qo'lda tuzatish** (`ils_record_change`) ikki bosqichli:
  1. `confirmToken` siz chaqiriladi. "Oldin → keyin" ko'rinishi va `confirmToken` qaytadi, baza o'zgarmaydi.
  2. Aynan shu argumentlar `confirmToken` bilan qayta yuboriladi. Kod 10 daqiqa amal qiladi.

  Xato bo'lsa, `ils_undo_change(auditId)` o'zgarishni qaytaradi. Avtonom agent bu bosqichlar orasida inson tasdig'ini olishi tavsiya etiladi.
- `destructive: true` belgisi bor amallar (o'chirish, o'tkazish, parol tiklash, ruxsatlar) — avval odamdan tasdiq oling.
- 📨 belgili amallar (`ils_check_submission`, `ils_reply_appeal`) ota-onaga Telegram xabarini yuboradi.

Javoblardagi sanalar Toshkent vaqtida (`+05:00`). Ro'yxatlar sahifalanadi: `total`, `offset` va `limit` ga qarang.

## 5. Xavfsizlik va cheklovlar

**Kimning nomidan ishlaydi.** Agent kalitni yaratgan **admin nomidan** ishlaydi. Har bir yozish amali `audit_logs` ga `mcp.<amal>` bo'lib tushadi, u yerda quyidagilar qayd etiladi:
- `via` — `agent_key` (MCP) yoki `agent_rest` (REST);
- `clientName` — `Agent: <kalit nomi>`;
- argumentlar.

Panelda: **Sozlamalar → Audit**.

**Kalit qachon darhol o'ladi:**
- panelda **Bekor qilish** bosilganda;
- muddati tugaganda;
- egasi nofaol bo'lsa yoki admin bo'lmay qolsa;
- egasi parolini almashtirsa yoki "barcha qurilmalardan chiqarish" bosilsa. Bu sizning kalitlaringizga ham tegadi: parolni almashtirgach, agentga yangi kalit bering. Shunday qilingan sabab: akkaunt o'g'irlanib, parol tiklansa, buzg'unchi yaratgan kalitlar ham yo'q bo'ladi.
- **Hammasini uzish** tugmasi bosilsa: Claude ulanishlari va barcha agent kalitlari bir zumda to'xtaydi.

**Hech qanday kalit bilan qilib bo'lmaydigan ishlar:**
- admin akkauntini tahrirlash;
- kimnidir admin qilish;
- o'z akkauntini o'zgartirish;
- foydalanuvchini butunlay o'chirish (faqat nofaol qilish mumkin);
- `audit_logs`, OAuth va kalit jadvallarini o'zgartirish;
- parol yoki token ustunlariga yozish.

SQL natijalaridan parol xeshlari va tokenlar avtomatik yashiriladi.

**Chegaralar:**
- bitta kalitga daqiqasiga 240 so'rov;
- REST yo'liga bitta IP'dan daqiqasiga 600 so'rov (kalit tekshirilishidan oldin);
- bir vaqtda 20 tagacha faol kalit;
- bitta amalning javob vaqti 60 soniyagacha.

**Panelning odatiy REST API'si** (`/api/users` va boshqalar) agent kalitini **qabul qilmaydi**. Agent faqat yuqoridagi amallar orqali ishlaydi. Sababi: bu amallarda tekshiruv, cheklov, audit va undo bor, panel API'sida esa ular yo'q.

**Ma'lumot oqimi:** agent o'qigan ma'lumot (o'quvchi ismlari, baholar) agentning AI provayderiga (OpenAI, Anthropic, Google) yuboriladi. Kerakidan ortiq shaxsiy ma'lumot so'ramang. "Faqat o'qish" kaliti yetarli bo'lsa, boshqaruv kaliti bermang.

**Favqulodda o'chirish:** serverda `MCP_ENABLED=false`. Bunda `/mcp` va `/api/agent/v1` ikkalasi ham 404 qaytaradi.

## 6. Muammolar

| Belgi | Sabab va yechim |
| --- | --- |
| `401 API key is invalid or revoked` | Kalit noto'g'ri nusxalangan (bo'sh joy, qisqargan) yoki bekor qilingan |
| `401 API key owner access changed` | Kalit egasi parolini almashtirgan yoki admin emas — yangi kalit yarating |
| `401 API key has expired` | Muddati tugagan — yangi kalit |
| `404 Amal topilmadi` + "boshqarish" maslahati | Kalit "faqat o'qish" — "O'qish + boshqarish" kaliti kerak |
| `406 Not Acceptable` (MCP, `curl` bilan) | `Accept: application/json, text/event-stream` sarlavhasini qo'shing |
| `405` (MCP) | `GET`/SSE yo'q — faqat `POST` |
| `429` | Daqiqasiga 240 dan oshgan — sekinlashtiring yoki natijalarni keshlang |
| Panelda "oxirgi foydalanish" yangilanmaydi | U daqiqasiga ko'pi bilan bir marta yoziladi |

## Ishlab chiquvchi uchun (kod)

| Qism | Fayl |
| --- | --- |
| Kalit: yaratish, tekshirish, holat | `backend/src/mcp/agentKeys.ts` |
| `/mcp` da kalit tekshiruvi | `backend/src/mcp/http.ts` (`agentKeyAuth`) |
| REST yo'li va OpenAPI | `backend/src/mcp/agent.routes.ts` |
| Panel API (`/api/mcp/agent-keys`) | `backend/src/mcp/connections.routes.ts` |
| Jadval | `mcp_agent_keys` (`McpAgentKey`) |
| Panel UI | `frontend/src/components/admin/AgentKeysSection.tsx` |
| Sinov | `cd backend && npm run e2e:mcp` — 10-bo'lim: panel, `/mcp`, REST, bekor qilish, muddat, egasi o'zgarishi |
