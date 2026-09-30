import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {accounts,render,refresh,loadPublicData,pullState} from '../site/github.mjs';
const html = await readFile(new URL('../site/index.html',import.meta.url),'utf8');
const snapshot = JSON.parse(html.match(/id="github-snapshot">(.*?)<\/script>/s)[1]);
test('snapshot includes four confirmed accounts and only public fields', () => {
 assert.deepEqual(snapshot.accounts,accounts);
 assert.equal(new Set(snapshot.repos.map(r=>r.id)).size,snapshot.repos.length);
 assert.ok(snapshot.repos.every(r=>accounts.includes(r.owner.login)));
 assert.ok(!JSON.stringify(snapshot).includes('"body":'));
 assert.ok(html.includes(render(snapshot)));
});
test('pull request states are distinct', () => {
 assert.equal(pullState({state:'closed',pull_request:{merged_at:'2026-09-01'}}),'Merged');
 assert.equal(pullState({state:'closed',draft:true}),'Closed');
 assert.equal(pullState({state:'open',draft:true}),'Draft');
 assert.equal(pullState({state:'open',draft:false}),'Open');
});
test('repository text is escaped and non-GitHub URLs are rejected', () => {
 const data=structuredClone(snapshot);
 Object.assign(data.repos[0],{name:'<img onerror="alert(1)">',html_url:'javascript:alert(1)'});
 const result=render(data);
 assert.ok(result.includes('&lt;img'));
 assert.ok(!result.includes('href="javascript:'));
});
test('failed live refresh preserves snapshot, even with malformed storage',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>{throw Error('offline')};
 try {
  const data={...snapshot,fetchedAt:'2020-01-01T00:00:00Z'};
  const container={},status={};
  await refresh(container,status,data,{getItem:()=>'{broken'});
  assert.equal(container.innerHTML,render(data));
  assert.match(status.textContent,/Live update unavailable/);
 } finally {globalThis.fetch=original;}
});
test('public fetch paginates, excludes private records and deduplicates repos',async()=>{
 const original=globalThis.fetch;const visited=[];
 globalThis.fetch=async(url,options)=>{
  visited.push(url);assert.equal(options.credentials,'omit');
  if(url.includes('/search/issues')) return {ok:true,json:async()=>({items:[],total_count:0,incomplete_results:false})};
  const repo={id:1,name:'public',owner:{login:'Venkat-RJ'}};
  const batch=url.includes('/Venkat-RJ/') ? (url.includes('page=2') ? [{...repo,id:2,private:true},{...repo,id:3}] : Array.from({length:100},()=>repo)) : [];
  return {ok:true,json:async()=>batch};
 };
 try {
  const data=await loadPublicData();
  assert.deepEqual(data.repos.map(r=>r.id),[1,3]);
  assert.ok(visited.some(url=>url.endsWith('&page=2')));
 } finally {globalThis.fetch=original;}
});
