"""Pack audio analysis + lyrics into data/data.js for the renderer."""
import json, sys
an = json.load(open(sys.argv[1])); ly = json.load(open(sys.argv[2], encoding='utf-8'))
fps = an['fps']
def at(k, t): a = an[k]; return a[min(len(a)-1, int(t*fps))]
strong = [k for k in an['kicks'] if at('low', k) > 0.45]
an['strong'] = strong
with open(sys.argv[3], 'w', encoding='utf-8') as f:
    f.write('window.AUDIO=' + json.dumps(an, separators=(',', ':')) + ';\n')
    f.write('window.LYRICS=' + json.dumps(ly, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('beats', len(an['beats']), 'kicks', len(an['kicks']), 'strong', len(strong))
