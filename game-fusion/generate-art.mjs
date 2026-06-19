/**
 * generate-art.mjs
 * Generates Game Fusion box art images via DALL-E 3 and saves them to ./art/
 *
 * Setup:
 *   npm install openai
 *   set OPENAI_API_KEY=sk-...
 *
 * Usage:
 *   node generate-art.mjs                        — generate the default pair list
 *   node generate-art.mjs chess poker            — generate one specific pair
 *   node generate-art.mjs --all                  — generate every possible pair (171 images, slow!)
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, 'art');
const DELAY_MS  = 13_000; // ~4-5 images/min to stay under standard rate limit

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Game descriptors for prompt building ─────────────────────────────
const GAMES = {
  chess:       { name: 'Chess',        elements: 'a glowing chess queen, marble board, scattered pieces in mid-battle' },
  dominoes:    { name: 'Dominoes',     elements: 'ornate ivory domino tiles with inlaid pips, long chain of played tiles' },
  poker:       { name: 'Poker',        elements: 'a royal flush fanned in one hand, towers of colorful poker chips, green felt' },
  scrabble:    { name: 'Scrabble',     elements: 'wooden letter tiles spelling dramatic words, a full board from above' },
  monopoly:    { name: 'Monopoly',     elements: 'a dramatic city skyline, stacks of colorful cash, hotels on a gleaming board' },
  battleship:  { name: 'Battleship',   elements: 'a warship on stormy seas, ocean grid map, explosion of red hit markers' },
  dnd:         { name: 'D&D',          elements: 'a glowing d20 die mid-roll, arcane runes, a dragon looming in the mist' },
  risk:        { name: 'Risk',         elements: 'a world map with territory markers, armies clashing at borders, flags' },
  go:          { name: 'Go',           elements: 'black and white stones on a wooden board, intricate patterns of play' },
  mahjong:     { name: 'Mahjong',      elements: 'jade-colored mahjong tiles arranged in a wall, Chinese characters glowing' },
  clue:        { name: 'Clue',         elements: 'a magnifying glass, candlestick, dark mansion corridor, shadowy suspect' },
  uno:         { name: 'Uno',          elements: 'a fan of bright UNO cards (red, blue, green, yellow), a wild card centered' },
  tetris:      { name: 'Tetris',       elements: 'colorful tetromino blocks cascading, nearly-complete glowing lines' },
  pacman:      { name: 'Pac-Man',      elements: 'Pac-Man racing through a neon maze, ghosts in pursuit, glowing pellets' },
  checkers:    { name: 'Checkers',     elements: 'red and black checker pieces mid-jump, a classic board with dramatic lighting' },
  backgammon:  { name: 'Backgammon',   elements: 'a leather backgammon board open, ivory and ebony pieces, pair of dice' },
  connect4:    { name: 'Connect Four', elements: 'a blue grid frame, cascading red and yellow discs, a winning diagonal glowing' },
  minesweeper: { name: 'Minesweeper',  elements: 'a Windows-style grid of tiles, a flag planted, a mine revealed in an explosion' },
  mtg:         { name: 'Magic',        elements: 'ornate Magic: The Gathering cards, mana symbols floating, a dragon creature card' },
  minecraft:   { name: 'Minecraft',    elements: 'isometric pixel-art landscape, glowing ore veins, blocky characters building' },
};

// ── Default pairs to generate ────────────────────────────────────────
// Edit this list to choose which combos you want pre-generated.
const DEFAULT_PAIRS = [
  ['chess',   'poker'],
  ['chess',   'dnd'],
  ['chess',   'monopoly'],
  ['poker',   'dnd'],
  ['tetris',  'pacman'],
  ['tetris',  'chess'],
  ['dnd',     'risk'],
  ['monopoly','risk'],
  ['go',      'chess'],
  ['uno',     'pacman'],
  ['clue',    'poker'],
  ['mtg',     'dnd'],
  ['connect4','tetris'],
  ['battleship','risk'],
  ['mahjong', 'go'],
];

// ── Prompt builder ───────────────────────────────────────────────────
function buildPrompt(idA, idB) {
  const a = GAMES[idA], b = GAMES[idB];
  return `Vintage 1970s board game box art illustration for a game called "${a.name} × ${b.name}".
The cover art is a single dramatic painted scene that blends elements from both games:
Left side features ${a.elements}.
Right side features ${b.elements}.
The two worlds merge dramatically in the center.
Style: richly painted retro illustration, deep jewel-tone colors, dynamic composition, bold graphic design.
Background: deep midnight navy or black, lit by warm golden and colored light.
Mood: epic, collectible, premium.
No text, no title, no logos — pure illustration only.`;
}

// ── File helpers ─────────────────────────────────────────────────────
function pairKey(idA, idB) {
  return [idA, idB].sort().join('-');
}

function outPath(key) {
  return path.join(OUT_DIR, `${key}.webp`);
}

function alreadyDone(key) {
  return fs.existsSync(outPath(key));
}

function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, res => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', err => { fs.unlink(dest, () => {}); reject(err); });
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Generate one pair ────────────────────────────────────────────────
async function generatePair(idA, idB) {
  const key    = pairKey(idA, idB);
  const dest   = outPath(key);
  const a      = GAMES[idA], b = GAMES[idB];

  if (!a) { console.error(`  ✗  Unknown game id: "${idA}"`); return; }
  if (!b) { console.error(`  ✗  Unknown game id: "${idB}"`); return; }

  if (alreadyDone(key)) {
    console.log(`  ✓  ${key}.webp already exists — skipping`);
    return;
  }

  console.log(`  ⏳  Generating ${a.name} × ${b.name} ...`);
  const prompt = buildPrompt(idA, idB);

  try {
    const response = await client.images.generate({
      model:   'dall-e-3',
      prompt,
      n:        1,
      size:    '1792x1024',   // widescreen landscape — perfect for box art
      quality: 'hd',
      style:   'vivid',
    });

    const url = response.data[0].url;
    await downloadImage(url, dest);
    console.log(`  ✅  Saved ${key}.webp`);

  } catch (err) {
    if (err?.status === 429) {
      console.warn(`  ⚠️  Rate limited. Waiting 30s before retry...`);
      await sleep(30_000);
      return generatePair(idA, idB); // one retry
    }
    console.error(`  ✗  Failed (${a.name} × ${b.name}): ${err.message}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable is not set.');
    console.error('Run:  set OPENAI_API_KEY=sk-...');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const args = process.argv.slice(2);

  let pairs;

  if (args.includes('--all')) {
    // Every possible combination
    const ids = Object.keys(GAMES);
    pairs = [];
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++)
        pairs.push([ids[i], ids[j]]);
    console.log(`Generating all ${pairs.length} combinations. This will take ~${Math.ceil(pairs.length * DELAY_MS / 60000)} minutes.\n`);

  } else if (args.length === 2) {
    // Specific pair from CLI: node generate-art.mjs chess poker
    pairs = [[args[0], args[1]]];

  } else if (args.length === 0) {
    pairs = DEFAULT_PAIRS;
    console.log(`Generating ${pairs.length} default pairs. (~${Math.ceil(pairs.length * DELAY_MS / 60000)} minutes)\n`);

  } else {
    console.error('Usage:');
    console.error('  node generate-art.mjs                  # default pairs');
    console.error('  node generate-art.mjs chess poker      # one pair');
    console.error('  node generate-art.mjs --all            # every combo');
    process.exit(1);
  }

  for (let i = 0; i < pairs.length; i++) {
    const [a, b] = pairs[i];
    console.log(`[${i + 1}/${pairs.length}] ${a} × ${b}`);
    await generatePair(a, b);
    if (i < pairs.length - 1) {
      console.log(`  ⏱  Waiting ${DELAY_MS / 1000}s (rate limit buffer)...\n`);
      await sleep(DELAY_MS);
    }
  }

  console.log('\nDone! Images saved to ./art/');
  console.log('The site will automatically use these over the SVG fallback.');
}

main();
