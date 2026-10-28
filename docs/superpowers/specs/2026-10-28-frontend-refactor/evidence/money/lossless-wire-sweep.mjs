import { parse, stringify, isLosslessNumber, LosslessNumber } from 'lossless-json' // npm i lossless-json@4.3.3;
// Field registry (would be generated from OpenAPI + checked against MONEY/NON_MONEY lists)
const MONEY_KEYS = new Set(['amount','netBalance','netAmount','shareAmount']);
const MONEY_MAP_KEYS = new Set(['customShares']);
const DECIMAL_MAP_KEYS = new Set(['rates','percentageShares','shares']); // non-money decimals -> string, never WireAmount
const WIRE_RE = /^-?\d{1,15}(?:\.\d{1,4})?$/;
class WireAmount { constructor(s){ if(!WIRE_RE.test(s)) throw new Error('MoneyWireError'); this.decimal = s; } }
const toNum = (v) => { const n = Number(v.value); if (!Number.isSafeInteger(n) && String(n) !== v.value && Number(String(n)) !== n) throw new Error('unsafe'); return n; };
function reviver(key, value) {
  if (value === null || typeof value !== 'object' || isLosslessNumber(value)) return value; // leaves untouched; parent converts
  const entries = Array.isArray(value) ? value.map((v,i)=>[i,v]) : Object.entries(value);
  for (const [k, v] of entries) {
    if (!isLosslessNumber(v)) continue;
    let out;
    if (MONEY_MAP_KEYS.has(key)) out = new WireAmount(v.value);
    else if (DECIMAL_MAP_KEYS.has(key)) out = v.value;              // decimal string
    else if (!Array.isArray(value) && MONEY_KEYS.has(k)) out = new WireAmount(v.value);
    else out = Number(v.value);
    value[k] = out;
  }
  return value;
}
export const parseWire = (text) => { const r = parse(text, reviver); return isLosslessNumber(r) ? Number(r.value) : r; };
const moneyFromWire = (w) => { const m = /^(-?)(\d+)(?:\.(\d{1,4}))?$/.exec(w.decimal); return BigInt(m[1] + m[2] + (m[3] ?? '').padEnd(4,'0')); };
// sweep through full pipeline
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const rnd = mulberry32(20261028);
const randBig = (max) => { let r = 0n; for (let i=0;i<4;i++) r = (r<<32n) | BigInt(Math.floor(rnd()*2**32)); return r % max; };
const toDec = (u) => { const neg = u<0n; const a = neg?-u:u; const s = a.toString().padStart(5,'0'); return (neg?'-':'')+s.slice(0,-4)+'.'+s.slice(-4); };
const MAXU = 10n**19n; // decimal(19,4)
let wrong=0, rej=0, n=0;
for (let i=0;i<400000;i++){
  // log-uniform magnitude 10^0..10^19 units
  const exp = BigInt(Math.floor(rnd()*19)); const u0 = randBig(10n**(exp+1n)); const u = (rnd()<0.5? -u0 : u0);
  const s = toDec(u);
  const txt = `{"amount":${s},"sharingMode":{"customShares":{"a":${s}},"percentageShares":{"a":33.3333}},"rate":1}`;
  try { const o = parseWire(txt); const a = moneyFromWire(o.amount), b = moneyFromWire(o.sharingMode.customShares.a);
        if (a!==u || b!==u || typeof o.sharingMode.percentageShares.a !== 'string' || o.rate !== 1) wrong++; } catch(e) { rej++; }
  n++;
}
console.log('pipeline sweep', {n, wrong, rej});
// outgoing: bigint -> raw literal
const out = stringify({ amount: new LosslessNumber(toDec(8999999999999997n)), n: 1 });
console.log('stringify', out, ' JSON.stringify(1e-7)=', JSON.stringify(1e-7), ' JSON.stringify(1e21)=', JSON.stringify(1e21));
// edge rejects
for (const s of ['1e3','1.23456','1234567890123456.0000','-0.0000']) { try { const o = parseWire(`{"amount":${s}}`); console.log(s,'->',moneyFromWire(o.amount)); } catch(e){ console.log(s,'-> REJECT', e.message); } }
// perf
const big = JSON.stringify({ items: Array.from({length: 20000}, (_, i) => ({ id: 'e'+i, amount: 85.5, description: 'Dinner "amount":5', date: 1717200000, sharingMode: { type:'EXACT', customShares: { a: 42.75, b: 42.75 } }, participants: [{ userId:'u', shareAmount: 42.75 }] })) }).replace(/85\.5/g,'85.5000');
let t=performance.now(); for(let i=0;i<5;i++) JSON.parse(big); const tj=(performance.now()-t)/5;
t=performance.now(); for(let i=0;i<5;i++) parseWire(big); const tl=(performance.now()-t)/5;
console.log(`payload ${(big.length/1e6).toFixed(2)} MB: JSON.parse ${tj.toFixed(1)} ms, parseWire ${tl.toFixed(1)} ms`);
console.log('string-embedded key untouched:', parseWire(big).items[0].description);
