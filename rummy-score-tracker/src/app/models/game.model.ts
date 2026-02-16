/**
 * =============================================================================
 * GAME MODEL - Data structures for Rummy Score Tracker
 * =============================================================================
 * 
 * This file defines all TypeScript interfaces and types used throughout the app.
 * The Rummy Score Tracker helps players keep track of scores during a rummy card
 * game, including player management, score tracking, and dealer rotation.
 * 
 * Key Concepts:
 * - Players take turns being the "dealer" who distributes cards
 * - One player gets the "open card" (first card from deck) each round
 * - Players accumulate points; exceeding max points means they're "out"
 * - Players who are "out" can rejoin if they can afford the "drop" penalty
 * - The last player remaining wins the game
 */

// =============================================================================
// PLAYER INTERFACE
// =============================================================================

/**
 * Represents a player in the game.
 * 
 * @property id - Unique identifier for the player (random string)
 * @property name - Display name of the player
 * @property isOut - True if player has exceeded max points and is out of the game
 * @property columnOrder - Position in the score table (0 = leftmost column)
 *                         This order also determines dealer/open card rotation
 * @property originalColumnOrder - Saved position when player goes out (for rejoin)
 * @property rejoinCount - Number of times this player has rejoined the game
 */
export interface Player {
  id: string;
  name: string;
  isOut: boolean;
  columnOrder: number;
  originalColumnOrder?: number;  // Saved when player goes out for rejoin
  rejoinCount: number;           // Number of times player has rejoined
}

// =============================================================================
// ROUND & SCORE INTERFACES
// =============================================================================

/**
 * Represents a single player's score in a round.
 * 
 * @property playerId - Reference to the player who earned this score
 * @property score - Points earned in this round (0 = round winner)
 */
export interface RoundScore {
  playerId: string;
  score: number;
}

/**
 * Represents a single round of play.
 * Each round, players receive cards and one player wins by going out first.
 * The winner gets 0 points; others get points based on cards left in hand.
 * 
 * @property id - Round number (1, 2, 3, etc.)
 * @property scores - Array of scores for each player in this round
 * @property winnerId - ID of the player who won this round (scored 0), or null
 * @property timestamp - When this round was recorded (Unix timestamp)
 */
export interface Round {
  id: number;
  scores: RoundScore[];
  winnerId: string | null;
  timestamp: number;
}

// =============================================================================
// GAME SETTINGS
// =============================================================================

/**
 * Game configuration settings set at the start of a game.
 * 
 * @property maxPoints - Point limit; exceeding this means player is "out"
 *                       Common values: 101, 201, 251, 501
 * @property dropPoints - Penalty points for "dropping" (quitting a round early)
 *                        Default calculation: MAX(20, 10% of maxPoints)
 *                        Used to determine if a player can afford to rejoin
 */
export interface GameSettings {
  maxPoints: number;
  dropPoints: number;
}

// =============================================================================
// GAME STATE
// =============================================================================

/**
 * Stores information about a removed player for potential restoration.
 * If a player is accidentally removed and re-added with the same name,
 * their history can be restored.
 * 
 * @property player - The player data at time of removal
 * @property scores - Map of roundId to score for this player
 */
export interface RemovedPlayer {
  player: Player;
  scores: { roundId: number; score: number }[];
}

/**
 * Complete state of the game, stored in localStorage for persistence.
 * This is the main data structure that holds everything about the current game.
 * 
 * @property settings - Game configuration (max points, drop points)
 * @property players - All players (both active and out)
 * @property rounds - History of all rounds played with scores
 * @property currentOpenCardPlayerIndex - Index in activePlayers array of who
 *                                        gets the open card next round
 *                                        (Dealer is the player before this one)
 * @property isGameStarted - True after initial setup is complete
 * @property isGameOver - True when only 1 player remains (they win)
 * @property gameWinnerId - ID of the winning player, or null if game ongoing
 * @property removedPlayers - Players who were removed (for potential restoration)
 */
export interface GameState {
  settings: GameSettings;
  players: Player[];
  rounds: Round[];
  currentOpenCardPlayerIndex: number;
  isGameStarted: boolean;
  isGameOver: boolean;
  gameWinnerId: string | null;
  removedPlayers?: RemovedPlayer[];
}

// =============================================================================
// EXTENDED PLAYER TYPE (with calculated fields)
// =============================================================================

/**
 * Extended Player interface with calculated/derived properties.
 * Used in the UI to display player status and determine available actions.
 * 
 * @extends Player - All base player properties
 * @property totalScore - Sum of all round scores for this player
 * @property canDrop - True if player can afford to drop without going out
 *                     Calculated as: (totalScore + dropPoints) <= maxPoints
 * @property canRejoin - (Only for out players) True if they can rejoin the game
 *                       Calculated as: (rejoinScore + dropPoints) <= maxPoints
 * @property rejoinScore - (Only for out players) Score they would have if rejoining
 *                         Calculated as: highestActiveScore + 1
 */
export interface PlayerWithTotal extends Player {
  totalScore: number;
  canDrop: boolean;
  canRejoin?: boolean;
  rejoinScore?: number;
}

// =============================================================================
// DEFAULT VALUES
// =============================================================================

/**
 * Default game state used when starting fresh or resetting.
 * All values are initialized to sensible defaults.
 */
export const DEFAULT_GAME_STATE: GameState = {
  settings: {
    maxPoints: 201,    // Default game is 201 points
    dropPoints: 20     // Default drop penalty
  },
  players: [],         // No players initially
  rounds: [],          // No rounds played
  currentOpenCardPlayerIndex: 0,  // First player gets open card
  isGameStarted: false,           // Need to complete setup
  isGameOver: false,              // Game not over
  gameWinnerId: null,             // No winner yet
  removedPlayers: []              // No removed players
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Generates a random unique identifier for players.
 * Uses base-36 encoding of a random number for short, unique strings.
 * 
 * @returns A 7-character random string (e.g., "a1b2c3d")
 * 
 * @example
 * const playerId = generateId(); // Returns something like "k9x2m4p"
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Calculates the default drop points based on max game points.
 * Rule: Drop points = MAX(20, 10% of maxPoints)
 * 
 * This ensures:
 * - Minimum drop penalty of 20 points (for low-point games)
 * - Scales with game size (10% for larger games)
 * 
 * @param maxPoints - The maximum points for the game
 * @returns Calculated drop points
 * 
 * @example
 * calculateDropPoints(101)  // Returns 20 (10% = 10.1, but min is 20)
 * calculateDropPoints(201)  // Returns 21 (10% = 20.1, rounded up)
 * calculateDropPoints(500)  // Returns 50 (10% = 50)
 */
export function calculateDropPoints(maxPoints: number): number {
  const tenPercent = Math.ceil(maxPoints * 0.1);
  return Math.max(20, tenPercent);
}
