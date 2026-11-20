# Nate Puangpanbut: Quantitative Research Portfolio

**Live site → [suraporn.github.io/quant](https://suraporn.github.io/quant/)**

This is my portfolio as a quantitative researcher. It centers on **QuadBreak**, a multi-strategy algorithmic trading system for gold (XAUUSD). QuadBreak runs on MQL5 and was researched on a tick-level backtesting engine I built in Python.

## What's on the site

It's a single page:

- **QuadBreak:** what the system is, plus simulated out-of-sample results. The specific strategies and parameters are kept private.
- **Process:** the validation pipeline every idea must pass. That means pre-registration, a train-only fit, a 12-condition cost and latency battery, out-of-sample checks, lookahead and random-twin tests, independent re-implementation, and a portfolio test at matched drawdown.
- **Research workflow:** the experiment register, and how I use LLM coding agents to run research.
- **Version history, experience, skills, education**, plus a downloadable résumé.

My other portfolios:
- **Data science:** [suraporn.github.io/ds](https://suraporn.github.io/ds/)
- **Controls and automation:** [suraporn.github.io/controls](https://suraporn.github.io/controls/)

## Built with

Plain HTML and CSS, with no build step. It's hosted free on GitHub Pages.

```
home.html         The whole site (single page)
index.html        Redirects to home.html
style.css         Styles
images/           Profile photo, favicon
files/resume.pdf  Downloadable résumé
```

## Run it locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Updating

- **Update the résumé:** replace `files/resume.pdf`, then bump the `?v=` number on its links in `home.html`.
- **Style changes:** after editing `style.css`, bump the `?v=` number in its link.

## Contact

nate.puangpanbut@gmail.com · [LinkedIn](https://www.linkedin.com/in/suraporn/)
