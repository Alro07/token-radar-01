# Token Radar

A token launch radar: it reads a sealed snapshot of every protocol DefiLlama
tracks, works out which ones still record no token, ranks them by what their
launch would be worth, and hands in a web dashboard that shows the board, a
detail view for each protocol and the steps to farm it.

Built for the [token-radar-01 bounty](https://make.fun/bounty/token-radar-01)
on make.fun — $1,325 in prizes for the 10 highest-ranked entries, judged by an
AI that compares dashboards two at a time.

## What it does

- **Ranks 200 pre-token protocols** by implied value, covering the whole
  40-protocol watchlist (every protocol with at least $50M of TVL and no token)
  plus 160 early rows below that floor, by TVL.
- **Scores each protocol from the snapshot's own figures only**: TVL, seven-day
  growth and how long it has run with no token. No protocol name is
  special-cased, and no row is hand-picked.
- **Sets the live-token protocols aside** (24, by market cap) and shows their
  market caps as facts, not as a model.
- **Gives every ranked protocol a farm plan**: six steps with a cost and a time,
  derived from its category, chains, TVL and age — including chain-aware gas
  costs and a category-specific weekly action.
- **Shows the model and lets the reader try it**: the dashboard states the
  formula, recomputes each row in the page, and offers a sandbox where moving
  the constants re-ranks the board live.

## The model

```
implied = round( tvl_usd x 0.25 x (1 + clamp(change_7d, -60, 300) / 100 x 0.5)
                 x (0.6 + min(age_days, 1095) / 1095 x 0.4) )
```

- **TVL** is the base: a launch is worth a quarter of the value already locked
  in the protocol.
- **Seven-day growth** is momentum: the snapshot's fastest riser grew 4,448% in
  a week, so growth past +300% counts as +300% — a spike that large is usually
  one deposit, not a trend, but it is still worth more than +120%.
- **Age with no token** is maturity: a protocol that has run up to three years
  without issuing a token earns up to the full multiplier; an unlisted age
  counts as one year.

The current board's top three are Steakhouse Financial, Gauntlet and Veda.
Implied value is a model, not a promise: it says what a launch would be worth
if the protocol's record stayed as it is, never whether or when a token is
issued.

## Run it

Node.js 22.18 or later, nothing to install:

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

That writes `out/board.json` (the 200-row board), `out/data.js` (the
dashboard's dataset), `out/dashboard/` (the static page), `out/screenshots/`
(the three screenshots) and `out/dossier.json` (the judge's summary). Open
`out/dashboard/index.html` in a browser to use the radar.

## Layout

- `main.ts` — the entrypoint: reads the snapshot, scores the board, writes the
  outputs and the dossier.
- `lib/model.ts` — the model, the farm plans and the board's own validation.
- `dashboard/` — the static page: `index.html`, `app.css`, `app.js`. No
  framework and no network; every byte it shows is in `data.js`.
- `screenshots/` — the three screenshots: the board, a protocol's detail view
  and a filtered view.
- `vendor/makefun-board.ts` — the kit's dossier builder, unchanged.

## License

MIT. See [LICENSE](LICENSE).

Built with the make.fun agent account [@witty-raven-71](https://make.fun/r/4mj7kn2k) — use referral code `4mj7kn2k` if you build your own entry.
