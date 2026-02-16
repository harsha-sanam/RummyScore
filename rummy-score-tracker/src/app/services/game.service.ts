/**
 * =============================================================================
 * GAME SERVICE - Core business logic for Rummy Score Tracker
 * =============================================================================
 * 
 * This service manages all game state and operations. It serves as the single
 * source of truth for the application, handling:
 * 
 * 1. State Management - Using Angular signals for reactive updates
 * 2. Persistence - Auto-saving to localStorage on every change
 * 3. Player Management - Adding, removing, reordering players
 * 4. Score Tracking - Recording and editing round scores
 * 5. Game Logic - Determining winners, dealer rotation, rejoin
 * 
 * IMPORTANT CONCEPTS:
 * 
 * Dealer Rotation:
 * - Players sit in a specific order (represented by columnOrder)
 * - The "open card" receiver rotates through active players
 * - The "dealer" is always the player BEFORE the open card receiver
 * - When a player goes out, they're skipped in rotation
 * 
 * Mid-Game Join:
 * - New players can join mid-game with score = highest active score + 1
 * - They get the open card for the next round
 * 
 * Rejoin:
 * - Out players can ONLY rejoin immediately after going out
 * - Once next round scores are added, rejoin window closes
 * - Rejoin score is ADJUSTED so their TOTAL = highest active score + 1
 * - Rejoining player gets the open card
 */

import { Injectable, signal, computed } from '@angular/core';
import {
  GameState,
  Player,
  Round,
  RoundScore,
  PlayerWithTotal,
  RemovedPlayer,
  DEFAULT_GAME_STATE,
  generateId,
  GameSettings
} from '../models/game.model';

// Key used to store game state in browser's localStorage
const STORAGE_KEY = 'rummy_game_state';

@Injectable({
  providedIn: 'root'  // Singleton service available app-wide
})
export class GameService {
  
  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================
  
  /**
   * Main game state signal. All state changes go through this.
   * Initialized from localStorage if available, otherwise uses defaults.
   */
  private gameState = signal<GameState>(this.loadFromStorage());

  /**
   * Tracks players who can rejoin (went out in the last round).
   * This list is cleared when a new round is added.
   */
  private playersEligibleForRejoin = signal<string[]>([]);

  // ==========================================================================
  // COMPUTED SIGNALS (Derived State)
  // ==========================================================================
  // These automatically update when gameState changes
  
  /** Current game settings (maxPoints, dropPoints) */
  readonly settings = computed(() => this.gameState().settings);
  
  /** All players in the game (both active and out) */
  readonly players = computed(() => this.gameState().players);
  
  /** All rounds played so far */
  readonly rounds = computed(() => this.gameState().rounds);
  
  /** Whether the initial setup has been completed */
  readonly isGameStarted = computed(() => this.gameState().isGameStarted);
  
  /** Whether the game has ended (only 1 player left) */
  readonly isGameOver = computed(() => this.gameState().isGameOver);
  
  /** ID of the game winner, or null if game is ongoing */
  readonly gameWinnerId = computed(() => this.gameState().gameWinnerId);

  /** Players who can currently rejoin (went out last round) */
  readonly rejoinEligiblePlayers = computed(() => this.playersEligibleForRejoin());

  /**
   * Active players only (not out), sorted by column order.
   * These are the players currently competing in the game.
   */
  readonly activePlayers = computed(() => {
    return this.gameState().players
      .filter(p => !p.isOut)
      .sort((a, b) => a.columnOrder - b.columnOrder);
  });

  /**
   * Players who are currently out of the game.
   */
  readonly outPlayers = computed(() => {
    return this.gameState().players.filter(p => p.isOut);
  });

