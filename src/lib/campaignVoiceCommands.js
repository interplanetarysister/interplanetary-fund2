// Natural-language campaign assistant grammar. Speech is descriptive data only:
// microphone text can never become code, provider authorization, or a publish
// action. Field extraction is deterministic so a detail is saved the moment it
// is spoken instead of requiring an exact phrase.

const SMALL = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

const FILLER = /^(?:(?:hi|hey|hello|ok|okay|so|well|um|uh|please|alexa)[,.\s]+)+/i;

const CATEGORIES = [
  ["medical", /\b(medical|surgery|hospital|treatment|cancer|illness|health|therapy|dialysis)\b/],
  ["emergency", /\b(emergency|urgent|fire|accident|flood|storm|crisis)\b/],
  ["education", /\b(school|tuition|college|student|classroom|teacher|scholarship)\b/],
  ["animals", /\b(animal|shelter|rescue|dog|cat|puppy|kitten|vet)\b/],
  ["memorial", /\b(memorial|funeral|in memory|passed away)\b/],
  ["business", /\b(business|shop|store|startup|studio)\b/],
  ["creative", /\b(film|album|music|book|art|theater|documentary)\b/],
  ["environment", /\b(climate|environment|garden|park|conservation|solar)\b/],
  ["community", /\b(community|neighborhood|town|village|youth|family)\b/],
];

function numberFromWords(value) {
  const tokens = String(value || "").toLowerCase().split(/[\s-]+/);
  let total = 0;
  let current = 0;
  let found = false;
  for (const token of tokens) {
    if (token in SMALL) { current += SMALL[token]; found = true; }
    else if (token === "hundred") { current = (current || 1) * 100; found = true; }
    else if (token === "thousand") { total += (current || 1) * 1000; current = 0; found = true; }
    else if (token === "million") { total += (current || 1) * 1000000; current = 0; found = true; }
  }
  return found ? total + current : null;
}

// Understands "$5,000", "5000 dollars", "5k", "five thousand", and
// "we need about twelve thousand to cover the surgery".
function findGoal(text) {
  const direct = text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)\s*(k|thousand)?/i);
  if (direct) {
    const value = Number(String(direct[1]).replaceAll(",", ""));
    if (Number.isFinite(value) && value > 0) return direct[2] ? value * 1000 : value;
  }
  const suffixed = text.match(/\b([\d,]+(?:\.\d{1,2})?)\s*(k|thousand|grand)\b/i);
  if (suffixed) {
    const value = Number(String(suffixed[1]).replaceAll(",", ""));
    if (Number.isFinite(value) && value > 0) return value * 1000;
  }
  const numeric = text.match(/\b(?:raise|raises|goal|target|budget|need|needs|hoping for|aiming for)\D{0,20}([\d,]+(?:\.\d{1,2})?)\b/i);
  if (numeric) {
    const value = Number(String(numeric[1]).replaceAll(",", ""));
    if (Number.isFinite(value) && value > 0) return value;
  }
  const spoken = spokenNumber(text);
  if (spoken > 0) return spoken;
  return 0;
}

// Finds "five hundred", "twelve thousand", "twenty five hundred" without
// letting an earlier word be swallowed by a greedy prefix.
function spokenNumber(text) {
  const tokens = String(text || "").toLowerCase().split(/\s+/).map((token) => token.replace(/[^a-z]/g, ""));
  for (let index = 0; index < tokens.length; index += 1) {
    const words = [];
    let next = index;
    while (next < tokens.length && words.length < 4 && tokens[next] in SMALL) {
      words.push(tokens[next]);
      next += 1;
    }
    if (!words.length) continue;
    const keyword = tokens[next];
    if (!["hundred", "thousand", "million"].includes(keyword)) continue;
    const value = numberFromWords([...words, keyword].join(" "));
    if (value && value > 0) return value;
  }
  return 0;
}

function categoryFor(text) {
  for (const [key, pattern] of CATEGORIES) if (pattern.test(text)) return key;
  return "";
}

