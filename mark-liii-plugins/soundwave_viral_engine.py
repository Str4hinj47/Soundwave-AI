"""
Soundwave Viral Engine — Research-based viral scripts for YouTube Shorts 2026

Based on research:
- vidIQ 18 Viral Hooks (2026): Did you know, Have you heard, Only 1% know, 3 mistakes, You're doing X wrong, etc. [1](https://vidiq.com/blog/post/viral-video-hooks-youtube-shorts/)
- Opus.pro 13.5M clips analysis: Expertise/Authority hooks avg 6,706 views 5.9x more than story reading, 80% viral clips use captions [2](https://www.opus.pro/research/how-to-go-viral-youtube-shorts)
- Fluxnote 60+ ideas: Top formats — 'X things that exist but most don't know', 'Popular belief is wrong', 'You are doing X wrong' [3](https://fluxnote.io/guides/viral-youtube-shorts-ideas-2026)
- Kineclip 12 Best Niches 2026: finance, history, psychology, horror, true crime, motivation, did-you-know facts [4](https://kineclip.com/blog/best-niches-youtube-shorts-2026/)

This module provides viral script templates that Jarvis can use instead of generic motivational.
"""

PLUGIN = {
    "name": "soundwave_viral_engine",
    "description": "Viral research engine 2026 — generates scripts using proven hooks that get millions views: Did you know, Only 1% know, 3 mistakes, You're doing X wrong, psychology facts, dark facts, history. Based on 13.5M clips analysis Expertise/Authority hooks 6.7k avg views, 80% viral clips use captions. Use action=generate topic=psychology|facts|history|motivation|horror|finance|ai",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {"type": "STRING", "description": "generate, list_hooks, list_niches, guide, trending"},
            "topic": {"type": "STRING", "description": "Topic or niche: psychology, facts, history, motivation, horror, finance, ai, dark, mystery"},
            "style": {"type": "STRING", "description": "Hook style: curiosity, contrarian, stakes, listicle, direct, story"},
            "count": {"type": "INTEGER", "description": "Number of scripts to generate"}
        },
        "required": ["action"]
    }
}

# ── 6 Proven Hook Types (Kineclip research) ───────────────────────────────
HOOK_TYPES = {
    "curiosity_gap": {
        "name": "Curiosity Gap — open loop, delay answer",
        "psych": "Brain hates unclosed question, watches to close loop",
        "templates": [
            "The most powerful army in the ancient world was destroyed by something you can buy at a grocery store.",
            "There's one thing YouTube never tells creators about how the algorithm actually works.",
            "Have you heard about the world's loneliest toilet? It has over 16 million views for this hook alone.",
            "Did you know that {fact}? And the reason will shock you.",
            "I found a faceless channel with zero subscribers that gets 500,000 views per video. Here's how.",
        ],
        "examples": [
            "Did you know that this book is poisonous? — 22M+ views",
            "Did you know honey never spoils? 3000-year-old honey still edible",
        ]
    },
    "contrarian": {
        "name": "Contrarian Take — challenge common belief",
        "psych": "Disagreement = friction, friction stops scroll",
        "templates": [
            "Saving money is keeping you poor — and the math is not close.",
            "{popular_belief} is wrong. Here's the science.",
            "Everything you knew about {topic} is 100% WRONG!",
            "Why doing 100 crunches a day is a waste of your time.",
            "The 8 hours of sleep rule is a myth.",
        ]
    },
    "stakes_warning": {
        "name": "Stakes / Warning — gain or avoid",
        "psych": "Loss aversion stronger than curiosity",
        "templates": [
            "If you do this one thing in an argument, the other person has already stopped listening.",
            "Most creators kill their own Shorts in the first 2 seconds — here's exactly how.",
            "If you train five days a week and still see nothing, this is the reason.",
            "You're doing {everyday_thing} wrong, and it's costing you {result}.",
        ]
    },
    "listicle": {
        "name": "Listicle Promise — numbered payoff, clear finish line",
        "psych": "Sets expectation, viewer wants to reach end",
        "templates": [
            "Three habits that quietly rewire your brain in under a week.",
            "Top 3 shocking facts about {topic} you didn't know.",
            "5 things that exist but most people don't know about.",
            "The only 3 supplements actually backed by research.",
            "3 mistakes everyone makes about {topic} — doubles engagement.",
        ]
    },
    "direct_callout": {
        "name": "Direct Callout — name exact viewer",
        "psych": "Feels video is aimed at them specifically",
        "templates": [
            "If you {specific_trait}, this is for you.",
            "If you train five days a week and still see nothing, this is the reason.",
            "POV: Your Short finally hits 1M views — and it quietly damages your channel.",
            "You: {common_struggle}. Here's the fix.",
        ]
    },
    "story_cold_open": {
        "name": "Story Cold-Open — drop into tense middle",
        "psych": "Narrative momentum, fall in mid-scene",
        "templates": [
            "At 2 a.m. the call came from inside her own house — and the police had just left.",
            "I lost everything in one week. Here's what I did.",
            "The day I lost everything taught me the most important thing about money.",
            "She lived alone. Every night at 3:13 AM, footsteps in the attic.",
        ]
    }
}