  /**
   * All players with their calculated totals and status.
   * Includes: totalScore, canDrop
   */
  readonly playersWithTotals = computed((): PlayerWithTotal[] => {
    const state = this.gameState();
    const eligibleForRejoin = this.playersEligibleForRejoin();
    const activeCount = state.players.filter(p => !p.isOut).length;

    return state.players.map(player => {
      // Calculate total score from all rounds
      const totalScore = this.calculatePlayerTotal(player.id);
      
      // Can they drop without exceeding max points?
      const canDrop = totalScore + state.settings.dropPoints <= state.settings.maxPoints;

      // Can they rejoin? 
      // Requirements:
      // 1. Player is out
      // 2. Player went out in the last round (eligible for rejoin)
      // 3. Can afford to drop after rejoining
      // 4. There must be at least 2 active players remaining (game not over)
      //    If only 1 player left, game is over - no rejoin allowed
      const highestActive = this.getHighestActiveScore();
      const rejoinTotal = highestActive + 1;
      const canRejoin = player.isOut && 
                        eligibleForRejoin.includes(player.id) &&
                        rejoinTotal + state.settings.dropPoints <= state.settings.maxPoints &&
                        activeCount >= 2;  // Must have at least 2 active players

      return {
        ...player,
        totalScore,
        canDrop,
        canRejoin
      };
    });
  });

  /**
   * Active players with their calculated totals, sorted by column order.
   * Used for displaying the score table.
   */
  readonly activePlayersWithTotals = computed((): PlayerWithTotal[] => {
    return this.playersWithTotals()
      .filter(p => !p.isOut)
      .sort((a, b) => a.columnOrder - b.columnOrder);
  });

  /**
   * The current dealer (who distributes cards).
   * Dealer is the player BEFORE the open card receiver in the rotation.
   * 
   * Example: If players are [A, B, C, D] and C gets open card,
   *          then B is the dealer.
   */
  readonly currentDealer = computed((): Player | null => {
    const active = this.activePlayers();
    if (active.length < 2) return null;

    const openCardIndex = this.gameState().currentOpenCardPlayerIndex;
    const openCardPlayer = active[openCardIndex];
    if (!openCardPlayer) return null;

    // Dealer is the player before the open card receiver (wraps around)
    const dealerIndex = openCardIndex === 0 ? active.length - 1 : openCardIndex - 1;
    return active[dealerIndex];
  });

  /**
   * The player who receives the open card (first card from deck).
   * This rotates through active players after each round.
   */
  readonly currentOpenCardPlayer = computed((): Player | null => {
    const active = this.activePlayers();
    if (active.length === 0) return null;

    const index = this.gameState().currentOpenCardPlayerIndex;
    return active[index] || active[0];
  });

  // ==========================================================================
  // PERSISTENCE METHODS
  // ==========================================================================

