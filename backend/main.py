from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx
import os
import sqlite3
import csv
import io
import re
from datetime import datetime
from dotenv import load_dotenv
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
import nltk

nltk.download('punkt_tab')

load_dotenv()

# ---------------------------------------------------------------------------
# Config — API keys stored in config.json next to the DB
# ---------------------------------------------------------------------------

DB_PATH = os.path.join(os.path.dirname(__file__), "leggendo.db")
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")

def get_config() -> dict:
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r") as f:
                import json
                return json.load(f)
        except Exception:
            pass
    return {}

def save_config(data: dict):
    import json
    existing = get_config()
    existing.update(data)
    with open(CONFIG_PATH, "w") as f:
        json.dump(existing, f, indent=2)

def get_deepl_key() -> str:
    # Config file takes priority over .env so users can set it from Settings
    return get_config().get("deepl_api_key") or os.getenv("DEEPL_API_KEY", "")


app = FastAPI(title="Leggendo API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

DB_PATH = os.path.join(os.path.dirname(__file__), "leggendo.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            subtitle TEXT DEFAULT '',
            text TEXT NOT NULL,
            language TEXT NOT NULL DEFAULT 'IT',
            target_language TEXT NOT NULL DEFAULT 'EN',
            word_count INTEGER DEFAULT 0,
            tags TEXT DEFAULT '',
            source_url TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            last_read_at TEXT
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word TEXT NOT NULL,
            language TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'unknown',
            updated_at TEXT NOT NULL,
            sentence_context TEXT,
            article_id INTEGER,
            UNIQUE(word, language)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS word_bank_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            article_id INTEGER NOT NULL,
            selected_text TEXT NOT NULL,
            sentence_context TEXT NOT NULL,
            sentence_translation TEXT,
            hint TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            exported_at TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            article_id INTEGER,
            selected_text TEXT,
            note_text TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE SET NULL
        )
    """)

    # Add total_words_read tracking table
    c.execute("""
        CREATE TABLE IF NOT EXISTS reading_stats (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            total_words_read INTEGER DEFAULT 0
        )
    """)
    c.execute("INSERT OR IGNORE INTO reading_stats (id, total_words_read) VALUES (1, 0)")
    
    # Add streaks tracking table
    c.execute("""
        CREATE TABLE IF NOT EXISTS reading_streaks (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            current_streak INTEGER DEFAULT 0,
            longest_streak INTEGER DEFAULT 0,
            last_read_date TEXT,
            total_days_read INTEGER DEFAULT 0
        )
    """)
    c.execute("INSERT OR IGNORE INTO reading_streaks (id) VALUES (1)")
    
    # Add daily reading log
    c.execute("""
        CREATE TABLE IF NOT EXISTS daily_reading (
            date TEXT PRIMARY KEY,
            words_read INTEGER DEFAULT 0,
            articles_read INTEGER DEFAULT 0
        )
    """)

    conn.commit()
    conn.close()

init_db()

# ---------------------------------------------------------------------------
# Translation helpers
# ---------------------------------------------------------------------------

_cache: dict = {}

async def deepl_translate(text: str, source_lang: str, target_lang: str) -> str | None:
    api_key = get_deepl_key()
    if not api_key:
        return None
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api-free.deepl.com/v2/translate",
                headers={"Authorization": f"DeepL-Auth-Key {api_key}"},
                data={
                    "text": text,
                    "source_lang": source_lang.upper(),
                    "target_lang": target_lang.upper(),
                },
            )
            if resp.status_code == 200:
                return resp.json()["translations"][0]["text"]
    except Exception as e:
        print("DeepL error:", e)
    return None

def make_cloze(sentence: str, selected_text: str) -> str:
    """Return the cloze-formatted sentence. If already contains {{c1::}}, use as-is."""
    if "{{c1::" in sentence:
        return sentence
    # Fallback for older entries that don't have cloze syntax yet
    escaped = re.escape(selected_text)
    cloze = f"{{{{c1::{selected_text}}}}}"
    result = re.sub(escaped, cloze, sentence, count=1)
    if "{{c1::" not in result:
        result = sentence.replace(selected_text, cloze, 1)
    if "{{c1::" not in result:
        result = f"{sentence} [{{{{c1::{selected_text}}}}}]"
    return result

# ---------------------------------------------------------------------------
# Articles
# ---------------------------------------------------------------------------

class ArticleCreate(BaseModel):
    title: str
    subtitle: str = ""
    text: str
    language: str = "IT"
    target_language: str = "EN"
    tags: str = ""
    source_url: str = ""

class ArticleUpdate(BaseModel):
    tags: str | None = None
    title: str | None = None
    subtitle: str | None = None
    source_url: str | None = None
    language: str | None = None
    target_language: str | None = None

@app.post("/articles")
async def create_article(body: ArticleCreate):
    import re as _re
    plain_text = _re.sub(r'<[^>]+>', ' ', body.text)
    word_count = len(plain_text.split())
    now = datetime.utcnow().isoformat()
    conn = get_db()
    c = conn.cursor()
    c.execute(
        "INSERT INTO articles (title, subtitle, text, language, target_language, word_count, tags, source_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (body.title, body.subtitle.strip(), body.text, body.language, body.target_language, word_count, body.tags.strip(), body.source_url.strip(), now)
    )
    article_id = c.lastrowid
    conn.commit()
    conn.close()
    return {"id": article_id, "title": body.title, "word_count": word_count, "tags": body.tags, "created_at": now}

@app.get("/articles")
async def list_articles(sort: str = Query("last_read", enum=["last_read", "created", "length", "language"])):
    conn = get_db()
    c = conn.cursor()
    order = {
        "last_read": "COALESCE(last_read_at, created_at) DESC",
        "created": "created_at DESC",
        "length": "word_count DESC",
        "language": "language ASC",
    }[sort]
    c.execute(f"SELECT id, title, subtitle, language, target_language, word_count, tags, source_url, created_at, last_read_at FROM articles ORDER BY {order}")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

@app.get("/articles/{article_id}")
async def get_article(article_id: int):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM articles WHERE id = ?", (article_id,))
    row = c.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Article not found")
    
    today = datetime.utcnow().date().isoformat()
    now_iso = datetime.utcnow().isoformat()
    
    # Check if this is the first time reading this article
    first_read = row["last_read_at"] is None
    
    # Update last_read_at regardless
    c.execute("UPDATE articles SET last_read_at = ? WHERE id = ?", (now_iso, article_id))
    
    # Only count words on first read
    if first_read:
        c.execute("UPDATE reading_stats SET total_words_read = total_words_read + ? WHERE id = 1",
                  (row["word_count"],))
        
        # Update daily reading log - only count new articles for word count
        c.execute("""
            INSERT INTO daily_reading (date, words_read, articles_read)
            VALUES (?, ?, 1)
            ON CONFLICT(date) DO UPDATE SET
                words_read = words_read + ?,
                articles_read = articles_read + 1
        """, (today, row["word_count"], row["word_count"]))
    else:
        # Re-reading an article - update daily log with 0 words, but count the article read
        c.execute("""
            INSERT INTO daily_reading (date, words_read, articles_read)
            VALUES (?, 0, 1)
            ON CONFLICT(date) DO UPDATE SET
                articles_read = articles_read + 1
        """, (today,))
    
    # Update streaks - check if we read today (regardless of first read or re-read)
    c.execute("SELECT last_read_date, current_streak, longest_streak FROM reading_streaks WHERE id = 1")
    streak_row = c.fetchone()
    
    if streak_row:
        last_date = streak_row["last_read_date"]
        current_streak = streak_row["current_streak"]
        longest_streak = streak_row["longest_streak"]
        
        if last_date:
            last = datetime.fromisoformat(last_date).date()
            today_date = datetime.utcnow().date()
            delta = (today_date - last).days
            
            if delta == 1:
                # Read yesterday and today - streak continues
                current_streak += 1
            elif delta == 0:
                # Already read today - streak stays the same
                current_streak = current_streak
            elif delta > 1:
                # Missed a day - streak resets
                current_streak = 1
        else:
            # First ever read
            current_streak = 1
        
        longest_streak = max(longest_streak, current_streak)
        
        c.execute("""
            UPDATE reading_streaks 
            SET current_streak = ?, longest_streak = ?, last_read_date = ?
            WHERE id = 1
        """, (current_streak, longest_streak, now_iso))
        
        # Update total days read (unique days)
        c.execute("SELECT COUNT(*) as count FROM daily_reading")
        total_days = c.fetchone()["count"]
        c.execute("UPDATE reading_streaks SET total_days_read = ? WHERE id = 1", (total_days,))
    
    conn.commit()
    conn.close()
    return dict(row)

@app.patch("/articles/{article_id}")
async def update_article(article_id: int, body: ArticleUpdate):
    conn = get_db()
    c = conn.cursor()
    if body.tags is not None:
        c.execute("UPDATE articles SET tags = ? WHERE id = ?", (body.tags.strip(), article_id))
    if body.title is not None:
        c.execute("UPDATE articles SET title = ? WHERE id = ?", (body.title.strip(), article_id))
    if body.subtitle is not None:
        c.execute("UPDATE articles SET subtitle = ? WHERE id = ?", (body.subtitle.strip(), article_id))
    if body.source_url is not None:
        c.execute("UPDATE articles SET source_url = ? WHERE id = ?", (body.source_url.strip(), article_id))
    if body.language is not None:
        c.execute("UPDATE articles SET language = ? WHERE id = ?", (body.language.upper(), article_id))
    if body.target_language is not None:
        c.execute("UPDATE articles SET target_language = ? WHERE id = ?", (body.target_language.upper(), article_id))
    conn.commit()
    conn.close()
    return {"updated": article_id}

class ArticleTextUpdate(BaseModel):
    text: str

@app.patch("/articles/{article_id}/text")
async def update_article_text(article_id: int, body: ArticleTextUpdate):
    import re as _re
    plain_text = _re.sub(r'<[^>]+>', ' ', body.text)
    word_count = len(plain_text.split())
    conn = get_db()
    c = conn.cursor()
    c.execute("UPDATE articles SET text = ?, word_count = ? WHERE id = ?",
              (body.text, word_count, article_id))
    conn.commit()
    conn.close()
    return {"updated": article_id, "word_count": word_count}

@app.delete("/articles/{article_id}")
async def delete_article(article_id: int):
    conn = get_db()
    c = conn.cursor()
    c.execute("DELETE FROM articles WHERE id = ?", (article_id,))
    conn.commit()
    conn.close()
    return {"deleted": article_id}

# ---------------------------------------------------------------------------
# Word status
# ---------------------------------------------------------------------------

class WordStatusUpdate(BaseModel):
    word: str
    language: str
    status: str
    sentence_context: str | None = None
    article_id: int | None = None

@app.post("/words/status")
async def update_word_status(body: WordStatusUpdate):
    if body.status not in ("unknown", "learning", "known"):
        raise HTTPException(status_code=400, detail="Invalid status")
    now = datetime.utcnow().isoformat()
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        INSERT INTO words (word, language, status, updated_at, sentence_context, article_id)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(word, language) DO UPDATE SET
            status=excluded.status,
            updated_at=excluded.updated_at,
            sentence_context=COALESCE(excluded.sentence_context, sentence_context),
            article_id=COALESCE(excluded.article_id, article_id)
    """, (body.word.lower(), body.language.upper(), body.status, now, body.sentence_context, body.article_id))
    conn.commit()
    conn.close()
    return {"word": body.word, "status": body.status}

