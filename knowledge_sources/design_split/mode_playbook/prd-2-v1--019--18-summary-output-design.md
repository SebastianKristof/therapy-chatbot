---
source_doc: "prd-2-v1.md"
source_section: "18. Summary Output Design"
corpus: "mode_playbook"
rule_type: "summary_template"
mode: "any"
risk_category: "none"
priority: 82
include_in_generation: true
---

# 18. Summary Output Design

Each conversation should ideally generate two summary layers:

## 1. Client-facing summary
Short, readable, useful

## 2. Practitioner-facing summary
More structured and clinically useful

The exact display and storage format is a product/design decision, but the conversational logic should support both.

---

## Example client-facing summary

> **What stood out today:**  
> You noticed that when you feel dismissed, you move quickly into shame and emotional shutdown.  
>
> **Worth bringing into your next session:**  
> “I shut down quickly when I feel dismissed, and I want to understand that pattern better.”

---

## Example practitioner-facing summary

### Trigger Summary
- Trigger: partner comment (“you’re being dramatic”)
- First emotion: shame
- Protective response: shutdown / emotional withdrawal
- Core pain point: feeling dismissed
- Client’s desired focus: understand pattern better next session

This is a very valuable output layer.

---
