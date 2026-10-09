import { describe, expect, it } from 'vitest';
import { parseOutline } from './paste';

describe('parseOutline', () => {
	it('builds a tree from indentation and strips bullets', () => {
		const tree = parseOutline(`- Plan trip
  - Book flights
  - Hotel
    * compare prices
- [x] Pack bag
1. Call grandma`);
		expect(tree).toEqual([
			{
				text: 'Plan trip',
				done: false,
				children: [
					{ text: 'Book flights', done: false, children: [] },
					{
						text: 'Hotel',
						done: false,
						children: [{ text: 'compare prices', done: false, children: [] }]
					}
				]
			},
			{ text: 'Pack bag', done: true, children: [] },
			{ text: 'Call grandma', done: false, children: [] }
		]);
	});

	it('handles tabs, blank lines and odd dedents', () => {
		const tree = parseOutline('A\n\tB\n\n\t\tC\n\tD\n  E');
		expect(tree.map((n) => n.text)).toEqual(['A']);
		expect(tree[0].children.map((n) => n.text)).toEqual(['B', 'D', 'E']);
		expect(tree[0].children[0].children[0].text).toBe('C');
	});
});
