# Backtesting Without Fooling Yourself

*A moving-average strategy on NSE large caps, tested on data it had never seen.*

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/dhilaan12/nse-backtester/blob/main/nse_backtester.ipynb)

A backtest of the classic 20/50-day moving-average crossover on RELIANCE, TCS and HDFCBANK, built to answer one question: **if a strategy looks good on past data, does it still work on data it has never seen?**

Spoiler: it didn't beat buy-and-hold. Finding out why was the point, and this repo is about how I tested it and about all the ways I could have fooled myself instead.

## The result in 30 seconds

- The strategy **did not beat buy-and-hold on return**, on any of the three stocks, once trading costs were included.
- It **did cut the worst losses** (maximum drawdown) in the 2024-26 test period, by 14 to 16 percentage points on all three stocks.
- The settings I picked on 2020-23 data scored a Sharpe ratio of **0.52 in training and 0.15 or lower on unseen 2024-26 data**. That gap is overfitting, and I caught it on my own project.

## Out-of-sample results (2024 to Nov 2026, windows 30/100)

| Stock | Strategy | CAGR | Sharpe | Max drawdown |
|---|---|---|---|---|
| HDFCBANK | Buy & hold | -0.9% | 0.06 | -31.7% |
| HDFCBANK | MA crossover | -4.5% | -0.25 | **-17.7%** |
| RELIANCE | Buy & hold | 1.3% | 0.17 | -27.2% |
| RELIANCE | MA crossover | 1.1% | 0.15 | **-16.7%** |
| TCS | Buy & hold | -11.2% | -0.36 | -53.4% |
| TCS | MA crossover | -11.1% | -0.81 | **-36.7%** |

![Test period results](test_period_results.png)

*The flat orange stretches are the strategy sitting in cash. On HDFC Bank it missed most of the 2025 rally. On TCS it dodged part of the fall.*

## Three more charts

**The whole period, with the train/test split marked.** The dashed line is where the test period begins.

![Equity curves with the split marked](images/equity_curves_split.png)

**Drawdowns in the test period.** How far each version sat below its previous peak. Shallower is better.

![Drawdowns in the test period](images/drawdowns_test.png)

**Overfitting, side by side.** Each cell is one pair of moving-average windows, averaged over the three stocks. Left: how it scored on the training years. Right: how the same pair scored on the test years.

![Sharpe heatmaps, train vs test](images/sharpe_heatmaps.png)

## How the test was set up

```
2020 ───────────────── 2023 │ 2024 ───────────────── Nov 2026
   TRAIN: pick the windows   │   TEST: never touched until the end
   (12 combinations tried)   │   (windows already locked in: 30/100)
```

I tried 12 combinations of moving-average windows (fast: 10, 20, 30; slow: 50, 100, 150, 200) using **only** the training years, picked the best by average Sharpe ratio, and then ran that one choice on the test years. Nothing from the test period was used to choose anything.

## Traps I tried to avoid

| Trap | What goes wrong | What I did |
|---|---|---|
| **Lookahead** | Acting on today's closing price as if you knew it before the close | The signal is shifted one day (`signal.shift(1)`), so today's signal trades tomorrow |
| **Ignoring costs** | A strategy that trades a lot looks great until fees | 0.2% charged on every buy and every sell. It cost Reliance about 9 points of final value |
| **Overfitting** | Tuning settings until they fit the past perfectly | Picked on 2020-23, judged only on 2024-26 |
| **Cherry-picking a metric** | Reporting only the number that flatters you | Reported return, Sharpe and drawdown, including where the strategy lost |

## What the numbers say (and where I'm not sure)

1. **No extra return.** Worse on HDFC Bank, about equal on Reliance, tied on TCS (0.720 vs 0.718, which is noise).
2. **Smaller drawdowns.** When a stock falls, the strategy moves to cash and loses less. In a rising market it sits out part of the rally, and on the full 2020-26 period with 20/50 windows its drawdowns were actually *bigger* on HDFC Bank and Reliance.
3. **Sharpe can mislead.** On TCS both versions lost about 11% a year, but the strategy was much calmer, so its Sharpe looks *worse* (-0.81 vs -0.36). When returns are negative, lower volatility makes Sharpe more negative. Return and drawdown are the better guides there.
4. **What I'm not sure about:** whether the drawdown improvement is real or just a feature of 2024-26 being a rough stretch for these stocks. Three stocks and one test window can't tell me.