# ── Viral Niches 2026 (ranked) ────────────────────────────────────────────
VIRAL_NICHES = {
    "psychology": {
        "why": "Exploded on Shorts — curiosity + value, high retention, faceless-friendly",
        "rpm": "mid-tier, sustainable",
        "hooks": ["Did you know", "3 psychological tricks", "Why people do X"],
        "facts": [
            "The Chameleon Effect: subtly mimicking someone's posture makes their brain see you as more trustworthy.",
            "If you do this one thing in an argument — say 'you always' — the other person has already stopped listening.",
            "Your brain has a negativity bias: it remembers one insult longer than ten compliments.",
            "People who swear more are often more honest — study in Language Sciences 2017.",
            "The Benjamin Franklin Effect: asking someone for a small favor makes them like you more, not less.",
            "Only 1% know this: mirroring someone's last 3 words makes them keep talking and feel heard.",
        ]
    },
    "facts": {
        "why": "Single surprising fact = natural hook, infinite source material, high shareability",
        "facts": [
            "Sharks are older than trees — 400 million vs 350 million years.",
            "Honey never spoils — archaeologists found 3000-year-old honey still edible.",
            "Cleopatra lived closer to the moon landing than to the building of the pyramids.",
            "Oxford University is older than the Aztec Empire — founded 1096 vs 1428.",
            "Octopuses have three hearts and blue blood — and nine brains.",
            "Wombat poop is cube-shaped — intestinal ridges form it.",
            "Your stomach gets a new lining every 3-4 days, otherwise acid would digest it.",
            "Scotland's national animal is a unicorn.",
            "Bananas are berries but strawberries are not — botanical classification.",
            "A group of flamingos is called a flamboyance.",
        ]
    },
    "history": {
        "why": "Single surprising story = natural hook, cinematic AI visuals work",
        "facts": [
            "The shortest war lasted 38 minutes — Anglo-Zanzibar War 1896.",
            "Ancient Romans used urine as mouthwash — ammonia cleaned teeth.",
            "The first computer programmer was a woman in the 1840s — Ada Lovelace.",
            "Samurai and cowboys existed at the same time — 1860s overlap.",
            "Nintendo was founded in 1889 as a playing card company.",
            "The oldest joke is from 1900 BC Sumer — it's a fart joke.",
        ]
    },
    "motivation": {
        "why": "High viral potential if not generic — needs specific, contrarian, story",
        "templates": [
            "Stop trying to be motivated. Motivation is weather. Discipline is climate. Weather changes daily. Climate stays.",
            "You don't need more time. You need less excuses. I did {unusual thing} every day for 7 days — here's what happened.",
            "The reason you're not growing has nothing to do with talent. It's this: you quit at 40% when you're actually at 40% of your limit.",
            "Three things I do before every failure: I expect it to be easy, I wait for perfect, I quit early. Stop doing them.",
        ]
    },
    "horror": {
        "why": "Tension = strongest retention tool, viewers watch to end and share",
        "templates": [
            "At 2:13 AM, she heard footsteps in the attic. She lived alone.",
            "The last message said 'Don't look behind you.' He laughed and turned around. Nothing. Then his phone buzzed again.",
            "They said the trail was closed for a reason. He didn't listen. Halfway in, the birds stopped singing.",
        ]
    },
    "finance": {
        "why": "Highest CPM $4.50, evergreen, Expert Explainer format works",
        "templates": [
            "The $100 rule that changed my life: If it costs less than $100, ask 'Will I use this 100 times?'",
            "Popular belief is wrong: Saving money is keeping you poor. Here's the science — inflation vs investing.",
            "I invested $100 into {asset}, 1-year update — shocked me.",
            "Three money habits that quietly rewire your brain in under a week.",
        ]
    },
    "ai": {
        "why": "Trending 2026 — AI mini-solutions, one tool one problem one result",
        "templates": [
            "This free AI tool is better than {paid alternative} — and takes 10 seconds.",
            "I asked 100 people about {topic}, AI answers shocked me.",
            "One AI prompt that gives you viral hooks: 'Write 10 hooks using curiosity gap for {topic}'",
            "AI just made {job} obsolete. Here's what to do instead.",
        ]
    }
}

