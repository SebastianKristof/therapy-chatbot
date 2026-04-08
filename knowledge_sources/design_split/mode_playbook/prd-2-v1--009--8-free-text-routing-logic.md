---
source_doc: "prd-2-v1.md"
source_section: "8. Free-Text Routing Logic"
corpus: "mode_playbook"
rule_type: "playbook_rule"
mode: "any"
risk_category: "none"
priority: 74
include_in_generation: true
---

# 8. Free-Text Routing Logic

If the user types freely instead of selecting a mode, the assistant should infer intent and route gently.

---

## Example routing behavior

### User:
> “I’m exhausted today after yesterday’s session.”

### Assistant:
> “That sounds like a question about what you’re experiencing after session. I can help with that. Want to look at whether this seems like an ordinary post-session response or something you should take more seriously?”

This is good because it:
- validates
- identifies the mode
- gently structures the conversation

The assistant should do this lightly, not mechanically.

---
