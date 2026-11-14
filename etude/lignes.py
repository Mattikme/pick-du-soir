# Étude « lignes Plus/Moins » : ligne de référence au demi-point + probabilité Plus/Moins (régression logistique, test walk-forward).
# Usage : python3 lignes.py nba|nhl   (lit nba.json / nhl.json produits par dump.mjs, écrit lignes_<ligue>.json)
import sys, json, numpy as np, pandas as pd, warnings; warnings.filterwarnings('ignore')
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, brier_score_loss
LG=sys.argv[1]
df=pd.DataFrame(json.load(open(LG+'.json'))); df['d']=pd.to_datetime(df['d'])
if LG=='nba':
    for c in ['min','pts','reb','ast','tpm']: df[c]=pd.to_numeric(df[c])
    df['pra']=df.pts+df.reb+df.ast; df['pr']=df.pts+df.reb; df['pa']=df.pts+df.ast; df['ra']=df.reb+df.ast
    MINL={'pts':12.5,'reb':5.5,'ast':4.5,'tpm':2.5,'pra':19.5,'pr':14.5,'pa':14.5,'ra':7.5}; MINT,MINT20=18,24; TRAIN_MIN=8000
else:
    df['min']=pd.to_numeric(df.toi)/60; df['sog']=pd.to_numeric(df.sog)
    MINL={'sog':1.5}; MINT,MINT20=13,14; TRAIN_MIN=8000
STATS=list(MINL)
df=df.sort_values(['d','gid']).reset_index(drop=True)
allow={}
for s in STATS:   # défense adverse : total concédé sur 15 matchs / moyenne de la ligue, avant le match
    t=df.groupby(['gid','opp','d'],sort=False)[s].sum().reset_index().sort_values(['d','gid'])
    t['a15']=t.groupby('opp')[s].transform(lambda x:x.shift(1).rolling(15,min_periods=8).mean())
    t['lg']=t[s].shift(1).rolling(450,min_periods=100).mean()
    allow[s]=dict(zip(zip(t.gid,t.opp),(t.a15/t.lg)))
def feats_for(p,mn,L,mC,home,rest,ow):
    l10,l20,l40=p[-10:],p[-20:],p[-40:]
    c=lambda x,a,b:min(max(x,a),b)
    return [c(l10.mean()/L,0,3),c(l20.mean()/L,0,3),c(l40.mean()/L,0,3),c(p[-1]/L,0,3),c(mn[-3:].mean()/mn[-20:].mean(),.3,2),c(mn[-5:].mean()/mn[-20:].mean(),.3,2),
            c(1 if ow!=ow else ow,.7,1.3),np.log(L),(p[-5:]>L).mean(),(l20>L).mean(),c((mC-L)/np.sqrt(L),-2,2),int(rest==1),int(home)]
def ref_line(p,mC):
    # ligne de référence : le demi-point qui coupe le mieux en deux les matchs récents (40, 20 et 10 derniers, pondérés)
    best=None
    for L in (np.floor(mC)-.5,np.floor(mC)+.5,np.floor(mC)+1.5):
        if L<.5: continue
        f=0.4*(p[-40:]>L).mean()+0.3*(p[-20:]>L).mean()+0.3*(p[-10:]>L).mean()
        if best is None or abs(f-.5)<best[0]-1e-9: best=(abs(f-.5),L)
    return best[1]
FE=['r_a10','r_a20','r_a40','r_last','minr3','minr','oppr','logL','h5','h20','gap','b2b','home']
out=[]
for pid,g in df.groupby('pid',sort=False):
    g=g.reset_index(drop=True); n=len(g)
    if n<16: continue
    dts=g['d'].values; home=g['home'].values; mins=g['min'].values.astype(float)
    for s in STATS:
        v=g[s].values.astype(float)
        for i in range(15,n):
            p=v[:i]; mn=mins[:i]
            if mn[-5:].mean()<MINT or mn[-20:].mean()<MINT20: continue
            rest=int((dts[i]-dts[i-1])/np.timedelta64(1,'D'))
            if rest>12: continue
            mC=0.4*np.median(p[-40:])+0.3*np.median(p[-20:])+0.3*np.median(p[-10:])
            L0=ref_line(p,mC)
            if L0<MINL[s]: continue
            step=max(1,round(0.08*L0)); ow=allow[s].get((g.gid[i],g.opp[i]),np.nan)
            for off in (-1,0,1):
                L=L0+off*step
                if L<.5: continue
                out.append((pid,g.gid[i],str(dts[i])[:10],s,off,L,v[i],int(v[i]>L),*feats_for(p,mn,L,mC,home[i],rest,ow)))
F=pd.DataFrame(out,columns=['pid','gid','d','stat','off','L','val','y']+FE); F['d']=pd.to_datetime(F.d)
print(LG,len(F),'lignes ; base Plus (ligne de référence)',round(F[F.off==0].y.mean(),3))
def fit(tr):
    mu,sd=tr[FE].mean(),tr[FE].std().replace(0,1); m=LogisticRegression(max_iter=3000,C=.3).fit((tr[FE]-mu)/sd,tr.y); return mu,sd,m