@app.get("/words/status")
async def get_word_statuses(language: str = Query(...)):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT word, status FROM words WHERE language = ?", (language.upper(),))
    rows = {r["word"]: r["status"] for r in c.fetchall()}
    conn.close()
    return rows

@app.get("/words/learning")
async def get_learning_words(language: str = Query(None)):
    conn = get_db()
    c = conn.cursor()
    if language:
        c.execute("""
            SELECT w.id, w.word, w.language, w.sentence_context, w.updated_at,
                   a.title as article_title, a.id as article_id
            FROM words w
            LEFT JOIN articles a ON w.article_id = a.id
            WHERE w.status = 'learning' AND w.language = ?
            ORDER BY w.updated_at DESC
        """, (language.upper(),))
    else:
        c.execute("""
            SELECT w.id, w.word, w.language, w.sentence_context, w.updated_at,
                   a.title as article_title, a.id as article_id
            FROM words w
            LEFT JOIN articles a ON w.article_id = a.id
            WHERE w.status = 'learning'
            ORDER BY w.updated_at DESC
        """)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

@app.delete("/words/{word_id}")
async def delete_word(word_id: int):
    conn = get_db()
    c = conn.cursor()
    c.execute("DELETE FROM words WHERE id = ?", (word_id,))
    conn.commit()
    conn.close()
    return {"deleted": word_id}

# ---------------------------------------------------------------------------
# Notes
# ---------------------------------------------------------------------------

class NoteCreate(BaseModel):
    article_id: int | None = None
    selected_text: str | None = None
    note_text: str

