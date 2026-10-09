import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPyodide} from 'pyodide';

test('every lesson solution satisfies its checks in the actual bundled Python interpreter; empty answers do not',{timeout:120000},async()=>{
 const {courses}=await import('../www/learning-catalog.mjs');
 const lessons=courses.flatMap(course=>course.lessons);
 assert.ok(courses.length>=6 && lessons.length>=36);
 const py=await loadPyodide();
 py.globals.set('_mupad_curriculum_json',JSON.stringify(lessons));
 const checked=await py.runPythonAsync(`
import json, io, sys, os, tempfile, contextlib
_lessons = json.loads(_mupad_curriculum_json)
_checked = []
for _lesson in _lessons:
    _task = _lesson['task']
    with tempfile.TemporaryDirectory() as _directory:
        _previous = os.getcwd()
        os.chdir(_directory)
        _previous_stdin = sys.stdin
        sys.stdin = io.StringIO('\\n'.join(_task.get('stdin', [])) + '\\n')
        try:
            _ns = {'__name__': '__main__', '__file__': _lesson['id'] + '.py'}
            _out = io.StringIO()
            with contextlib.redirect_stdout(_out), contextlib.redirect_stderr(io.StringIO()):
                exec(compile(_task['solution'], _ns['__file__'], 'exec'), _ns, _ns)
            _ns['__mupad_output'] = _out.getvalue()
            exec(compile(_task['checks'], '<exercise checks>', 'exec'), _ns, _ns)
            _rejected = False
            try:
                exec(_task['checks'], {'__mupad_output': ''})
            except Exception:
                _rejected = True
            assert _rejected, 'Empty answer passed ' + _lesson['id']
            _checked.append(_lesson['id'])
        except Exception as _error:
            raise RuntimeError('Curriculum check failed for ' + _lesson['id'] + ': ' + str(_error)) from _error
        finally:
            sys.stdin = _previous_stdin
            os.chdir(_previous)
len(_checked)
`);
 assert.equal(checked,lessons.length);
 console.log(`Verified ${checked} solutions and rejected ${checked} empty answers using CPython ${py.runPython('import sys; sys.version.split()[0]')}.`);
});
