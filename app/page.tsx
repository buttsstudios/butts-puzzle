'use client';

import { useState, useEffect, useCallback } from 'react';
import { savePuzzleScore, getPuzzleLeaderboard } from '@/lib/firebase';
import {
  login as authLogin,
  getPlayerName,
  isPremium,
  isLoggedIn,
  getDailyTries,
  canPlay,
  canAccess5x5,
  logout as authLogout,
  setPremium,
  decrementTries,
} from '@/lib/auth';

interface Score {
  id: string;
  playerName: string;
  moves: number;
  time: number;
  gridSize: number;
}

export default function SlidingNumbers() {
  const [playerName, setPlayerName] = useState('');
  const [isLoggedInState, setIsLoggedInState] = useState(false);
  const [gridSize, setGridSize] = useState(3);
  const [tiles, setTiles] = useState<number[]>([]);
  const [emptyIndex, setEmptyIndex] = useState(0);
  const [moves, setMoves] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState('Enter your name to play');
  const [isWin, setIsWin] = useState(false);
  const [leaderboard, setLeaderboard] = useState<Score[]>([]);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [dailyTries, setDailyTries] = useState(5);
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [paywallMessage, setPaywallMessage] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  useEffect(() => {
    const name = getPlayerName();
    if (name) {
      setPlayerName(name);
      setIsLoggedInState(true);
      setDailyTries(getDailyTries());
      setIsPremiumUser(isPremium());
      loadLeaderboard();
    }
  }, []);

  useEffect(() => {
    if (isLoggedInState) {
      initGame();
    }
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [isLoggedInState, gridSize]);

  const loadLeaderboard = async () => {
    const scores = await getPuzzleLeaderboard(gridSize);
    setLeaderboard(scores as Score[]);
    if (scores.length > 0) {
      setBestTime((scores[0] as Score).time);
    }
  };

  const initGame = useCallback(() => {
    if (!canPlay()) {
      setPaywallMessage('Daily limit reached! Come back tomorrow for more free games.');
      setShowPaywallModal(true);
      return;
    }

    if (gridSize === 5 && !canAccess5x5()) {
      setPaywallMessage('5x5 board is available for premium users only. Upgrade to unlock!');
      setShowPaywallModal(true);
      return;
    }

    const newTiles = Array.from({ length: gridSize * gridSize }, (_, i) => i);
    const newEmptyIndex = gridSize * gridSize - 1;
    setTiles(newTiles);
    setEmptyIndex(newEmptyIndex);
    setMoves(0);
    setElapsed(0);
    setIsWin(false);
    setMessage('Click a tile next to the empty space to move it');
    setGameStarted(false);
    
    if (timerInterval) clearInterval(timerInterval);
    setStartTime(null);
    
    shuffle(newTiles, newEmptyIndex);
  }, [gridSize, timerInterval]);

  const shuffle = (currentTiles: number[], currentEmpty: number) => {
    let newTiles = [...currentTiles];
    let newEmpty = currentEmpty;
    
    for (let i = 0; i < gridSize * 100; i++) {
      const neighbors = getNeighbors(newEmpty);
      const randomNeighbor = neighbors[Math.floor(Math.random() * neighbors.length)];
      [newTiles[newEmpty], newTiles[randomNeighbor]] = [newTiles[randomNeighbor], newTiles[newEmpty]];
      newEmpty = randomNeighbor;
    }
    
    setTiles(newTiles);
    setEmptyIndex(newEmpty);
    setMoves(0);
    setElapsed(0);
    setIsWin(false);
    setMessage('Click a tile next to the empty space to move it');
    setGameStarted(false);
    
    if (timerInterval) clearInterval(timerInterval);
    setStartTime(null);
  };

  const getNeighbors = (index: number) => {
    const neighbors: number[] = [];
    const row = Math.floor(index / gridSize);
    const col = index % gridSize;
    
    if (row > 0) neighbors.push(index - gridSize);
    if (row < gridSize - 1) neighbors.push(index + gridSize);
    if (col > 0) neighbors.push(index - 1);
    if (col < gridSize - 1) neighbors.push(index + 1);
    
    return neighbors;
  };

  const moveTile = (index: number) => {
    if (isWin || !gameStarted) return;
    
    const neighbors = getNeighbors(emptyIndex);
    if (!neighbors.includes(index)) return;
    
    const newTiles = [...tiles];
    [newTiles[emptyIndex], newTiles[index]] = [newTiles[index], newTiles[emptyIndex]];
    setTiles(newTiles);
    setEmptyIndex(index);
    setMoves(prev => prev + 1);
    
    checkWin(newTiles);
  };

  const checkWin = (currentTiles: number[]) => {
    const win = currentTiles.every((tile, i) => tile === i);
    if (win) {
      if (timerInterval) clearInterval(timerInterval);
      setIsWin(true);
      
      const finalMoves = moves + 1;
      const finalTime = startTime ? Math.floor((Date.now() - startTime) / 1000) : elapsed;
      
      setMessage(`Congratulations! Solved in ${finalMoves} moves and ${formatTime(finalTime)}!`);
      savePuzzleScore(playerName, finalMoves, finalTime, gridSize);
      loadLeaderboard();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const solve = () => {
    const solved = Array.from({ length: gridSize * gridSize }, (_, i) => i);
    setTiles(solved);
    setEmptyIndex(gridSize * gridSize - 1);
    setMessage('Puzzle solved! Click "New Game" to play again.');
  };

  const handleDifficulty = (size: number) => {
    if (size === 5 && !canAccess5x5()) {
      setPaywallMessage('5x5 board is available for premium users only. Upgrade to unlock!');
      setShowPaywallModal(true);
      return;
    }
    setGridSize(size);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim()) {
      authLogin(playerName.trim());
      setIsLoggedInState(true);
      setDailyTries(getDailyTries());
      setIsPremiumUser(isPremium());
    }
  };

  const newGame = () => {
    if (timerInterval) clearInterval(timerInterval);
    initGame();
  };

  const startTimer = () => {
    if (!startTime) {
      setStartTime(Date.now());
      const interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - (startTime || Date.now())) / 1000));
      }, 1000);
      setTimerInterval(interval);
    }
  };

  const handleTileClick = (index: number) => {
    if (!gameStarted) {
      setGameStarted(true);
      decrementTries();
      setDailyTries(getDailyTries());
      startTimer();
    }
    moveTile(index);
  };

  const handleNewGame = () => {
    const remaining = getDailyTries();
    if (remaining <= 0) {
      setPaywallMessage('Daily limit reached! Come back tomorrow for more free games.');
      setShowPaywallModal(true);
      return;
    }
    
    if (gridSize === 5 && !canAccess5x5()) {
      setPaywallMessage('5x5 board is available for premium users only. Upgrade to unlock!');
      setShowPaywallModal(true);
      return;
    }
    
    setDailyTries(getDailyTries());
    if (timerInterval) clearInterval(timerInterval);
    initGame();
  };

  const handleLogout = () => {
    authLogout();
    setIsLoggedInState(false);
    setPlayerName('');
    setGridSize(3);
    setTiles([]);
    setIsWin(false);
    setMessage('Enter your name to play');
    if (timerInterval) clearInterval(timerInterval);
  };

  const handleUpgradeClick = () => {
    setShowUpgradeModal(true);
  };

  if (!isLoggedInState) {
    return (
      <div className="login-overlay">
        <div className="login-box">
          <h1>Sliding Numbers</h1>
          <p style={{ marginBottom: '1rem', color: '#888' }}>Enter your name to play</p>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
              Start Playing
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header-row">
        <h1>Sliding Numbers</h1>
        <div className="header-actions">
          {!isPremiumUser && (
            <button className="btn btn-premium btn-small" onClick={handleUpgradeClick}>
              Upgrade
            </button>
          )}
          {isPremiumUser && <span className="premium-badge">Premium</span>}
          <button className="btn btn-small btn-secondary" onClick={handleLogout}>Logout</button>
        </div>
      </div>
      <p className="subtitle">Sliding tile puzzle - arrange numbers in order</p>
      
      <div className="stats">
        <div className="stat">Player: {playerName}</div>
        <div className="stat">Tries: {dailyTries}/5</div>
        <div className="stat">Moves: {moves}</div>
        <div className="stat">Time: {formatTime(elapsed)}</div>
        <div className="stat">Best: {bestTime ? formatTime(bestTime) : '-'}</div>
      </div>
      
      <div className="difficulty">
        {[3, 4, 5].map(size => (
          <button
            key={size}
            className={gridSize === size ? 'active' : ''}
            onClick={() => handleDifficulty(size)}
          >
            {size}x{size}
            {size === 5 && !isPremiumUser && <span className="lock-icon">🔒</span>}
          </button>
        ))}
      </div>
      
      <div 
        className="puzzle-grid" 
        style={{ gridTemplateColumns: `repeat(${gridSize}, 80px)` }}
      >
        {tiles.map((tile, index) => (
          <div
            key={index}
            className={`tile ${tile === gridSize * gridSize - 1 ? 'empty' : ''}`}
            onClick={() => handleTileClick(index)}
          >
            {tile !== gridSize * gridSize - 1 ? tile + 1 : ''}
          </div>
        ))}
      </div>
      
      <div className="actions">
        <button className="btn btn-primary" onClick={handleNewGame}>
          New Game
        </button>
        <button className="btn btn-secondary" onClick={solve}>
          Show Solution
        </button>
      </div>
      
      <div className={`message ${isWin ? 'win-message' : ''}`}>
        {message}
      </div>

      <div className="leaderboard">
        <h3>🏆 Leaderboard ({gridSize}x{gridSize})</h3>
        {leaderboard.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#666' }}>No scores yet</p>
        ) : (
          leaderboard.map((entry, i) => (
            <div key={entry.id} className="leaderboard-entry">
              <span>#{i + 1} {entry.playerName}</span>
              <span>{entry.moves} moves / {formatTime(entry.time)}</span>
            </div>
          ))
        )}
      </div>

      {showPaywallModal && (
        <div className="paywall-overlay" onClick={() => setShowPaywallModal(false)}>
          <div className="paywall-modal" onClick={(e) => e.stopPropagation()}>
            <h2>🔒 Premium Required</h2>
            <p>{paywallMessage}</p>
            {paywallMessage.includes('5x5') && (
              <button className="btn btn-premium" onClick={() => { setShowPaywallModal(false); setShowUpgradeModal(true); }}>
                Upgrade to Premium
              </button>
            )}
            <button className="btn btn-primary" onClick={() => setShowPaywallModal(false)}>
              Got it
            </button>
          </div>
        </div>
      )}

      {showUpgradeModal && (
        <div className="paywall-overlay" onClick={() => setShowUpgradeModal(false)}>
          <div className="paywall-modal" onClick={(e) => e.stopPropagation()}>
            <h2>⭐ Unlock Premium</h2>
            <p>Get unlimited daily plays and access to 5x5 boards!</p>
            <ul className="premium-features">
              <li>✓ Unlimited daily games</li>
              <li>✓ Access to 5x5 challenge boards</li>
              <li>✓ One-time purchase, yours forever</li>
            </ul>
            <p className="premium-price">$2.99</p>
            <button className="btn btn-primary" onClick={() => window.open('https://buy.stripe.com/14A14gfh93E0dcZ71l7Re05', '_blank')}>
              Unlock Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