@app.post("/notes")
async def create_note(body: NoteCreate):
    now = datetime.utcnow().isoformat()
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        INSERT INTO notes (article_id, selected_text, note_text, created_at)
        VALUES (?, ?, ?, ?)
    """, (body.article_id, body.selected_text, body.note_text, now))
    note_id = c.lastrowid
    conn.commit()
    conn.close()
    return {"id": note_id, "article_id": body.article_id, "selected_text": body.selected_text,
            "note_text": body.note_text, "created_at": now}

@app.get("/notes")
async def get_notes(article_id: int = Query(None)):
    conn = get_db()
    c = conn.cursor()
    if article_id:
        c.execute("""
            SELECT n.*, a.title as article_title
            FROM notes n LEFT JOIN articles a ON n.article_id = a.id
            WHERE n.article_id = ?
            ORDER BY n.created_at DESC
        """, (article_id,))
    else:
        c.execute("""
            SELECT n.*, a.title as article_title
            FROM notes n LEFT JOIN articles a ON n.article_id = a.id
            ORDER BY n.created_at DESC
        """)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

class NoteUpdate(BaseModel):
    note_text: str

@app.patch("/notes/{note_id}")
async def update_note(note_id: int, body: NoteUpdate):
    conn = get_db()
    c = conn.cursor()
    c.execute("UPDATE notes SET note_text = ? WHERE id = ?", (body.note_text, note_id))
    conn.commit()
    conn.close()
    return {"updated": note_id}

@app.delete("/notes/{note_id}")
async def delete_note(note_id: int):
    conn = get_db()
    c = conn.cursor()
    c.execute("DELETE FROM notes WHERE id = ?", (note_id,))
    conn.commit()
    conn.close()
    return {"deleted": note_id}


# ---------------------------------------------------------------------------
# Word bank
# ---------------------------------------------------------------------------

class WordBankEntryCreate(BaseModel):
    article_id: int
    selected_text: str
    sentence_context: str
    sentence_translation: str | None = None
    hint: str = ""
    notes: str = ""

class WordBankEntryUpdate(BaseModel):
    sentence_translation: str | None = None
    hint: str | None = None
    notes: str | None = None

def strip_html(text: str) -> str:
    """Remove HTML tags, decode entities, and normalize whitespace."""
    if not text:
        return ''
    # Remove style/script blocks entirely
    clean = re.sub(r'<(style|script)[^>]*>.*?</(style|script)>', '', text, flags=re.DOTALL | re.IGNORECASE)
    # Remove all tags
    clean = re.sub(r'<[^>]+>', ' ', clean)
    # Decode common HTML entities
    clean = clean.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<') \
                 .replace('&gt;', '>').replace('&quot;', '"').replace('&#39;', "'") \
                 .replace('&apos;', "'").replace('&hellip;', '…').replace('&mdash;', '—') \
                 .replace('&ndash;', '–').replace('&laquo;', '«').replace('&raquo;', '»')
    # Normalize whitespace
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean

@app.post("/wordbank/cleanup-html")
async def cleanup_wordbank_html():
    """One-time cleanup: strip HTML from all existing word bank entries."""
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id, selected_text, sentence_context FROM word_bank_entries")
    rows = c.fetchall()
    updated = 0
    for row in rows:
        clean_text = strip_html(row["selected_text"])
        clean_sentence = strip_html(row["sentence_context"])
        if clean_text != row["selected_text"] or clean_sentence != row["sentence_context"]:
            c.execute(
                "UPDATE word_bank_entries SET selected_text = ?, sentence_context = ? WHERE id = ?",
                (clean_text, clean_sentence, row["id"])
            )
            updated += 1
    conn.commit()
    conn.close()
    return {"cleaned": updated, "total": len(rows)}

@app.post("/wordbank")
async def add_to_wordbank(body: WordBankEntryCreate):
    now = datetime.utcnow().isoformat()
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        INSERT INTO word_bank_entries
            (article_id, selected_text, sentence_context, sentence_translation, hint, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (body.article_id, strip_html(body.selected_text), strip_html(body.sentence_context),
          body.sentence_translation, body.hint, body.notes, now))
    entry_id = c.lastrowid
    conn.commit()
    conn.close()
    return {"id": entry_id, "selected_text": body.selected_text}

@app.get("/wordbank/{article_id}")
async def get_wordbank(article_id: int):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM word_bank_entries WHERE article_id = ? ORDER BY created_at ASC", (article_id,))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

@app.delete("/wordbank/entry/{entry_id}")
async def delete_wordbank_entry(entry_id: int):
    conn = get_db()
    c = conn.cursor()
    c.execute("DELETE FROM word_bank_entries WHERE id = ?", (entry_id,))
    conn.commit()
    conn.close()
    return {"deleted": entry_id}

@app.patch("/wordbank/entry/{entry_id}")
async def update_wordbank_entry(entry_id: int, body: WordBankEntryUpdate):
    conn = get_db()
    c = conn.cursor()
    if body.sentence_translation is not None:
        c.execute("UPDATE word_bank_entries SET sentence_translation = ? WHERE id = ?", (body.sentence_translation, entry_id))
    if body.hint is not None:
        c.execute("UPDATE word_bank_entries SET hint = ? WHERE id = ?", (body.hint, entry_id))
    if body.notes is not None:
        c.execute("UPDATE word_bank_entries SET notes = ? WHERE id = ?", (body.notes, entry_id))
    conn.commit()
    conn.close()
    return {"updated": entry_id}

# ---------------------------------------------------------------------------
# Global word bank (all articles)
# ---------------------------------------------------------------------------

@app.get("/wordbank")
async def get_all_wordbank(
    language: str = Query(None),
    exported: str = Query(None, enum=["yes", "no", "all"]),
):
    conn = get_db()
    c = conn.cursor()
    query = """
        SELECT w.*, a.title as article_title, a.language, a.target_language, a.tags
        FROM word_bank_entries w
        JOIN articles a ON w.article_id = a.id
        WHERE 1=1
    """
    params = []
    if language:
        query += " AND a.language = ?"
        params.append(language.upper())
    if exported == "yes":
        query += " AND w.exported_at IS NOT NULL"
    elif exported == "no":
        query += " AND w.exported_at IS NULL"
    query += " ORDER BY w.created_at DESC"
    c.execute(query, params)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

class ExportRequest(BaseModel):
    entry_ids: list[int]
    # Updated field values keyed by entry id (stringified)
    updates: dict[str, dict] = {}

@app.post("/export/csv")
async def export_csv(body: ExportRequest):
    if not body.entry_ids:
        raise HTTPException(status_code=400, detail="No entries to export")

    conn = get_db()
    c = conn.cursor()

    # Apply any pending edits first
    for str_id, changes in body.updates.items():
        entry_id = int(str_id)
        if "sentence_context" in changes:
            c.execute("UPDATE word_bank_entries SET sentence_context = ? WHERE id = ?",
                      (changes["sentence_context"], entry_id))
        if "sentence_translation" in changes:
            c.execute("UPDATE word_bank_entries SET sentence_translation = ? WHERE id = ?",
                      (changes["sentence_translation"], entry_id))
        if "hint" in changes:
            c.execute("UPDATE word_bank_entries SET hint = ? WHERE id = ?",
                      (changes["hint"], entry_id))
        if "notes" in changes:
            c.execute("UPDATE word_bank_entries SET notes = ? WHERE id = ?",
                      (changes["notes"], entry_id))

    # Fetch all entries with article info
    placeholders = ",".join("?" * len(body.entry_ids))
    c.execute(f"""
        SELECT w.*, a.language, a.target_language, a.tags
        FROM word_bank_entries w
        JOIN articles a ON w.article_id = a.id
        WHERE w.id IN ({placeholders})
    """, body.entry_ids)
    entries = [dict(r) for r in c.fetchall()]

    # Mark as exported
    now = datetime.utcnow().isoformat()
    c.execute(f"UPDATE word_bank_entries SET exported_at = ? WHERE id IN ({placeholders})",
              [now] + list(body.entry_ids))
    conn.commit()
    conn.close()

    # Build CSV
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_ALL, lineterminator='\n')
    
    for entry in entries:
        cloze = make_cloze(entry["sentence_context"], entry["selected_text"])
        translation = entry.get("sentence_translation") or ""
        hint = entry.get("hint") or ""
        notes = entry.get("notes") or ""
        
        # Preserve newlines in hint and notes
        # No processing needed - CSV quoting will handle them
        
        # Tags: only user-added tags (excluding @folder tags)
        raw_tags = entry.get("tags") or ""
        tag_list = [t for t in raw_tags.split() if t and not t.startswith('@')]
        tags = " ".join(dict.fromkeys(tag_list))
        
        writer.writerow([cloze, translation, hint, notes, tags])

    csv_content = output.getvalue()
    output.close()

    return StreamingResponse(
        io.BytesIO(csv_content.encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leggendo_export.csv"}
    )

# ---------------------------------------------------------------------------
# PDF Export for Learning Words
# ---------------------------------------------------------------------------

@app.get("/export/words-pdf")
async def export_words_pdf(language: str = Query(None)):
    """Export learning words as PDF"""
    conn = get_db()
    c = conn.cursor()
    
    if language:
        c.execute("""
            SELECT w.word, w.sentence_context, a.title as article_title, a.language
            FROM words w
            LEFT JOIN articles a ON w.article_id = a.id
            WHERE w.status = 'learning' AND w.language = ?
            ORDER BY w.updated_at DESC
        """, (language.upper(),))
    else:
        c.execute("""
            SELECT w.word, w.sentence_context, a.title as article_title, a.language
            FROM words w
            LEFT JOIN articles a ON w.article_id = a.id
            WHERE w.status = 'learning'
            ORDER BY w.updated_at DESC
        """)
    
    words = [dict(r) for r in c.fetchall()]
    conn.close()
    
    if not words:
        raise HTTPException(status_code=404, detail="No learning words found")
    
    # Register Unicode font
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    
    font_path = os.path.join(os.path.dirname(__file__), "DejaVuSans.ttf")
    if os.path.exists(font_path):
        pdfmetrics.registerFont(TTFont('DejaVu', font_path))
        pdfmetrics.registerFont(TTFont('DejaVu-Bold', os.path.join(os.path.dirname(__file__), "DejaVuSans-Bold.ttf")))
        pdfmetrics.registerFont(TTFont('DejaVu-Oblique', os.path.join(os.path.dirname(__file__), "DejaVuSans-Oblique.ttf")))
        
        title_font = 'DejaVu-Bold'
        word_font = 'DejaVu-Bold'
        context_font = 'DejaVu-Oblique'
        source_font = 'DejaVu'
    else:
        # Fallback to Helvetica
        title_font = 'Helvetica-Bold'
        word_font = 'Helvetica-Bold'
        context_font = 'Helvetica-Oblique'
        source_font = 'Helvetica'
        print("Warning: DejaVuSans.ttf not found. Turkish characters may not display correctly.")
    
    # Create PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=72)
    styles = getSampleStyleSheet()
    
    # Custom styles with Unicode font
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#c17b3f'),
        spaceAfter=30,
        fontName=title_font
    )
    
    number_style = ParagraphStyle(
        'NumberStyle',
        parent=styles['Normal'],
        fontSize=14,
        fontName=word_font,
        textColor=colors.HexColor('#c17b3f'),
        spaceAfter=6,
        leading=16,
        alignment=2  # Right align
    )
    
    word_style = ParagraphStyle(
        'WordStyle',
        parent=styles['Normal'],
        fontSize=14,
        fontName=word_font,
        textColor=colors.HexColor('#1a1612'),
        spaceAfter=6,
        leading=16,
        leftIndent=40
    )
    
    context_style = ParagraphStyle(
        'ContextStyle',
        parent=styles['Normal'],
        fontSize=11,
        fontName=context_font,
        textColor=colors.HexColor('#6b5e4e'),
        spaceAfter=12,
        leftIndent=60,
        leading=14
    )
    
    source_style = ParagraphStyle(
        'SourceStyle',
        parent=styles['Normal'],
        fontSize=9,
        fontName=source_font,
        textColor=colors.HexColor('#9ca3af'),
        spaceAfter=20,
        leftIndent=60,
        leading=11
    )
    
    story = []
    
    # Title
    title_text = f"Words Learning - {language if language else 'All Languages'}"
    story.append(Paragraph(title_text, title_style))
    story.append(Spacer(1, 0.2 * inch))
    
    # Stats
    story.append(Paragraph(f"Total words: {len(words)}", styles['Normal']))
    story.append(Spacer(1, 0.3 * inch))
    
    # Words list as numbered list
    for idx, w in enumerate(words, 1):
        # Create a table for each entry to align number and word
        from reportlab.platypus import Table, TableStyle
        
        number = str(idx)
        word_text = w['word'].replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        
        # Create two-column table: number (right-aligned) | word
        data = [
            [Paragraph(number, number_style), Paragraph(word_text, word_style)]
        ]
        
        # Create table with flexible column widths
        t = Table(data, colWidths=[30, None])
        t.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (0, 0), 0),
            ('RIGHTPADDING', (0, 0), (0, 0), 8),
            ('LEFTPADDING', (1, 0), (1, 0), 0),
            ('RIGHTPADDING', (1, 0), (1, 0), 0),
        ]))
        
        story.append(t)
        
        # Add sentence context if exists
        if w.get('sentence_context'):
            # Clean up cloze markers and escape HTML
            context = w['sentence_context'].replace('{{c1::', '').replace('}}', '')
            context = context.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            story.append(Paragraph(context, context_style))
        
        # Add article source if exists
        if w.get('article_title'):
            title = w['article_title'].replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            story.append(Paragraph(f"from: {title}", source_style))
        
        story.append(Spacer(1, 0.1 * inch))
    
    doc.build(story)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=leggendo_words_{language or 'all'}.pdf"}
    )

# ---------------------------------------------------------------------------
# Streaks
# ---------------------------------------------------------------------------

@app.get("/streaks")
async def get_streaks():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT current_streak, longest_streak, total_days_read FROM reading_streaks WHERE id = 1")
    streak_row = c.fetchone()
    
    # Get last 30 days of reading activity
    c.execute("""
        SELECT date, words_read, articles_read 
        FROM daily_reading 
        WHERE date >= date('now', '-30 days')
        ORDER BY date DESC
    """)
    daily_activity = [dict(r) for r in c.fetchall()]
    
    conn.close()
    
    return {
        "current_streak": streak_row["current_streak"] if streak_row else 0,
        "longest_streak": streak_row["longest_streak"] if streak_row else 0,
        "total_days_read": streak_row["total_days_read"] if streak_row else 0,
        "daily_activity": daily_activity
    }

# ---------------------------------------------------------------------------
# Translation & lookup
# ---------------------------------------------------------------------------

FREE_DICT_BASE = "https://api.dictionaryapi.dev/api/v2/entries"
WIKTIONARY_API = "https://en.wiktionary.org/w/api.php"

# Native Wiktionary base URLs for monolingual mode
WIKTIONARY_NATIVE_APIS = {
    "EN": "https://en.wiktionary.org/w/api.php",
    "IT": "https://it.wiktionary.org/w/api.php",
    "DE": "https://de.wiktionary.org/w/api.php",
    "FR": "https://fr.wiktionary.org/w/api.php",
    "ES": "https://es.wiktionary.org/w/api.php",
    "TR": "https://tr.wiktionary.org/w/api.php",
}

WIKTIONARY_LANG_NAMES = {
    "EN": "English",
    "IT": "Italian",
    "DE": "German",
    "FR": "French",
    "ES": "Spanish",
    "TR": "Turkish",
}

WIKTIONARY_HEADERS = {"User-Agent": "Leggendo/1.0 (language learning app) httpx/0.27"}

SCRAPE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
}

# ---------------------------------------------------------------------------
# WordReference Italian monolingual dictionary
# ---------------------------------------------------------------------------

@app.get("/demauro/debug")
async def demauro_debug(word: str = Query(...)):
    """Returns De Mauro definition HTML."""
    url = f"https://dizionario.internazionale.it/parola/{word.lower()}"
    try:
        async with httpx.AsyncClient(timeout=12.0, headers=SCRAPE_HEADERS, follow_redirects=True) as client:
            resp = await client.get(url)
            html = resp.text
            html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
            html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)
            # Find the word entry section
            for marker in ['class="word-wrap"', 'class="entry"', 'class="lemma"', 'id="entry"', 'class="word"', '<article']:
                idx = html.find(marker)
                if idx >= 0:
                    return {"marker": marker, "content": html[idx:idx+5000]}
            # Fallback: find anything after the nav
            idx = html.find('<main')
            if idx == -1:
                idx = html.find('<div id="content"')
            if idx == -1:
                idx = html.find('<div class="container"')
            return {"marker": "fallback", "content": html[idx:idx+5000] if idx >= 0 else html[2000:7000]}
    except Exception as e:
        return {"error": str(e)}



async def wordreference_debug(word: str = Query(...)):
    """Returns WordReference HTML for debugging."""
    url = f"https://www.wordreference.com/definizione/{word.lower()}"
    try:
        async with httpx.AsyncClient(timeout=12.0, headers=SCRAPE_HEADERS, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return {"error": f"HTTP {resp.status_code}", "url": str(resp.url)}
            html = resp.text
            html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
            html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)
            idx = html.find('headerWord')
            return {
                "url": str(resp.url),
                "status": resp.status_code,
                "definition_area": html[idx:idx+4000] if idx >= 0 else "not found",
            }
    except Exception as e:
        return {"error": str(e)}


async def lookup_wordreference_it(word: str) -> dict:
    """Scrape WordReference Italian monolingual dictionary (Le Monnier)."""
    result = {
        "found": False, "definitions": [], "part_of_speech": None,
        "gender": None, "etymology": None, "phonetic": None, "forms": None,
    }
    url = f"https://www.wordreference.com/definizione/{word.lower()}"
    try:
        async with httpx.AsyncClient(timeout=12.0, headers=SCRAPE_HEADERS, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return result
            html = resp.text

            # Pronunciation — WordReference uses <span class='Pron'>‹cà·sa›</span>
            pron = re.search(r"<span class='Pron'>(.*?)</span>", html)
            if pron:
                result["phonetic"] = re.sub(r'<[^>]+>', '', pron.group(1)).strip()
            else:
                # Fallback: pronWR span with IPA brackets
                pron2 = re.search(r"pronWR[^>]*>\s*(\[.*?\])", html)
                if pron2:
                    result["phonetic"] = pron2.group(1).strip()

            # Inflected forms — in inflectionsSection
            infl = re.search(r'inflectionsSection[^>]*>(.*?)</div>', html, re.DOTALL)
            if infl:
                infl_text = re.sub(r'<[^>]+>', '', infl.group(1))
                infl_text = re.sub(r'\s+', ' ', infl_text).strip()
                # Clean up boilerplate text like "Forme flesse di 'word' (nf):"
                infl_text = re.sub(r"Forme flesse di '[^']+' \([^)]+\):\s*", '', infl_text)
                if infl_text:
                    result["forms"] = infl_text

            # Main entry block
            entry_match = re.search(r"<div class='entryitit[^']*'>(.*?)(?=<div class='entry|<div id='forum|<br\s*/>\s*<br|$)", html, re.DOTALL)
            if not entry_match:
                return result
            entry = entry_match.group(1)

            # Part of speech + gender
            gramm = re.search(r"<span class='Gramm'>(.*?)</span>", entry)
            if gramm:
                g = re.sub(r'<[^>]+>', '', gramm.group(1)).strip()
                gramm_map = {
                    's.f.': ('sostantivo', 'femminile'), 's.m.': ('sostantivo', 'maschile'),
                    's.m.f.': ('sostantivo', None), 'v.tr.': ('verbo transitivo', None),
                    'v.intr.': ('verbo intransitivo', None), 'v.rifl.': ('verbo riflessivo', None),
                    'agg.': ('aggettivo', None), 'avv.': ('avverbio', None),
                    'prep.': ('preposizione', None), 'cong.': ('congiunzione', None),
                }
                pos, gender = gramm_map.get(g, (g, None))
                result["part_of_speech"] = pos
                result["gender"] = gender

            # Definitions — grab only the core definition text, not locutions
            defns = re.findall(r"<li class='definition'[^>]*>(.*?)</li\s*>", entry, re.DOTALL)
            for d in defns[:5]:
                # Remove everything from <br> onward (locutions, idioms follow the main def)
                d = re.sub(r'<br\s*/?>\s*.*', '', d, flags=re.DOTALL)
                # Strip all remaining tags
                text = re.sub(r'<[^>]+>', '', d)
                text = re.sub(r'\s+', ' ', text).strip().strip(' ,;:')
                if len(text) > 5:
                    result["definitions"].append({"pos": result["part_of_speech"], "text": text[:300]})

            result["found"] = len(result["definitions"]) > 0
            if result["found"]:
                result["source"] = "WordReference (Le Monnier)"
    except Exception as e:
        print(f"WordReference error for '{word}': {e}")
    return result


# ---------------------------------------------------------------------------
# TDK — Türk Dil Kurumu (Turkish monolingual, official JSON API)
# ---------------------------------------------------------------------------

async def lookup_tdk(word: str) -> dict:
    """Query TDK's official JSON API for Turkish definitions."""
    result = {"found": False, "definitions": [], "part_of_speech": None, "gender": None, "etymology": None}
    url = f"https://sozluk.gov.tr/gts?ara={word.lower()}"
    try:
        async with httpx.AsyncClient(timeout=12.0, headers=SCRAPE_HEADERS) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return result
            data = resp.json()

            if not data or isinstance(data, dict) and "error" in data:
                return result

            entries = data if isinstance(data, list) else []
            for entry in entries[:2]:
                anlamlar = entry.get("anlamlar", [])
                pos = None
                for anlam in anlamlar[:5]:
                    ozellik = anlam.get("ozellik_tam", "") or anlam.get("ozellik", "") or ""
                    text = anlam.get("anlam", "").strip()
                    if not pos and ozellik:
                        pos = ozellik.strip()
                    if text:
                        result["definitions"].append({"pos": ozellik or None, "text": text})

            # Pronunciation/origin
            if entries:
                lisan = entries[0].get("lisan", "")
                if lisan:
                    result["etymology"] = f"Köken: {lisan}"
                if not result["part_of_speech"] and result["definitions"]:
                    result["part_of_speech"] = result["definitions"][0].get("pos")

            result["found"] = len(result["definitions"]) > 0
    except Exception as e:
        print(f"TDK error for '{word}': {e}")
    return result