# ── Viral Script Structure (4-beat spine) ─────────────────────────────────
SCRIPT_STRUCTURE = """
4-Beat Spine for 70%+ retention (GrowthOS research):
1. HOOK (0-2s): Bold claim or curiosity gap, pattern interrupt, no 'Hey guys'
   - Must pass 3-second muted test — show most interesting frame first
2. CONTEXT (3-10s): One insight, data-supported, reframe understanding
   - Use Expertise/Authority: 'Study in Current Biology 2018 found...'
3. PAYOFF (11-15s): Deliver value, visual proof, unexpected twist
4. LOOP/CTA (last 1s): Unresolved question or teaser, embedded CTA
   - 'Follow for Part 8' or 'Part 2 drops Thursday' or loop last line to first
   - Natural CTA: 'Follow for more tech that feels illegal but isn't' — beats 'like and subscribe'
"""

VIRAL_CHECKLIST = """
7 Non-Negotiables for Viral Shorts 2026 (from research):
1. Hook in 1.5 seconds or less — first frame = pattern interrupt
2. Bold on-screen text — TikTok style #8B5CF6 Montserrat 800 56px middle (you already have)
3. Captions in 80% of viral clips — you already burn them
4. Keep under 60 seconds — completion rate drops after idea outgrows runtime
5. Cut every dead second — no pauses, speak faster
6. End with unresolved question/teaser — drives replays, AVD past 100%
7. 3 Shorts/week minimum for 90 days — algorithm locks category then pushes
"""

