import json, re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
CIVS_PATH = REPO / 'data' / 'civilisations.json'
OUT_TECHS = REPO / 'data' / 'technologies.json'
OUT_CIV_TECHS = REPO / 'data' / 'civ_technologies.json'

DATA = Path('/tmp/aoe2techtree_data.json')
STRINGS = Path('/tmp/aoe2techtree_strings_en.json')

def slug(s: str) -> str:
    s = s.lower().strip()
    s = s.replace("'", '')
    s = re.sub(r'[^a-z0-9]+', '_', s).strip('_')
    return s

raw = json.loads(DATA.read_text())
strings = json.loads(STRINGS.read_text())

aoc = raw['data']
techs = aoc.get('techs', {})
unit_upgrades = aoc.get('unit_upgrades', {})

# Flatten tech definitions
out_techs = {}

def tech_name(t):
    # Prefer language name id -> english string
    lnid = str(t.get('LanguageNameId')) if t.get('LanguageNameId') is not None else None
    if lnid and lnid in strings:
        return strings[lnid]
    return t.get('internal_name') or ''

for tid, t in techs.items():
    name = tech_name(t)
    out_techs[str(tid)] = {
        'id': int(tid),
        'slug': slug(name) if name else f'tech_{tid}',
        'name': name or f'Tech {tid}',
        'type': 'tech',
        'cost': t.get('Cost') or {},
        'researchTime': t.get('ResearchTime'),
        'repeatable': t.get('Repeatable'),
        'internalName': t.get('internal_name')
    }

for uid, t in unit_upgrades.items():
    # unit_upgrades entries have ID = tech id in game, but key is unit id.
    # We'll store by tech id to avoid collision.
    tech_id = t.get('ID')
    name = t.get('internal_name') or f'Upgrade {tech_id}'
    out_techs[f'upgrade_{uid}'] = {
        'id': int(tech_id) if tech_id is not None else None,
        'slug': slug(name),
        'name': name,
        'type': 'unit_upgrade',
        'unitId': int(uid),
        'cost': t.get('Cost') or {},
        'researchTime': t.get('ResearchTime'),
        'internalName': t.get('internal_name')
    }

# Civ tech availability
civs = json.loads(CIVS_PATH.read_text())
name_to_civid = {c['name']: c['id'] for c in civs}

techtrees = raw.get('techtrees', {})
out_civ_techs = {}

for civ_name, tree in techtrees.items():
    civ_id = name_to_civid.get(civ_name)
    if not civ_id:
        # if our civ list uses e.g. Mayans vs Mayans? Already.
        continue
    civ_techs = []
    for item in tree.get('techs', []):
        # item is {id, age}
        civ_techs.append(int(item['id']))
    # include unique techs in a dedicated field too
    unique = tree.get('unique', {}) or {}
    unique_techs = []
    for k in ['castleAgeUniqueTech', 'imperialAgeUniqueTech']:
        if unique.get(k) is not None:
            unique_techs.append(int(unique[k]))

    out_civ_techs[civ_id] = {
        'name': civ_name,
        'techIds': sorted(set(civ_techs)),
        'uniqueTechIds': unique_techs
    }

# Write files
OUT_TECHS.write_text(json.dumps(out_techs, indent=2, ensure_ascii=False, sort_keys=True) + '\n')
OUT_CIV_TECHS.write_text(json.dumps(out_civ_techs, indent=2, ensure_ascii=False, sort_keys=True) + '\n')

print('tech_defs', len(out_techs))
print('civs_with_techtrees', len(out_civ_techs))