# ---------------------------------------------------------------------------
# Unified monolingual lookup — routes to best source per language
# ---------------------------------------------------------------------------

async def lookup_monolingual(word: str, lang: str) -> dict:
    """Route to the best monolingual source for the given language."""
    lang = lang.upper()
    if lang == "IT":
        result = await lookup_wordreference_it(word)
        if result["found"]:
            return result
        # Fallback to it.wiktionary
        wikitext = await fetch_wikt(WIKTIONARY_NATIVE_APIS["IT"], word)
        if wikitext:
            parsed = parse_wiktionary_wikitext_native(wikitext)
            if parsed["definitions"]:
                return {**parsed, "found": True, "source": "Wiktionary (it)"}
    elif lang == "TR":
        result = await lookup_tdk(word)
        if result["found"]:
            return {**result, "source": "TDK"}
        # Fallback to tr.wiktionary
        wikitext = await fetch_wikt(WIKTIONARY_NATIVE_APIS.get("TR", WIKTIONARY_API), word)
        if wikitext:
            parsed = parse_wiktionary_wikitext_native(wikitext)
            if parsed["definitions"]:
                return {**parsed, "found": True, "source": "Wiktionary (tr)"}
    else:
        # For other languages use native Wiktionary edition if available
        api_url = WIKTIONARY_NATIVE_APIS.get(lang, WIKTIONARY_API)
        wikitext = await fetch_wikt(api_url, word)
        if wikitext:
            parsed = parse_wiktionary_wikitext_native(wikitext) if lang in WIKTIONARY_NATIVE_APIS \
                else parse_wiktionary_wikitext(wikitext, WIKTIONARY_LANG_NAMES.get(lang, lang.title()))
            lang_label = f"Wiktionary ({lang.lower()})" if lang in WIKTIONARY_NATIVE_APIS else "Wiktionary"
            if parsed["definitions"]:
                return {**parsed, "found": True, "source": lang_label}

    return {"found": False, "definitions": [], "part_of_speech": None, "gender": None, "etymology": None, "source": None}