function cleanFragment(value) {
  return String(value || "")
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\b(?:and|with|when|because|so that)\b[\s\S]*$/i, "")
    .replace(/[.,;:!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

// Every way a person says money out loud: "$5,000", "5k", "twelve thousand",
// "eight hundred dollars", "2 grand".
function stripSpokenMoney(value) {
  return String(value || "")
    .replace(/\$\s*[\d,]+(?:\.\d{1,2})?\s*(?:k|thousand|million|grand)?/gi, " ")
    .replace(/\b[\d,]+(?:\.\d{1,2})?\s*(?:k|thousand|million|grand)\b/gi, " ")
    .replace(/\b[\d,]+(?:\.\d{1,2})?\s*(?:dollars|bucks|usd)\b/gi, " ")
    .replace(/\b(?:[a-z]+[\s-]){1,3}(?:thousand|hundred|million)\b/gi, " ")
    .replace(/\b(?:dollars|bucks|usd)\b/gi, " ");
}

// Reduces a spoken sentence to the campaign purpose by removing the goal,
// title, location, and beneficiary clauses that became their own fields.
function purposeFrom(text, extracted) {
  let value = stripSpokenMoney(text);
  value = value.replace(/(?:call it|name it|title it|the title is|title is)\s+["“']?[^"”',;]{3,120}["”']?/i, " ");
  value = value.replace(/(?:,|\band\b)?\s*(?:we\s+(?:are|'re)\s+)?(?:based|located)\s+in[^.,;]*/i, " ");
  value = value.replace(/(?:,|\band\b)\s*(?:i|we)\s+(?:want|need|hope|plan|are trying|is trying)\s+to\s+(?:raise|collect|gather)\b[\s\S]*$/i, " ");
  value = value.replace(/\b(?:goal|target)\s*(?:is|of)\b[\s\S]*$/i, " ");
  value = value.replace(/\b(?:with|for)\s+an?\s+(?:goal|target)\b[\s\S]*$/i, " ");
  value = value.replace(/\b(?:to help|helping|to support|supporting|benefit(?:s|ing)?|in honor of|in memory of)\b[\s\S]*$/i, " ");
  value = value
    .replace(/^(?:i|we)\s*(?:'m|'re| am| are)\s+(?:trying|hoping|planning|wanting)?\s*to\s+(?:raise|collect|gather|fundraise)\s*(?:money|funds|support)?\s*(?:for|to)?\s*/i, "")
    .replace(/^(?:i|we)\s*(?:'m|'re| am| are)\s+(?:raising|collecting|gathering|fundraising)\s*(?:money|funds|support)?\s*(?:for|to)?\s*/i, "")
    .replace(/^(?:this campaign is|the campaign is|we need|i need|i want|we want)\s+(?:to\s+)?/i, "")
    .replace(/^(?:(?:for|about|to|of|the|a|an)\s+)+/i, "")
    .replace(/^(?:raise|raising|collect|collecting|gather|gathering|fundraise|fundraising)\s*(?:money|funds|support)?\s*(?:for|to)?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\s.,;:!?]+$/g, "");
  if (extracted?.title && value.toLowerCase().startsWith(extracted.title.toLowerCase())) {
    value = value.slice(extracted.title.length).replace(/^[\s,;:-]+/, "");
  }
  // A fragment with no real words is just a number or punctuation, not a purpose.
  if (!/[a-z]{3}/i.test(value)) return "";
  if (value.length < 8) return "";
  return value.slice(0, 400);
}

export function extractCampaignDetails(value) {
  const text = String(value || "").replace(FILLER, "").trim();
  if (!text) return {};
  const lower = text.toLowerCase();
  const out = {};

  const goal = findGoal(text);
  if (goal > 0) out.goal_amount = Math.round(goal);

  const title = text.match(/(?:call it|name it|title it|the title is|title is)\s+["“']?([^"”']{3,120})/i);
  if (title) {
    const cleaned = title[1]
      .split(/(?:,|;|\s+-\s+|\band\s+(?:we|i|our)\b|\bwe\s+(?:want|need|are)\b|\bi\s+(?:want|need|am)\b|\bso\s+that\b)/i)[0]
      .replace(/[.!?]+$/, "").trim();
    if (cleaned.length >= 3) out.title = cleaned.slice(0, 120);
  }

  const who = text.match(/\b(?:to help|helping|to support|supporting|benefit(?:s|ing)?|in honor of|in memory of)\s+([^.,;]{2,140})/i);
  let helpReason = "";
  if (who) {
    const [whoPart, ...reasonParts] = who[1].trim().split(/\s+with\s+/i);
    if (whoPart && !/^\s*[\d$]/.test(whoPart)) out.who_helping = cleanFragment(whoPart);
    const reason = reasonParts.join(" with ");
    if (reason && /[a-z]{3}/i.test(reason)) helpReason = cleanFragment(reason);
  }

  const location = text.match(/\b(?:based in|located in)\s+([\w .'’-]{2,40})/i);
  if (location) out.location = cleanFragment(location[1]);

  const tone = lower.match(/\b(urgent|heartfelt|hopeful|warm|grateful|professional|serious|joyful)\b/);
  if (tone) out.tone = tone[1];

  const category = categoryFor(lower);
  if (category) out.category = category;

  const purpose = purposeFrom(text, out) || helpReason;
  if (purpose) out.purpose = purpose;
  return out;
}

const REQUIRED = [
  { key: "purpose", test: (f) => String(f?.ai_profile?.primary_goal || "").trim(), ask: "What is the campaign raising money for?" },
  { key: "who_helping", test: (f) => String(f?.ai_profile?.who_helping || "").trim(), ask: "Who does this campaign help?" },
  { key: "goal_amount", test: (f) => Number(f?.goal_amount) > 0, ask: "What is your fundraising goal in dollars?" },
  { key: "title", test: (f) => String(f?.title || "").trim(), ask: "What should the campaign be titled, or say show five titles?" },
  { key: "story", test: (f) => String(f?.story || "").trim(), ask: "Say write my story when you want the story written." },
];

export function missingCampaignFields(form) {
  const source = form || {};
  return REQUIRED.filter((rule) => !rule.test(source)).map(({ key, ask }) => ({ key, ask }));
}

export function nextCampaignQuestion(form) {
  return missingCampaignFields(form)[0]?.ask || "";
}

// The spoken reply always confirms what was captured and names the single next
// detail needed, so a partially described campaign can be finished by voice.
export function spokenProgress(form, captured = {}) {
  const parts = [];
  if (captured.purpose) parts.push("campaign purpose");
  if (captured.who_helping) parts.push(`helping ${captured.who_helping}`);
  if (captured.goal_amount) parts.push(`goal of ${Number(captured.goal_amount).toLocaleString()} dollars`);
  if (captured.title) parts.push(`title ${captured.title}`);
  if (captured.location) parts.push(`based in ${captured.location}`);
  const lead = parts.length ? `Saved: ${parts.join(", ")}. ` : "Saved that detail. ";
  const missing = missingCampaignFields(form);
  if (!missing.length) {
    return `${lead}Everything I need is in place. Say write my story, or save as a draft.`;
  }
  const after = missing[1] ? ` After that I will ask: ${missing[1].ask}` : "";
  return `${lead}${missing[0].ask}${after}`;
}

// Deliberate command grammar: microphone text never becomes executable code,
// arbitrary agent tools, payment authorization, or a public-publish operation.
export function campaignVoiceCommand(value) {
  const text = String(value || "").trim().replace(/^alexa[,\s:]*/i, "").trim();
  const lower = text.toLowerCase().replace(/[.!?]+$/, "");
  if (/^(stop|cancel|stop speaking|be quiet|stop listening)$/.test(lower)) return { action: "stop" };
  if (/^(help|what can i say|what can you do)$/.test(lower)) return { action: "help" };
  if (/^(read|read back|read my campaign|review|review campaign|read it back)$/.test(lower)) return { action: "review" };
  if (/^(save|save draft|save as a draft|save (it|this|my campaign) as a draft|save my draft)$/.test(lower)) return { action: "save" };
  if (/^(generate|create|make)( me)? (an? |the )?(image|picture|photo|cover)( for (it|my campaign))?$/.test(lower)) return { action: "image" };
  if (/^(generate|create|make|write)( me)? (a |the |my )?story$/.test(lower)) return { action: "story" };
  if (/^(generate|create|make|show)( me)? (five |5 |some )?(titles|title ideas|title choices)$/.test(lower)) return { action: "titles" };
  const choice = lower.match(/^(?:use|choose|pick|select)(?: the)? (first|second|third|fourth|fifth|one|two|three|four|five|[1-5])(?: title| option| choice)?$/);
  if (choice) return { action: "choose", index: ({ first: 0, second: 1, third: 2, fourth: 3, fifth: 4, one: 0, two: 1, three: 2, four: 3, five: 4 })[choice[1]] ?? Number(choice[1]) - 1 };
  const goal = lower.match(/^(?:set|change|make)(?: the| my)? (?:goal|budget|target)(?: to| at| be)? \$?([\d,]+(?:\.\d{1,2})?)(?: dollars)?$/);
  if (goal) return { action: "goal", amount: Number(goal[1].replaceAll(",", "")) };
  const title = text.match(/^(?:set|change)(?: the| my)? title to (.+)$/i);
  if (title) return { action: "title", text: title[1].slice(0, 160) };
  return { action: "details", text };
}

export function initialVoiceBrief(text) {
  const extracted = extractCampaignDetails(text);
  return { purpose: extracted.purpose || String(text || "").slice(0, 400), goal: extracted.goal_amount || null };
}