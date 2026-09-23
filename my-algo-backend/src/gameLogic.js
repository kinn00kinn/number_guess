/**
 * Pure game-logic helpers shared by the Durable Object and unit tests.
 */

/** @param {{color:'black'|'white', number:number}} card */
export function cardRank(card) {
  return card.number * 2 + (card.color === 'white' ? 1 : 0);
}

/** @param {Array<{color:'black'|'white', number:number}>} hand */
export function sortCards(hand) {
  hand.sort((a, b) => cardRank(a) - cardRank(b));
  return hand;
}

/**
 * Compute guesses that are logically possible from the attacker's public knowledge.
 * Hidden opponent values are intentionally not used.
 *
 * @param {{
 *   attackerHand:Array<{color:'black'|'white',number:number,isOpen:boolean,id:string}>,
 *   drawnCard:{color:'black'|'white',number:number,isOpen:boolean,id:string}|null,
 *   opponentHand:Array<{color:'black'|'white',number:number,isOpen:boolean,id:string}>,
 *   targetCardId:string,
 *   failedGuesses:number[]
 * }} args
 */
export function getAllowedGuesses({
  attackerHand,
  drawnCard,
  opponentHand,
  targetCardId,
  failedGuesses = [],
}) {
  const targetIndex = opponentHand.findIndex((card) => card.id === targetCardId);
  if (targetIndex < 0) return [];

  const target = opponentHand[targetIndex];
  if (target.isOpen) return [];

  const occupiedRanks = new Set();
  for (const card of attackerHand) occupiedRanks.add(cardRank(card));
  if (drawnCard) occupiedRanks.add(cardRank(drawnCard));
  for (const card of opponentHand) {
    if (card.isOpen) occupiedRanks.add(cardRank(card));
  }

  let leftBound = null;
  for (let i = targetIndex - 1; i >= 0; i--) {
    if (opponentHand[i].isOpen) {
      leftBound = cardRank(opponentHand[i]);
      break;
    }
  }

  let rightBound = null;
  for (let i = targetIndex + 1; i < opponentHand.length; i++) {
    if (opponentHand[i].isOpen) {
      rightBound = cardRank(opponentHand[i]);
      break;
    }
  }

  const failed = new Set(failedGuesses);
  const allowed = [];
  for (let number = 0; number <= 11; number++) {
    if (failed.has(number)) continue;
    const rank = cardRank({ color: target.color, number });
    if (occupiedRanks.has(rank)) continue;
    if (leftBound !== null && rank <= leftBound) continue;
    if (rightBound !== null && rank >= rightBound) continue;
    allowed.push(number);
  }
  return allowed;
}

/** @param {unknown} guess */
export function isValidGuessValue(guess) {
  return Number.isInteger(guess) && guess >= 0 && guess <= 11;
}

/** @param {string} value */
export function isValidGuestId(value) {
  return /^guest-[A-Za-z0-9_-]{8,80}$/.test(value);
}