def parse_wiktionary_wikitext_native(wikitext: str) -> dict:
    """Parse native-language Wiktionary wikitext (no language section filtering needed)."""
    result = {"definitions": [], "part_of_speech": None, "gender": None, "forms": [], "etymology": None}

    # Extract etymology - native wikts don't need language filtering
    etym_match = re.search(r"==+\s*[Ee]tim|[Oo]rigine|[Hh]erkunft|[Éé]tymologie\s*==+\s*\n(.*?)(?===|\Z)", wikitext, re.DOTALL)
    if etym_match:
        etym_text = re.sub(r"\[\[([^\]|]*\|)?([^\]]*)\]\]", r"\2", etym_match.group(1))
        etym_text = re.sub(r"\{\{[^}]*\}\}", "", etym_text).strip()
        result["etymology"] = etym_text[:300] if etym_text else None

    # Extract gender
    gender_match = re.search(r"\{\{[a-z\-]+-noun\|([mfn])", wikitext)
    if gender_match:
        result["gender"] = {"m": "maschile", "f": "femminile", "n": "neutro"}.get(gender_match.group(1))

    # Extract POS sections — native wikts use locale names
    pos_pattern = r"===+\s*((?:sostantivo|verbo|aggettivo|avverbio|nome|Substantiv|Verb|Adjektiv|nom|verbe|adjectif|sustantivo|fiil|isim|sıfat)[^=]*?)===+\s*\n(.*?)(?====|\Z)"
    pos_sections = re.findall(pos_pattern, wikitext, re.DOTALL | re.IGNORECASE)

    for pos, content in pos_sections[:2]:
        if not result["part_of_speech"]:
            result["part_of_speech"] = pos.strip()
        defn_matches = re.findall(r"^#\s*([^*:#\n][^\n]+)", content, re.MULTILINE)
        for defn in defn_matches[:4]:
            clean = re.sub(r"\[\[([^\]|]*\|)?([^\]]*)\]\]", r"\2", defn)
            clean = re.sub(r"\{\{[^}]*\}\}", "", clean)
            clean = re.sub(r"'''|''", "", clean).strip()
            if clean and len(clean) > 3:
                result["definitions"].append({"pos": pos.strip(), "text": clean})

    # Fallback: grab any # lines if structured parsing found nothing
    if not result["definitions"]:
        defn_matches = re.findall(r"^#\s*([^*:#\n][^\n]+)", wikitext, re.MULTILINE)
        for defn in defn_matches[:5]:
            clean = re.sub(r"\[\[([^\]|]*\|)?([^\]]*)\]\]", r"\2", defn)
            clean = re.sub(r"\{\{[^}]*\}\}", "", clean)
            clean = re.sub(r"'''|''", "", clean).strip()
            if clean and len(clean) > 3:
                result["definitions"].append({"pos": None, "text": clean})

    return result


async def fetch_wikt(api_url: str, word: str) -> str:
    """Fetch raw wikitext from any Wiktionary edition."""
    try:
        async with httpx.AsyncClient(timeout=15.0, headers=WIKTIONARY_HEADERS) as client:
            resp = await client.get(api_url, params={
                "action": "query", "titles": word.lower(),
                "prop": "revisions", "rvprop": "content",
                "rvslots": "main", "format": "json", "formatversion": "2",
            })
            if resp.status_code != 200:
                return ""
            data = resp.json()
            pages = data.get("query", {}).get("pages", [])
            if not pages or "missing" in pages[0]:
                return ""
            return pages[0].get("revisions", [{}])[0].get("slots", {}).get("main", {}).get("content", "")
    except Exception as e:
        print(f"Wiktionary fetch error: {e}")
        return ""


# ---------------------------------------------------------------------------
# Article stats (per-article word status breakdown)
# ---------------------------------------------------------------------------

@app.get("/articles/{article_id}/stats")
async def get_article_stats(article_id: int):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT text, language FROM articles WHERE id = ?", (article_id,))
    row = c.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Article not found")

    text = re.sub(r'<[^>]+>', ' ', row["text"])
    language = row["language"].upper()
    raw_tokens = re.findall(r"[\w']+", text, re.UNICODE)
    unique_words = set(w.lower() for w in raw_tokens if w.strip())

    if not unique_words:
        conn.close()
        return {"unique": 0, "learning": 0}

    placeholders = ",".join("?" * len(unique_words))
    c.execute(
        f"SELECT COUNT(*) as count FROM words WHERE language = ? AND status = 'learning' AND word IN ({placeholders})",
        [language] + list(unique_words)
    )
    learning = c.fetchone()["count"]
    conn.close()

    return {"unique": len(unique_words), "learning": learning}

