import test from 'node:test';
import assert from 'node:assert/strict';
import {renderSvg, validateCalendar} from '../scripts/update-contributions.mjs';

function sample() {
  const weeks = Array.from({length: 53}, (_, w) => ({
    contributionDays: Array.from({length: 7}, (_, d) => ({
      date: new Date(Date.UTC(2025, 10, 16 + w * 7 + d)).toISOString().slice(0, 10),
      weekday: d,
      contributionCount: w === 0 && d === 2 ? 1 : 0,
      color: w === 0 && d === 2 ? '#40c463' : '#ebedf0'
    }))
  }));
  const months = Array.from({length: 12}, (_, i) => {
    const month = new Date(Date.UTC(2025, 10 + i, 1));
    return {firstDay: month.toISOString().slice(0, 10), name: month.toLocaleDateString('en-US', {month:'long', timeZone:'UTC'})};
  });
  return {totalContributions: 1, weeks, months};
}

test('renders the exact daily contribution data as a responsive SVG', () => {
  const svg = renderSvg(sample());
  assert.match(svg, /viewBox="0 0 \d+ \d+"/);
  assert.match(svg, /#40c463/);
  assert.match(svg, /1 contribution on 2025-11-18/);
  assert.equal((svg.match(/<rect /g) || []).length, 53 * 7);
  assert.match(svg, /calendar-desc/);
});
test('rejects malformed colors and duplicate days', () => {
  const data = sample();
  data.weeks[0].contributionDays[0].color = '<script>';
  assert.throws(() => validateCalendar(data), /Invalid or duplicated/);
  data.weeks[0].contributionDays[0].color = '#ebedf0';
  data.weeks[0].contributionDays[1].date = data.weeks[0].contributionDays[0].date;
  assert.throws(() => validateCalendar(data), /Invalid or duplicated/);
});
test('rejects incomplete calendar datasets', () => {
  assert.throws(() => renderSvg({weeks:[],months:[],totalContributions:0}), /Unexpected/);
});
