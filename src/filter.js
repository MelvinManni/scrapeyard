import { fetch } from 'undici';

// Apply a natural-language filter prompt to a list of result items.
// If ANTHROPIC_API_KEY is set, uses Claude. Otherwise falls back to keyword
// inclusion/exclusion heuristics derived from the prompt.
export async function applyFilter({ prompt, items }) {
  if (!prompt || !items.length) return { items, mode: 'noop' };

  const key = process.env.ANTHROPIC_API_KEY;
  if (key) {
    try {
      return await llmFilter({ prompt, items, key });
    } catch (e) {
      console.warn('[filter] llm failed, falling back:', e.message);
    }
  }
  return heuristicFilter({ prompt, items });
}

async function llmFilter({ prompt, items, key }) {
  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

  // Compact payload — only what the model needs to decide.
  const compact = items.map((r, i) => ({
    i,
    title: r.title,
    source: r.source,
    snippet: (r.snippet || '').slice(0, 240),
  }));

  const sys = `You filter news results against a user instruction. Return ONLY JSON of the form {"keep":[<indices>]} — no prose, no markdown. Include an index iff the item satisfies the instruction.`;
  const user = `Instruction: ${prompt}\n\nItems:\n${JSON.stringify(compact)}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: sys,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = (data.content?.[0]?.text || '').trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('no json in response');
  const parsed = JSON.parse(match[0]);
  const keep = new Set(parsed.keep || []);
  return { items: items.filter((_, i) => keep.has(i)), mode: 'llm' };
}

// Without an LLM, only honor explicit exclusions — keyword inclusions are too
// strict for natural-language prompts and would silently drop everything.
function heuristicFilter({ prompt, items }) {
  const p = prompt.toLowerCase();
  const stop = new Set(['the','and','that','those','these','this','rumors','rumor']);
  const excludes = [];
  for (const m of p.matchAll(/\b(?:skip|exclude|without|except|no\s+)\s*([a-z][\w-]{3,30}(?:\s+[a-z][\w-]{3,30})?)/g)) {
    for (const w of m[1].trim().split(/\s+/)) {
      if (w.length >= 4 && !stop.has(w)) excludes.push(w);
    }
  }
  if (!excludes.length) return { items, mode: 'heuristic-noop' };
  const filtered = items.filter(r => {
    const hay = `${r.title} ${r.snippet || ''} ${r.source || ''}`.toLowerCase();
    return !excludes.some(w => hay.includes(w));
  });
  return { items: filtered, mode: 'heuristic' };
}