def parse_wiktionary_wikitext(wikitext: str, lang_name: str) -> dict:
    """Parse raw wikitext from Wiktionary into structured data."""
    result = {
        "definitions": [],
        "part_of_speech": None,
        "gender": None,
        "forms": [],
        "etymology": None,
        "raw_available": True,
    }

    # Find the section for our language
    lang_section_pattern = rf"==\s*{re.escape(lang_name)}\s*=="
    lang_match = re.search(lang_section_pattern, wikitext)
    if not lang_match:
        return result

    # Extract only this language's section
    start = lang_match.start()
    next_lang = re.search(r"\n==[^=]", wikitext[start + 5:])
    section = wikitext[start: start + 5 + next_lang.start()] if next_lang else wikitext[start:]

    # Extract etymology
    etym_match = re.search(r"===\s*Etymology.*?===\s*\n(.*?)(?===|\Z)", section, re.DOTALL)
    if etym_match:
        etym_text = re.sub(r"\[\[([^\]|]*\|)?([^\]]*)\]\]", r"\2", etym_match.group(1))
        etym_text = re.sub(r"\{\{[^}]*\}\}", "", etym_text).strip()
        result["etymology"] = etym_text[:300] if etym_text else None

    # Extract part of speech sections and definitions
    pos_sections = re.findall(
        r"===\s*(Noun|Verb|Adjective|Adverb|Pronoun|Preposition|Conjunction|Interjection|Participle|Suffix|Prefix)\s*===\s*\n(.*?)(?===|\Z)",
        section, re.DOTALL
    )

    for pos, content in pos_sections[:2]:
        if not result["part_of_speech"]:
            result["part_of_speech"] = pos

        # Extract gender from noun headers like {{it-noun|m}}
        gender_match = re.search(r"\{\{[a-z]+-noun\|([mfn])", content)
        if gender_match and not result["gender"]:
            gender_map = {"m": "masculine", "f": "feminine", "n": "neuter"}
            result["gender"] = gender_map.get(gender_match.group(1))

        # Extract numbered definitions
        defn_matches = re.findall(r"^#\s*([^*:#\n][^\n]+)", content, re.MULTILINE)
        for defn in defn_matches[:4]:
            # Clean wikitext markup
            clean = re.sub(r"\[\[([^\]|]*\|)?([^\]]*)\]\]", r"\2", defn)
            clean = re.sub(r"\{\{[^}]*\}\}", "", clean)
            clean = re.sub(r"'''|''", "", clean)
            clean = clean.strip()
            if clean and len(clean) > 3:
                result["definitions"].append({"pos": pos, "text": clean})

    return result


@app.get("/dictionary/tdk")
async def tdk_lookup(word: str = Query(...)):
    """Turkish Dictionary - TDK (Türk Dil Kurumu) official JSON API."""
    cache_key = f"tdk:{word}"
    if cache_key in _cache:
        return _cache[cache_key]
    try:
        async with httpx.AsyncClient(timeout=10.0, headers=WIKTIONARY_HEADERS) as client:
            resp = await client.get(
                f"https://sozluk.gov.tr/gts",
                params={"ara": word.lower()}
            )
            if resp.status_code != 200:
                return {"word": word, "found": False, "definitions": []}
            data = resp.json()
            if isinstance(data, dict) and "error" in data:
                return {"word": word, "found": False, "definitions": []}

            definitions = []
            part_of_speech = None
            for entry in data[:1]:  # first entry
                for meaning in entry.get("anlamlarListe", [])[:5]:
                    pos = meaning.get("ozelliklerListe", [{}])[0].get("tam_adi") if meaning.get("ozelliklerListe") else None
                    if pos and not part_of_speech:
                        part_of_speech = pos
                    definitions.append({
                        "pos": pos,
                        "text": meaning.get("anlam", ""),
                    })

            result = {
                "word": word,
                "found": len(definitions) > 0,
                "definitions": definitions,
                "part_of_speech": part_of_speech,
                "gender": None,
                "etymology": None,
                "source": "TDK",
            }
            _cache[cache_key] = result
            return result
    except Exception as e:
        print(f"TDK error: {e}")
        return {"word": word, "found": False, "definitions": []}

@app.get("/dictionary/lookup")
async def dictionary_lookup(
    word: str = Query(...),
    lang: str = Query("IT"),
    mode: str = Query("monolingual"),
):
    """Unified dictionary endpoint — routes to the best source per language/mode."""
    lang = lang.upper()

    if mode == "monolingual":
        if lang == "TR":
            return await tdk_lookup(word)
        elif lang == "IT":
            result = await lookup_wordreference_it(word)
            if result.get("found"):
                return result
            # fallback to Wiktionary monolingual
            return await wiktionary_lookup(word=word, lang=lang, monolingual=True)
        else:
            return await wiktionary_lookup(word=word, lang=lang, monolingual=True)

    # wiktionary mode
    return await wiktionary_lookup(word=word, lang=lang, monolingual=False)


async def wiktionary_debug(word: str = Query(...), lang: str = Query("IT"), monolingual: bool = Query(False)):
    lang_name = WIKTIONARY_LANG_NAMES.get(lang.upper(), lang.title())
    api_url = WIKTIONARY_NATIVE_APIS.get(lang.upper(), WIKTIONARY_API) if monolingual else WIKTIONARY_API
    wikitext = await fetch_wikt(api_url, word)
    if not wikitext:
        return {"found": False, "api_url": api_url}
    return {
        "lang_name": lang_name,
        "api_url": api_url,
        "monolingual": monolingual,
        "wikitext_preview": wikitext[:3000],
        "has_lang_section": lang_name in wikitext,
        "section_headers": re.findall(r"==+[^=]+==+", wikitext[:3000]),
    }


@app.get("/wiktionary")
async def wiktionary_lookup(
    word: str = Query(...),
    lang: str = Query("IT"),
    monolingual: bool = Query(False),
):
    lang_name = WIKTIONARY_LANG_NAMES.get(lang.upper(), lang.title())
    cache_key = f"wikt:{'mono' if monolingual else 'en'}:{word}:{lang}"
    if cache_key in _cache:
        return _cache[cache_key]

    if monolingual:
        result = await lookup_monolingual(word, lang)
        result = {"word": word, "monolingual": True, **result}
    else:
        wikitext = await fetch_wikt(WIKTIONARY_API, word)
        if not wikitext:
            return {"word": word, "found": False, "definitions": [], "monolingual": False}
        parsed = parse_wiktionary_wikitext(wikitext, lang_name)
        result = {"word": word, "found": len(parsed["definitions"]) > 0, "monolingual": False, **parsed}

    _cache[cache_key] = result
    return result

@app.get("/lookup")
async def lookup_word(
    word: str = Query(...),
    source_lang: str = Query("IT"),
    target_lang: str = Query("EN"),
):
    cache_key = f"{word}:{source_lang}:{target_lang}"
    if cache_key in _cache:
        return _cache[cache_key]

    result = {"word": word, "translation": None, "definitions": [], "phonetic": None, "examples": []}
    result["translation"] = await deepl_translate(word, source_lang, target_lang)
    _cache[cache_key] = result
    return result

@app.get("/translate-sentence")
async def translate_sentence(
    text: str = Query(...),
    source_lang: str = Query("IT"),
    target_lang: str = Query("EN"),
):
    translation = await deepl_translate(text, source_lang, target_lang)
    if translation is None:
        raise HTTPException(status_code=503, detail="Translation unavailable")
    return {"translation": translation}

# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@app.get("/stats")
async def get_stats(language: str = Query(None)):
    conn = get_db()
    c = conn.cursor()

    # Learning words count
    if language:
        c.execute("SELECT COUNT(*) as count FROM words WHERE language = ? AND status = 'learning'", (language.upper(),))
    else:
        c.execute("SELECT COUNT(*) as count FROM words WHERE status = 'learning'")
    words_learning = c.fetchone()["count"]

    c.execute("SELECT COUNT(*) as count FROM articles" + (" WHERE language = ?" if language else ""),
              (language.upper(),) if language else ())
    article_count = c.fetchone()["count"]

    c.execute("SELECT COUNT(*) as count FROM word_bank_entries WHERE exported_at IS NULL")
    pending_count = c.fetchone()["count"]

    c.execute("SELECT COUNT(*) as count FROM word_bank_entries WHERE exported_at IS NOT NULL")
    exported_count = c.fetchone()["count"]

    c.execute("SELECT total_words_read FROM reading_stats WHERE id = 1")
    row = c.fetchone()
    total_words_read = row["total_words_read"] if row else 0

    conn.close()
    return {
        "articles": article_count,
        "words_learning": words_learning,
        "word_bank_pending": pending_count,
        "word_bank_exported": exported_count,
        "total_words_read": total_words_read,
    }

