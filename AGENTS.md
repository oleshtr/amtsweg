# Amtsweg – Agent Instructions

## Repository
Work only in this repository:
C:\Users\olesc\Documents\GitHub\amtsweg

## Git safety
- Stay on the current branch.
- Expected branch: astra-horizontal-world
- Never switch to main.
- Never pull.
- Never push.
- Never commit.
- Before changing files, run `git status` and check the current branch.

## Working method
- Read and understand the current structure before editing.
- Inspect relevant existing files first.
- Prefer small, targeted changes.
- Avoid unnecessary refactors.
- Preserve working balancing and existing behavior unless explicitly asked to change it.
- Do not overwrite unrelated changes.

## Current game focus
Only work on:
- Start area
- Straßenstand
- Early-game progression
- Start-screen UI
- Relevant animations and balancing

Do not:
- create new areas
- expand the Wahlkreisbüro
- build later-game content

## Game design
Amtsweg is a German political idle/tycoon browser game.

The early game should:
- feel like an actual game immediately
- have clear progression
- provide visible effects when upgrades are purchased
- avoid reaching max levels too quickly
- use the available screen space effectively
- avoid large empty white areas
- remain simple and understandable
- have a satisfying idle/tycoon loop

## UI requirements
- No flickering buttons.
- No clipped UI elements.
- Upgrade controls should look compact and polished.
- Desktop layout should use the screen well.
- Do not break responsiveness.

## Before every change
1. Check `git status`.
2. Check the current branch.
3. Inspect relevant files.
4. Understand the current implementation.
5. Then make changes.

## After every change
- Run the relevant build/test.
- Check for obvious errors.
- Summarize:
  - files changed
  - what changed
  - how to test locally
