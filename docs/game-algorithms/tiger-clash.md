# TIGER CLASH

A card duel. One card is dealt to the Tiger and one to the Dragon; the higher card wins. You back the Tiger, the Dragon or a Tie. Free demo credits only.

> **Bottom line:** Tiger and Dragon bets return **97.06%** on average; Tie bets return **52.94%**. All figures are exact mathematics: this game has **no assumptions**, every rule comes from the existing game.

---

## 1. How the game works

- A standard **52-card deck**: four suits, 13 ranks each.
- **Rank order:** 2 is lowest, then 3 to 10, Jack (11), Queen (12), King (13) and **Ace highest** (14). Suits do not matter.
- **One card for the Tiger, one for the Dragon.** The **higher rank wins**. If both cards have the **same rank** it is a **Tie**.
- You choose one of three bets: **Tiger**, **Dragon** or **Tie**, and a **stake** of 1 to 10,000 whole demo credits.

## 2. How a round starts and ends

**Start.** You choose Tiger, Dragon or Tie and a stake. The server checks both and takes the stake from your balance.

**The deal.** The server takes two cards off the top of the shuffled deck: the first is the Tiger's, the second the Dragon's. They are chosen **before your choice is looked at**; your pick has no influence on them.

**End.** The server compares the ranks, pays any win and reports both cards. The round is finished the moment the cards are dealt. The animation your screen shows is only a replay.

**The deck is kept between rounds** of the same session: dealt cards are not put back. When fewer than two cards are left, a new deck is shuffled.

## 3. How winning and losing are decided

| Your bet | The cards | You receive | Result |
| --- | --- | --- | --- |
| **Tiger** | Tiger's card is higher | **2×** your stake | Win |
| **Tiger** | Dragon's card is higher | nothing | Lose |
| **Tiger** | Tie | **half** your stake back (0.5×) | Half lost |
| **Dragon** | Dragon's card is higher | **2×** your stake | Win |
| **Dragon** | Tiger's card is higher | nothing | Lose |
| **Dragon** | Tie | **half** your stake back (0.5×) | Half lost |
| **Tie** | Tie | **9×** your stake | Win |
| **Tie** | Any other result | nothing | Lose |

"You receive" is the money coming back to you, **including** your stake. A 2× win on a stake of 100 pays 200: a profit of 100.

## 4. The complete algorithm, step by step

1. **Check the bet:** the side is Tiger, Dragon or Tie; the stake is a whole number from 1 to 10,000; you have enough demo credits. Take the stake.
2. **Get the deck.** Use the cards left in your session's deck. If fewer than 2 remain (or it is the first round), build a fresh 52-card deck and **shuffle** it with the round's secret random numbers (the standard "Fisher-Yates" shuffle, which gives every possible order exactly the same chance).
3. **Deal:** the first card taken is the Tiger's, the second the Dragon's. They stay out of the deck.
4. **Compare the ranks:** higher wins, equal is a Tie.
5. **Work out the payout** with the table in section 3.
6. **Pay, save the round, and keep the rest of the deck** for your next round.

## 5. Winning and losing chances

These follow directly from the 52-card deck and are exact.

**Why a Tie is 3 chances in 51:** whatever the Tiger's card is, 51 cards are left and exactly **3** of them share its rank (the other three suits). So a Tie has probability **3 ÷ 51**. The other 48 cards are either higher or lower, and by symmetry each is equally likely, so Tiger and Dragon each get **24 ÷ 51**.

| Outcome of the cards | Chance | Roughly |
| --- | --- | --- |
| Tiger's card is higher (Tiger wins) | 24/51 = **47.06%** | 1 in 2.1 |
| Dragon's card is higher (Dragon wins) | 24/51 = **47.06%** | 1 in 2.1 |
| Same rank (Tie) | 3/51 = **5.88%** | 1 in 17 |

### Return to player (exact)

| Your bet | How it works out | Return |
| --- | --- | --- |
| Tiger (or Dragon) | 47.06% × 2 + 5.88% × 0.5 = 0.9412 + 0.0294 | **97.06%** |
| Tie | 5.88% × 9 | **52.94%** |

So on 100 staked, a Tiger or Dragon bet gets back about 97.06 on average. A Tie bet gets back about 52.94: **Tie is a long-shot bet with a low average return**, even though a single win pays a lot.

### A note about the kept deck

The figures above are the chances for any round before you know which cards are left. Because the deck is kept between rounds (as in the existing game), the cards dealt earlier are no longer in the deck. The server never shows you the deck or the cards still to come. A player who remembers every card dealt so far could, late in a deck, work out that some outcomes are slightly more or less likely than average. Reshuffling every round would remove that. The existing game does not do so, and this game keeps the same behaviour.

## 6. Random numbers and fairness

- The deck is shuffled with the round's secret seed from the operating system's secure random source (see [the shared explanation](README.md#random-numbers-and-fairness)). The shuffle uses unbiased picks, so every ordering of the 52 cards is equally likely.
- The two cards are dealt **before** your pick is read and cannot depend on it.
- The rest of the deck is private and is never sent to you.
- Because one shuffle decides the cards of several rounds, the seed of a round is **kept secret until your session has ended** (otherwise it would reveal cards still to come). Once you close the session, the audit shows the seed and its fingerprint for each round.

## 7. Payout examples

Amounts are demo credits.

**Example A: a Tiger win.** Stake **100** on **Tiger**. Cards: Tiger gets the **King of Hearts**, Dragon gets the **7 of Clubs**. King (13) beats 7. Payout 2 × 100 = **200**, profit **100**.

**Example B: a Tiger loss.** Stake **100** on **Tiger**. Tiger gets the **4 of Spades**, Dragon the **Jack of Diamonds**. Jack (11) beats 4. Payout **0**, loss **100**.

**Example C: a Tie that costs half.** Stake **100** on **Dragon**. Both cards are **9s** (9 of Hearts and 9 of Spades): a Tie. Dragon and Tiger bets get half back: payout 0.5 × 100 = **50**, loss **50**.

**Example D: backing the Tie and winning.** Stake **10** on **Tie**. Both cards are **Queens**. Payout 9 × 10 = **90**, profit **80**.

**Example E: backing the Tie and losing.** Stake **10** on **Tie**. The cards are **3** and **Ace**. Payout **0**, loss **10**.

## 8. What is taken from the existing game, and what is assumed

**Taken from the existing game (not changed):** the 52-card deck and rank order (Ace high), the three bets, the payouts (win 2×, Tie 9×, half stake back on Tiger or Dragon when the cards tie), stakes of 1 to 10,000 in whole credits, the deal from a shuffled deck before the pick is looked at, two distinct cards per round, the deck being kept between rounds and reshuffled when fewer than two cards are left, and the Fisher-Yates shuffle.

**ASSUMPTIONS:** none. The only difference is that the server keeps a separate deck for each play session, and rounds happen when you place a bet (the existing screen also deals rounds on a timer when no bet is placed).
