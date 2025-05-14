#!/usr/bin/env node

const { program } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const fs = require('fs').promises;
const path = require('path');

const HIGHSCORE_FILE = path.join(process.env.HOME || process.env.USERPROFILE, '.memory_highscores.json');

// Initialize 4x4 board with 8 pairs of symbols
const symbols = ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D', 'E', 'E', 'F', 'F', 'G', 'G', 'H', 'H'];

// Load high scores
async function loadHighScores() {
  try {
    const data = await fs.readFile(HIGHSCORE_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Save high score
async function saveHighScore(score, name) {
  const highScores = await loadHighScores();
  highScores.push({ name, score, date: new Date().toISOString() });
  highScores.sort((a, b) => b.score - a.score); // Sort by score descending
  highScores.splice(5); // Keep top 5 scores
  await fs.writeFile(HIGHSCORE_FILE, JSON.stringify(highScores, null, 2));
}

// Display high scores
async function showHighScores() {
  const highScores = await loadHighScores();
  if (!highScores.length) {
    console.log(chalk.yellow('No high scores yet.'));
    return;
  }
  console.log(chalk.blue('High Scores:'));
  highScores.forEach((entry, index) => {
    console.log(`${index + 1}. ${entry.name} - ${entry.score} points (${entry.date})`);
  });
}

// Reset high scores
async function resetHighScores() {
  await fs.writeFile(HIGHSCORE_FILE, JSON.stringify([], null, 2));
  console.log(chalk.green('High scores cleared!'));
}

// Shuffle array
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Initialize game board
function createBoard() {
  const shuffled = shuffle([...symbols]);
  const board = [];
  for (let i = 0; i < 4; i++) {
    board.push(shuffled.slice(i * 4, (i + 1) * 4));
  }
  return board;
}

// Display board (hidden unless revealed)
function displayBoard(board, revealed) {
  console.log(chalk.blue('  1 2 3 4'));
  for (let i = 0; i < 4; i++) {
    let row = `${i + 1} `;
    for (let j = 0; j < 4; j++) {
      const cell = revealed[i][j] ? chalk.green(board[i][j]) : chalk.gray('*');
      row += cell + ' ';
    }
    console.log(row);
  }
}

// Parse coordinates (e.g., "1,2")
function parseCoordinates(input) {
  if (!/^[1-4],[1-4]$/.test(input)) {
    throw new Error('Invalid format. Use coordinates (e.g., 1,2).');
  }
  const [row, col] = input.split(',').map(num => parseInt(num) - 1);
  return [row, col];
}

// Play a game
async function playGame() {
  const board = createBoard();
  const revealed = Array(4).fill().map(() => Array(4).fill(false));
  let moves = 0;
  let matches = 0;

  console.log(chalk.cyan('Welcome to Memory Match!'));
  console.log(chalk.cyan('Match pairs of symbols by selecting two cards (e.g., 1,1 and 2,3).'));

  while (matches < 8) {
    displayBoard(board, revealed);

    // Get first card
    const { first } = await inquirer.prompt([
      {
        type: 'input',
        name: 'first',
        message: 'Enter first card coordinates (e.g., 1,2):',
        validate: input => {
          try {
            const [row, col] = parseCoordinates(input);
            return !revealed[row][col] ? true : 'Card already revealed!';
          } catch {
            return 'Invalid format. Use coordinates (e.g., 1,2).';
          }
        },
      },
    ]);
    const [row1, col1] = parseCoordinates(first);
    revealed[row1][col1] = true;
    displayBoard(board, revealed);

    // Get second card
    const { second } = await inquirer.prompt([
      {
        type: 'input',
        name: 'second',
        message: 'Enter second card coordinates (e.g., 2,3):',
        validate: input => {
          try {
            const [row, col] = parseCoordinates(input);
            return !(revealed[row][col] || (row === row1 && col === col1))
              ? true
              : 'Invalid or already revealed card!';
          } catch {
            return 'Invalid format. Use coordinates (e.g., 2,3).';
          }
        },
      },
    ]);
    const [row2, col2] = parseCoordinates(second);
    revealed[row2][col2] = true;
    displayBoard(board, revealed);

    moves++;

    // Check for match
    if (board[row1][col1] === board[row2][col2]) {
      console.log(chalk.green('Match found!'));
      matches++;
    } else {
      console.log(chalk.red('No match! Cards will be hidden.'));
      revealed[row1][col1] = false;
      revealed[row2][col2] = false;
    }

    await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause
  }

  displayBoard(board, revealed);
  const score = Math.max(100 - moves * 5, 10); // Score based on moves
  console.log(chalk.green(`Congratulations! You cleared the board in ${moves} moves!`));
  console.log(chalk.green(`Your score: ${score}`));
  const { name } = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Enter your name to save your score:',
      default: 'Player',
    },
  ]);
  await saveHighScore(score, name);
}

program
  .command('play')
  .description('Start a new game')
  .action(() => playGame());

program
  .command('highscore')
  .description('View high scores')
  .action(() => showHighScores());

program
  .command('reset')
  .description('Clear high scores')
  .action(() => resetHighScores());

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
  console.log(chalk.cyan('Use the "play" command to start the game!'));
}
