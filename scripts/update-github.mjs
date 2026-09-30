import {readFile, writeFile} from 'node:fs/promises';
import {loadPublicData, render} from '../site/github.mjs';

// Read-only public requests. No token or private repository data is used.
const data = await loadPublicData();
const file = new URL('../site/index.html', import.meta.url);
const html = await readFile(file, 'utf8');
const stamp = new Date(data.fetchedAt).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'});
const block = `<!-- github:start -->
        <div id="github-content">${render(data)}</div>
        <p id="github-status" class="note" role="status">Saved public GitHub data from ${stamp}. Private work is not included.</p>
        <script type="application/json" id="github-snapshot">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
        <!-- github:end -->`;
if (!html.includes('<!-- github:start -->')) throw new Error('GitHub section markers are missing');
await writeFile(file, html.replace(/<!-- github:start -->[\s\S]*?<!-- github:end -->/, block));
console.log(`Saved ${data.repos.length} public repositories and ${data.pulls.items.length} pull requests.`);
