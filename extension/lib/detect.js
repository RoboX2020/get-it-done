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
      return { current, total, confident: true };
    }

    const fraction = clean.match(/^(\d{1,3})\s*\/\s*(\d{1,3})$/);
    if (fraction) {
      const current = Number(fraction[1]);
      const total = Number(fraction[2]);
      if (validPair(current, total) && total > 1) return { current, total, confident: false };
    }

    const currentOnly = clean.match(/(?:question|problem|item|exercise)\s*#?\s*(\d{1,3})\b/i);
    if (currentOnly) {
      const current = Number(currentOnly[1]);
      if (current >= 1 && current <= 500) return { current, total: null, confident: false };
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
    if (/\b(incorrect|is-incorrect|not-correct|wrong)\b/i.test(value)) return "rejected";
    if (/\b(is-correct|answer-correct|submitted|is-submitted)\b/i.test(value)) return "accepted";
    if (/(^|[^a-z])correct([^a-z]|$)/i.test(value)) return "accepted";
    return null;
  }

  function completionFromText(text) {
    if (!text || typeof text !== "string") return null;
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean || clean.length > 120) return null;
    if (/\b(try again|incorrect|not quite|not yet|wrong answer)\b/i.test(clean)) return "rejected";
    if (/^(correct|that's correct|you are correct|submitted|answer submitted|response submitted|completed|nice work|well done)\b/i.test(clean)) {
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

  return {
    PLATFORMS,
    platformById,
    platformFromHost,
    platformFromSignals,
    findQuestion,
    completionFromClass,
    completionFromText,
    parseLinks,
  };
});
