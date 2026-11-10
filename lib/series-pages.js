// Pages « séries » : accueil et fiche joueur (insérées dans site.js à la construction)
export const SERIES_CSS = `
.chips{display:flex;gap:8px;overflow-x:auto;margin:4px -16px 16px;padding:0 16px;scrollbar-width:none}
.chips::-webkit-scrollbar{display:none}
.chips a{white-space:nowrap;padding:8px 14px;border-radius:999px;background:var(--card);border:1px solid var(--edge);font-weight:600;font-size:14px;color:var(--mute)}
.chips a.on{background:var(--ink);color:var(--night);border-color:var(--ink)}
.pc .line{display:block;font:800 26px/1 var(--disp);margin-top:14px;letter-spacing:.01em}
.pc .score small{font-size:.45em;color:rgba(255,255,255,.7);margin-left:4px}
.rates{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap}
.rates span{background:rgba(0,0,0,.32);border-radius:10px;padding:5px 8px;font-size:12px;color:rgba(255,255,255,.8)}
.rates b{font:800 15px var(--disp);color:#fff;margin-left:4px}
.hit{font:800 22px/1 var(--disp);border-radius:12px;padding:7px 10px;min-width:58px;text-align:center;background:var(--card-2)}
.hit.h3{background:rgba(61,220,151,.16);color:#3DDC97}.hit.h2{background:rgba(255,181,71,.14);color:var(--warn)}
.li .line{font-weight:700;color:var(--ink)}
.grid{background:var(--card);border:1px solid var(--edge);border-radius:20px;overflow:hidden}
.grid table{font-size:15px}
.grid th,.grid td{text-align:center;padding:10px 6px}
.grid th:first-child,.grid td:first-child{text-align:left;padding-left:14px}
.grid td.t{font:800 20px var(--disp)}
.cell{display:inline-block;min-width:46px;border-radius:9px;padding:4px 6px;font:800 16px var(--disp);background:var(--card-2);color:var(--mute)}
.cell.c3{background:rgba(61,220,151,.18);color:#3DDC97}.cell.c2{background:rgba(255,181,71,.15);color:var(--warn)}.cell.c1{background:rgba(255,93,115,.12);color:#FF8A9A}
.bars .line-mark{position:absolute;left:0;right:0;border-top:2px dashed rgba(255,255,255,.55)}
.chart{position:relative}
.bars{position:relative}
.bars b.ok{background:linear-gradient(180deg,#5BE5A8,#2BAF77)}
.bars b.ko{background:linear-gradient(180deg,#59607F,#3A4062)}
.bars div:last-child b{box-shadow:none}
.legend{color:var(--mute);font-size:13px;margin:8px 4px 2px}
.resp{border-top:1px solid var(--edge);margin-top:30px;padding-top:16px}
`;

export const STAT_TABS = [['all', 'Toutes'], ['pts', 'Points'], ['reb', 'Rebonds'], ['ast', 'Passes'], ['tpm', '3 points'], ['stl', 'Interceptions'], ['blk', 'Contres'], ['pra', 'Pts+Reb+Pas'], ['pr', 'Pts+Reb'], ['pa', 'Pts+Pas'], ['ra', 'Reb+Pas'], ['streak', 'Streak']];
export const rateClass = (h, n) => (!n ? '' : h / n >= 0.9 ? 'h3' : h / n >= 0.7 ? 'h2' : '');
export const cellClass = (h, n) => (!n ? '' : h / n >= 0.8 ? 'c3' : h / n >= 0.5 ? 'c2' : 'c1');
