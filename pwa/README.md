# Get Done phone app (PWA)

A small installable web app for phones: your deck, a friend link, and an "I finished a question" button.
Works in Chrome and Safari on Android and iPhone. Static files only, hosted free on Cloudflare Workers.

    ./prepare-assets.sh      # fonts and icons from ../extension
    npx wrangler deploy      # serves ./public as the worker "get-done-app"

It talks to the friend-link service in ../friend-worker (same links, same pictures). Progress stays in the phone's local storage.
