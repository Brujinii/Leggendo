# Leggendo

**A smart language-learning reader** – read articles in your target language, look up words instantly, track your progress, and export flashcards to Anki.

[insert screenshot: Library view showing articles grouped by language and folder tags]

---

## ✨ Features

- **Rich text editor** – Paste or write articles with headings, lists, and quotes.
- **Instant dictionary lookup** – Click any word to see its translation (DeepL) and dictionary entry (Wiktionary or native dictionaries for Italian, Turkish, etc.).
- **Word status** – Mark words as *learning* to review them later.
- **Sentence translation** – Press `T` to translate the whole sentence.
- **Word bank** – Save words and their sentence context, then export to Anki as cloze‑deletion cards.
- **Notes** – Attach personal notes to any selected text.
- **Reading streaks** – Tracks daily reading activity.
- **Progress statistics** – Words read, articles read, pending/exported cards.
- **Folders via tags** – Organise articles with `@folder\subfolder` tags.
- **Themes & font sizes** – Sepia, light, dark; adjustable UI and reader font sizes.
- **Multi‑language** – Supports English, Italian, German, French, Spanish, Turkish.

---

## 📸 Screenshots

> *Placeholders – replace with actual screenshots.*

| Reader view | Dictionary panel | Export overlay |
|-------------|------------------|----------------|
| [insert screenshot: reader with highlighted word and sidebar] | [insert screenshot: word translation + Wiktionary entry] | [insert screenshot: export screen with editable cards] |

| Streak card | Words learning page |
|-------------|----------------------|
| [insert screenshot: streak heatmap] | [insert screenshot: list of learning words] |

---

## 🖥️ System requirements

- **Windows** (the provided scripts are for PowerShell)
- **macOS / Linux** – manual steps are also described
- **Python 3.10 or newer**
- **Node.js 18+** (including `npm`)

---

## 🚀 Installation

### Windows (easiest)

1. **Clone or download** this repository.
2. Open **PowerShell** as a normal user (no admin needed) and navigate to the project folder.
3. Run the setup script:

   ```powershell
   .\config.ps1
   ```

   This will:
   - Create a Python virtual environment inside `backend/venv`
   - Install all Python dependencies (FastAPI, spaCy, etc.)
   - Download required spaCy language models (English, Italian, German, French, Spanish)
   - Install Turkish lemmatizer (`zeyrek`)

4. **Install frontend dependencies** – open a second terminal in the `frontend` folder and run:

   ```powershell
   npm install
   ```

> **Note:** The first run of `config.ps1` may take a few minutes because it downloads the spaCy models.

### macOS / Linux (manual)

1. **Backend** – open a terminal in the `backend` folder:

   ```bash
   python -m venv venv
   source venv/bin/activate      # on macOS/Linux
   pip install -r requirements.txt
   python -m spacy download en_core_web_sm
   python -m spacy download it_core_news_sm
   python -m spacy download de_core_news_sm
   python -m spacy download fr_core_news_sm
   python -m spacy download es_core_news_sm
   ```

2. **Frontend** – in the `frontend` folder:

   ```bash
   npm install
   ```

---

## 🔑 Configuration (DeepL API key)

Leggendo uses **DeepL** for word and sentence translations. The free tier gives you 500,000 characters/month – enough for hundreds of articles.

