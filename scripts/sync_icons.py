import json, os, re, shutil
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
UNITS_JSON = REPO / 'data' / 'units.json'
CIVS_JSON = REPO / 'data' / 'civilisations.json'
AOC_100 = Path('/tmp/aoc_100.json')
ICON_SRC = Path('/tmp/aoe2-icon-resources')

OUT_UNITS_DIR = REPO / 'assets' / 'units'
OUT_CIVS_DIR = REPO / 'assets' / 'civs'
OUT_MANIFEST = REPO / 'data' / 'icons.json'

OUT_UNITS_DIR.mkdir(parents=True, exist_ok=True)
OUT_CIVS_DIR.mkdir(parents=True, exist_ok=True)

units = json.loads(UNITS_JSON.read_text())
civs = json.loads(CIVS_JSON.read_text())
aoc = json.loads(AOC_100.read_text())

# objects in dataset are mapping: str(id)->name
objects = aoc.get('objects', {})
# reverse map name->id (prefer lowest id on duplicates)
name_to_objid = {}
for k,v in objects.items():
    if not isinstance(v,str):
        continue
    name=v.strip()
    if not name:
        continue
    if name not in name_to_objid or int(k) < int(name_to_objid[name]):
        name_to_objid[name]=k

# civs mapping: key-> {name,id}
# icon-resources civilizations folder appears to use civ "id" values
civ_name_to_iconid = {}
for _,v in (aoc.get('civilizations', {}) or {}).items():
    if isinstance(v, dict) and 'name' in v and 'id' in v and v['id'] is not None:
        civ_name_to_iconid[v['name']] = str(v['id'])

def norm(s:str)->str:
    s=s.lower().strip()
    s=re.sub(r"\([^)]*\)","",s)  # drop parentheses
    s=s.replace('’',"'")
    s=re.sub(r"[^a-z0-9]+"," ",s)
    s=re.sub(r"\s+"," ",s).strip()
    return s

norm_to_objid={}
for name,objid in name_to_objid.items():
    n=norm(name)
    norm_to_objid.setdefault(n, objid)


def find_objid(unit_name:str):
    # exact
    if unit_name in name_to_objid:
        return name_to_objid[unit_name], unit_name
    n=norm(unit_name)
    if n in norm_to_objid:
        return norm_to_objid[n], None
    # some common normalizations
    n2 = n.replace('man at arms','man-at-arms')
    if n2 in norm_to_objid:
        return norm_to_objid[n2], None
    return None, None


def copy_best(src_base:Path, dest:Path):
    # prefer png then jpg
    for ext in ['.png','.jpg','.jpeg','.webp']:
        cand = src_base.with_suffix(ext)
        if cand.exists():
            shutil.copyfile(cand, dest.with_suffix(ext))
            return dest.with_suffix(ext).name
    return None

manifest = {
    'units': {},
    'civilisations': {},
    'unmatched_units': [],
    'unmatched_civs': []
}

# units
for u in units:
    uid=u.get('id')
    name=u.get('name')
    if not uid or not name:
        continue
    objid, matched_name = find_objid(name)
    if not objid:
        manifest['unmatched_units'].append({'id':uid,'name':name})
        continue
    src_base = ICON_SRC / 'objects' / objid
    dest_base = OUT_UNITS_DIR / uid
    fname = copy_best(src_base, dest_base)
    if not fname:
        manifest['unmatched_units'].append({'id':uid,'name':name,'objectId':objid,'reason':'no icon file'})
        continue
    manifest['units'][uid] = {
        'name': name,
        'objectId': int(objid),
        'src': f'assets/units/{fname}',
        **({'matchedName': matched_name} if matched_name else {})
    }

# civs
for c in civs:
    cid=c.get('id')
    name=c.get('name')
    if not cid or not name:
        continue
    iconid = civ_name_to_iconid.get(name)
    if not iconid:
        manifest['unmatched_civs'].append({'id':cid,'name':name,'reason':'no civ id in dataset'})
        continue
    src_base = ICON_SRC / 'civilizations' / iconid
    dest_base = OUT_CIVS_DIR / cid
    fname = copy_best(src_base, dest_base)
    if not fname:
        manifest['unmatched_civs'].append({'id':cid,'name':name,'iconId':iconid,'reason':'no icon file'})
        continue
    manifest['civilisations'][cid] = {
        'name': name,
        'iconId': int(iconid),
        'src': f'assets/civs/{fname}'
    }

OUT_MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True) + '\n')

print('units_total', len(units))
print('unit_icons', len(manifest['units']))
print('unmatched_units', len(manifest['unmatched_units']))
print('civs_total', len(civs))
print('civ_icons', len(manifest['civilisations']))
print('unmatched_civs', len(manifest['unmatched_civs']))
