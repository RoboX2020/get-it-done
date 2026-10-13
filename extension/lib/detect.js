(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.GetDone = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PLATFORMS = [
    { id: "canvas", name: "Canvas", host: /(^|\.)instructure\.com$|(^|\.)canvaslms\.com$|(^|\.)canvas\.[a-z0-9.-]+$/i },
    { id: "pearson", name: "Pearson", host: /pearson|mathxl|mylab|mastering/i },
    { id: "edfinity", name: "Edfinity", host: /(^|\.)edfinity\.com$/i },
    { id: "blackboard", name: "Blackboard", host: /blackboard|bbhosted/i },
    { id: "moodle", name: "Moodle", host: /moodle/i },
    { id: "brightspace", name: "Brightspace", host: /brightspace|desire2learn|(^|\.)d2l\./i },
    { id: "schoology", name: "Schoology", host: /schoology/i },
    { id: "mcgraw", name: "McGraw Hill", host: /mheducation|connectmath|mhcampus/i },
    { id: "cengage", name: "Cengage", host: /cengage/i },
    { id: "webassign", name: "WebAssign", host: /webassign/i },
    { id: "aleks", name: "ALEKS", host: /(^|\.)aleks\.com$/i },
    { id: "wiley", name: "WileyPLUS", host: /wileyplus|(^|\.)wiley\.com$/i },
    { id: "gradescope", name: "Gradescope", host: /gradescope/i },
    { id: "classroom", name: "Google Classroom", host: /(^|\.)classroom\.google\.com$/i },
    { id: "deltamath", name: "DeltaMath", host: /deltamath/i },
    { id: "webwork", name: "WeBWorK", host: /webwork/i },
    { id: "myopenmath", name: "MyOpenMath", host: /myopenmath|lumenlearning/i },
    { id: "ixl", name: "IXL", host: /(^|\.)ixl\.com$/i },
    { id: "khan", name: "Khan Academy", host: /khanacademy/i },
    { id: "knewton", name: "Knewton", host: /knewton/i },
    { id: "zybooks", name: "zyBooks", host: /zybooks/i },
    { id: "hawkes", name: "Hawkes Learning", host: /hawkeslearning/i },
    { id: "tophat", name: "Top Hat", host: /(^|\.)tophat\.com$/i },
    { id: "edpuzzle", name: "Edpuzzle", host: /edpuzzle/i },
    { id: "commonlit", name: "CommonLit", host: /commonlit/i },
    { id: "savvas", name: "Savvas", host: /savvas/i },
    { id: "hmh", name: "HMH", host: /hmhco/i },
    { id: "apex", name: "Apex", host: /apexlearning|apexvs/i },
    { id: "edgenuity", name: "Edgenuity", host: /edgenuity/i },
    { id: "edmentum", name: "Edmentum", host: /edmentum|(^|\.)plato\.com$/i },
    { id: "formative", name: "Formative", host: /formative\.com|goformative/i },
    { id: "quizizz", name: "Quizizz", host: /quizizz|wayground/i },
    { id: "nearpod", name: "Nearpod", host: /nearpod/i },
    { id: "carnegie", name: "Carnegie Learning", host: /carnegielearning/i },
    { id: "assistments", name: "ASSISTments", host: /assistments/i },
    { id: "mathspace", name: "Mathspace", host: /mathspace/i },
    { id: "itslearning", name: "itslearning", host: /itslearning/i },
    { id: "agilix", name: "Buzz", host: /agilixbuzz/i },
    { id: "expertta", name: "Expert TA", host: /theexpertta/i },
    { id: "aktiv", name: "Aktiv", host: /(^|\.)aktiv\.com$/i },
  ];

  const SIGNAL_RULES = [
    ["canvas", /instructure|ic-app|canvas-lms/i],
    ["pearson", /pearson|mathxl|mylab/i],
    ["edfinity", /edfinity/i],
    ["blackboard", /blackboard/i],
    ["moodle", /moodle/i],
    ["brightspace", /brightspace|desire2learn|\bd2l\b/i],
    ["schoology", /schoology/i],
    ["mcgraw", /mheducation|connect\.mheducation/i],
    ["webassign", /webassign/i],
    ["cengage", /cengage/i],
    ["aleks", /aleks/i],
    ["wiley", /wileyplus/i],
    ["gradescope", /gradescope/i],
    ["deltamath", /deltamath/i],
    ["khan", /khanacademy/i],
    ["zybooks", /zybooks/i],
  ];

  function platformById(id) {
    if (!id) return null;
    const key = String(id).toLowerCase();
    return PLATFORMS.find((platform) => platform.id === key || platform.name.toLowerCase() === key) || null;
  }

  function platformFromHost(hostname) {
    if (!hostname) return null;
    const host = String(hostname).toLowerCase();
    return PLATFORMS.find((platform) => platform.host.test(host)) || null;
  }

  function platformFromSignals(blob) {
    if (!blob) return null;
    for (const [id, rule] of SIGNAL_RULES) {
      if (rule.test(blob)) return platformById(id);
    }
    return null;
  }

  function validPair(current, total) {
    return current >= 1 && total >= 1 && total <= 500 && current <= total;
  }

  const SLUG_BODY = String.raw`\d{1,2}\.\d{1,3}(?:\.\d{1,3})?`;

  function validSlug(slug) {
    if (!slug || typeof slug !== "string") return false;
    const parts = slug.split(".");
    if (parts.length < 2 || parts.length > 3) return false;
    return parts.every((part) => /^\d{1,3}$/.test(part));
  }

  function numericQuestion(current, total, confident) {
    const key = String(current);
    return {
      key,
      label: key,
      index: current,
      current,
      total,
      confident,
      kind: "numeric",
    };
  }

  function slugQuestion(slug, confident) {
    return {
      key: slug,
      label: slug,
      index: null,
      current: null,
      total: null,
      confident,
      kind: "slug",
    };
  }

  function findQuestionSlug(text) {
    if (!text || typeof text !== "string") return null;
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean || clean.length > 180) return null;

    const labeled = [
      new RegExp(String.raw`(?:question|problem|item|exercise|part)\s*#?\s*(${SLUG_BODY})\b`, "i"),
      new RegExp(String.raw`\bQ\s*(${SLUG_BODY})\b`, "i"),
    ];
    for (const pattern of labeled) {
      const match = clean.match(pattern);
      if (!match || !validSlug(match[1])) continue;
      return slugQuestion(match[1], true);
    }

    if (clean.length <= 28 && validSlug(clean)) return slugQuestion(clean, true);

    if (clean.length <= 64) {
      const tokens = clean.match(new RegExp(String.raw`\b${SLUG_BODY}\b`, "g"));
      if (tokens && tokens.length === 1 && validSlug(tokens[0])) return slugQuestion(tokens[0], false);
    }

    return null;
  }

  function findQuestion(text) {
    if (!text || typeof text !== "string") return null;
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean || clean.length > 180) return null;

    const labeled = [
      /(?:question|problem|item|exercise|part)\s*#?\s*(\d{1,3})\s*(?:of|\/|\|)\s*(\d{1,3})/i,
      /(\d{1,3})\s*(?:of|\/)\s*(\d{1,3})\s*(?:questions|problems|items|exercises)/i,
      /\bQ\s*(\d{1,3})\s*(?:of|\/)\s*(\d{1,3})\b/i,
    ];

    for (const pattern of labeled) {
      const match = clean.match(pattern);
      if (!match) continue;
      const current = Number(match[1]);
      const total = Number(match[2]);
      if (!validPair(current, total)) return null;
      return numericQuestion(current, total, true);
    }

    if (clean.length <= 48) {
      const ofPair = clean.match(/\b(\d{1,3})\s+of\s+(\d{1,3})\b/i);
      if (ofPair) {
        const current = Number(ofPair[1]);
        const total = Number(ofPair[2]);
        if (validPair(current, total)) return numericQuestion(current, total, false);
      }
    }

    const fraction = clean.match(/^(\d{1,3})\s*\/\s*(\d{1,3})$/);
    if (fraction) {
      const current = Number(fraction[1]);
      const total = Number(fraction[2]);
      if (validPair(current, total) && total > 1) return numericQuestion(current, total, false);
    }

    const slugHit = findQuestionSlug(text);
    if (slugHit) return slugHit;

    const currentOnly = clean.match(/(?:question|problem|item|exercise)\s*#?\s*(\d{1,3})(?!\.\d)\b/i);
    if (currentOnly) {
      const current = Number(currentOnly[1]);
      if (current >= 1 && current <= 500) return numericQuestion(current, null, false);
    }

    return null;
  }

  function cleanLink(piece) {
    let value = String(piece || "").trim();
    if (!value) return null;
    value = value.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "");
    const embedded = value.match(/https?:\/\/[^\s<>"']+/i);
    if (embedded) {
      value = embedded[0];
    } else {
      const bare = value.match(/[a-z0-9.-]+\.[a-z]{2,}\/[^\s<>"']+/i);
      if (bare && /\.(png|jpe?g|gif|webp|avif|svg|bmp)(\?|#|$)/i.test(bare[0])) {
        value = "https://" + bare[0];
      }
    }
    value = value.replace(/[)\].,>'"]+$/, "");
    if (value.length > 2000) return null;
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      return url.href;
    } catch (error) {
      return null;
    }
  }

  function completionFromClass(className) {
    const value = String(className || "");
    if (/\b(incorrect|is-incorrect|not-correct|wrong|partial-credit|partialcredit)\b/i.test(value)) {
      return "rejected";
    }
    if (/\b(is-correct|answer-correct|submitted|is-submitted|correct-feedback|feedback-correct|result-correct)\b/i.test(value)) {
      return "accepted";
    }
    if (/(^|[^a-z])correct([^a-z]|$)/i.test(value)) return "accepted";
    return null;
  }

  function completionFromText(text) {
    if (!text || typeof text !== "string") return null;
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean || clean.length > 120) return null;
    if (/\b(try again|incorrect|not quite|not yet|wrong answer|partially correct|partial credit)\b/i.test(clean)) {
      return "rejected";
    }
    if (
      /^(correct|that's correct|you are correct|you're correct|submitted|answer submitted|response submitted|completed|nice work|well done|good job|nice job|great job|you got it|got it right|that's right|you are right|you're right|fully correct|all correct)\b/i.test(
        clean,
      )
    ) {
      return "accepted";
    }
    return null;
  }

  function parseLinks(text) {
    if (!text || typeof text !== "string") return [];
    const urls = [];
    const lines = text.split(/[\n\r]+/);
    for (const line of lines) {
      const pieces = line.split(",");
      for (const piece of pieces) {
        const url = cleanLink(piece);
        if (url) urls.push(url);
      }
    }
    return urls;
  }

  // Stable short hash of a question stem. Used when a site's question labels are random or missing.
  function fingerprint(text) {
    const clean = String(text || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 160);
    if (clean.length < 20) return null;
    let h = 2166136261;
    for (let i = 0; i < clean.length; i += 1) {
      h ^= clean.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return "fp:" + h.toString(36);
  }

  // Does this page belong to the assignment the user pasted? Same site, and the page path
  // either sits under the pasted path or carries all of its long numeric ids.
  function assignmentMatches(pageHref, assignUrl) {
    if (!assignUrl) return true;
    let page, link;
    try {
      page = new URL(pageHref);
      link = new URL(assignUrl);
    } catch (error) {
      return false;
    }
    if (page.hostname.toLowerCase() !== link.hostname.toLowerCase()) return false;
    const lp = link.pathname.replace(/\/+$/, "");
    const pp = page.pathname.replace(/\/+$/, "");
    const rest = pp + page.search + page.hash;
    const ids = (lp + link.search + link.hash).match(/\d{3,}/g) || [];
    if (ids.length) return ids.every((id) => rest.includes(id));
    if (lp && lp !== "") return pp === lp || pp.startsWith(lp + "/");
    return true;
  }

  return {
    fingerprint,
    assignmentMatches,
    PLATFORMS,
    platformById,
    platformFromHost,
    platformFromSignals,
    findQuestion,
    findQuestionSlug,
    validSlug,
    completionFromClass,
    completionFromText,
    parseLinks,
  };
});
