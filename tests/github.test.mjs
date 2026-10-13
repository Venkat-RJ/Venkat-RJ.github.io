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
test('merged PRs beyond the first twelve remain visible',async()=>{
 const original=globalThis.fetch;
 const pulls=Array.from({length:19},(_,index)=>({...snapshot.pulls.items[0],id:index,html_url:`https://github.com/owner/repo/pull/${index+1}`,state:index>=12?'closed':'open',draft:false,pull_request:{merged_at:index>=12?'2026-10-06T10:00:00Z':null}}));
 globalThis.fetch=async url=>({ok:true,json:async()=>url.includes('/search/issues')?{items:new URL(url).searchParams.get('per_page')==='100'?pulls:pulls.slice(0,12),total_count:19,incomplete_results:false}:[]});
 try {
  const data=await loadPublicData();
  assert.equal(data.pulls.items.length,19);
  assert.equal(data.pulls.items.filter(pull=>pullState(pull)==='Merged').length,7);
  assert.match(render(data),/19 public pull requests · 7 merged/);
  assert.match(render(data),/Show 15 more pull requests \(7 merged\)/);
 } finally {globalThis.fetch=original;}
});
test('an unavailable repository account cannot prevent a merged PR refresh',async()=>{
 const original=globalThis.fetch;
 const merged={...snapshot.pulls.items[0],state:'closed',draft:false,pull_request:{merged_at:'2026-10-06T10:00:00Z'}};
 globalThis.fetch=async url=>{
  if(url.includes('/users/Venkat-RJ/')) throw Error('account unavailable');
  return {ok:true,json:async()=>url.includes('/search/issues')?{items:[merged],total_count:1,incomplete_results:false}:[]};
 };
 try {
  const container={},status={},old={...snapshot,fetchedAt:'2020-01-01T00:00:00Z'};
  await refresh(container,status,old);
  assert.match(container.innerHTML,/state-merged/);
  assert.match(container.innerHTML,/1 public pull requests · 1 merged/);
  assert.match(status.textContent,/Some repository details use saved data/);
  await assert.rejects(loadPublicData(),/Repository data unavailable/);
 } finally {globalThis.fetch=original;}
});
test('incomplete PR results preserve the previous view',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async url=>({ok:true,json:async()=>url.includes('/search/issues')?{items:[],total_count:19,incomplete_results:true}:[]});
 try {
  const old={...snapshot,fetchedAt:'2020-01-01T00:00:00Z'},container={},status={};
  await refresh(container,status,old);
  assert.equal(container.innerHTML,render(old));
  assert.match(status.textContent,/Live update unavailable/);
 } finally {globalThis.fetch=original;}
});
test('build authentication is request-only and never saved in public data',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  assert.equal(options.headers.Authorization,'Bearer test-build-token');
  assert.equal(options.credentials,'omit');
  return {ok:true,json:async()=>url.includes('/search/issues')?{items:[],total_count:0,incomplete_results:false}:[]};
 };
 try {assert.ok(!JSON.stringify(await loadPublicData({token:'test-build-token'})).includes('test-build-token'));}
 finally {globalThis.fetch=original;}
});
