# Attendance Tracker

A class attendance tracker with Excel upload and WhatsApp message generator.

## Deploy to Vercel (Step-by-Step)

### Step 1 — Install Node.js (if you don't have it)
Download from https://nodejs.org and install.

### Step 2 — Set up the project locally
```bash
cd attendance-app
npm install
npm run build    # make sure it builds without errors
```

### Step 3 — Push to GitHub
1. Go to https://github.com and create a new repository (e.g. `attendance-tracker`)
2. Run these commands in the `attendance-app` folder:
```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/attendance-tracker.git
git push -u origin main
```

### Step 4 — Deploy on Vercel
1. Go to https://vercel.com and sign up / log in (free)
2. Click **"Add New Project"**
3. Click **"Import"** next to your `attendance-tracker` repository
4. Leave all settings as default — Vercel auto-detects Vite
5. Click **"Deploy"**
6. Done! You'll get a live URL like `attendance-tracker.vercel.app`

---

## Local Development
```bash
npm install
npm run dev
```
Then open http://localhost:5173

## How it works
- Upload any `.xlsx`, `.xls`, or `.csv` file with student data
- The app auto-detects Name, Roll No., and Reg No. columns
- The student list is saved in the browser (`localStorage`) — no re-upload needed
- Take attendance, then generate a WhatsApp message with absentees sorted by Roll No.
- Use "📂 New Class" to switch to a different class list
