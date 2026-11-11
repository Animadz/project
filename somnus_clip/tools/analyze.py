import librosa, numpy as np, json, sys
y, sr = librosa.load(sys.argv[1], sr=22050, mono=True)
hop=512
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, hop_length=hop)
bt = librosa.frames_to_time(beats, sr=sr, hop_length=hop)
onset = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
rms = librosa.feature.rms(y=y, hop_length=hop)[0]
S = np.abs(librosa.stft(y, hop_length=hop))
freqs = librosa.fft_frequencies(sr=sr)
low = S[freqs<150].mean(0); mid=S[(freqs>=150)&(freqs<2000)].mean(0); high=S[freqs>=4000].mean(0)
def norm(a): a=np.asarray(a,float); return (a/ (np.percentile(a,99)+1e-9)).clip(0,1.5)
fps=30; n=int(len(y)/sr*fps)
t=np.arange(n)/fps; ft=librosa.frames_to_time(np.arange(len(rms)),sr=sr,hop_length=hop)
out={'tempo':float(np.atleast_1d(tempo)[0]),'beats':bt.tolist(),'fps':fps,'n':n}
for k,a in [('rms',rms),('onset',onset),('low',low),('mid',mid),('high',high)]:
    out[k]=np.round(np.interp(t,ft,norm(a)),3).tolist()
# kicks: onset peaks in low band
lo_on = np.maximum(0,np.diff(low,prepend=low[0])); 
pk = librosa.util.peak_pick(norm(lo_on),pre_max=3,post_max=3,pre_avg=5,post_avg=5,delta=0.12,wait=6)
out['kicks']=librosa.frames_to_time(pk,sr=sr,hop_length=hop).round(3).tolist()
json.dump(out,open(sys.argv[2],'w'))
print('tempo',out['tempo'],'beats',len(bt),'kicks',len(out['kicks']))
# energy per 4s window
for s in range(0,int(len(y)/sr),4):
    a=np.array(out['rms'][s*fps:(s+4)*fps]); print(f"{s:4d}s {'#'*int(a.mean()*40)}")
