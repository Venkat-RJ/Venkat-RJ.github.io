import {writeFile} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const USER = 'Venkat-RJ';
const QUERY = `query ContributionCalendar($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        months { name firstDay }
        weeks {
          contributionDays { date weekday contributionCount color }
        }
      }
    }
  }
}`;

function xmlEscape(input) {
  return String(input).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&apos;" }[c]));
}
function validateCalendar(calendar) {
  if (!calendar || !Array.isArray(calendar.weeks) || calendar.weeks.length < 50 || calendar.weeks.length > 54)
    throw new Error("Unexpected GitHub contribution week count");
  if (!Array.isArray(calendar.months) || calendar.months.length < 10 || calendar.months.length > 14)
    throw new Error("Unexpected GitHub contribution months");
  if (!Number.isSafeInteger(calendar.totalContributions) || calendar.totalContributions < 0)
    throw new Error("Invalid total contributions");
  let seen = new Set();
  for (const week of calendar.weeks) {
    if (!Array.isArray(week.contributionDays) || week.contributionDays.length < 1 || week.contributionDays.length > 7)
      throw new Error("Invalid contribution week");
    for (const day of week.contributionDays) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !Number.isInteger(day.weekday) || day.weekday < 0 || day.weekday > 6 ||
          !Number.isSafeInteger(day.contributionCount) || day.contributionCount < 0 || !/^#[0-9a-f]{6}$/i.test(day.color) ||
          seen.has(day.date))
        throw new Error("Invalid or duplicated contribution day");
      seen.add(day.date);
    }
  }
  for (const month of calendar.months) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(month.firstDay) || typeof month.name !== "string")
      throw new Error("Invalid contribution month");
  }
  return calendar;
}
function renderSvg(value) {
  const calendar = validateCalendar(value);
  const cell = 10, step = 13, left = 36, top = 28;
  const width = left + (calendar.weeks.length - 1) * step + cell + 10;
  const height = top + 6 * step + cell + 10;
  const monthLabels = calendar.months.map(month => {
    const index = calendar.weeks.findIndex(week => week.contributionDays.some(day => day.date === month.firstDay));
    return index < 0 ? "" : `<text x="${left + index * step}" y="13">${xmlEscape(month.name.slice(0,3))}</text>`;
  }).filter(Boolean).join("\n    ");
  const weekdayLabels = [[1,"Mon"],[3,"Wed"],[5,"Fri"]]
    .map(([day,label]) => `<text x="0" y="${top + day * step + 8}">${label}</text>`).join("\n    ");
  const days = calendar.weeks.flatMap((week, weekIndex) =>
    week.contributionDays.map(day => {
      const x = left + weekIndex * step;
      const y = top + day.weekday * step;
      const info = `${day.contributionCount} ${day.contributionCount === 1 ? "contribution" : "contributions"} on ${day.date}`;
      return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${day.color}"><title>${xmlEscape(info)}</title></rect>`;
    })
  ).join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="calendar-title calendar-desc">
  <title id="calendar-title">GitHub contribution calendar for Venkat-RJ</title>
  <desc id="calendar-desc">Daily activity reported by GitHub over the past year, ${calendar.totalContributions} contributions in this calendar. Some work may not appear.</desc>
  <g fill="#666c75" font-family="Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="10">
    ${monthLabels}
    ${weekdayLabels}
  </g>
  ${days}
</svg>\n`;
}

async function main() {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GH_TOKEN must be provided by GitHub Actions');
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'venkat-rj-portfolio-contributions'
    },
    body: JSON.stringify({query: QUERY, variables: {login: USER}}),
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`GitHub GraphQL returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(`GitHub GraphQL: ${payload.errors.map(error=>error.message).join('; ')}`);
  const calendar = payload.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar) throw new Error('GitHub did not return a contribution calendar');
  const file = fileURLToPath(new URL('../site/assets/github-contributions.svg', import.meta.url));
  await writeFile(file, renderSvg(calendar), 'utf8');
  console.log(`Rendered GitHub contribution calendar for ${USER}: ${calendar.weeks.length} weeks, ${calendar.totalContributions} contributions.`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}

export {validateCalendar, renderSvg};
