#!/usr/bin/env python3
"""Build a pinned, public-data catchment snapshot. No DB writes or credentials.

python3 scripts/build-catchment-demand.py --cache /tmp/dental-catchment-data
ACS 2020–2024 tracts are allocated to 2020 Census block internal points using
population and housing-unit weights separately. Whole counties are downloaded
so a clipped map window never changes a tract's weighting denominator.
"""
import argparse
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import time
import urllib.parse
import urllib.request

ROOT = 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/'
BLOCKS = 'https://tigerweb.geo.census.gov/arcgis/rest/services/Census2020/tigerWMS_Census2020/MapServer/10'
COUNTIES = ['031', '037', '043', '063', '089', '091', '093', '097', '111', '197']
TOPICS = [
    ('population', '60c98f20a162416ea1725b94d7297f83', 'Population', ['B01001_001E', 'B01001_001M', 'B01001_calc_numLT18E', 'B01001_calc_numGE65E']),
    ('income', '0f43160beaaa4026a8a2f2db01ba1972', 'Household_Income_Distribution', [f'B19001_{i:03}E' for i in range(1, 18)]),
    ('housing', '204f0ea4315640fca8c2e0fbefe11a96', 'Housing_Units_by_Year_Built', ['B25034_001E', 'B25034_002E']),
    ('tenure', '4e3f28aff6bf4119baa286f2e389296e', 'Housing_Units_Occupancy', ['B25003_001E', 'B25003_002E']),
]

def get(url, params=None):
    query = url + ('?' + urllib.parse.urlencode(params) if params else '')
    for attempt in range(5):
        try:
            with urllib.request.urlopen(query, timeout=90) as r:
                data = json.load(r)
            if isinstance(data, dict) and data.get('error'):
                raise ValueError(data['error'])
            return data
        except Exception:
            if attempt == 4:
                raise
            time.sleep(2 ** attempt)

def cached(path, fn):
    if path.exists():
        with gzip.open(path, 'rt') as f:
            return json.load(f)
    data = fn()
    tmp = path.with_suffix('.tmp')
    with gzip.open(tmp, 'wt') as f:
        json.dump(data, f, separators=(',', ':'))
    tmp.replace(path)
    return data

def paged(url, where, fields):
    count = get(url + '/query', dict(f='json', where=where, returnCountOnly='true'))['count']
    rows = []
    for offset in range(0, count, 500):
        d = get(url + '/query', dict(f='json', where=where, outFields=fields, returnGeometry='false',
                orderByFields='GEOID', resultOffset=offset, resultRecordCount=500))
        rows.extend(f['attributes'] for f in d['features'])
    assert len(rows) == count and len({r['GEOID'] for r in rows}) == count, f'Incomplete {url}: {len(rows)}/{count}'
    return rows

