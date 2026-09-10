# 📄 Local AI PDF Editor (Desktop-Class Web App) 
david.windsedl.cz

Kompletní plně funkční desktopově působící webová aplikace pro **lokální úpravu PDF pomocí AI (Ollama)** a robustního PDF engine (**PyMuPDF / fitz**, **pdfplumber**, **Pillow**).

---

## 🌟 Klíčové vlastnosti (Key Features)

1. **Skutečná úprava PDF (Real PDF Editing Engine)**:
   - Žádné pouhé kreslení na plátno — aplikace fyzicky mění PDF strukturu, rediguje původní obsah a vkládá nový text se zachováním pozic, barev a velikostí.
   - **Podporované operace**: `replace_text`, `replace_all_text`, `add_text`, `delete_text`, `redact` (anonymizace / začernění), `add_image` (loga / razítka), `delete_image`, `move_text`, `change_font_size`, `change_color`, `duplicate_element`.
2. **Lokální AI přes Ollama (100% Offline & Private)**:
   - Podpora modelů `qwen2.5`, `llama3.1`, `mistral`, `deepseek-r1` a dalších.
   - Žádné povinné cloudové klíče, veškerá data zůstávají na vašem počítači.
   - Detekce dostupnosti Ollama (`http://localhost:11434`) s tlačítkem Retry.
   - Inteligentní okamžitý rule-engine parser pro nulovou latenci + LLM fallback.
3. **Desktop-Class UI & Live Preview**:
   - Velký PDF Viewer postavený na **PDF.js** s vysokým DPI a plynulým zoomem (Fit Width, Fit Page, 50% - 200%).
   - **Interaktivní výběr elementů**: Kliknutím na textový blok v náhledu jej označíte a napíšete např. *„Změň tohle na 25 000 Kč“*.
   - **Režim Before / After**: Okamžité vizuální porovnání originálu s upravenou verzí.
   - **Preview navrhovaných změn**: AI nejdříve zobrazí strukturovaný plán s diffem pro schválení před aplikací (nebo volitelně Auto-Apply v Nastavení).
4. **Undo / Redo & Revision History**:
   - Každá změna vytvoří novou neměnnou revizi. Původní nahraný soubor se nikdy nepřepisuje.
   - Časová osa revizí s možností návratu k libovolné verzi.
5. **Pluggable Architecture (PyMuPDF + Infix placeholder)**:
   - Abstraktní rozhraní `PDFEditingBackend` umožňuje snadné napojení dalších enginů (např. Infix Server / CLI).

---

## 🏗️ Architektura projektu

```
├── backend/
│   ├── main.py                  # FastAPI hlavní aplikace
│   ├── api/
│   │   ├── documents.py         # REST endpointy pro upload, preview, apply, undo, export
│   │   └── ollama.py            # Status a výpis lokálních modelů
│   ├── ai/
│   │   ├── ollama_client.py     # HTTP klient pro komunikaci s lokální Ollamou
│   │   └── ai_parser.py         # NLP & LLM parser příkazů do JSON plánu
│   ├── pdf/
│   │   ├── base.py              # Abstraktní interface PDFEditingBackend
│   │   ├── pymupdf_backend.py   # PyMuPDF / fitz + pdfplumber implementace
│   │   ├── infix_backend.py     # Infix Server placeholder adaptér
│   │   ├── analyzer.py          # Analýza layoutu, bloků a fontů
│   │   ├── editor.py            # Exekuce operací
│   │   └── ocr.py               # Detekce skenovaných PDF a OCR
│   ├── models/
│   │   ├── operations.py        # Pydantic modely operací
│   │   ├── document.py          # Datové struktury pro stránky, bloky a metadata
│   │   └── settings.py          # Nastavení aplikace
│   └── services/
│       ├── document_session.py  # Izolace uživatelských relací
│       └── undo_manager.py      # Správa historie revizí
├── src/                         # Frontend React + TypeScript + Tailwind
│   ├── components/              # Viewer, Chat, Diff, Toolbar, Settings modal
│   ├── lib/                     # PDF engine & API klienti
│   └── App.tsx
├── storage/                     # Lokální úložiště relací a revizí
├── setup.bat / setup.sh         # Automatická instalace venv a závislostí
├── start.bat / start.sh         # Spuštění jedním kliknutím
└── requirements.txt             # Python balíčky
```

---

## 🚀 Rychlé spuštění (Quick Start)

### 1. Prvotní instalace
**Windows:**
```cmd
setup.bat
```
**Linux / macOS:**
```bash
chmod +x setup.sh start.sh
./setup.sh
```

### 2. Spuštění aplikace
**Windows:**
```cmd
start.bat
```
**Linux / macOS:**
```bash
./start.sh
```

Aplikace se otevře v prohlížeči na adrese **http://localhost:3000**.

---

## 🌐 Podrobný návod na nasazení (Deploy přes GitHub na Vercel)

Aplikaci lze velice jednoduše a zdarma nasadit do cloudu na platformu **Vercel** s automatickým propojováním změn z **GitHubu** (Continuous Deployment) a podporou vlastní subdomény (např. `david.windsedl.cz`).

### Fáze 1: Příprava a nahrání projektu na GitHub

Pokud projekt ještě nemáte ve svém vzdáleném GitHub repozitáři, postupujte takto:

1. **Otevřete terminál** v kořenovém adresáři projektu.
2. **Inicializujte Git** (pokud ještě není inicializován):
   ```bash
   git init
   ```
3. **Přidejte všechny soubory a vytvořte první commit**:
   ```bash
   git add .
   git commit -m "feat: Initial commit - Local AI PDF Editor"
   ```