## How I could have made this look good

- Report only the training period, where the chosen windows scored 0.52 Sharpe.
- Test dozens of window combinations on the full history and show only the best.
- Skip trading costs.
- Remove the one-day shift on the signal.

Any of these would have produced a more impressive chart. None of them would have been true.

## Limitations

- **Only three stocks, and they're survivors.** I picked three of today's biggest NSE companies. A strategy tested only on stocks that went on to do well can look different from one tested on everything that existed in 2020.
- **One test window,** and it was a weak period for these stocks.
- **Selection bias remains:** the best of 12 window pairs is partly luck.
- **Costs are a flat 0.2% per trade,** not a real model of brokerage, STT, taxes or market impact.
- **No slippage, no position sizing** (always all-in or all-out), and cash earns nothing.
- **Yahoo Finance data** can contain errors. Prices are split and dividend adjusted, and data ends on 9 Nov 2026 so the numbers here are reproducible.

## What I want to find out next

- How do you tell a real edge from a lucky backtest? Is there a test that says "this result could easily be chance"?
- Do the results change on 30 or 50 stocks instead of three?
- What happens if I move the train/test split date, or test on several windows in a row (walk-forward testing)?
- How sensitive is the result to the 0.2% cost assumption?

## What I learned

*[Write 3-4 sentences yourself, in your own words: what surprised you, what you got wrong at first, what you'd do differently.]*

## How this was built

I wrote this with AI assistance (Claude), in Google Colab. I chose the question, the stocks, the cost assumption, the train/test split and the metrics, ran every cell, and interpreted the results myself. I'm learning Python alongside this, so treat the code as readable rather than elegant.

## Run it

1. Click the **Open in Colab** badge at the top.
2. Run all cells (Runtime, then Run all).
3. Or locally: `pip install -r requirements.txt` and open `nse_backtester.ipynb` in Jupyter.

<details>
<summary><b>Plain-English glossary</b></summary>

- **Backtest:** running a strategy on past data to see what it would have done.
- **Buy-and-hold:** buy once, never sell. The baseline every strategy has to beat.
- **Moving average (MA):** the average closing price over the last N days. A 20-day MA reacts faster than a 50-day one.
- **Crossover:** hold the stock when the 20-day MA is above the 50-day MA, otherwise sit in cash.
- **CAGR:** the steady yearly growth rate that gets you from the start value to the end value.
- **Max drawdown:** the worst fall from a peak to a later low. A 40% fall needs a 67% gain to recover.
- **Sharpe ratio:** return per unit of bumpiness. Higher means smoother returns. (No risk-free rate is subtracted here.)
- **Overfitting:** settings that fit the past perfectly but fail on new data, like memorising last year's exam paper.
- **Out-of-sample:** data the settings were never tuned on. The only result you can trust much.
- **Survivorship bias:** testing only on companies that survived, which flatters results.

</details>

<details>
<summary><b>Full-period results (2020 to Nov 2026, fixed 20/50 windows, before the train/test split)</b></summary>

| Stock | Strategy | Final value of ₹1 | CAGR | Sharpe | Max drawdown |
|---|---|---|---|---|---|
| HDFCBANK | Buy & hold | 1.54 | 6.8% | 0.39 | -31.7% |
| HDFCBANK | MA crossover | 0.84 | -2.7% | -0.07 | -49.1% |
| RELIANCE | Buy & hold | 2.58 | 15.6% | 0.66 | -27.2% |
| RELIANCE | MA crossover | 1.13 | 1.9% | 0.19 | -44.3% |
| TCS | Buy & hold | 1.50 | 6.4% | 0.38 | -53.4% |
| TCS | MA crossover | 1.01 | 0.2% | 0.09 | -41.9% |

</details>