def generate_viral_script(topic="psychology", style="curiosity_gap", seed=""):
    import random
    topic = (topic or "psychology").lower()
    # Find niche
    niche = None
    for k in VIRAL_NICHES:
        if k in topic or topic in k:
            niche = VIRAL_NICHES[k]
            break
    if not niche:
        if "fact" in topic or "did you know" in topic:
            niche = VIRAL_NICHES["facts"]
        elif "motiv" in topic:
            niche = VIRAL_NICHES["motivation"]
        elif "horror" in topic or "scary" in topic:
            niche = VIRAL_NICHES["horror"]
        elif "history" in topic:
            niche = VIRAL_NICHES["history"]
        elif "money" in topic or "finance" in topic:
            niche = VIRAL_NICHES["finance"]
        elif "ai" in topic:
            niche = VIRAL_NICHES["ai"]
        else:
            niche = VIRAL_NICHES["psychology"]

    facts = niche.get("facts") or niche.get("templates") or []
    if not facts:
        facts = VIRAL_NICHES["facts"]["facts"]

    # Pick hook type
    hook_data = HOOK_TYPES.get(style) or HOOK_TYPES["curiosity_gap"]
    hook_template = random.choice(hook_data["templates"])

    # Build script using viral structure
    fact = random.choice(facts)

    # Viral script examples based on niche
    if niche == VIRAL_NICHES["psychology"]:
        scripts = [
            f"Did you know that {fact.lower()} Most people never notice this, but once you see it, you can't unsee it. Here's how to use it today.",
            f"Only 1% know this psychology trick: {fact} Try it in your next conversation and watch what happens.",
            f"You're doing this wrong in every argument: {fact} The moment you say it, they've already stopped listening. Do this instead.",
            f"Three psychological tricks that feel illegal to know: One — {fact} Two — people remember how you made them feel, not what you said. Three — silence after a question makes them reveal more.",
        ]
    elif niche == VIRAL_NICHES["facts"]:
        scripts = [
            f"Did you know that {fact.lower()} I was today years old when I found this out. And it gets weirder.",
            f"Have you heard about {fact.lower()} Most people don't know this exists, but it's 100% true.",
            f"{fact} And that's just one of 5 things that sound fake but are real. Follow for Part 2.",
            f"Only 1% know that {fact.lower()} This is why textbooks don't teach it.",
        ]
    elif niche == VIRAL_NICHES["history"]:
        scripts = [
            f"Did you know that {fact.lower()} History class never taught you this because it's too wild.",
            f"The most powerful army in history was destroyed by something from a grocery store. {fact} Wait for it.",
            f"{fact} And that's why history is stranger than fiction. Part 2 drops tomorrow.",
        ]
    elif niche == VIRAL_NICHES["motivation"]:
        scripts = [
            f"Stop waiting for motivation. Motivation is weather, discipline is climate. {fact} Start today, not tomorrow.",
            f"I did {fact.lower()} every day for 7 days. Here's what happened — and why 99% quit at 40%.",
            f"You're doing motivation wrong. {fact} The person who wins isn't strongest, it's the one who doesn't quit at 40%.",
        ]
    elif niche == VIRAL_NICHES["finance"]:
        scripts = [
            f"Everything you knew about saving money is wrong. {fact} The math is not even close.",
            f"Only 1% know this money rule: {fact} It feels illegal but it's just math.",
            f"Three money mistakes keeping you poor: One — {fact} Two — you budget but don't track. Three — you save but don't invest.",
        ]
    else:
        scripts = [f"{hook_template} {fact} Follow for more {topic} that feels illegal to know."]

    import hashlib
    idx = int(hashlib.md5((topic+style+seed).encode()).hexdigest(), 16) % len(scripts)
    return scripts[idx]

