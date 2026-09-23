import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOpponentHandView, buildPublicPlayers, cardRank, getAllowedGuesses, isValidGuessValue, isValidGuestId, sortCards } from './gameLogic.js';

const card = (color, number, isOpen, id) => ({ color, number, isOpen, id });

test('sort order is number asc and black before white for ties', () => {
  const hand = [card('white', 4, false, 'a'), card('black', 5, false, 'b'), card('black', 4, false, 'c')];
  sortCards(hand);
  assert.deepEqual(hand.map((c) => [c.color, c.number]), [['black', 4], ['white', 4], ['black', 5]]);
  assert.equal(cardRank(card('black', 4, false, 'x')), 8);
  assert.equal(cardRank(card('white', 4, false, 'x')), 9);
});

test('candidate bounds honor nearest open cards and target color', () => {
  const opponent = [
    card('black', 3, true, 'left'),
    card('white', 99, false, 'target'),
    card('white', 7, true, 'right'),
  ];
  const allowed = getAllowedGuesses({ attackerHand: [], drawnCard: null, opponentHand: opponent, targetCardId: 'target', failedGuessesByCard: {} });
  assert.deepEqual(allowed, [3, 4, 5, 6]);
});

test('own black 5 does not eliminate white 5', () => {
  const opponent = [card('white', 99, false, 'target')];
  const allowed = getAllowedGuesses({
    attackerHand: [card('black', 5, false, 'mine')],
    drawnCard: null,
    opponentHand: opponent,
    targetCardId: 'target',
    failedGuessesByCard: {},
  });
  assert.ok(allowed.includes(5));
});

test('own white 5 eliminates white 5', () => {
  const opponent = [card('white', 99, false, 'target')];
  const allowed = getAllowedGuesses({
    attackerHand: [card('white', 5, false, 'mine')],
    drawnCard: null,
    opponentHand: opponent,
    targetCardId: 'target',
    failedGuessesByCard: {},
  });
  assert.ok(!allowed.includes(5));
});

test('failed guess is excluded only for target knowledge', () => {
  const opponent = [card('black', 99, false, 'a'), card('white', 99, false, 'b')];
  const a = getAllowedGuesses({ attackerHand: [], drawnCard: null, opponentHand: opponent, targetCardId: 'a', failedGuessesByCard: { a: [4] } });
  const b = getAllowedGuesses({ attackerHand: [], drawnCard: null, opponentHand: opponent, targetCardId: 'b', failedGuessesByCard: {} });
  assert.ok(!a.includes(4));
  assert.ok(b.includes(4));
});

test('open or unknown target cannot be attacked', () => {
  const opponent = [card('black', 2, true, 'open')];
  assert.deepEqual(getAllowedGuesses({ attackerHand: [], drawnCard: null, opponentHand: opponent, targetCardId: 'open', failedGuessesByCard: {} }), []);
  assert.deepEqual(getAllowedGuesses({ attackerHand: [], drawnCard: null, opponentHand: opponent, targetCardId: 'missing', failedGuessesByCard: {} }), []);
});

test('guess and guest ID validation reject malformed input', () => {
  assert.equal(isValidGuessValue(0), true);
  assert.equal(isValidGuessValue(11), true);
  assert.equal(isValidGuessValue(12), false);
  assert.equal(isValidGuessValue(2.5), false);
  assert.equal(isValidGuestId('guest-12345678'), true);
  assert.equal(isValidGuestId('someone-12345678'), false);
});


test('client-safe views never expose hidden opponent numbers or hands', () => {
  const opponent = [card('black', 11, false, 'opaque-card-id'), card('white', 7, true, 'open-id')];
  const view = buildOpponentHandView({ attackerHand: [], drawnCard: null, opponentHand: opponent, failedGuesses: {} });
  assert.equal(view[0].number, null);
  assert.equal(view[1].number, 7);
  assert.equal(view[0].id, 'opaque-card-id');

  const players = buildPublicPlayers([{ id: 'p1', name: 'A', isCpu: false, hand: [card('black', 11, false, 'secret')] }]);
  assert.deepEqual(players[0].hand, []);
  assert.equal(JSON.stringify(players).includes('secret'), false);
});


test('candidate filtering rejects values that cannot fit the whole sorted hand', () => {
  const opponent = [
    card('white', 99, false, 'target'),
    card('white', 99, false, 'b'),
    card('white', 99, false, 'c'),
    card('white', 99, false, 'd'),
  ];
  const allowed = getAllowedGuesses({
    attackerHand: [], drawnCard: null, opponentHand: opponent,
    targetCardId: 'target', failedGuessesByCard: {},
  });
  assert.deepEqual(allowed, [0,1,2,3,4,5,6,7,8]);
});
