import re,json,sys
txt=open(sys.argv[1],encoding='utf-8').read().strip().split('\n\n')
def ts(s):
    h,m,r=s.split(':'); sec,ms=r.split(','); return int(h)*3600+int(m)*60+int(sec)+int(ms)/1000
out=[]
for b in txt:
    L=b.strip().split('\n'); a,c=L[1].split(' --> '); out.append({'s':ts(a),'e':ts(c),'t':' '.join(L[2:])})
json.dump(out,open(sys.argv[2],'w'),ensure_ascii=False,indent=0)
for i,o in enumerate(out): print(i,f"{o['s']:7.2f} {o['e']:7.2f}",o['t'][:60])