1. Get a free API key at [DeepL Pro](https://www.deepl.com/pro#developer) (choose the **free** plan).
2. Start the app (see below), go to **Settings → API Keys**, paste your key, and click **Save**.
3. Press **Test connection** to verify it works.

> No API key is required for dictionary lookups (Wiktionary / TDK / WordReference). Without a DeepL key, only monolingual dictionary definitions will appear.

---

## ▶️ Running the app

### Windows (one‑click start)

Run the startup script from the project root:

```powershell
.\start.ps1
```

This will:
- Start the backend (FastAPI on `http://localhost:8000`)
- Start the frontend (Vite on `http://localhost:5173`)
- Open your browser at the frontend address

To stop, close the two terminal windows that opened.

### Manual start (any OS)

**Terminal 1 – Backend**

```bash
cd backend
source venv/bin/activate        # macOS/Linux
# or .\venv\Scripts\activate   on Windows
uvicorn main:app --reload --port 8000
```

**Terminal 2 – Frontend**

```bash
cd frontend
npm run dev
```

Then open `http://localhost:5173` in your browser.

---

## 📖 How to use Leggendo

### 1. Add your first article

- Click **+ Add text** on the Library page.
- Give it a **title** (and optional subtitle).
- Choose the **text language** (e.g., Italian) and your **target translation language** (e.g., English).
- Paste or type your article in the rich‑text editor.
- **Tags** – you can add space‑separated tags. Use `@folder\subfolder` to create nested folders (e.g., `@news\politics`).
- Click **Save & Read**.

### 2. Read and look up words

- Click any word – the right sidebar shows its translation and dictionary entry.
- **Drag** across multiple words to look up a phrase.
- Press **`L`** to mark the selected word as *learning* (it will appear in the Words page).
- Press **`T`** to translate the whole sentence.
- Press **`N`** to add a note (attached to the selected text).
- Press **`A`** to add the word + its sentence to the **word bank** (for later export to Anki).
- Press **`Esc`** to clear the selection.

### 3. Word bank & Anki export

- Words added with `A` appear in the Word Bank panel below the reader.
- When you’re ready, click **Export to Anki →** to open the export overlay.
- Edit the target‑language sentence (cloze syntax `{{c1::word}}` is auto‑inserted), translation, hint, and notes.
- Click **Export X cards** – a CSV file is downloaded.
- In **Anki**, go to *File → Import* and select the CSV. Map columns in this order:
  1. Target Language (cloze sentence)
  2. Known Language (translation)
  3. Hint
  4. Notes
  5. Tags
- Use the *Language Learning Cloze Deletion* note type (or create your own).

### 4. Track your learning

- **Library** – all articles, sorted by recent, added, length, or language. Folders are created from `@` tags.
- **Words** – lists all words you marked as *learning*. You can remove them or export a PDF for offline study.
- **Notes** – all your notes, linked back to the original article.
- **Export** – manage your word bank globally, filter by language or exported status.
- **Settings** – change theme, font sizes, default languages, and per‑language dictionary mode.

---

## ⌨️ Keyboard shortcuts (reader page)

| Shortcut | Action |
|----------|--------|
| `L` | Mark selected word as learning / remove |
| `N` | Add note (uses selection if any) |
| `A` | Add to word bank |
| `T` | Translate sentence |
| `C` | Copy selected text |
| `Esc` | Deselect |

---

## 🛠️ Troubleshooting

### “spaCy model not found” error when clicking a word

Run the model download manually:

```bash
cd backend
source venv/bin/activate
python -m spacy download it_core_news_sm   # replace with your language
```

### DeepL translation fails

- Make sure you saved your API key in **Settings → API Keys** and clicked **Save**.
- Check that your key is still valid (free tier keys expire after 90 days unless you keep using them). You can get a new one at [DeepL](https://www.deepl.com/pro#developer).

### Turkish words not lemmatising correctly

The Turkish lemmatizer (`zeyrek`) is installed automatically. If you still see problems, try reinstalling it:

```bash
cd backend
source venv/bin/activate
pip install --upgrade zeyrek
```

### Frontend doesn’t connect to backend

Make sure the backend is running on port `8000`. Check that the `vite.config.ts` proxy is set to `http://localhost:8000`. If you changed the port, update the proxy accordingly.

### “No module named ‘zeyrek’” on Windows

Some Windows systems may have trouble installing `zeyrek`. Install it manually:

```bash
cd backend
.\venv\Scripts\activate
pip install zeyrek
```

---

## 📁 Project structure (for developers)

```
leggendo/
├── config.ps1          # Windows setup script
├── start.ps1           # Windows launcher
├── backend/
│   ├── main.py         # FastAPI app (all routes)
│   ├── requirements.txt
│   └── leggendo.db     # SQLite database (auto‑created)
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx
        ├── api.ts
        ├── components/
        ├── pages/
        └── ...
```

---

## 📄 License

This project is open‑source. Feel free to use, modify, and share it.

---

**Happy reading & learning!** 📚✨