  /**
   * Loads game state from localStorage.
   * Returns default state if nothing is stored or if there's an error.
   */
  private loadFromStorage(): GameState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error loading game state:', e);
    }
    return { ...DEFAULT_GAME_STATE };
  }

  /**
   * Saves current game state to localStorage.
   * Called automatically after every state change.
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.gameState()));
    } catch (e) {
      console.error('Error saving game state:', e);
    }
  }

  /**
   * Updates the game state and persists to storage.
   * This is the ONLY way state should be modified.
   * 
   * @param updates - Partial state object with properties to update
   */
  private updateState(updates: Partial<GameState>): void {
    this.gameState.update(state => ({ ...state, ...updates }));
    this.saveToStorage();
  }

  // ==========================================================================
  // GAME SETUP METHODS
  // ==========================================================================

  /**
   * Initializes a new game with the given settings.
   * Called when user completes the setup modal.
   * 
   * @param maxPoints - Maximum points before a player is out
   * @param dropPoints - Penalty points for dropping a round
   */
  initializeGame(maxPoints: number, dropPoints: number): void {
    this.updateState({
      settings: { maxPoints, dropPoints },
      isGameStarted: true
    });
  }

  /**
   * Updates game settings (can be called mid-game if needed).
   */
  updateSettings(settings: GameSettings): void {
    this.updateState({ settings });
  }

  // ==========================================================================
  // PLAYER MANAGEMENT METHODS
  // ==========================================================================

  /**
   * Checks if a player name already exists among ACTIVE players (case-insensitive).
   * 
   * @param name - Name to check
   * @returns True if name already exists among active players
   */
  isPlayerNameTaken(name: string): boolean {
    const normalizedName = name.trim().toLowerCase();
    return this.gameState().players.some(p => p.name.toLowerCase() === normalizedName);
  }

  /**
   * Finds a removed player by name (case-insensitive).
   * 
   * @param name - Name to search for
   * @returns The removed player data if found, null otherwise
   */
  findRemovedPlayer(name: string): RemovedPlayer | null {
    const normalizedName = name.trim().toLowerCase();
    const removedPlayers = this.gameState().removedPlayers || [];
    return removedPlayers.find(rp => rp.player.name.toLowerCase() === normalizedName) || null;
  }

  /**
   * Adds a new player to the game.
   * If a player with the same name was previously removed, restores their history.
   * Players are added in the order they pick cards (determines rotation).
   * 
   * @param name - Display name for the player
   * @returns True if player was added, false if name already exists
   */
  addPlayer(name: string): boolean {
    const state = this.gameState();
    const trimmedName = name.trim();
    
    // Check for duplicate name among current players (case-insensitive)
    if (this.isPlayerNameTaken(trimmedName)) {
      return false;
    }
    
    // Check if this player was previously removed - restore them!
    const removedPlayer = this.findRemovedPlayer(trimmedName);
    
    if (removedPlayer) {
      // Restore the removed player with their original ID and position
      const restoredPlayer: Player = {
        ...removedPlayer.player,
        isOut: false,
        columnOrder: state.players.filter(p => !p.isOut).length,
        rejoinCount: removedPlayer.player.rejoinCount || 0
      };

      // Restore their scores to all rounds
      const updatedRounds = state.rounds.map(round => {
        const savedScore = removedPlayer.scores.find(s => s.roundId === round.id);
        if (savedScore) {
          return {
            ...round,
            scores: [...round.scores, { playerId: restoredPlayer.id, score: savedScore.score }]
          };
        }
        return round;
      });

      // Remove from removedPlayers list
      const updatedRemovedPlayers = (state.removedPlayers || []).filter(
        rp => rp.player.name.toLowerCase() !== trimmedName.toLowerCase()
      );

      this.updateState({
        players: [...state.players, restoredPlayer],
        rounds: updatedRounds,
        removedPlayers: updatedRemovedPlayers
      });
      
      return true;
    }
    
    // Create new player with next available column order
    const newPlayer: Player = {
      id: generateId(),
      name: trimmedName,
      isOut: false,
      columnOrder: state.players.filter(p => !p.isOut).length,
      rejoinCount: 0
    };

    this.updateState({
      players: [...state.players, newPlayer]
    });
    
    return true;
  }

  /**
   * Adds a join score for a new player joining mid-game.
   * DOES NOT create a new round - adds their join score to the LAST round.
   * The new player gets the open card.
   * 
   * @param playerName - Name of the player who just joined
   * @param joinScore - Score they join with (highest + 1)
   */
  addJoinScoreForNewPlayer(playerName: string, joinScore: number): void {
    const state = this.gameState();
    const player = state.players.find(p => p.name === playerName && !p.isOut);
    
    if (!player || state.rounds.length === 0) return;

    // Add the join score to the LAST round (not a new round)
    const updatedRounds = state.rounds.map((round, index) => {
      if (index === state.rounds.length - 1) {
        // Add the new player's join score to the last round
        return {
          ...round,
          scores: [...round.scores, { playerId: player.id, score: joinScore }]
        };
      }
      return round;
    });

    // Set this player to get open card next
    const activeAfterJoin = state.players
      .filter(p => !p.isOut)
      .sort((a, b) => a.columnOrder - b.columnOrder);
    const newOpenCardIndex = activeAfterJoin.findIndex(p => p.id === player.id);

    this.updateState({
      rounds: updatedRounds,
      currentOpenCardPlayerIndex: Math.max(0, newOpenCardIndex)
    });
    
    // Note: We don't clear rejoin eligibility since this isn't a new round
  }

  /**
   * Rejoins a player who is currently out.
   * Their score in the LAST ROUND is ADJUSTED so their TOTAL = highest active score + 1.
   * They return to their ORIGINAL position in the seating order.
   * They get the open card for the next round.
   * 
   * NOTE: Can only rejoin immediately after going out (before next round).
   * NOTE: Does NOT create a new round - modifies the last round's score.
   * 
   * @param playerId - ID of the player to rejoin
   */
  rejoinPlayer(playerId: string): void {
    const state = this.gameState();
    const player = state.players.find(p => p.id === playerId);
    
    // Check if player is eligible for rejoin
    if (!player || !player.isOut || !this.playersEligibleForRejoin().includes(playerId)) {
      return;
    }

    // Calculate current total and target total
    const currentTotal = this.calculatePlayerTotal(playerId);
    const highestActive = this.getHighestActiveScore();
    const targetTotal = highestActive + 1;
    
    // Calculate the adjustment needed to the LAST round's score
    // We need: currentTotal - lastRoundScore + newScore = targetTotal
    // So: newScore = targetTotal - currentTotal + lastRoundScore
    const lastRound = state.rounds[state.rounds.length - 1];
    const lastRoundScore = lastRound?.scores.find(s => s.playerId === playerId)?.score || 0;
    const newLastRoundScore = targetTotal - currentTotal + lastRoundScore;

    // Get the original column order (saved when player went out)
    const originalOrder = player.originalColumnOrder ?? player.columnOrder;

    // Mark player as active again at their ORIGINAL position
    // First, shift other active players to make room
    // Also INCREMENT the rejoin count
    const updatedPlayers = state.players.map(p => {
      if (p.id === playerId) {
        return {
          ...p,
          isOut: false,
          columnOrder: originalOrder,
          originalColumnOrder: undefined,  // Clear saved position
          rejoinCount: (p.rejoinCount || 0) + 1  // Increment rejoin count
        };
      }
      // Shift active players that were at or after the original position
      if (!p.isOut && p.columnOrder >= originalOrder) {
        return { ...p, columnOrder: p.columnOrder + 1 };
      }
      return p;
    });

    // Update the LAST round's score for this player (don't create new round)
    const updatedRounds = state.rounds.map((round, index) => {
      if (index === state.rounds.length - 1) {
        return {
          ...round,
          scores: round.scores.map(s => 
            s.playerId === playerId ? { ...s, score: newLastRoundScore } : s
          )
        };
      }
      return round;
    });

    // Set rejoining player to get open card
    const activeAfterRejoin = updatedPlayers
      .filter(p => !p.isOut)
      .sort((a, b) => a.columnOrder - b.columnOrder);
    const newOpenCardIndex = activeAfterRejoin.findIndex(p => p.id === playerId);

    this.updateState({
      players: updatedPlayers,
      rounds: updatedRounds,
      currentOpenCardPlayerIndex: Math.max(0, newOpenCardIndex),
      isGameOver: false,
      gameWinnerId: null
    });

    // Remove this player from rejoin eligibility
    this.playersEligibleForRejoin.update(list => list.filter(id => id !== playerId));
  }

  /**
   * Removes a player completely from the game.
   * SAVES their data so they can be restored if re-added with same name.
   * This deletes all their scores and removes them from rotation.
   * Different from being "out" - this is permanent removal.
   * 
   * @param playerId - ID of the player to remove
   */
  removePlayer(playerId: string): void {
    const state = this.gameState();
    
    // Find the player being removed
    const playerToRemove = state.players.find(p => p.id === playerId);
    if (!playerToRemove) return;

    // Save the player's scores for potential restoration
    const playerScores: { roundId: number; score: number }[] = [];
    state.rounds.forEach(round => {
      const score = round.scores.find(s => s.playerId === playerId);
      if (score) {
        playerScores.push({ roundId: round.id, score: score.score });
      }
    });

    // Create removed player record
    const removedPlayerRecord: RemovedPlayer = {
      player: { ...playerToRemove },
      scores: playerScores
    };

    // Add to removed players list (replace if same name exists)
    const existingRemovedPlayers = state.removedPlayers || [];
    const updatedRemovedPlayers = [
      ...existingRemovedPlayers.filter(
        rp => rp.player.name.toLowerCase() !== playerToRemove.name.toLowerCase()
      ),
      removedPlayerRecord
    ];

    // Filter out the player
    const updatedPlayers = state.players.filter(p => p.id !== playerId);
    
    // Reorder remaining active players (fill gaps in columnOrder)
    let order = 0;
    updatedPlayers.forEach(p => {
      if (!p.isOut) {
        p.columnOrder = order++;
      }
    });

    // Remove player's scores from all rounds
    const updatedRounds = state.rounds.map(round => ({
      ...round,
      scores: round.scores.filter(s => s.playerId !== playerId)
    }));

    this.updateState({
      players: updatedPlayers,
      rounds: updatedRounds,
      removedPlayers: updatedRemovedPlayers
    });

    // Remove from rejoin eligibility
    this.playersEligibleForRejoin.update(list => list.filter(id => id !== playerId));

    // Check if this removal ends the game
    this.checkGameOver();
  }

  /**
   * Reorders players based on new column positions.
   * Called when user drags columns in the score table.
   * This affects the dealer/open card rotation order.
   * 
   * @param playerIds - Array of player IDs in new order (left to right)
   */
  reorderPlayers(playerIds: string[]): void {
    const state = this.gameState();
    
    const updatedPlayers = state.players.map(player => {
      const newOrder = playerIds.indexOf(player.id);
      if (newOrder !== -1) {
        return { ...player, columnOrder: newOrder };
      }
      return player;
    });

    this.updateState({ players: updatedPlayers });
  }

  // ==========================================================================
  // SCORE MANAGEMENT METHODS
  // ==========================================================================

  /**
   * Adds a new round of scores.
   * Called after each hand is played and scores are entered.
   * 
   * @param scores - Array of scores for each player
   */
  addRound(scores: RoundScore[]): void {
    const state = this.gameState();
    
    // Clear rejoin eligibility from previous round
    this.playersEligibleForRejoin.set([]);
    
    // Find the winner (player with 0 score)
    const winnerId = scores.find(s => s.score === 0)?.playerId || null;

    // Create the new round record
    const newRound: Round = {
      id: state.rounds.length + 1,
      scores,
      winnerId,
      timestamp: Date.now()
    };

    this.updateState({
      rounds: [...state.rounds, newRound]
    });

    // Check if any players exceeded max points and went out
    const playersWhoWentOut = this.checkPlayersOut();
    
    // Set rejoin eligibility for players who just went out
    if (playersWhoWentOut.length > 0) {
      this.playersEligibleForRejoin.set(playersWhoWentOut);
    }

    // Advance dealer for next round
    this.advanceOpenCard();
  }

  /**
   * Updates a score in an existing round.
   * Called when user clicks a cell to edit.
   * 
   * @param roundId - Which round to update
   * @param playerId - Which player's score to update
   * @param newScore - The new score value
   */
  updateScore(roundId: number, playerId: string, newScore: number): void {
    const state = this.gameState();
    
    const updatedRounds = state.rounds.map(round => {
      if (round.id === roundId) {
        // Update the specific score
        const updatedScores = round.scores.map(s =>
          s.playerId === playerId ? { ...s, score: newScore } : s
        );
        // Recalculate winner (player with 0 score)
        const winnerId = updatedScores.find(s => s.score === 0)?.playerId || null;
        return { ...round, scores: updatedScores, winnerId };
      }
      return round;
    });

    this.updateState({ rounds: updatedRounds });

    // Check if this edit caused anyone to go out
    this.checkPlayersOut();
  }

  /**
   * Checks all active players to see if anyone exceeded max points.
   * Marks them as "out" and saves their original column order for potential rejoin.
   * 
   * @returns Array of player IDs who just went out
   */
  private checkPlayersOut(): string[] {
    const state = this.gameState();
    const playersWhoWentOut: string[] = [];

    const updatedPlayers = state.players.map(player => {
      // Skip already-out players
      if (player.isOut) return player;

      const total = this.calculatePlayerTotal(player.id);
      
      // Check if player exceeded max points
      if (total > state.settings.maxPoints) {
        playersWhoWentOut.push(player.id);
        // Mark player as out and SAVE their original column order for rejoin
        return { 
          ...player, 
          isOut: true,
          originalColumnOrder: player.columnOrder  // Save for potential rejoin
        };
      }
      return player;
    });

    // Update state if anyone went out
    if (playersWhoWentOut.length > 0) {
      this.updateState({ players: updatedPlayers });
      this.checkGameOver();
    }

    return playersWhoWentOut;
  }

  /**
   * Checks if the game is over (only 1 or 0 players remaining).
   * Updates game state accordingly.
   */
  private checkGameOver(): void {
    const active = this.activePlayers();
    
    if (active.length === 1) {
      // One player left = they win!
      this.updateState({
        isGameOver: true,
        gameWinnerId: active[0].id
      });
    } else if (active.length === 0) {
      // No players left (edge case)
      this.updateState({ isGameOver: true });
    }
  }

  // ==========================================================================
  // DEALER ROTATION METHODS
  // ==========================================================================

  /**
   * Advances the open card to the next player in rotation.
   * Called after each round.
   * The dealer automatically becomes the player before the new open card receiver.
   */
  advanceOpenCard(): void {
    const active = this.activePlayers();
    if (active.length < 2) return;

    const currentIndex = this.gameState().currentOpenCardPlayerIndex;
    // Move to next player, wrapping around to 0 at the end
    const nextIndex = (currentIndex + 1) % active.length;

    this.updateState({ currentOpenCardPlayerIndex: nextIndex });
  }

  /**
   * Manually sets which player gets the open card.
   * Used when a new player joins mid-game.
   * 
   * @param playerId - ID of the player to receive open card
   */
  setOpenCardPlayer(playerId: string): void {
    const active = this.activePlayers();
    const index = active.findIndex(p => p.id === playerId);
    if (index !== -1) {
      this.updateState({ currentOpenCardPlayerIndex: index });
    }
  }

  /**
   * Manually sets the dealer.
   * The open card player will be the NEXT player after the dealer.
   * 
   * @param playerId - ID of the player to be dealer
   */
  setDealer(playerId: string): void {
    const active = this.activePlayers();
    const dealerIndex = active.findIndex(p => p.id === playerId);
    if (dealerIndex !== -1) {
      // Open card goes to the player AFTER the dealer
      const openCardIndex = (dealerIndex + 1) % active.length;
      this.updateState({ currentOpenCardPlayerIndex: openCardIndex });
    }
  }

  /**
   * Gets the most recent round ID (for edit restriction).
   * 
   * @returns The ID of the most recent round, or null if no rounds
   */
  getMostRecentRoundId(): number | null {
    const rounds = this.gameState().rounds;
    if (rounds.length === 0) return null;
    return rounds[rounds.length - 1].id;
  }

  /**
   * Checks if editing a score would result in multiple winners (0 scores).
   * 
   * @param roundId - Round to check
   * @param playerId - Player whose score is being changed
   * @param newScore - The new score value
   * @returns True if the edit would result in multiple winners
   */
  wouldCreateMultipleWinners(roundId: number, playerId: string, newScore: number): boolean {
    const round = this.gameState().rounds.find(r => r.id === roundId);
    if (!round) return false;

    // Count how many players would have 0 score after this edit
    let zeroCount = 0;
    for (const score of round.scores) {
      if (score.playerId === playerId) {
        if (newScore === 0) zeroCount++;
      } else if (score.score === 0) {
        zeroCount++;
      }
    }

    return zeroCount > 1;
  }

  // ==========================================================================
  // CALCULATION METHODS
  // ==========================================================================

  /**
   * Calculates the total score for a player across all rounds.
   * 
   * @param playerId - ID of the player
   * @returns Sum of all their round scores
   */
  calculatePlayerTotal(playerId: string): number {
    return this.gameState().rounds.reduce((total, round) => {
      const score = round.scores.find(s => s.playerId === playerId);
      return total + (score?.score || 0);
    }, 0);
  }

  /**
   * Gets the highest score among active players.
   * Used to calculate join/rejoin scores.
   * 
   * @param excludePlayerId - Optional player ID to exclude from calculation
   * @returns Highest score among active players
   */
  getHighestActiveScore(excludePlayerId?: string): number {
    const state = this.gameState();
    let highest = 0;

    state.players.forEach(player => {
      if (!player.isOut && player.id !== excludePlayerId) {
        const total = this.calculatePlayerTotal(player.id);
        if (total > highest) {
          highest = total;
        }
      }
    });

    return highest;
  }

  /**
   * Gets a specific player's score for a specific round.
   * 
   * @param roundId - Which round
   * @param playerId - Which player
   * @returns The score, or null if not found
   */
  getPlayerScore(roundId: number, playerId: string): number | null {
    const round = this.gameState().rounds.find(r => r.id === roundId);
    if (!round) return null;
    const score = round.scores.find(s => s.playerId === playerId);
    return score?.score ?? null;
  }

  // ==========================================================================
  // RESET METHODS
  // ==========================================================================

  /**
   * Starts a new game with the same players and settings.
   * Clears all scores but keeps everything else.
   */
  newGame(): void {
    const state = this.gameState();
    
    // Reset all players to active
    const resetPlayers = state.players.map(p => ({ ...p, isOut: false }));
    
    // Reassign column orders
    let order = 0;
    resetPlayers.forEach(p => {
      p.columnOrder = order++;
    });

    this.updateState({
      players: resetPlayers,
      rounds: [],                        // Clear all rounds
      currentOpenCardPlayerIndex: 0,     // Reset to first player
      isGameOver: false,
      gameWinnerId: null
    });

    // Clear rejoin eligibility
    this.playersEligibleForRejoin.set([]);
  }

  /**
   * Completely resets everything - players, scores, settings.
   * Returns to the initial setup screen.
   */
  resetEverything(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.gameState.set({ ...DEFAULT_GAME_STATE });
    this.playersEligibleForRejoin.set([]);
  }

  /**
   * Deletes a round from the game.
   * Removes the round and renumbers subsequent rounds.
   * Rechecks player statuses (may bring back players who were out).
   * 
   * @param roundId - ID of the round to delete
   */
  deleteRound(roundId: number): void {
    const state = this.gameState();
    
    // Filter out the round
    const filteredRounds = state.rounds.filter(r => r.id !== roundId);
    
    // Renumber rounds sequentially
    const updatedRounds = filteredRounds.map((round, index) => ({
      ...round,
      id: index + 1
    }));

    // Update state with new rounds
    this.updateState({ rounds: updatedRounds });

    // Recalculate player statuses - some players might come back from "out" status
    this.recalculatePlayerStatuses();

    // Clear rejoin eligibility since round structure changed
    this.playersEligibleForRejoin.set([]);
  }

  /**
   * Recalculates all player statuses based on current totals.
   * Players who are under max points should be marked as active.
   * Players over max points should be marked as out.
   */
  private recalculatePlayerStatuses(): void {
    const state = this.gameState();
    let hasChanges = false;

    const updatedPlayers = state.players.map(player => {
      const total = this.calculatePlayerTotal(player.id);
      const shouldBeOut = total > state.settings.maxPoints;

      if (player.isOut !== shouldBeOut) {
        hasChanges = true;
        return { ...player, isOut: shouldBeOut };
      }
      return player;
    });

    if (hasChanges) {
      // Reorder active players
      let order = 0;
      updatedPlayers.forEach(p => {
        if (!p.isOut) {
          p.columnOrder = order++;
        }
      });

      this.updateState({ players: updatedPlayers });
      this.checkGameOver();
    }
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Checks if the initial setup needs to be shown.
   * 
   * @returns True if game hasn't been set up yet
   */
  needsSetup(): boolean {
    return !this.gameState().isGameStarted;
  }
}
