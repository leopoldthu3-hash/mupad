import json,subprocess,time
from pathlib import Path

def call(*args):
    return subprocess.check_output(args,text=True).strip()
listing=json.loads(call('xcrun','simctl','list','devices','available','--json'))
devices=[d for group in listing['devices'].values() for d in group if 'iPad' in d['name'] and d.get('isAvailable',True)]
if not devices:
    raise SystemExit('No available iPad simulator; native behavior unverified')
device=devices[0]['udid']
if devices[0]['state']!='Booted':
    subprocess.run(['xcrun','simctl','boot',device],check=True)
subprocess.run(['xcrun','simctl','bootstatus',device,'-b'],check=True)
subprocess.run(['xcrun','simctl','install',device,'sim-build/Build/Products/Debug-iphonesimulator/App.app'],check=True)
subprocess.run(['xcrun','simctl','launch',device,'no.leopold.mupad','--mupad-selftest'],check=True)
container=Path(call('xcrun','simctl','get_app_container',device,'no.leopold.mupad','data'))
result=container/'Documents/MuPad-selftest.json'
for attempt in range(120):
    if result.exists():
        text=result.read_text();Path('native-test-result.json').write_text(text)
        report=json.loads(text)
        print(json.dumps(report,indent=2))
        if report.get('status')!='passed': raise SystemExit('Native WKWebView self-test failed')
        break
    time.sleep(2)
else:
    raise SystemExit('Native WKWebView self-test did not report within 240 seconds')
