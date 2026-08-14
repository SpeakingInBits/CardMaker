import { describe, expect, it } from 'vitest';
import { HistoryManager } from './HistoryManager';

describe('HistoryManager', () => {
    it('starts with nothing to undo or redo', () => {
        const h = new HistoryManager();
        h.reset('a');
        expect(h.canUndo).toBe(false);
        expect(h.canRedo).toBe(false);
        expect(h.undo()).toBeNull();
        expect(h.redo()).toBeNull();
    });

    it('undoes and redoes committed states in order', () => {
        const h = new HistoryManager();
        h.reset('a');
        h.commit('b');
        h.commit('c');

        expect(h.undo()).toBe('b');
        expect(h.undo()).toBe('a');
        expect(h.canUndo).toBe(false);
        expect(h.redo()).toBe('b');
        expect(h.redo()).toBe('c');
        expect(h.canRedo).toBe(false);
    });

    it('ignores commits identical to the current state', () => {
        const h = new HistoryManager();
        h.reset('a');
        expect(h.commit('a')).toBe(false);
        expect(h.canUndo).toBe(false);
        expect(h.commit('b')).toBe(true);
    });

    it('clears the redo stack on a new commit', () => {
        const h = new HistoryManager();
        h.reset('a');
        h.commit('b');
        h.undo();
        expect(h.canRedo).toBe(true);
        h.commit('c');
        expect(h.canRedo).toBe(false);
        expect(h.undo()).toBe('a');
    });

    it('drops the oldest entries beyond the limit', () => {
        const h = new HistoryManager(2);
        h.reset('0');
        h.commit('1');
        h.commit('2');
        h.commit('3');
        expect(h.undo()).toBe('2');
        expect(h.undo()).toBe('1');
        expect(h.canUndo).toBe(false); // '0' fell off the end
    });

    it('reset discards all history', () => {
        const h = new HistoryManager();
        h.reset('a');
        h.commit('b');
        h.reset('fresh');
        expect(h.canUndo).toBe(false);
        expect(h.canRedo).toBe(false);
    });
});
