import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AvatarPicker from './AvatarPicker.svelte';

describe('AvatarPicker.svelte', () => {
	it('picks an emoji and marks it chosen', async () => {
		const picked: number[] = [];
		render(AvatarPicker, { value: 0, onpick: (a: number) => picked.push(a) });

		await expect
			.element(page.getByRole('radio', { name: '🦊' }))
			.toHaveAttribute('aria-checked', 'true');
		await page.getByRole('radio', { name: '🐸' }).click();
		await expect
			.element(page.getByRole('radio', { name: '🐸' }))
			.toHaveAttribute('aria-checked', 'true');
		await expect
			.element(page.getByRole('radio', { name: '🦊' }))
			.toHaveAttribute('aria-checked', 'false');
		expect(picked).toEqual([1]);

		await page.getByRole('button', { name: 'Random' }).click();
		expect(picked).toHaveLength(2);
		expect(picked[1]).not.toBe(1);
	});
});
