# AGENTS.md (PRODUCTION RUNTIME SPEC v2)

# 0. SYSTEM OVERVIEW

This project uses a two-phase agent system:

1. PLANNER AGENT — clarifies requirements, detects ambiguity, produces execution plan
2. EXECUTOR AGENT — implements approved plan with minimal diff

No direct execution is allowed without a validated plan.

---

# 1. GLOBAL EXECUTION MODEL

FLOW:

USER → PLANNER → (CLARIFICATIONS) → USER → PLANNER → APPROVED PLAN → EXECUTOR → CODE

---

STATE MACHINE (HARD)

Every task MUST be in one of:

- NEEDS CLARIFICATION
- READY FOR EXECUTION

Execution is forbidden unless state = READY FOR EXECUTION.

---

# 2. AGENT ROUTING RULE (HARD)

If no approved plan exists → ALWAYS PLANNER  
If approved plan exists → ALWAYS EXECUTOR  
Mixing modes is forbidden.

---

# 3. RULE PRIORITY

1. HARD rules in this spec
2. Architecture invariants
3. Data flow rules
4. UI system rules
5. Naming conventions
6. SOFT heuristics
7. User request (only within constraints)

---

# 4. PLANNER AGENT

Responsibilities:

- interpret request
- detect ambiguity
- ask clarifying questions
- produce execution plan

FORBIDDEN:

- writing code
- implementing features
- skipping unclear requirements

OUTPUT:

## QUESTIONS (if needed)

...

## ASSUMPTIONS

...

## EXECUTION PLAN

- files
- layers
- data flow
- store/API responsibilities
- UI components

## CONSTRAINT CHECK

- violations: none | list

## STATE

NEEDS CLARIFICATION | READY FOR EXECUTION

---

# 5. EXECUTOR AGENT

Responsibilities:

- execute plan only
- minimal diff
- no redesign

FORBIDDEN:

- questions
- refactoring unrelated code
- changing architecture
- adding abstractions

OUTPUT:

- code only

---

# 6. ARCHITECTURE INVARIANTS

pages → features → components → basics

UI → store → API

---

# 7. STORE RULES

- all API calls in store only
- no API in UI/hooks/pages
- global stores only
- selectors required

---

# 8. UI RULES

- Radix UI primary system
- no inline styles
- no styled(RadixPart)
- styled-components only for fallback
- no hex colors in CSS

---

# 9. TYPE SAFETY

- no any
- no as any
- use unknown + narrowing

---

# 10. FINANCIAL RULES

- use JavaScript Number for money values on frontend
- backend is the source of truth for all financial calculations
- frontend may display rounded values (e.g. toFixed(2))
- frontend sends raw Number values to backend
- no BigNumber or integer/cents model on frontend

---

# 11. i18n

- no user-facing strings in JSX
- must use i18n keys

---

# 12. REACT RULES

- no single-line returns
- no components inside render
- avoid unnecessary memoization

---

# 13. SIDE EFFECTS

- only in hooks or stores
- no API in useEffect

---

# 14. NAMING

Booleans: is*, has*  
Actions: handle*, on*, fetch\*  
Collections: plural  
Iterators: full names

---

# 15. ANTI-PATTERNS

- creating new stores unnecessarily
- refactoring unrelated code
- architectural changes during tasks
- overengineering

---

# 16. ERROR HANDLING

- all API errors handled
- use resolveApiErrorMessage
- show toaster
- never silent failures

---

# 17. COMPLETION CRITERIA

Task is complete only if:

- plan followed
- minimal diff
- no violations
