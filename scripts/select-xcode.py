from pathlib import Path
import re
choices=[]
for path in Path('/Applications').glob('Xcode*.app'):
    match=re.search(r'Xcode[_ -](\d+)(?:\.(\d+))?',path.name)
    if match and int(match[1])>=26:
        choices.append(((int(match[1]),int(match[2] or 0)),path))
if not choices:
    raise SystemExit('No supported Xcode 26+ installation found')
print(str(max(choices,key=lambda item:item[0])[1]/'Contents/Developer'))
