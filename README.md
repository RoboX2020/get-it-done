# Get Done

A browser extension that flashes the next picture on your list every time you finish a homework question.

Paste one image link per question — 5, 10, or 45. Get Done sits in a window on the left or right of the page. On Canvas, Pearson, Edfinity, and other homework sites, the next picture flashes only after that page records the question as done.

## Try it here

```bash
npm install
npm run dev
```

Open the homework preview at [http://127.0.0.1:8741](http://127.0.0.1:8741). Eight pictures are already queued. Pick an answer and press Check answer. A wrong try leaves the picture sealed. After the page shows Correct, press Next and the side window flashes the next picture. Drag the top bar to move it, pull the gold corner to resize, and use Left or Right to dock it.

Skipping ahead does not reveal a picture. Going back does not either.

## Install the extension

Chrome and Edge:

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Click Load unpacked and choose the `extension` folder in this project.
4. Pin Get Done.

Click the toolbar icon to paste picture links before you start. On a recognized homework site the panel opens on the right. `Ctrl+Shift+Period` (`Command+Shift+Period` on Mac) shows or hides it.

The badge on the icon is how many pictures are left.

## What it watches

The panel opens on sites it recognizes, including Canvas (including school `instructure.com` domains), Pearson and MyLab, Edfinity, Blackboard, Moodle, Brightspace, Schoology, McGraw Hill Connect, Cengage, WebAssign, ALEKS, WileyPLUS, Gradescope, Google Classroom, DeltaMath, WeBWorK, Khan Academy, and others.

On a school domain it does not know by name, it still looks for a question counter such as “Question 3 of 10”, “Problem 4/12”, or “Item 2 of 8”, including counters inside embedded frames. You can also open the panel on any page from the toolbar icon.

A picture flashes only after the page records the question. That means a Correct, Submitted, or completed mark, or — on sites that save as you leave — an answer already filled in when their own Next or Submit moves you on. A blank skip does not count. Get Done has no button that reveals the next picture. Landing on a question, refreshing, or going backward does not either.

Links stay in the browser. Nothing is uploaded.

## Checks

```bash
npm test
```
