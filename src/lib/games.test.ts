import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

async function seedFilteredGames(db: Database): Promise<{ strategy: { id: number; name: string }; puzzle: { id: number; name: string }; codeForge: { id: number; name: string }; devMasters: { id: number; name: string } }> {
    const [strategy] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id, name: categories.name });
    const [puzzle] = await db
        .insert(categories)
        .values({ name: 'Puzzle', description: 'cat' })
        .returning({ id: categories.id, name: categories.name });
    const [codeForge] = await db
        .insert(publishers)
        .values({ name: 'CodeForge Studios', description: 'pub' })
        .returning({ id: publishers.id, name: publishers.name });
    const [devMasters] = await db
        .insert(publishers)
        .values({ name: 'DevMasters Inc.', description: 'pub' })
        .returning({ id: publishers.id, name: publishers.name });

    await db.insert(games).values([
        { title: 'Alpha Strategy', description: 'Strategy title', starRating: 4.2, categoryId: strategy.id, publisherId: codeForge.id },
        { title: 'Beta Strategy', description: 'Another strategy title', starRating: 4.4, categoryId: strategy.id, publisherId: devMasters.id },
        { title: 'Gamma Puzzle', description: 'Puzzle title', starRating: 4.1, categoryId: puzzle.id, publisherId: codeForge.id },
    ]);

    return { strategy, puzzle, codeForge, devMasters };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('filters games by category ids', async () => {
        const { strategy } = await seedFilteredGames(db);
        const filtered = await getAllGames(db, { categoryIds: [strategy.id] });

        expect(filtered.map((game) => game.title)).toEqual(['Alpha Strategy', 'Beta Strategy']);
        expect(filtered.every((game) => game.category?.name === 'Strategy')).toBe(true);
    });

    it('combines category and publisher filters', async () => {
        const { strategy, codeForge } = await seedFilteredGames(db);
        const filtered = await getAllGames(db, { categoryId: strategy.id, publisherId: codeForge.id });

        expect(filtered.map((game) => game.title)).toEqual(['Alpha Strategy']);
        expect(filtered[0].publisher).toEqual({ id: codeForge.id, name: 'CodeForge Studios' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
