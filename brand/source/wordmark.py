"""Jëfëli. geometric wordmark (owner's rounded direction). Units: cap/ascender height H=1000, baseline y=0, y down."""
import numpy as np, json, sys
from shapely.geometry import LineString, Point
from shapely.ops import unary_union
P=dict(X=0.72, w=0.172, o=0.016, dot=0.54, per=0.80, sb=0.12, jbar=0.40, bar=0.80)
if len(sys.argv)>1: P.update(json.loads(sys.argv[1]))
H=1000.; X=P['X']*H; w=P['w']*H; o=P['o']*H; sb=P['sb']*H
S=lambda pts: LineString(pts).buffer(w/2, cap_style=1, join_style=1, quad_segs=64)
arc=lambda cx,cy,r,a0,a1,n=160: [(cx+r*np.cos(np.radians(a)), cy-r*np.sin(np.radians(a))) for a in np.linspace(a0,a1,n)]
dotc=lambda x,y,r: Point(x,y).buffer(r,quad_segs=64)
def J(x):
    rb=0.30*H; xs=x+P['jbar']*H+w/2              # stem centre
    cy=-w/2-rb+o                                  # bowl centreline bottom at -w/2+o (overshoot)
    pts=[(x+w/2,-H+w/2),(xs,-H+w/2),(xs,cy)]+arc(xs-rb,cy,rb,0,-180)[1:]
    return S(pts), xs+w/2-x
def e(x):
    Ro=X/2+o; R=Ro-w/2; cx=x+Ro; cy=-X/2
    bar=LineString([(cx-R,cy+w*0.06),(cx+R,cy+w*0.06)]).buffer(w*P['bar']/2,cap_style=2)  # optically thinner horizontal, set just below centre
    return unary_union([S(arc(cx,cy,R,0,322)), bar]), 2*Ro
def uml(cx):
    r=P['dot']*w; y=-H+r
    return unary_union([dotc(cx-0.25*X,y,r),dotc(cx+0.25*X,y,r)])
def f(x):
    rh=0.27*X; sx=x+0.30*X; cy=-H+w/2+rh
    stem=S([(sx,-w/2),(sx,cy)]+arc(sx+rh,cy,rh,180,90)[1:]+[(sx+rh+0.08*X,-H+w/2)])
    bar=S([(x+w/2,-X+w/2),(sx+0.30*X,-X+w/2)])
    return unary_union([stem,bar]), 0.30*X+rh+0.08*X+w/2
def l(x):
    rf=0.20*X; sx=x+w/2; cy=-w/2-rf+o*0.5
    return S([(sx,-H+w/2),(sx,cy)]+arc(sx+rf,cy,rf,180,295)[1:]), w+rf*1.35
def i(x):
    sx=x+w/2; r=P['dot']*w
    return unary_union([S([(sx,-X+w/2),(sx,-w/2)]), dotc(sx,-H+r,r)]), w
x=0; parts=[]
# optical spacing: straight-to-round sides get less room than straight-to-straight
spacing={'J':1.0,'ë1':0.85,'f':0.75,'ë2':0.85,'l':0.95,'i':0.0}
seq=[('J',J),('ë1',e),('f',f),('ë2',e),('l',l),('i',i)]
for k,fn in seq:
    shp,adv=fn(x); parts.append(shp)
    if k.startswith('ë'): parts.append(uml(x+adv/2))
    x+=adv+sb*spacing[k]
rp=P['per']*w; per=dotc(x+0.55*sb+rp,-rp,rp)
letters=unary_union(parts)
def path(g):
    polys=[g] if g.geom_type=='Polygon' else list(g.geoms); d=''
    for p in polys:
        for r in [p.exterior]+list(p.interiors):
            c=np.array(r.simplify(P.get('tol',0.15)).coords)[:-1]; d+='M'+' '.join(f'{a:.1f} {b:.1f}' for a,b in c)+'Z'
    return d
# J. monogram for the app icon: same J and same period
jx,_=J(0); jb=jx.bounds; rpm=P['per']*w; jper=dotc(jb[2]+0.55*sb+rpm,-rpm,rpm)
out={'letters':path(letters),'period':path(per),'bounds':unary_union([letters,per]).bounds,
     'J':path(jx),'Jper':path(jper),'Jbounds':unary_union([jx,jper]).bounds}
json.dump(out,open(P.get('out','wm2.json'),'w')); print([round(v) for v in out['bounds']],[round(v) for v in out['Jbounds']])
