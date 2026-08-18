# Delta Product Specification

## Core Philosophy

The learning environment is designed around absolute focus and momentum. It operates more like a continuous feed than a traditional dashboard. The user is never managing their progress; they are only ever answering the single question in front of them.

### Principles

1. **Zero setup.** No level selection, no course upload, no format choice. The only decision the user makes is selecting the certification/topic they want to prep for.
2. **One primary action per screen.** Every screen has exactly one obvious next action. There are no menus, and no lateral navigation.
3. **No navigation during learning.** The system feeds the user what they need to know next. The loop loops back on itself automatically. The user never asks "what do I do now."
4. **Never assume mastery—verify it.** We don't take a user's word that they know something. The "I know this" action instantly triggers a "Prove to Skip" verification check. Nobody gets credit without proof.

## Core Flow

### Part 1: Onboarding
- **Screen 1 (The only decision):** A search box with an autocomplete list of certifications. The user taps one. This is the entire input surface of the product.
- **Screen 2 (Building your prep plan):** A 10–30s loading state. The backend pulls the blueprint, sources content per objective, tags freshness, and generates the first practice set. No choices here, just a status screen.
- **Screen 3 (Drop into the loop):** The user lands directly on the first objective. No dashboard tours, no settings prompt.

### Part 2: The Loop
- **Learn Card:** One objective at a time. Curated excerpt/clip, freshness badge, and citation link.
  - *Moving forward:* "Mark as done" happens automatically when they've engaged with the content, seamlessly loading the quick check.
  - *Prove to Skip:* Users can skip the Learn Card, but doing so drops them into the Quick Check. Passing it moves them forward. Failing it drops them back to the Learn Card.
- **Quick Check:** 2–3 questions in the exam's native format, inline with the learning material. If wrong, recovery plan content surfaces inline.
- **Readiness Updates:** A persistent, always-visible score (Coverage + Freshness + Practice). It ticks up in place.
- **Automatic Progression:** The next objective loads automatically. There is no "next" button when you are mid-flow.
- **Freshness Changes:** Passive banners (e.g. `[+] 2 topics updated`) surface inline if the blueprint changes.
- **Mock Exam:** Automatically unlocks when readiness crosses the target threshold, appearing as an inline banner.
