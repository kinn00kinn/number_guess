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

function canAssignSortedRanks(rankOptions, targetIndex, targetRank) {
  let previous = -1;
  for (let i = 0; i < rankOptions.length; i++) {
    const options = i === targetIndex ? [targetRank] : rankOptions[i];
    const next = options.find((rank) => rank > previous);
    if (next === undefined) return false;
    previous = next;
  }
  return true;
}

/**
 * Compute guesses logically possible from public information only.
 * It accounts for colors, known/owned cards, failed guesses, and whether the
 * entire sorted opponent hand can still be assigned consistently.
 *
 * @param {{
 *   attackerHand:Array<{color:'black'|'white',number:number,isOpen:boolean,id:string}>,
 *   drawnCard:{color:'black'|'white',number:number,isOpen:boolean,id:string}|null,
 *   opponentHand:Array<{color:'black'|'white',number:number,isOpen:boolean,id:string}>,
 *   targetCardId:string,
 *   failedGuessesByCard:Record<string,number[]>
 * }} args
 */
export function getAllowedGuesses({
  attackerHand,
  drawnCard,
  opponentHand,
  targetCardId,
  failedGuessesByCard = {},
}) {
  const targetIndex = opponentHand.findIndex((card) => card.id === targetCardId);
  if (targetIndex < 0 || opponentHand[targetIndex].isOpen) return [];

  const occupiedRanks = new Set();
  for (const card of attackerHand) occupiedRanks.add(cardRank(card));
  if (drawnCard) occupiedRanks.add(cardRank(drawnCard));
  for (const card of opponentHand) {
    if (card.isOpen) occupiedRanks.add(cardRank(card));
  }

  const rankOptions = opponentHand.map((card) => {
    if (card.isOpen) return [cardRank(card)];
    const failed = new Set(failedGuessesByCard[card.id] || []);
    const options = [];
    for (let number = 0; number <= 11; number++) {
      if (failed.has(number)) continue;
      const rank = cardRank({ color: card.color, number });
      if (!occupiedRanks.has(rank)) options.push(rank);
    }
    return options;
  });

  const target = opponentHand[targetIndex];
  const allowed = [];
  for (let number = 0; number <= 11; number++) {
    if ((failedGuessesByCard[target.id] || []).includes(number)) continue;
    const rank = cardRank({ color: target.color, number });
    if (occupiedRanks.has(rank)) continue;
    if (canAssignSortedRanks(rankOptions, targetIndex, rank)) allowed.push(number);
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

/**
 * Build a client-safe view of the opponent hand.
 * @param {{attackerHand:any[],drawnCard:any|null,opponentHand:any[],failedGuesses:Record<string,number[]>}} args
 */
export function buildOpponentHandView({ attackerHand, drawnCard, opponentHand, failedGuesses }) {
  return opponentHand.map((card) => ({
    color: card.color,
    number: card.isOpen ? card.number : null,
    isOpen: card.isOpen,
    id: card.id,
    allowedGuesses: card.isOpen
      ? []
      : getAllowedGuesses({
          attackerHand,
          drawnCard,
          opponentHand,
          targetCardId: card.id,
          failedGuessesByCard: failedGuesses,
        }),
  }));
}

/** @param {Array<{id:string,name:string,isCpu:boolean}>} players */
export function buildPublicPlayers(players) {
  return players.map((player) => ({
    id: player.id,
    name: player.name,
    hand: [],
    isCpu: player.isCpu,
  }));
}
