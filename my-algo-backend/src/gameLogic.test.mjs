import test from 'node:test';
import assert from 'node:assert/strict';
import { cardRank, getAllowedGuesses, isValidGuessValue, isValidGuestId, sortCards } from './gameLogic.js';

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
  const allowed = getAllowedGuesses({ attackerHand: [], drawnCard: null, opponentHand: opponent, targetCardId: 'target', failedGuesses: [] });
  assert.deepEqual(allowed, [3, 4, 5, 6]);
});

test('own black 5 does not eliminate white 5', () => {
  const opponent = [card('white', 99, false, 'target')];
  const allowed = getAllowedGuesses({
    attackerHand: [card('black', 5, false, 'mine')],
    drawnCard: null,
    opponentHand: opponent,
    targetCardId: 'target',
    failedGuesses: [],
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
    failedGuesses: [],
  });
  assert.ok(!allowed.includes(5));
});

test('failed guess is excluded only for target knowledge', () => {
  const opponent = [card('black', 99, false, 'a'), card('white', 99, false, 'b')];
  const a = getAllowedGuesses({ attackerHand: [], drawnCard: null, opponentHand: opponent, targetCardId: 'a', failedGuesses: [4] });
  const b = getAllowedGuesses({ attackerHand: [], drawnCard: null, opponentHand: opponent, targetCardId: 'b', failedGuesses: [] });
  assert.ok(!a.includes(4));
  assert.ok(b.includes(4));
});

test('open or unknown target cannot be attacked', () => {
  const opponent = [card('black', 2, true, 'open')];
  assert.deepEqual(getAllowedGuesses({ attackerHand: [], drawnCard: null, opponentHand: opponent, targetCardId: 'open', failedGuesses: [] }), []);
  assert.deepEqual(getAllowedGuesses({ attackerHand: [], drawnCard: null, opponentHand: opponent, targetCardId: 'missing', failedGuesses: [] }), []);
});

test('guess and guest ID validation reject malformed input', () => {
  assert.equal(isValidGuessValue(0), true);
  assert.equal(isValidGuessValue(11), true);
  assert.equal(isValidGuessValue(12), false);
  assert.equal(isValidGuessValue(2.5), false);
  assert.equal(isValidGuestId('guest-12345678'), true);
  assert.equal(isValidGuestId('someone-12345678'), false);
});