@app.get("/health")
async def health():
    return {"status": "ok"}

# ---------------------------------------------------------------------------
# API Keys & external service settings
# ---------------------------------------------------------------------------

class ApiKeyUpdate(BaseModel):
    deepl_api_key: str

@app.get("/settings/api-keys")
async def get_api_keys():
    key = get_deepl_key()
    masked = ("•" * (len(key) - 4) + key[-4:]) if len(key) > 4 else ("•" * len(key))
    return {"deepl_configured": bool(key), "deepl_key_masked": masked if key else ""}

@app.post("/settings/api-keys")
async def set_api_keys(body: ApiKeyUpdate):
    save_config({"deepl_api_key": body.deepl_api_key.strip()})
    return {"saved": True}

@app.get("/settings/api-keys/test")
async def test_api_keys():
    result = await deepl_translate("ciao", "IT", "EN")
    if result:
        return {"ok": True, "test_translation": result}
    key = get_deepl_key()
    if not key:
        return {"ok": False, "error": "No API key configured"}
    return {"ok": False, "error": "Translation failed — check your key is valid and has quota remaining"}

# ---------------------------------------------------------------------------
# Lemmatizer (spaCy)
# ---------------------------------------------------------------------------

# Map Leggendo language codes to spaCy model names.
# Install models with: python -m spacy download <model>
# To add a language later: add its entry here and to config.ps1.
# Turkish (TR) is intentionally excluded: no spaCy model with a lemmatizer
# component is compatible with spaCy 3.7+. Turkish lookups go directly to
# TDK (the official Turkish dictionary) which handles inflected forms itself.
SPACY_MODELS: dict[str, str] = {
    "EN": "en_core_web_sm",
    "IT": "it_core_news_sm",
    "DE": "de_core_news_sm",
    "FR": "fr_core_news_sm",
    "ES": "es_core_news_sm",
}

_spacy_cache: dict = {}

# ---------------------------------------------------------------------------
# Turkish lemmatizer — zeyrek
# ---------------------------------------------------------------------------
# zeyrek is a pure-Python port of the Zemberek morphological analyzer.
# It has no spaCy dependency and works with any Python/spaCy version.
# Install with: pip install zeyrek

_zeyrek_analyzer = None

def get_zeyrek():
    """Load and cache the zeyrek MorphAnalyzer. Returns None if not installed."""
    global _zeyrek_analyzer
    if _zeyrek_analyzer is not None:
        return _zeyrek_analyzer
    try:
        import zeyrek
        _zeyrek_analyzer = zeyrek.MorphAnalyzer()
        return _zeyrek_analyzer
    except Exception as e:
        print(f"[zeyrek] Failed to load: {e}")
        return None

# ---------------------------------------------------------------------------
# Turkish morphology — zeyrek
# ---------------------------------------------------------------------------
# parse.morphemes is a clean list of English abbreviation strings, e.g.:
#   ['Noun', 'A3sg', 'P1sg']
#   ['Verb', 'Narr', 'A1pl']           ← evidential -mış
#   ['Adj', 'Become', 'Verb', 'Caus', 'Verb', 'FutPart', 'Adj']
#
# parse.formatted shows the IG structure (| = derivation boundary):
#   '[beyaz:Adj] beyaz:Adj | laş:Become→Verb | tır:Caus→Verb | acak:FutPart→Adj'
#
# We use parse.morphemes directly — no state-name parsing needed.
# parse.lemma  is the pre-derivation dictionary root (e.g. 'beyaz', not 'beyazlaş').

# Maps morpheme abbreviation -> (human label, category)
_TR_MORPHEME_MAP: dict[str, tuple[str | None, str]] = {
    # ------------------------------------------------------------------ POS
    'Noun':     ('Noun',            'POS'),
    'Verb':     ('Verb',            'POS'),
    'Adj':      ('Adjective',       'POS'),
    'Adv':      ('Adverb',          'POS'),
    'Pron':     ('Pronoun',         'POS'),
    'Num':      ('Numeral',         'POS'),
    'Postp':    ('Postposition',    'POS'),
    'Conj':     ('Conjunction',     'POS'),
    'Interj':   ('Interjection',    'POS'),
    'Ques':     ('Question Particle','POS'),
    'Punc':     ('Punctuation',     'POS'),
    'Det':      ('Determiner',      'POS'),
    'Prop':     ('Proper Noun',     'POS'),
    'Dup':      ('Duplicator',      'POS'),

    # ------------------------------------------------------------------ Agreement
    'A1sg':     ('1st Person Singular',  'Number'),
    'A2sg':     ('2nd Person Singular',  'Number'),
    'A3sg':     (None,                   'Number'),   # 3sg is unmarked, skip
    'A1pl':     ('1st Person Plural',    'Number'),
    'A2pl':     ('2nd Person Plural',    'Number'),
    'A3pl':     ('3rd Person Plural',    'Number'),

    # ------------------------------------------------------------------ Possession
    'P1sg':     ('1st Sing. Possessive', 'Possession'),
    'P2sg':     ('2nd Sing. Possessive', 'Possession'),
    'P3sg':     ('3rd Sing. Possessive', 'Possession'),
    'P1pl':     ('1st Pl. Possessive',   'Possession'),
    'P2pl':     ('2nd Pl. Possessive',   'Possession'),
    'P3pl':     ('3rd Pl. Possessive',   'Possession'),
    'Pnon':     (None,                   'Possession'),  # no possession, skip

    # ------------------------------------------------------------------ Case
    'Nom':      (None,          'Case'),   # nominative is unmarked, skip
    'Acc':      ('Accusative',  'Case'),
    'Dat':      ('Dative',      'Case'),
    'Loc':      ('Locative',    'Case'),
    'Abl':      ('Ablative',    'Case'),
    'Gen':      ('Genitive',    'Case'),
    'Ins':      ('Instrumental','Case'),
    'Equ':      ('Equative',    'Case'),

    # ------------------------------------------------------------------ Tense / Evidentiality
    'Past':     ('Past (-di)',              'Tense'),
    'Narr':     ('Evidential/Narrative (-miş)', 'Tense'),  # ← the mış tense
    'Pres':     ('Present',                'Tense'),
    'Fut':      ('Future (-ecek)',          'Tense'),
    'Aor':      ('Aorist (-ir/-er)',        'Tense'),

    # ------------------------------------------------------------------ Aspect / Progressive
    'Prog1':    ('Progressive (-iyor)',     'Aspect'),
    'Prog2':    ('Progressive (-mekte)',    'Aspect'),

    # ------------------------------------------------------------------ Mood
    'Imp':      ('Imperative',      'Mood'),
    'Opt':      ('Optative (-e)',   'Mood'),
    'Desr':     ('Desiderative (-se)', 'Mood'),
    'Cond':     ('Conditional (-se)', 'Mood'),
    'Necess':   ('Necessitative (-meli)', 'Mood'),

    # ------------------------------------------------------------------ Polarity
    'Neg':      ('Negative',    'Polarity'),
    'Pos':      (None,          'Polarity'),   # positive is default, skip

    # ------------------------------------------------------------------ Verb Form
    'Inf1':     ('Infinitive (-mek)',           'VerbForm'),
    'Inf2':     ('Verbal Noun (-me)',           'VerbForm'),
    'Inf3':     ('Verbal Noun (-iş)',           'VerbForm'),
    'PastPart': ('Past Participle (-dik)',      'VerbForm'),
    'FutPart':  ('Future Participle (-ecek)',   'VerbForm'),
    'PresPart': ('Present Participle (-en)',    'VerbForm'),
    'NarrPart': ('Evidential Participle (-miş)','VerbForm'),
    'AorPart':  ('Aorist Participle (-ir)',     'VerbForm'),
    'Ger1':     ('Gerund (-erek)',              'VerbForm'),
    'Ger2':     ('Gerund (-ince)',              'VerbForm'),
    'Ger3':     ('Gerund (-e ... -e)',          'VerbForm'),
    'Ger4':     ('Gerund (-eli)',               'VerbForm'),
    'Ger5':     ('Gerund (-ip)',                'VerbForm'),

    # ------------------------------------------------------------------ Voice
    'Pass':     ('Passive',     'Voice'),
    'Caus':     ('Causative',   'Voice'),
    'Reflex':   ('Reflexive',   'Voice'),
    'Recip':    ('Reciprocal',  'Voice'),

    # ------------------------------------------------------------------ Derivation
    # These mark a derivational boundary (new IG); lemma is the pre-derivation root.
    'Become':   ('Inchoative (-leş/-laş)',  'Derivation'),   # güzel → güzelleş
    'Acquire':  ('Acquire (-len/-lan)',     'Derivation'),   # ev → evlen
    'Ly':       ('Adverbial (-ce/-ca)',     'Derivation'),   # güzel → güzelce
    'With':     ('Relational (-li/-lı)',    'Derivation'),   # kitap → kitaplı
    'Without':  ('Privative (-siz/-sız)',   'Derivation'),   # kitap → kitapsız
    'Related':  ('Nominalization (-lik)',   'Derivation'),   # kitap → kitaplık
    'Agt':      ('Agentive (-ci/-cı)',      'Derivation'),   # kitap → kitapçı
    'Able':     ('Ability (-ebil/-abil)',   'Derivation'),   # git → gidebil
    'Almost':   ('Almost (-imtrak)',        'Derivation'),
    'Hastily':  ('Hastily (-iver)',         'Derivation'),
    'Since':    ('Since (-eli)',            'Derivation'),
    'Zero':     (None,                     'Derivation'),   # zero-deriv, silent
    'Cop':      (None,                     'Other'),        # copula bridge, silent
}