def run(parameters, player=None, session_memory=None):
    action = (parameters.get("action") or "generate").lower()
    topic = parameters.get("topic") or "psychology"
    style = parameters.get("style") or "curiosity_gap"
    count = parameters.get("count") or 1

    if action == "guide":
        return f"""
# VIRAL SHORTS 2026 — Research-Based Guide for Jarvis

Based on 13.5M clips analysis + vidIQ 18 hooks + 60+ ideas

{SCRIPT_STRUCTURE}

{VIRAL_CHECKLIST}

## 6 Hook Types That Stop Scroll (71% decide in first 3 seconds):
{chr(10).join([f"- {k}: {v['name']} — {v['psych']}" for k,v in HOOK_TYPES.items()])}

## Top Niches 2026 Ranked:
{chr(10).join([f"- {k}: {v['why']}" for k,v in VIRAL_NICHES.items()])}

## How to generate viral script for Jarvis:
- Say: soundwave_viral_engine action=generate topic=psychology style=curiosity_gap
- Or: topic=facts style=listicle
- Or: topic=finance style=contrarian

## Example viral scripts:
Psychology: {generate_viral_script('psychology', 'curiosity_gap')}
Facts: {generate_viral_script('facts', 'curiosity_gap')}
History: {generate_viral_script('history', 'curiosity_gap')}
Finance: {generate_viral_script('finance', 'contrarian')}

## For yt_short_runner — new script engine:
The runner now should use soundwave_viral_engine to generate scripts instead of generic motivational templates. Call generate_viral_script(topic) to get hook-first script under 450 chars.

Data sources:
[1] vidIQ 18 Viral Hooks 2026 — 16M views hook 'Have you heard about world's loneliest toilet'
[2] Opus.pro 13.5M clips — Expertise hooks 6,706 avg views 5.9x more, 80% viral clips use captions
[3] Fluxnote 60+ ideas — formats 'X things most don't know', 'Popular belief is wrong'
[4] Kineclip 12 Best Niches 2026 — finance $4.50 CPM, psychology, horror, history
"""

    if action == "list_hooks":
        out = ["VIRAL HOOKS 2026 — 6 types that reliably work (71% decide in 3 seconds):"]
        for k,v in HOOK_TYPES.items():
            out.append(f"\n{k} — {v['name']}")
            out.append(f"  Psych: {v['psych']}")
            for t in v["templates"][:2]:
                out.append(f"  - {t}")
        return "\n".join(out)

    if action == "list_niches":
        out = ["BEST NICHES FOR YOUTUBE SHORTS 2026 (ranked):"]
        for k,v in VIRAL_NICHES.items():
            out.append(f"\n{k} — {v['why']}")
            for f in (v.get("facts") or v.get("templates") or [])[:2]:
                out.append(f"  - {f}")
        return "\n".join(out)

    if action == "trending":
        return """
TRENDING SEPT 2026 — What to make Shorts about:

Top niches by views/CPM:
- Entertainment/Pranks 32% of Shorts views (highest viral potential)
- Finance $4.50 CPM highest monetization — 'AI made X obsolete', '$100 rule'
- Psychology — dark psychology, Chameleon Effect, Benjamin Franklin Effect — mid RPM, sustainable, faceless
- History — single surprising fact = natural hook, cinematic AI visuals
- Horror/True Crime — tension = retention, watch to end
- AI tools — one tool one problem one result, show outcome first
- Motivation — only if contrarian/specific, not generic 'never give up'
- Did-you-know facts — one fact per video, lead with wow factor, visual comparison

Viral formats now:
1. 'I did [unusual thing] every day for 7 days'
2. '[Popular belief] is wrong. Here's science'
3. 'You are doing [everyday thing] wrong'
4. 'X things that exist but most don't know'
5. 'Only 1% know this'
6. 'POV: ...'
7. 'The [product/skill] that changed my life'

Best posting: 6-9 AM EST / 8-11 AM IST, 3 Shorts/week min for 90 days, title 30-50 chars curiosity language, 2-3 specific hashtags, pin comment 'Full breakdown in bio' = 12-18% long-form traffic.

Make it faceless: narration over minecraft parkour (you already have) + bold TikTok captions #8B5CF6 Montserrat 800 56px middle scale (you already have) + hook in first 1.5s.
"""

    if action == "generate":
        try:
            count = int(count)
        except:
            count = 1
        count = max(1, min(10, count))
        scripts = []
        for i in range(count):
            s = generate_viral_script(topic, style, seed=str(i))
            scripts.append(f"{i+1}. [{style} + {topic}] {s}")
        return "\n\n".join(scripts)

    return "Use action=generate|list_hooks|list_niches|trending|guide topic=psychology|facts|history|finance|ai style=curiosity_gap|contrarian|stakes_warning|listicle|direct_callout|story_cold_open"
