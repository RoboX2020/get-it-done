# Get Done

Browser extension that flashes the next picture on your list when you finish a homework question.

Paste one image URL per question (5, 10, 45, …). A side panel sits on the left or right of the page. On Canvas, Pearson MyLab, Edfinity, and other sites, the next picture unlocks only after **the homework page** records that question as done—not when you click a button in Get Done.

## Install from GitHub (public)

### 1. Get the code

```bash
git clone https://github.com/RoboX2020/get-it-done.git
cd get-it-done
```

No Node.js required for the extension itself. Node is only needed if you want the local homework preview (optional).

### 2. Load the extension in Chrome or Edge

1. Open **Chrome** → `chrome://extensions` (or **Edge** → `edge://extensions`).
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select the **`extension`** folder inside the repo—the folder that contains `manifest.json`.

Pin **Get Done** on the toolbar.

### 3. Add your reward pictures

1. Click the Get Done icon.
2. Paste **one direct image link per line** (as many lines as you have questions).
3. Click **Save pictures**.

### 4. Do homework

Open your assignment on Canvas, Pearson, Edfinity, etc. The panel opens on the right by default.

| Action | How |
|--------|-----|
| Move panel | Drag the top bar |
| Resize | Drag the gold corner |
| Dock left/right | **Left** / **Right** in the footer |
| Show/hide | `Ctrl+Shift+.` (Windows/Linux) or `Cmd+Shift+.` (Mac) |

**Rewards:** As soon as the page shows the question is done (e.g. **Correct** after Check Answer), the next picture flashes. One picture per question, and each question pays only once—skipping blank or going back does not cheat the stack.

### 5. After updates

```bash
cd get-it-done
git pull
```

Then in `chrome://extensions`, click **Reload** on Get Done and refresh your homework tab.

---

## Pearson (MyLab / MathXL)

Pearson often labels problems with **dotted IDs** (e.g. `1.18.3`, `5.3`, `2.4`), not “Question 3 of 10”. Get Done tracks those IDs inside Pearson’s player iframe. Status should look like **Problem 1.18.3 on Pearson**. Use **Check Answer**; the picture flashes as soon as the page marks it correct.

---

## Firefox package

`extension/manifest.firefox.json` is the AMO variant: same code, but `background.scripts` instead of a service worker, plus the Gecko add-on ID. To build the Firefox upload, copy the extension folder, replace `manifest.json` with `manifest.firefox.json`, and zip.

## Optional: local demo (no real LMS)

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:8741](http://127.0.0.1:8741). Eight sample pictures are preloaded. Answer correctly, then press **Next**, to see the reward flash.

---

## Supported sites

Canvas (`instructure.com`, school Canvas domains), Pearson / MyLab / MathXL, Edfinity, Blackboard, Moodle, Brightspace, Schoology, McGraw Hill Connect, Cengage, WebAssign, ALEKS, WileyPLUS, Gradescope, Google Classroom, DeltaMath, WeBWorK, Khan Academy, and others.

On unknown domains, Get Done still looks for counters like “Question 3 of 10” or Pearson-style labels, including inside embedded frames. Use the toolbar popup → **Open panel** on any page.

Picture links and progress stay in your browser (`chrome.storage.local`). Nothing is uploaded.

---

## Tests

```bash
npm test
```
