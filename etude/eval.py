import pandas as pd, numpy as np, sys
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import roc_auc_score, brier_score_loss, log_loss
F=pd.read_pickle(sys.argv[1]); F['d']=pd.to_datetime(F.d)
F['opp']=F.opp.fillna(1.0); F['minr']=F.min5/F.min20.replace(0,np.nan); F['minr']=F.minr.fillna(1)
F['b2b']=(F.rest<=1).astype(int); F['thr_rel']=F.thr/ (F.m20*F.thr).replace(0,np.nan)
F['m5']=F.m5.clip(0,3); F['m10']=F.m10.clip(0,3); F['m20']=F.m20.clip(0,3); F['mall']=F.mall.clip(0,3)
F['old']=0.55*(0.45*F.h10+0.25*F.h5+0.3*F.h20)+0.45*F[['m10']].clip(upper=1).squeeze()*0+0.0  # placeholder remplacé ci-dessous
hit=0.45*F.h10+0.25*F.h5+0.3*F.h20; ratio=(1/F.m10.replace(0,np.nan)).clip(upper=1).fillna(0)
F['old']=0.55*hit+0.45*ratio
feats=['h5','h10','h20','m5','m10','m20','mall','sd10','minr','min20','home','b2b','opp','h3','last']
cut=pd.Timestamp(sys.argv[2]); tr=F[F.d<cut]; te=F[F.d>=cut]
print('train',len(tr),'test',len(te),'taux de réussite test',round(te.y.mean(),3))
def rep(name,p):
    p=np.clip(p,1e-4,1-1e-4); print(f"{name:34s} AUC {roc_auc_score(te.y,p):.4f}  Brier {brier_score_loss(te.y,p):.4f}  logloss {log_loss(te.y,p):.4f}")
rep('base : h10 (notre 8/10 actuel)',te.h10.values)
rep('ancien score du site',te.old.values)
rep('moyenne simple 5/10/20 (1/3 chaque)',((te.h5+te.h10+te.h20)/3).values)
rep('poids forme : .5*h5+.3*h10+.2*h20',(.5*te.h5+.3*te.h10+.2*te.h20).values)
lr=LogisticRegression(max_iter=2000,C=1.0); mu,sd=tr[feats].mean(),tr[feats].std().replace(0,1)
lr.fit((tr[feats]-mu)/sd,tr.y); plr=lr.predict_proba((te[feats]-mu)/sd)[:,1]; rep('régression logistique (tous facteurs)',plr)
print(' poids (standardisés):',dict(zip(feats,np.round(lr.coef_[0],2))))
gb=HistGradientBoostingClassifier(max_depth=3,learning_rate=0.05,max_iter=250,l2_regularization=1.0); gb.fit(tr[feats],tr.y); pgb=gb.predict_proba(te[feats])[:,1]; rep('arbres boostés (tous facteurs)',pgb)
for k,fs in {'sans domicile/repos':[f for f in feats if f not in('home','b2b')],'sans adversaire':[f for f in feats if f!='opp'],'sans minutes':[f for f in feats if f not in('minr','min20')]}.items():
    l2=LogisticRegression(max_iter=2000).fit((tr[fs]-mu[fs])/sd[fs],tr.y); rep('logistique '+k,l2.predict_proba((te[fs]-mu[fs])/sd[fs])[:,1])
te=te.assign(p_lr=plr,p_gb=pgb)
# top-N par soir (1 série par joueur)
def topn(col,n):
    s=te.sort_values(col,ascending=False).drop_duplicates(['pid','d']); res=[]
    for d,g in s.groupby('d'):
        if len(g)>=n: res.append(g.head(n).y.mean())
    return np.mean(res), len(res)
print('--- précision des N meilleures séries par soir (taux de réussite réel) ---')
for n in (3,4,10):
    print(n,{c:round(topn(c,n)[0],3) for c in ['h10','old','p_lr','p_gb']}, 'jours',topn('h10',n)[1])
print('--- calibration (arbres) ---')
te['bin']=pd.cut(te.p_gb,[0,.5,.6,.7,.75,.8,.85,.9,1]); print(te.groupby('bin',observed=True).agg(n=('y','size'),prevu=('p_gb','mean'),reel=('y','mean')).round(3))
print('--- calibration base h10 ---'); print(te.groupby('h10').agg(n=('y','size'),reel=('y','mean')).round(3))
F.assign().to_pickle('nba_feat2.pkl')
