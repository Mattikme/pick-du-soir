import pandas as pd, numpy as np, json
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, roc_auc_score
F=pd.read_pickle('nba_feat2.pkl'); F['d']=pd.to_datetime(F.d); F['last']=F['last'].clip(0,3)
feats=['h5','h10','h20','m5','m10','m20','mall','sd10','minr','min20','home','h3','last']
F['sd10']=F.sd10.clip(0,3); F['minr']=F.minr.clip(0,3)
def fit(tr):
    mu,sd=tr[feats].mean(),tr[feats].std().replace(0,1)
    m=LogisticRegression(max_iter=3000,C=1.0).fit((tr[feats]-mu)/sd,tr.y); return mu,sd,m
def pred(mu,sd,m,te): return m.decision_function((te[feats]-mu)/sd)
# walk-forward mensuel : prédictions hors échantillon
oos=[]; months=pd.period_range('2026-01','2026-11',freq='M')
for mth in months:
    s=mth.start_time; e=(mth+1).start_time; te=F[(F.d>=s)&(F.d<e)]
    if te.empty: continue
    tr=F[F.d<s]
    if len(tr)<20000: continue
    mu,sd,m=fit(tr); oos.append(te.assign(z=pred(mu,sd,m,te)))
O=pd.concat(oos); print('OOS',len(O),O.d.min().date(),O.d.max().date())
# recalibrage Platt sur les prédictions hors échantillon
pl=LogisticRegression(C=1e6).fit(O[['z']],O.y); a,b=pl.coef_[0][0],pl.intercept_[0]; print('platt a,b',round(a,3),round(b,3))
O['p0']=1/(1+np.exp(-O.z)); O['p1']=pl.predict_proba(O[['z']])[:,1]
print('Brier brut',round(brier_score_loss(O.y,O.p0),4),'calibré',round(brier_score_loss(O.y,O.p1),4),'base h10',round(brier_score_loss(O.y,O.h10),4),'AUC',round(roc_auc_score(O.y,O.p1),3))
sub=O[O.m10<=1.3]
def topn(col,n):
    s=sub.sort_values(col,ascending=False).drop_duplicates(['pid','d']); r=[g.head(n).y.mean() for _,g in s.groupby('d') if len(g)>=n]; return round(np.mean(r),3),len(r)
for n in (3,4,5,10): print('top',n,'/soir  algo',topn('p1',n),' base h10',topn('h10',n))
# sélection plus stricte : p>=0.75
for th in (.70,.75,.80):
    t=sub[sub.p1>=th].drop_duplicates(['pid','d']); print('p>=',th,'n',len(t),'réel',round(t.y.mean(),3),'prévu',round(t.p1.mean(),3))
sub=sub.assign(bin=pd.cut(sub.p1,[0,.5,.6,.7,.8,1])); print(sub.groupby('bin',observed=True).agg(n=('y','size'),prevu=('p1','mean'),reel=('y','mean')).round(3))
mu,sd,m=fit(F)
J={'feats':feats,'mu':[float(mu[f]) for f in feats],'sd':[float(sd[f]) for f in feats],'coef':[float(x) for x in m.coef_[0]],'intercept':float(m.intercept_[0]),'platt':[float(a),float(b)],'maxm':1.3,'trained_rows':int(len(F)),'oos_days':int(O.d.nunique()),
 'top4':topn('p1',4)[0],'top4_base':topn('h10',4)[0]}
json.dump(J,open('algo_model.json','w'),indent=1); print(json.dumps(J)[:400])