oos=[]
for mth in pd.period_range('2026-01',pd.Timestamp.now().to_period('M'),freq='M'):   # test mois par mois, jusqu'au mois en cours
    s,e=mth.start_time,(mth+1).start_time; te=F[(F.d>=s)&(F.d<e)]; tr=F[F.d<s]
    if te.empty or len(tr)<TRAIN_MIN: continue
    mu,sd,m=fit(tr); oos.append(te.assign(z=m.decision_function((te[FE]-mu)/sd)))
O=pd.concat(oos)
pl=LogisticRegression(C=1e6).fit(O[O.off==0][['z']],O[O.off==0].y); a,b=float(pl.coef_[0][0]),float(pl.intercept_[0])
O['p']=1/(1+np.exp(-(a*O.z+b)))
R=O[O.off==0].copy(); R['conf']=np.maximum(R.p,1-R.p); R['win']=np.where(R.p>=.5,R.y,1-R.y)
print('hors échantillon',len(R),'lignes',R.d.nunique(),'soirs',R.d.min().date(),R.d.max().date(),'| AUC',round(roc_auc_score(R.y,R.p),4),'Brier',round(brier_score_loss(R.y,R.p),4),'base',round(brier_score_loss(R.y,np.full(len(R),R.y.mean())),4),'| platt',round(a,3),round(b,3))
for off in (-1,1): t=O[O.off==off]; print('  décalage',off,'AUC',round(roc_auc_score(t.y,t.p),3),'prévu',round(t.p.mean(),3),'réel',round(t.y.mean(),3))
R['bin']=pd.cut(R.conf,[.5,.55,.58,.62,.65,.68,.72,1]); cal=R.groupby('bin',observed=True).agg(n=('win','size'),prevu=('conf','mean'),reel=('win','mean')).round(3); print(cal.to_string())
LO,LOP,HI=.56,.55,.72   # confiance mini côté Moins, côté Plus, et maxi
R['side']=np.where(R.p>=.5,'plus','moins')
def nightly(n,ms):
    # même règle que lib/lignes.js : une ligne par joueur, moitié de « Plus » si possible, pas plus de ms lignes par stat
    rows=[]
    for d,g in R.groupby('d'):
        c=g[(g.conf<=HI)&((g.conf>=LO)|((g.side=='plus')&(g.conf>=LOP)))].sort_values('conf',ascending=False).drop_duplicates('pid')
        keep=[]; k={}
        def take(pool,limit):
            for idx,r in pool.iterrows():
                if len(keep)>=limit: break
                if idx in keep or k.get(r.stat,0)>=ms: continue
                keep.append(idx); k[r.stat]=k.get(r.stat,0)+1
        take(c[c.side=='plus'],(n+1)//2); take(c,n); rows+=keep
    return R.loc[rows]
res={}
for n,ms in ((4,1 if LG=='nba' else 4),(10,3 if LG=='nba' else 10)):
    t=nightly(n,ms); P=t[t.side=='plus']; M=t[t.side=='moins']; res[n]=(round(float(t.win.mean()),3),int(len(t)),round(float(t.conf.mean()),3))
    print('top',n,'/soir : réussite',res[n][0],'prévu',res[n][2],'n',res[n][1],'| Plus',round(P.win.mean(),3),len(P),'Moins',round(M.win.mean(),3),len(M),'| stats',t.stat.value_counts().to_dict())
    if n==4: t['m']=t.d.dt.to_period('M'); print(t.groupby('m').win.agg(['mean','size']).round(3).T.to_string())
mu,sd,m=fit(F)
J={'league':LG,'feats':FE,'mu':[float(mu[f]) for f in FE],'sd':[float(sd[f]) for f in FE],'coef':[float(x) for x in m.coef_[0]],'intercept':float(m.intercept_[0]),'platt':[a,b],
 'minLine':MINL,'minT':MINT,'minT20':MINT20,'lo':LO,'loPlus':LOP,'hi':HI,'trained_rows':int(len(F)),'oos_days':int(R.d.nunique()),'oos_from':str(R.d.min().date()),'oos_to':str(R.d.max().date()),
 'top4':res[4][0],'top4_n':res[4][1],'top10':res[10][0],'auc':round(float(roc_auc_score(R.y,R.p)),3),
 'calib':[{'tranche':str(i),'n':int(r.n),'prevu':float(r.prevu),'reel':float(r.reel)} for i,r in cal.iterrows()]}
json.dump(J,open(f'lignes_{LG}.json','w'),indent=1)
R.to_pickle(f'oos_{LG}.pkl')
if len(sys.argv)>2:   # vecteurs de contrôle pour vérifier que lib/lignes.js calcule exactement la même chose (voir etude/parite.mjs)
    T=F[F.off==0].copy(); T['p']=1/(1+np.exp(-(a*m.decision_function((T[FE]-mu)/sd)+b)))
    T.assign(d=T.d.dt.strftime('%Y-%m-%d'))[['pid','gid','d','stat','L','oppr','p']].to_json(f'vecteurs_{LG}.json',orient='records')
