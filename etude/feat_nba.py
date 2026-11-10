import json, numpy as np, pandas as pd
from collections import defaultdict
rows=json.load(open('nba.json'))
df=pd.DataFrame(rows); df['d']=pd.to_datetime(df['d'])
for c in ['min','pts','reb','ast','stl','blk','tpm']: df[c]=pd.to_numeric(df[c])
df['pra']=df.pts+df.reb+df.ast; df['pr']=df.pts+df.reb; df['pa']=df.pts+df.ast; df['ra']=df.reb+df.ast
LAD={'pts':[10,15,20,25,30,35,40],'reb':[4,6,8,10,12,14],'ast':[3,4,6,8,10,12],'tpm':[1,2,3,4,5],'stl':[1,2,3,4],'blk':[1,2,3,4,5],
 'pra':[15,20,25,30,35,40,45,50],'pr':[10,15,20,25,30,35,40,45],'pa':[10,15,20,25,30,35,40,45],'ra':[5,8,10,12,15,18,20]}
STATS=list(LAD)
# défense adverse : stat concédée par équipe et par match (somme des joueurs adverses), moyenne glissante 15 matchs
df=df.sort_values(['d','gid']).reset_index(drop=True)
allowed={}
for s in STATS:
    t=df.groupby(['gid','opp','d'])[s].sum().reset_index().sort_values('d')   # 'opp' = équipe défendante
    t['allow15']=t.groupby('opp')[s].transform(lambda x:x.shift(1).rolling(15,min_periods=5).mean())
    t['lg']=t[s].expanding().mean().shift(1)
    allowed[s]=t.set_index(['gid','opp'])[['allow15']]
    # niveau moyen ligue par équipe-match
    allowed[s]['lgmean']=t.set_index(['gid','opp'])[s].expanding().mean().shift(1)
out=[]
for pid,g in df.groupby('pid'):
    g=g.sort_values('d').reset_index(drop=True)
    n=len(g)
    if n<21: continue
    dts=g['d'].values; home=g['home'].values; mins=g['min'].values.astype(float)
    for s in STATS:
        v=g[s].values.astype(float)
        for i in range(20,n):
            p=v[:i]; l5=p[-5:]; l10=p[-10:]; l20=p[-20:]
            for t in LAD[s]:
                h10=(l10>=t).sum()
                if h10<7: continue
                y=int(v[i]>=t)
                al=allowed[s].loc[(g.gid[i],g.opp[i])] if (g.gid[i],g.opp[i]) in allowed[s].index else None
                aw=np.nan if al is None else (al.allow15/al.lgmean if al.lgmean else np.nan)
                rest=(dts[i]-dts[i-1]).astype('timedelta64[D]').astype(int)
                out.append((pid,g.gid[i],str(dts[i])[:10],s,t,y,(l5>=t).mean(),h10/10,(l20>=t).mean(),
                  l5.mean()/t,l10.mean()/t,l20.mean()/t,p.mean()/t,l10.std()/t,
                  mins[max(0,i-5):i].mean(),mins[max(0,i-20):i].mean(),home[i],rest,aw,
                  (p[-3:]>=t).mean(), v[i-1]/t))
cols=['pid','gid','d','stat','thr','y','h5','h10','h20','m5','m10','m20','mall','sd10','min5','min20','home','rest','opp','h3','last']
F=pd.DataFrame(out,columns=cols); F.to_pickle('nba_feat.pkl'); print(F.shape, F.y.mean())
