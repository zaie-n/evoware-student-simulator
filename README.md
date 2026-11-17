# Liquid Handling Lab — Student Simulator

A browser-based educational simulator for teaching liquid-handling workflows, worktable setup, disposable-tip handling, and basic automation logic inspired by Tecan Freedom EVOware.

**Live simulator:** https://zaie-n.github.io/evoware-student-simulator/

## Using the simulator

Open the live site in a modern desktop browser. No installation, account, or backend is required.

The simulator includes:

- A configurable worktable with carriers and labware placement.
- Script commands for liquid handling, tip acquisition and disposal, loops, variables, and timers.
- A validation system with command-specific feedback.
- A visual simulation of the liquid-handling arm and mounted tips.
- Operator prompts that pause execution until **Continue** is selected, or cancel the run with **Abort**.
- Timers that run at 3× simulation speed.
- Sample-aware loop behavior, including partial final cycles when the sample count is not divisible by the number of mounted channels.
- Premade bead-cleanup teaching protocols.

## Project structure

| File | Purpose |
| --- | --- |
| `index.html` | Simulator interface and runtime |
| `validator.js` | Script and worktable validation |
| `worktable.js` | Worktable placement and movement logic |
| `tests/validator.test.js` | Validation regression tests |
| `tests/worktable.test.js` | Worktable movement tests |
| `tests/page-integration.test.js` | Interface integration and inline JavaScript checks |
| `.github/workflows/pages.yml` | GitHub Pages deployment |
| `.github/workflows/validator-tests.yml` | Automated regression checks |

## Running the tests locally

The project uses Node.js for its automated checks. From the repository root, run:

```bash
node --check validator.js
node --check worktable.js
node tests/validator.test.js
node tests/worktable.test.js
node tests/page-integration.test.js
```

The regression workflow runs these checks automatically when changes are pushed to `main` and for pull requests.

## Deployment

The site is published through GitHub Pages. Changes pushed to `main` trigger the deployment workflow. The workflow can also be started manually from the repository's Actions tab.

## Independence and trademarks

This is an independent educational project. It is not affiliated with, endorsed by, or produced by Tecan. Tecan, Freedom EVO, and EVOware are trademarks of their respective owner. Product and command terminology is used only to describe the subject matter of the educational simulation.

The project uses independently authored code and interface styling. It does not include Tecan software, source code, proprietary artwork, or executable instrument methods.

## Limitations

This simulator is for instruction only. It does not connect to a physical liquid handler and must not be used to control laboratory equipment or validate a real instrument protocol.
