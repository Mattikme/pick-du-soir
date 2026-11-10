import pandas as pd, numpy as np, sys
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import roc_auc_score
F=pd.read_pickle('nba_feat2.pkl'); cut=pd.Timestamp(sys.argv[1])
feats=['h5','h10','h20','m5','m10','m20','mall','sd10','minr','min20','home','b2b','opp','h3','last']
tr=F[F.d<cut]; te=F[F.d>=cut].copy(); mu,sd=tr[feats].mean(),tr[feats].std().replace(0,1)
lr=LogisticRegression(max_iter=2000).fit((tr[feats]-mu)/sd,tr.y); te['p_lr']=lr.predict_proba((te[feats]-mu)/sd)[:,1]
gb=HistGradientBoostingClassifier(max_depth=3,learning_rate=0.05,max_iter=250,l2_regularization=1.0).fit(tr[feats],tr.y); te['p_gb']=gb.predict_proba(te[feats])[:,1]
te['m10r']=te.m10  # moyenne/seuil : >1 = seuil sous la moyenne
def topn(sub,col,n):
    s=sub.sort_values(col,ascending=False).drop_duplicates(['pid','d']); r=[g.head(n).y.mean() for _,g in s.groupby('d') if len(g)>=n]; return round(np.mean(r),3),len(r)
for lim in (9,1.5,1.3,1.15,1.0):
    sub=te[te.m10<=lim]
    print(f'\nSéries "intéressantes" : moyenne10/seuil <= {lim}  (n={len(sub)}, taux global {sub.y.mean():.3f})')
    print('  AUC dans ce sous-ensemble :',{c:round(roc_auc_score(sub.y,sub[c]),3) for c in ['h10','old','p_lr','p_gb']})
    for n in (4,10): print(f'  top {n}/soir :',{c:topn(sub,c,n)[0] for c in ['h10','old','p_lr','p_gb']}, 'jours',topn(sub,'h10',n)[1])
print('\ncalibration modèle dans le sous-ensemble <=1.15')
sub=te[te.m10<=1.15].copy(); sub['bin']=pd.cut(sub.p_gb,[0,.4,.5,.6,.7,.8,.9,1]); print(sub.groupby('bin',observed=True).agg(n=('y','size'),prevu=('p_gb','mean'),reel=('y','mean')).round(3))
print('base h10 dans ce sous-ensemble'); print(sub.groupby('h10').agg(n=('y','size'),reel=('y','mean')).round(3))
