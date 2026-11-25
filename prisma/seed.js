/**
 * Optional, idempotent catalog seed: the game categories and the six built-in SPINVERSE
 * games. Run it manually after applying the migrations:
 *
 *   npm run prisma:seed
 *
 * Safe to run repeatedly: rows are created only when missing and existing rows are never
 * overwritten, so admin edits are preserved. Games are data, not code - add new ones
 * through the admin API (POST /api/v1/admin/games), not here.
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: 'Classic Slots', slug: 'classic-slots' },
  { name: 'Cascading Reels', slug: 'cascading-reels' },
  { name: 'Hold & Respin', slug: 'hold-respin' },
  { name: 'Crash', slug: 'crash' },
  { name: 'Card Duel', slug: 'card-duel' },
  { name: 'Table Games', slug: 'table-games' },
  { name: 'Instant Win', slug: 'instant-win' },
  { name: 'Arcade', slug: 'arcade' },
];

// Metadata comes from each game's package manifest (game-packages/<id>/manifest.json).
const BUILT_IN_GAMES = [
  {
    gameId: 'pharaohs-fortune',
    name: "Pharaoh's Fortune",
    category: 'classic-slots',
    description:
      'Classic 5×3 slot in a sun-struck Egyptian tomb. Expanding wilds and a hidden chamber bonus reward the curious.',
    featured: true,
    displayOrder: 1,
  },
  {
    gameId: 'atlantis-cascade',
    name: 'Atlantis Cascade',
    category: 'cascading-reels',
    description:
      'Cascading 6×5 symbols in a sunken city: wins vanish, new symbols tumble in and the multiplier rises.',
    featured: true,
    displayOrder: 2,
  },
  {
    gameId: 'neon-overdrive',
    name: 'Neon Overdrive',
    category: 'hold-respin',
    description:
      'Hold & Respin in a cyberpunk skyline. Lock glowing orbs, respin for point tiers and chase the Grand.',
    featured: false,
    displayOrder: 3,
  },
  {
    gameId: 'skyfall',
    name: 'SKYFALL',
    category: 'crash',
    description:
      'Crash game: ride the rising multiplier and cash out before the sky falls. Two bet panels, simulated players.',
    featured: false,
    displayOrder: 4,
  },
  {
    gameId: 'tiger-clash',
    name: 'TIGER CLASH',
    category: 'card-duel',
    description:
      'Mythical card duel: back Tiger, Dragon or Tie as one card each is revealed.',
    featured: false,
    displayOrder: 5,
  },
  {
    gameId: 'roulette',
    name: 'Roulette',
    category: 'table-games',
    description:
      'European roulette with a single zero, the full table layout and every inside and outside bet.',
    featured: false,
    displayOrder: 6,
  },
];

async function main() {
  const categoryIds = new Map();

  for (const [index, category] of CATEGORIES.entries()) {
    const row = await prisma.gameCategory.upsert({
      where: { slug: category.slug },
      update: {},
      create: { ...category, sortOrder: index + 1 },
    });
    categoryIds.set(category.slug, row.id);
  }

  for (const { category, ...game } of BUILT_IN_GAMES) {
    await prisma.game.upsert({
      where: { gameId: game.gameId },
      update: {},
      create: {
        ...game,
        categoryId: categoryIds.get(category),
        developer: 'SPINVERSE',
        thumbnail: 'assets/thumbnail.webp',
        entryPoint: 'index.html',
        version: '1.0.0',
        status: 'ACTIVE',
        visibility: 'PUBLIC',
        orientation: 'BOTH',
        platforms: ['DESKTOP', 'TABLET', 'MOBILE'],
        builtIn: true,
      },
    });
  }

  console.log(`Seeded ${CATEGORIES.length} categories and ${BUILT_IN_GAMES.length} built-in games.`);
}

main()
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
