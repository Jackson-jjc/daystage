# Day Stage

You’re the headliner. Give yourself a call sheet for an ordinary day or a whole week, then put it on your lock screen, desktop, or desk.

[Open the editor](https://jackson-jjc.github.io/daystage/#studio)

## Make your first poster

- **Daily** — Enter up to eight plans, then choose one of eleven poster designs. Start with the 10:00 library shift and add the 14:00 rehearsal. The Focus design has optional checkboxes in the editor and on paper.
- **Weekly** — Pick a week and enter up to fourteen plans across Monday–Sunday. Give each a day and an optional time. Several plans can share a day. The weekly layout shows days you leave open, too.
- Choose **Poster**, **Phone wallpaper**, or **Computer wallpaper** and download the PNG. Use your device’s wallpaper settings or print the file. Poster, phone and desktop exports measure 1080 × 1440, 1080 × 2340 and 2560 × 1440 pixels, respectively.

Drafts stay in the current browser. Switching between Daily and Weekly keeps the two sets of plans separate. The saved image shows the schedule at the moment of export. Edit the plan and export again when it changes.

## Why a call sheet?

When class ends, checking the time can also tell you where to go next. A performer gets a call sheet before a show. Day Stage lets you play yourself and make one for the library, band practice, or dinner with friends. You choose where to leave it and when to look.

In four online experiments on remembering a later action, people performed better on the task when they set an external cue. NICE’s ADHD guidance gives written instructions and reduced distractions as examples of adjustments to individual needs. These findings shaped the idea of a quiet, visible plan. Whether a Day Stage poster helps people remember their real-life plans is a question for user testing. [Gilbert’s experiments](https://pmc.ncbi.nlm.nih.gov/articles/PMC4448673/) · [NICE guidance](https://www.nice.org.uk/guidance/ng87/chapter/recommendations#terms-used-in-this-guideline)

## Run the editor

The published page is a self-contained HTML file. Download the repository and run the following in its root directory with Python 3 installed.

```sh
python -m http.server 8000
```

Open [the local studio](http://localhost:8000/#studio). Manual planning and PNG export work without a sign-in, model, or API key.

The optional Daily AI organizer uses the visitor’s OpenRouter authorization to request a free model. It produces a draft for the visitor to review. Speech recognition needs a supported browser and microphone permission. Optional image generation uses the visitor’s chosen API and may incur charges. Pasting or typing plans stays available.

## Check the weekly workflow

With Node.js, install Playwright and its Chromium browser, then run the browser check. It serves the page locally, works through the editor, and compares actual downloads with the preview PNGs. The script prints the output directory.

```sh
npm install --no-save playwright
npx playwright install chromium
node scripts/weekly-workflow-qa.cjs
```