# Category display order
_TR_CAT_ORDER = ['POS', 'Tense', 'Aspect', 'Mood', 'Polarity',
                 'Number', 'Possession', 'Case', 'VerbForm', 'Voice', 'Derivation']

def get_turkish_lemma(word: str):
    """
    Return (root, morphemes_list, available).
    Uses parse.morphemes directly (clean English abbreviations from the docs).
    parse.lemma is the pre-derivation dictionary root.
    """
    try:
        analyzer = get_zeyrek()
        if analyzer is None:
            return word, None, False

        res = analyzer.analyze(word)
        if not res or not res[0]:
            return word, None, True

        parse = res[0][0]
        # parse.morphemes: ['Verb', 'Narr', 'A1pl'] etc.
        # parse.lemma: pre-derivation root (e.g. 'düşünmek', 'beyaz')
        return parse.lemma, list(parse.morphemes), True

    except Exception as e:
        print(f"[zeyrek] error: {e}")
        return word, None, False

def get_spacy_nlp(lang: str):
    """Load and cache a spaCy model. Returns None if not installed."""
    lang = lang.upper()
    if lang in _spacy_cache:
        return _spacy_cache[lang]
    model = SPACY_MODELS.get(lang)
    if not model:
        _spacy_cache[lang] = None
        return None
    try:
        import spacy
        # Note: do NOT disable "trainable_lemmatizer" or "lemmatizer" —
        # that is the component we actually need. Only skip heavy unused ones.
        nlp = spacy.load(model, disable=["parser", "ner", "senter"])
        _spacy_cache[lang] = nlp
        return nlp
    except Exception as e:
        print(f"[spaCy] Failed to load model '{model}' for lang '{lang}': {e}")
        _spacy_cache[lang] = None
        return None

@app.get("/lemmatize")
async def lemmatize(word: str = Query(...), lang: str = Query("IT")):
    first_word = word.strip().split()[0] if word.strip() else word
    lang = lang.upper()

    morph_data = []

    if lang == "TR":
        lemma, morphemes, available = get_turkish_lemma(first_word)

        if not available:
            return {
                "word": first_word, "lemma": first_word,
                "morphology": None, "changed": False,
                "available": False, "reason": "zeyrek not available",
            }

        if morphemes is None:
            return {
                "word": first_word, "lemma": lemma,
                "morphology": None,
                "changed": lemma.lower() != first_word.lower(),
                "available": True, "reason": None,
            }

        # morphemes is a clean list of English abbreviations per the zeyrek docs,
        # e.g. ['Verb', 'Narr', 'A1pl'] or ['Adj', 'Become', 'Verb', 'Caus', 'Verb', 'FutPart', 'Adj']
        # De-duplicate while preserving order.
        seen_m: set[str] = set()
        morphemes = [m for m in morphemes if not (m in seen_m or seen_m.add(m))]

        features: dict[str, str] = {}
        derivation_labels: list[str] = []

        for m in morphemes:
            entry = _TR_MORPHEME_MAP.get(m)
            if entry is None:
                continue
            label, category = entry
            if label is None:
                continue  # explicitly suppressed (A3sg, Nom, Pnon, Zero, Cop…)
            if category == 'Derivation':
                if not derivation_labels or derivation_labels[-1] != label:
                    derivation_labels.append(label)
                continue
            if category == 'Other':
                continue
            # Last-write wins per category (e.g. second POS after derivation replaces first)
            features[category] = label

        if derivation_labels:
            features['Derivation'] = ' → '.join(derivation_labels)

        # Emit tags in a fixed, readable order
        morph_data = [
            f"{cat}: {features[cat]}"
            for cat in _TR_CAT_ORDER
            if cat in features
        ]
    else:
        nlp = get_spacy_nlp(lang)

        if nlp is None:
            return {
                "word": first_word,
                "lemma": first_word,
                "available": False,
                "changed": False,
                "morphology": None
            }

        doc = nlp(first_word)
        token = doc[0]
        lemma = token.lemma_

        morph_dict = token.morph.to_dict()

        SPACY_MORPH_MAP = {

            # --- Number ---
            "Sing": "Singular",
            "Plur": "Plural",
            "Dual": "Dual",

            # --- Gender ---
            "Masc": "Masculine",
            "Fem": "Feminine",
            "Neut": "Neuter",
            "Com": "Common Gender",

            # --- Person ---
            "1": "1st Person",
            "2": "2nd Person",
            "3": "3rd Person",

            # --- Tense ---
            "Past": "Past",
            "Pres": "Present",
            "Fut": "Future",

            # --- Aspect ---
            "Imp": "Imperfective",
            "Perf": "Perfective",
            "Prog": "Progressive",
            "Hab": "Habitual",

            # --- Mood ---
            "Ind": "Indicative",
            "Sub": "Subjunctive",
            "Imp": "Imperative",
            "Cnd": "Conditional",
            "Opt": "Optative",

            # --- Verb Form ---
            "Fin": "Finite Verb",
            "Inf": "Infinitive",
            "Part": "Participle",
            "Ger": "Gerund",
            "Sup": "Supine",
            "Conv": "Converb",

            # --- Voice ---
            "Act": "Active",
            "Pass": "Passive",
            "Mid": "Middle",

            # --- Case ---
            "Nom": "Nominative",
            "Acc": "Accusative",
            "Dat": "Dative",
            "Gen": "Genitive",
            "Loc": "Locative",
            "Abl": "Ablative",
            "Voc": "Vocative",
            "Ins": "Instrumental",

            # --- Degree ---
            "Pos": "Positive",
            "Cmp": "Comparative",
            "Sup": "Superlative",

            # --- Definiteness ---
            "Def": "Definite",
            "Ind": "Indefinite",

            # --- Pronoun Type ---
            "Prs": "Personal Pronoun",
            "Rel": "Relative Pronoun",
            "Dem": "Demonstrative",
            "Int": "Interrogative",
            "Ind": "Indefinite Pronoun",
            "Tot": "Total",
            "Neg": "Negative Pronoun",

            # --- Determiner Type ---
            "Art": "Article",

            # --- Possession ---
            "Yes": "Possessive",
            "No": "Non-Possessive",

            # --- Polarity ---
            "Pos": "Positive",
            "Neg": "Negative",

            # --- Reflex ---
            "Yes": "Reflexive",

            # --- Abbreviation ---
            "Yes": "Abbreviation",

            # --- Foreign ---
            "Yes": "Foreign",

            # --- Typo ---
            "Yes": "Typo",

            # --- Animacy ---
            "Anim": "Animate",
            "Inan": "Inanimate",

            # --- Clusivity ---
            "In": "Inclusive",
            "Ex": "Exclusive",

            # --- Numeral Type ---
            "Card": "Cardinal",
            "Ord": "Ordinal",
            "Mult": "Multiplicative",
            "Frac": "Fraction",

            # --- Verb Politeness / Honorific ---
            "Form": "Formal",
            "Infm": "Informal",

            # --- Evidentiality ---
            "Evid": "Evidential",

            # --- Misc ---
            "Yes": "Yes",
            "No": "No",
        }

        morph_data = []

        for key, value in morph_dict.items():
            readable = SPACY_MORPH_MAP.get(value, value)
            morph_data.append(f"{key}: {readable}")

    readable_morph = " • ".join(morph_data) if morph_data else None

    return {
        "word": first_word,
        "lemma": lemma,
        "morphology": readable_morph,
        "changed": lemma.lower() != first_word.lower(),
        "available": True,
        "reason": None,
    }