def number(v):
    return v if isinstance(v, (int, float)) and v >= 0 else None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, required=True)
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    base = json.loads(Path('public/data/chicagoland-acs-2024.geojson').read_text())
    # Existing pinned ACS geography supplies boundaries/education and defines our tract universe.
    features = [f for f in base['features'] if f['properties']['GEOID'][2:5] in COUNTIES]
    wanted = {f['properties']['GEOID'] for f in features}
    where = "State = 'Illinois'"
    provenance = []
    topic_rows = {}
    for topic, item_id, service, fields in TOPICS:
        item = get(f'https://www.arcgis.com/sharing/rest/content/items/{item_id}', {'f': 'json'})
        import re
        assert re.search(r'Current Vintage[\s\S]{0,100}2020-2024', item['description']), f'Vintage changed: {topic}'
        url = ROOT + f'ACS_{service}_View_Boundaries/FeatureServer/2'
        rows = cached(args.cache / f'{topic}-2024.json.gz', lambda: paged(url, where, ','.join(['GEOID'] + fields)))
        topic_rows[topic] = {r['GEOID']: r for r in rows if r['GEOID'] in wanted}
        assert set(topic_rows[topic]) == wanted, f'Missing ACS tracts: {topic}'
        provenance.append(dict(topic=topic, url=url, item=item_id, fields=fields, modified=item['modified']))
        print(f'{topic}: {len(topic_rows[topic])} matched tracts', flush=True)

    def county(code):
        rows = cached(args.cache / f'blocks-{code}.json.gz', lambda: paged(BLOCKS,
            f"STATE = '17' AND COUNTY = '{code}' AND (POP100 > 0 OR HU100 > 0)", 'GEOID,POP100,HU100,INTPTLON,INTPTLAT'))
        print(f'Blocks {code}: {len(rows)}', flush=True)
        return rows
    with ThreadPoolExecutor(max_workers=3) as pool:
        blocks = [b for rows in pool.map(county, COUNTIES) for b in rows if b['GEOID'][:11] in wanted]
    totals = defaultdict(lambda: [0, 0])
    for b in blocks:
        t = totals[b['GEOID'][:11]]
        t[0] += int(b['POP100']); t[1] += int(b['HU100'])
    tracts = []
    for f in sorted(features, key=lambda f: f['properties']['GEOID']):
        p = f['properties']; key = p['GEOID']
        pop, inc, house, tenure = [topic_rows[t][key] for t in ['population', 'income', 'housing', 'tenure']]
        tracts.append(dict(id=key, name=p['NAME'], county=p['County'], population=number(pop['B01001_001E']),
            populationMoe=number(pop['B01001_001M']), under18=number(pop['B01001_calc_numLT18E']),
            over65=number(pop['B01001_calc_numGE65E']), households=number(inc['B19001_001E']),
            incomeBins=[number(inc[f'B19001_{i:03}E']) for i in range(2, 18)],
            adults25=number(p['B15002_001E']), bachelorsPct=number(p['B15002_calc_pctGEBAE']),
            housingUnits=number(house['B25034_001E']), built2020=number(house['B25034_002E']),
            occupied=number(tenure['B25003_001E']), owners=number(tenure['B25003_002E']),
            blockPopulation=totals[key][0], blockHousing=totals[key][1]))
    index = {t['id']: i for i, t in enumerate(tracts)}
    from shapely import contains_xy, make_valid, union_all
    from shapely.geometry import shape, mapping, Polygon
    scope = shape(json.loads(Path('public/data/land-use/scope.geojson').read_text())['features'][0]['geometry'])
    anchors = [[round(float(b['INTPTLON']), 6), round(float(b['INTPTLAT']), 6), index[b['GEOID'][:11]], int(b['POP100']), int(b['HU100']),
                int(contains_xy(scope, float(b['INTPTLON']), float(b['INTPTLAT'])))] for b in blocks]
    assert all(-90 < a[0] < -87 and 40 < a[1] < 43 for a in anchors)
    missing = [t['id'] for t in tracts if (t['population'] or 0) > 0 and not t['blockPopulation']]
    data = dict(version=1, vintage='2020–2024', retrievedAt=datetime.now(timezone.utc).isoformat(), tracts=tracts, anchors=anchors)
    output = Path('public/data/catchments'); output.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(data, separators=(',', ':')).encode()
    (output / 'demand.json').write_bytes(raw)
    region = union_all([make_valid(shape(f['geometry'])) for f in features])
    # This boundary only checks regional coverage, never allocates residents.
    # Esri removes water from tracts; river holes/slivers must not masquerade as
    # missing Census counties. Fill interior water holes and allow ~100m slivers.
    pieces = list(region.geoms) if region.geom_type == 'MultiPolygon' else [region]
    region = union_all([Polygon(p.exterior) for p in pieces]).buffer(0.001).simplify(0.0001, preserve_topology=True)
    (output / 'region.geojson').write_text(json.dumps(dict(type='Feature', properties={}, geometry=mapping(region)), separators=(',', ':')))
    metadata = dict(version=1, vintage='2020–2024', retrievedAt=data['retrievedAt'], tractCount=len(tracts),
        blockCount=len(anchors), counties=COUNTIES, sources=provenance, blockSource=BLOCKS,
        sha256=hashlib.sha256(raw).hexdigest(), missingPopulationAnchors=missing,
        coverageBoundary='Tract union with interior water holes filled and 0.001-degree tolerance for removed-water slivers. Used only for coverage warnings, never population weights.',
        method='ACS tract counts allocated using 2020 Census block population weights; households/income/housing use housing-unit weights. Block internal points determine polygon membership. Income median interpolated from pooled B19001 bins, never averaged tract medians.',
        limitations=['Spatial allocation is modeled. 2020 blocks can miss or misplace subsequent development.',
            'ACS sampling error and block-boundary allocation error remain. Demographics within each tract are assumed spatially uniform after weighting.',
            'Housing built 2020 or later is a stock estimate, not annual permits or a growth forecast.',
            'Population is residential; commuters, dental utilization, patient flows and financials are not estimated.'])
    (output / 'metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(f'Wrote {len(tracts)} tracts / {len(anchors)} block anchors / {len(raw):,} bytes; {len(missing)} tracts without population anchors', flush=True)

if __name__ == '__main__':
    main()
