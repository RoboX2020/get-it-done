# Get Done privacy policy

 Applies to extension version 1.1.0.

Get Done reveals images you choose as rewards when a homework page records a completed question and you move to the next question.

## Information handled on your device

Get Done reads question labels and completion signals from the current page and embedded frames. It watches relevant page changes and interactions to detect when to reveal a reward. It stores your image links, reward count, panel size and position, and site-specific visibility preferences in local browser storage. Per-site question and completion state may also be held in the page's session storage. These are used only for the homework reward feature.

The extension does not send homework-page text, answers, reward progress, or browsing history to any server. It has no analytics, advertisements, or account system. The only data that reaches a developer-operated server is what a friend uploads through an optional friend link, described below.

## Friend links (optional, off unless you create a link)

Version 1.1.0 lets you create a link that friends can open to add pictures to your reward deck. If you never create a link, none of this applies.

What is stored on our server (a free Cloudflare Workers and D1 database): the link, the assignment name and question count you set, an optional due time, and whatever a friend uploads through the link. That is the picture, plus an optional first name and an optional short note the friend chooses to type. We do not collect friends' accounts, emails, or tracking data. Pictures are served only from long random addresses.

How it is used: the extension asks the server for new uploads and adds them to your deck at random positions. Pictures are not screened or reviewed by the developer. You can delete any unlocked picture from the extension popup. Deleting it removes it from your deck and from the server.

Retention: uploads are kept until you delete them, or until you remove the friend link. After the due time you set, the link stops accepting uploads. The extension keeps a private owner key in local storage to read and delete uploads for your link. It is never shown to friends.

Friends should only upload pictures they have the right to share. To report or remove a picture, contact us through the address below.

## Image requests

Images are loaded directly from URLs you enter. Get Done may preload upcoming images. The image host receives a normal network request, including your IP address and ordinary browser request information. Image elements use a no-referrer policy. Third-party image hosts have their own privacy practices; use image sources you trust. Avoid image URLs containing private tokens or personal information.

## Retention and control

You can edit or clear the image list and reset reward progress through the extension. Local data remains until changed or cleared. Uninstalling the extension removes its extension storage. Per-site session storage ends with the page session. No developer has remote access to this local data through Get Done.

## Permissions

Local storage keeps your settings, progress, and friend-link settings. Network access to the friend-link service lets the extension fetch and delete uploads for your own link. Access to web pages and embedded frames lets Get Done find question/completion signals across school-specific and custom homework domains and display the reward panel. The extension does not solve questions or submit answers.

## Contact

Support and privacy questions: https://github.com/RoboX2020/get-it-done/issues
