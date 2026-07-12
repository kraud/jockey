# Foundational Principles of Game Design
*Use these classic frameworks and industry-standard guidelines to evaluate, stress-test, and refine game mechanics during the planning phases.*

---

## 1. The MDA Framework (Hunicke, LeBlanc, Zubek)
A game is a system that translates developer intent into player experience. It must be designed from both perspectives:
- **Mechanics:** The hard rules, data structures, card actions, and turn constraints (the code/tabletop rulebook).
- **Dynamics:** The emergent behaviors that happen when players interact with the mechanics over time (e.g., players hoarding cards, bluffing, rushing the win condition).
- **Aesthetics:** The emotional response invoked in the player (e.g., Fellowship via multiplayer interaction, Challenge via tactical decision-making, Drama via close matches).

> **Agent Directive:** When the user suggests a *Mechanic*, analyze what *Dynamic* it will create. Ensure that dynamic supports the intended emotional *Aesthetic*.

---

## 2. The Four Layers of Tabletop Rules
Because this card game can exist physically or digitally, the rules architecture must be mapped across four distinct buckets to ensure nothing is overlooked:
1. **Structural Rules:** The high-level shape of the game. Victory conditions, tie-breakers, turn order, and structural limits (e.g., maximum hand size).
2. **Setup Rules:** The initial state of the system. Starting hand sizes, deck compositions, resource initialization, and who goes first.
3. **Regular Play Rules:** The permitted actions a player can take on a standard turn, resource costs, and step-by-step turn phases (e.g., Draw -> Action -> Discard).
4. **Exceptions:** How specific cards or unique conditions break the global structural rules (e.g., "This card allows you to hold 8 cards instead of 5").

---

## 3. Critical Design Traps to Avoid

### The Dominant Strategy Problem (Nash Equilibrium Trap)
If players discover one specific combination of cards or path to victory that is mathematically superior to all others, the game becomes solved, and all other strategic choices become meaningless.
- **Agent Guardrail:** Look for feedback loops where winning allows a player to accumulate resources faster, creating an unstoppable "snowball effect." Ensure catch-up mechanics or counter-play vectors exist.

### Imperfect Information & Transparency
Games of "imperfect information" (where some data is hidden, like a player's hand) rely on psychology, bluffing, and risk assessment. 
- **Agent Guardrail:** Clearly define what state is *Global public* (visible to all), *Local private* (visible only to the owner), and *System hidden* (in the deck/shuffled). Changing who sees what information is a powerful lever for turning a dry mathematical game into a tense psychological one.

### Loss Aversion & Friction Points
Psychology shows that humans experience the pain of losing something roughly twice as intensely as the joy of gaining the exact same thing. 
- **Agent Guardrail:** If a card mechanic involves stealing or destroying an opponent's resources, ensure it requires high commitment, can be anticipated, or offers a minor consolidation prize to prevent severe player frustration.

### Meaningful Choice (Sid Meier's Law)
A game is a series of interesting choices. A choice is not interesting if one option is obviously correct, if the outcome is completely random, or if the player doesn't have enough context to make an informed decision.
- **Agent Guardrail:** When designing player turns, ensure choices balance short-term survival against long-term victory goals.