4. **Vytvořte nový repozitář na GitHubu**:
   - Přejděte do prohlížeče na [github.com/new](https://github.com/new).
   - Zadejte název repozitáře (např. `local-ai-pdf-editor`).
   - Můžete zvolit **Public** nebo **Private** (obojí na Vercelu funguje i v bezplatném tieru).
   - Nepřidávejte README ani .gitignore (ty již v projektu máte).
   - Klikněte na **Create repository**.
5. **Propojte lokální projekt s GitHub repozitářem a nahrajte kód**:
   ```bash
   git branch -M main
   git remote add origin https://github.com/<VASE-UZIVATELSKE-JMENO>/local-ai-pdf-editor.git
   git push -u origin main
   ```

---

### Fáze 2: Nasazení na Vercel

1. **Přihlášení na Vercel**:
   - Přejděte na [vercel.com](https://vercel.com) a přihlaste se (doporučujeme zvolit **Continue with GitHub** pro automatické propojení práv).
2. **Import projektu**:
   - Na hlavní stránce Vercel Dashboard klikněte na tlačítko **Add New...** vpravo nahoře a zvolte **Project**.
   - V seznamu GitHub repozitářů vyhledejte váš repozitář `local-ai-pdf-editor` a klikněte na tlačítko **Import**.
3. **Konfigurace buildu projektu (Project Configuration)**:
   - **Project Name**: Můžete ponechat výchozí nebo změnit (např. `david-windsedl-pdf-editor`).
   - **Framework Preset**: Vercel automaticky detekuje **Vite** (pokud ne, vyberte v rozevíracím menu *Vite*).
   - **Root Directory**: Ponechte `./`.
   - **Build and Output Settings**:
     - *Build Command*: `npm run build` (výchozí)
     - *Output Directory*: `dist` (výchozí)
     - *Install Command*: `npm install` (výchozí)
4. **Spuštění nasazení**:
   - Klikněte na tlačítko **Deploy**.
   - Během 30–60 sekund Vercel projekt sestaví a vygeneruje produkční URL (např. `https://local-ai-pdf-editor-xyz.vercel.app`).

Součástí projektu je i přiložený konfigurační soubor `vercel.json`, který zajišťuje správné přesměrování všech podstránek (SPA rewrite), takže při obnovení stránky v prohlížeči (F5) nedojde k chybě 404.

---

### Fáze 3: Nastavení vlastní domény (např. `david.windsedl.cz`)

Pokud chcete aplikaci provozovat na své vlastní subdoméně:

1. V administraci projektu na Vercelu přejděte do záložky **Settings** -> **Domains**.
2. Do textového pole zadejte svou doménu nebo subdoménu (např. `david.windsedl.cz`) a klikněte na **Add**.
3. Vercel zobrazí požadovaný DNS záznam:
   - **Typ záznamu**: `CNAME`
   - **Název (Host)**: `david` (nebo celá subdoména dle formátu vašeho registrátora)
   - **Hodnota (Target/Value)**: `cname.vercel-dns.com`
4. Přihlaste se do správy DNS své domény u svého registrátora (např. Forpsi, Wedos, Cloudflare, Active24) a přidejte tento CNAME záznam.
5. Jakmile se DNS záznam propíše (obvykle během několika minut až hodin), Vercel automaticky vygeneruje a obnovuje bezplatný **SSL certifikát (HTTPS)**.

---

### Fáze 4: Automatické aktualizace (CI/CD)

Jakmile je propojení mezi GitHubem a Vercelem aktivní:
- Kdykoliv provedete změnu kódu a odešlete ji příkazem:
  ```bash
  git add .
  git commit -m "Update features"
  git push origin main
  ```
- Vercel automaticky zachytí commit, spustí nový build a během minuty bez výpadku aktualizuje živou verzi na vaší doméně.

---

### 💡 Důležitá poznámka k Lokální AI (Ollama) v cloudu

Jelikož je aplikace nasazena na veřejné HTTPS doméně, zatímco **Ollama běží lokálně na vašem počítači** (`http://localhost:11434`):

1. **Vestavěný inteligentní Rule Engine**: Aplikace obsahuje rychlý deterministický parser, který funguje okamžitě přímo v prohlížeči i bez spuštěné Ollamy (pro běžné požadavky na změnu data, jmen, částek, začernění, odstranění odstavců apod.).
2. **Připojení k lokální Ollamě z webu**: Pokud chcete využívat plný LLM model z lokální Ollamy přes webový prohlížeč, povolte v Ollamě přístup z jiných domén (CORS):
   - **Windows (PowerShell)**:
     ```powershell
     [System.Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS', '*', 'User')
     ```
     Poté restartujte aplikaci Ollama.
   - **Linux / macOS**:
     Spusťte před startem:
     ```bash
     export OLLAMA_ORIGINS="*"
     ollama serve
     ```
3. **Tunneling (volitelné)**: Pro bezpečné šifrované propojení můžete využít např. [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) nebo `ngrok http 11434` a výslednou HTTPS adresu zadat v aplikaci v okně **Nastavení (Settings)**.

---

## 💬 Příklady příkazů v AI Chatu

- *„Změň datum 1. 9. 2026 na 10. 9. 2026.“*
- *„Změň Hello World na Hello David.“*
- *„Nahraď text ABC textem XYZ.“*
- *„Změň jméno ve všech výskytech.“*
- *„Začerň tento údaj.“* / *„Začerň IČO.“*
- *„Odstraň tento odstavec.“*
- *„Přidej logo do pravého horního rohu.“*
- *„Najdi všechny výskyty 2025.“* -> *„Změň je na 2026.“*
- *„Změň tohle na 25 000 Kč.“* (po kliknutí na částku v dokumentu)
