#!/usr/bin/env python3
"""Create a source release with installation instructions and file checksums."""
import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text())['version']
output = root / 'artifacts' / f'auksinis-protas-{version}.zip'
output.parent.mkdir(exist_ok=True)
root_files = [
    'README.md', '.nvmrc', 'package.json', 'package-lock.json', 'tsconfig.json',
    'next.config.js', 'next-env.d.ts', 'eslint.config.mjs',
    'postcss.config.js', 'tailwind.config.ts', '.gitignore', '.env.local.example',
]
files = [root / name for name in root_files if (root / name).is_file() and not (root / name).is_symlink()]
for folder in ['src', 'supabase', 'tests', 'scripts', 'docs', 'public']:
    path = root / folder
    if path.exists():
        files.extend(p for p in path.rglob('*') if p.is_file() and not p.is_symlink())
files = sorted(set(files))
manifest = []
with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
    for path in files:
        relative = path.relative_to(root)
        if any(part in ['__pycache__', '.DS_Store'] for part in relative.parts):
            continue
        if path.name.startswith('.env') and path.name != '.env.local.example':
            continue
        if path.suffix in ['.pem', '.key', '.pyc', '.tsbuildinfo']:
            continue
        data = path.read_bytes()
        archive.writestr(f'auksinis-protas/{relative.as_posix()}', data)
        manifest.append(f'{hashlib.sha256(data).hexdigest()}  {relative.as_posix()}')
    archive.writestr('auksinis-protas/SHA256SUMS', '\n'.join(manifest) + '\n')
with ZipFile(output) as archive:
    assert archive.testzip() is None
print(f'Created {output.relative_to(root)} ({len(manifest)} files, {output.stat().st_size:,} bytes)')
