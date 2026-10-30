# The German Lab: React version

The same website as `germanlab-app`, rebuilt with a **React frontend** and a **Django (Python) backend** that provides a JSON API. Students practise words, quizzes, Goethe-style speaking tasks (recorded and scored by you), grammar and your videos. Students request access and you approve them.

| Part | Technology |
|---|---|
| Frontend | React 18, React Router 6, built with Vite 5 (folder `frontend/`) |
| Backend | Python, Django 5.2, JSON API (folder `api/`) |
| Database | SQLite on your laptop; PostgreSQL when online |
| Sign-in | Django sessions (secure cookie) with CSRF protection |

---

## 1. Run it on your Windows computer

You need **Python 3.10+**. **Node.js is only needed if you change the React code**: the finished app is already built into `static/app/`.

```bash
cd "D:\Learn German\germanlab-react"
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python manage.py migrate
python manage.py seed_content
python manage.py createteacher
python manage.py runserver
```

Open <http://127.0.0.1:8000> and sign in.

**Every time after that:**
```bash
.venv\Scripts\activate
python manage.py runserver
```

This is a separate copy with its **own database**. Accounts and progress from `germanlab-app` are not in it, so create your teacher account again here.

---

## 2. Changing the React code (frontend)

You need Node.js 18 or newer (<https://nodejs.org>). In a **second** terminal:

```bash
cd "D:\Learn German\germanlab-react\frontend"
npm install          # only the first time
npm run dev          # live editing at http://localhost:5173
```

Keep `python manage.py runserver` running in the first terminal; the dev server passes API calls on to Django. Changes to files in `frontend/src` appear in the browser immediately.

When you're happy, build the finished app, which Django then serves on port 8000:

```bash
npm run build
```

---

## 3. How the code is organised

```
germanlab-react/
├── frontend/                    React app
│   ├── src/main.jsx             starts the app
│   ├── src/App.jsx              all page addresses (routes)
│   ├── src/lib/api.js           talks to the Django API (cookies + CSRF)
│   ├── src/lib/session.jsx      who is signed in
│   ├── src/lib/hooks.js         useApi() for loading data, useTitle()
│   ├── src/components/          Layout (menus), Recorder, Icon, Toasts, form fields
│   ├── src/pages/public/        start page, sign in, request access, password reset
│   ├── src/pages/student/       Today, Words, Study, Practice, Speaking, Grammar, Videos, Progress
│   ├── src/pages/teacher/       Overview, Requests, Students, Classes, Videos, Speaking answers, content/ (Content editor)
│   └── src/styles/              the design system, split by topic:
│       ├── index.css            loads the files below in order
│       ├── base.css             colours, fonts, spacing, grid paper
│       ├── layout.css           sidebar, tab bar, page headers
│       ├── components.css       buttons, forms, lists, badges, messages…
│       ├── pages/               public, study, speaking, teacher, content
│       └── motion.css           shared animations, "reduce motion"
├── api/                         Django JSON API
│   ├── urls.py                  every API address
│   ├── views_auth.py            sign in/out, request access, passwords, level
│   ├── views_student.py         words, quizzes, speaking, grammar, videos, progress
│   ├── views_teacher.py         approvals, students, classes, videos, speaking feedback
│   ├── views_content.py         editing words, quiz questions, grammar, speaking tasks
│   ├── serializers.py           database objects → JSON
│   └── spa.py                   serves the built React app for every page address
├── accounts/ content/ learning/ the database models and learning logic (same as before)
├── static/app/                  the built React app (made by `npm run build`)
├── tests/                       101 automated API tests
└── notebooks/                   Jupyter notebook (progress tables, CSV word import)
```

**How a page loads:** the browser opens e.g. `/words`; Django sends the React app; React asks `/api/decks/` for the data and draws the page. Every rule (who may see what, quiz marking, scores) is checked in Python on the server; React only displays.

**Content** (`/teacher/content`) is where you edit everything students learn: word lists (each word saves itself when you leave the row, and you can paste many words at once), quiz questions with a live preview, grammar topics with an editable table, and speaking tasks. Django's built-in admin (`/admin/`) is still there as an advanced editor, for example to add a new level.

**Your sections** (the last tab of Content) are parts of the course you build yourself, like "Basics of A1": a section has lessons, and a lesson is built from blocks (text, table, word list, tip box, sound tiles, sound rules, spelling example, three kinds of exercises, "spell your name", a video, a speaking task). Lessons start as drafts; students of that level see a section in their menu under "From your teacher" once it has a published lesson. When a student has answered every exercise of a lesson it counts as done, and you see it on their student page. **Course content comes from the teacher's Google Drive** (A1 / PDF / Lektion01 … Lektion23). Each lesson becomes a section with its goals, its parts, its exercises, its 20 new words (a word list in Words) and its homework; Lektion 1 and 2 are in `content/course_a1.py`, with three small mistakes of the slides corrected. `python manage.py migrate` adds them; on a new database run `python manage.py add_a1_course` after `seed_content`. The older section "Basics of A1" (from another book) is kept but hidden; delete it under Content → Your sections if you no longer want it.

---

## Levels (A1, A2)

- Students choose their level when they request access. You confirm or change it when approving.
- A student sees **their level and the levels below it**, never a higher one: an A1 student only gets A1, an A2 student gets A2 and can revise A1. The server refuses links to higher levels.
- Move a student up on their page in **Students**. Students without a level (from before this change) can still open every level until you set one.
- Every **class** has a level; a student can only be in a class of their own level.
- Every **video** needs a level; videos without one are hidden from students.

---

## 4. Tests

```bash
python manage.py test tests --settings=config.settings.test
```

101 tests cover sign-in and CSRF protection, limits on sign-in, registration and password-reset attempts, request access and approval, teacher-only access, flashcard rules, quiz marking (answers are never sent to the browser before you answer), speaking answers (one per task, file checks, who can listen, scoring, deletion 3 days after feedback), video uploads and private streaming, classes, students, password reset, the content editor (teacher only, word import, question rules, grammar tables, speaking tasks, deleting a question while students are in a quiz), that the admin's "View on site" links open the right page, the production security headers, the "practise my mistakes" quiz, the progress calendar and grammar-topic scores, that pages stay fast as students practise more (no extra database queries per quiz or word), and that every page address serves the app, and the teacher's sections (block checks, drafts, levels, scores).

---

## 5. Putting it online

Same as the Django version, plus the built frontend is included automatically:

1. `pip install -r requirements-prod.txt`
2. Set `DJANGO_SETTINGS_MODULE=config.settings.prod`, a new `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`, and the `POSTGRES_*` values.
3. `python manage.py migrate`, `seed_content`, `collectstatic`, `createteacher`
4. Start with `gunicorn config.wsgi`.

Run `npm run build` before uploading if you changed the React code.

---

## 6. Known limits

- No real email yet: password-reset links appear in the `runserver` window.
- Pronunciation uses the browser's German voice, which varies by device.
- Recording in the browser needs microphone permission, and HTTPS once online.
- Sign-in is limited: after 5 wrong passwords for one email (or 20 from one connection) sign-in waits 15 minutes. Registration and password-reset requests are limited the same way. The counters live in Django's cache, which is per process: with several gunicorn workers, configure a shared cache (for example Django's database cache) so the limits are counted together.
- Fonts are part of the built app (no requests to Google). Online, the site sends a Content-Security-Policy (see `config/settings/prod.py`); if you embed something new, add its address there.
- HSTS is off until you set `DJANGO_HSTS_SECONDS` (e.g. `31536000`). Turn it on once HTTPS works, because browsers remember it.
