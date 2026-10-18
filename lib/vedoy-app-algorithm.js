/**
 * Vedoy App Algorithm v0.1
 * Transparent, deterministic ranking. No health/finance/private-vault inputs.
 * Use ONLY with explicitly consented public-forum interaction signals.
 * All "not interested" exclusions are applied before ranking.
 */
"use strict";
const SIGNAL_WEIGHTS = Object.freeze({
  view: 0.15, dwell: 1.5, like: 4, comment: 5, save: 3, share: 3, follow: 5,
  not_interested: -100
});
const MAX_DWELL_SECONDS = 45;
const MAX_EVENTS_PER_POST_PER_DAY = 20;
const MS_DAY = 86400000;
function safeTags(value) {
  return Array.isArray(value) ? value.filter(x => typeof x === "string").map(x=>x.trim().toLowerCase()).filter(Boolean).slice(0, 20) : [];
}
function deriveInterests(events = [], now = Date.now()) {
  const scores = new Map();
  const ordered = [...events].filter(e => e && typeof e === "object").sort((a,b)=>Date.parse(b.occurred_at||0)-Date.parse(a.occurred_at||0));
  const seen = new Map();
  for (const e of ordered) {
    const age = Math.max(0, (now-Date.parse(e.occurred_at || 0)) / MS_DAY);
    if (!Number.isFinite(age) || age > 30) continue;
    const key = String(e.post_id) + ":" + new Date(e.occurred_at).toISOString().slice(0,10);
    const count = seen.get(key)||0;
    if (count >= MAX_EVENTS_PER_POST_PER_DAY) continue;
    seen.set(key,count+1);
    if (e.event_type === "not_interested") continue; // handled as hard exclusions
    let weight = SIGNAL_WEIGHTS[e.event_type] || 0;
    if (e.event_type === "dwell") weight *= Math.min(MAX_DWELL_SECONDS, Math.max(0, Number(e.dwell_seconds)||0))/MAX_DWELL_SECONDS;
    const decay = Math.exp(-age / 14);
    for (const tag of safeTags(e.tags)) scores.set(tag, (scores.get(tag)||0) + weight*decay);
  }
  return scores;
}
function rankForYou(posts = [], context = {}) {
  const now = Number.isFinite(context.now) ? context.now : Date.now();
  const follows = new Set(safeTags(context.followedTags));
  const blocked = new Set((context.notInterestedPostIds || []).map(String));
  const hiddenTags = new Set(safeTags(context.hiddenTags));
  const affinity = deriveInterests(context.events || [], now);
  return posts.filter(p => p && p.moderation_status === "approved")
    .filter(p => !blocked.has(String(p.id)))
    .filter(p => !safeTags(p.tags).some(t => hiddenTags.has(t)))
    .map(p => {
      const tags = safeTags(p.tags);
      const ageDays = Math.max(0,(now-Date.parse(p.created_at || 0))/MS_DAY);
      const recency = Number.isFinite(ageDays) ? 3 * Math.exp(-ageDays/7) : 0;
      const interest = tags.reduce((n,t)=>n+(follows.has(t)?5:0)+Math.min(8,affinity.get(t)||0),0);
      const popularity = Math.min(3,Math.log1p(Math.max(0,Number(p.upvotes)||0)));
      const score = interest + recency + popularity;
      return {...p, score, why: tags.filter(t=>follows.has(t)||affinity.has(t)).slice(0,3)};
    })
    .sort((a,b) => b.score - a.score || Date.parse(b.created_at||0)-Date.parse(a.created_at||0));
}
if (typeof module !== "undefined") module.exports={SIGNAL_WEIGHTS,deriveInterests,rankForYou};
