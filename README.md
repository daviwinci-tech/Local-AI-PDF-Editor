# 📄 Local AI PDF Editor (Desktop-Class Web App) 
(david.windsedl.cz)

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
