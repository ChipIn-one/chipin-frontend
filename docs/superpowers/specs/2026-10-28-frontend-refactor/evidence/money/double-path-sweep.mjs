// Seeded PRNG
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const rnd = mulberry32(42);
const randBig = (max) => { // uniform bigint in [0,max)
  const m = BigInt(max); let r = 0n; for (let i=0;i<4;i++) r = (r<<32n) | BigInt(Math.floor(rnd()*2**32)); return r % m; };
const toDec = (u) => { const neg = u<0n; let a = neg?-u:u; const s = a.toString().padStart(5,'0'); return (neg?'-':'')+s.slice(0,-4)+'.'+s.slice(-4); };
// Methods
const mRound = (v) => { const r = Math.round(v*1e4); return Number(r)/1e4 === v ? BigInt(r) : 'REJ'; };
const mFixed = (v) => { const s = v.toFixed(4); const r = BigInt(s.replace('.','')); return Number(s) === v ? r : 'REJ'; };
const mText = (s) => { const m = /^(-?)(\d+)(?:\.(\d{1,4}))?$/.exec(s); if(!m) return 'REJ'; return BigInt(m[1]+m[2]+(m[3]??'').padEnd(4,'0')); };
const U=10000n; const ranges = [[0n, 10n**11n*U],[10n**11n*U, 2n**39n*U],[2n**39n*U, 9n*10n**11n*U],[9n*10n**11n*U, 10n**15n*U]];
const N = 400000;
for (const [lo,hi] of ranges) {
  const res = {round:{wrong:0,rej:0}, fixed:{wrong:0,rej:0}, text:{wrong:0,rej:0}}; let ex={};
  for (let i=0;i<N;i++){
    const u = lo + randBig(hi-lo); const s = toDec(u); const v = JSON.parse(s);
    for (const [k,f,arg] of [['round',mRound,v],['fixed',mFixed,v],['text',mText,s]]) {
      const r = f(arg); if (r==='REJ') {res[k].rej++; ex[k+'Rej']??=s;} else if (r!==u) {res[k].wrong++; ex[k+'Wrong']??=s+'->'+r;}
    }
  }
  console.log(`[${toDec(lo)}, ${toDec(hi)})`, JSON.stringify(res), JSON.stringify(ex));
}
// specific vectors
for (const s of ['899999999999.9997','365963032346.3555','99999999999.9999','100000000000.0001','54975581388.7999','746251344.6807','96689212322.2351']) {
  const v = JSON.parse(s); console.log(s, 'round=', mRound(v), 'fixed=', mFixed(v), 'text=', mText(s));
}
console.log('2^39/1e4 =', 2**39/1e4, ' 2^53/1e4=', 2**53/1e4);
