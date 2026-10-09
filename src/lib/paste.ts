// Turns pasted multi-line text (bullet lists, markdown checklists, indented notes) into a tree.

export interface OutlineNode {
	text: string;
	done: boolean;
	children: OutlineNode[];
}

const BULLET = /^(?:[-*•+▪◦‣]|\d{1,3}[.)])\s+/;
const CHECKBOX = /^\[([ xX])\]\s*/;

export function parseOutline(text: string): OutlineNode[] {
	const roots: OutlineNode[] = [];
	const stack: { indent: number; node: OutlineNode }[] = [];

	for (const raw of text.split(/\r?\n/)) {
		if (!raw.trim()) continue;
		const lead = /^[\t ]*/.exec(raw)![0];
		const indent = [...lead].reduce((n, ch) => n + (ch === '\t' ? 4 : 1), 0);
		let line = raw.trim().replace(BULLET, '');
		let done = false;
		const check = CHECKBOX.exec(line);
		if (check) {
			done = check[1].toLowerCase() === 'x';
			line = line.slice(check[0].length);
		}
		line = line.trim();
		if (!line) continue;

		const node: OutlineNode = { text: line, done, children: [] };
		while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
		if (stack.length) stack[stack.length - 1].node.children.push(node);
		else roots.push(node);
		stack.push({ indent, node });
	}
	return roots;
}
