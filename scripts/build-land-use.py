#!/usr/bin/env python3
"""Reproducible CMAP 2023 → watched-ZCTA clipped vector archive. No database writes.

Install requests, shapely, tippecanoe in a venv. Run from frontend root:
python scripts/build-land-use.py --cache /tmp/dental-landuse-cache
Source pages are cached and ID completeness is checked before publishing artifacts.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
from datetime import datetime, timezone
import hashlib
import gzip
import json
from pathlib import Path
import shutil
import subprocess
import time

import requests
from shapely import make_valid, union_all
from shapely.geometry import shape, mapping
from shapely.prepared import prep

CMAP = 'https://services5.arcgis.com/LcMXE3TFhi1BSaCY/arcgis/rest/services/LUI_2023_view/FeatureServer/1'
ZCTA = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2024/MapServer/2'

def get(url, params):
    for attempt in range(5):
        try:
            # ArcGIS rejects long GET URLs (large object-ID batches) with HTTP 404.
            r = requests.post(url, data=params, timeout=120) if 'objectIds' in params else requests.get(url, params=params, timeout=120)
            r.raise_for_status()
            d = r.json()
            if 'error' in d:
                raise RuntimeError(d['error'])
            return d
        except (requests.RequestException, ValueError, RuntimeError):
            if attempt == 4:
                raise
            time.sleep(2 ** attempt)

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--cache', type=Path, required=True)
    p.add_argument('--resume-clipped', action='store_true', help='Resume after the last fully written feature in a previous interrupted run')
    args = p.parse_args()
    cache = args.cache
    cache.mkdir(parents=True, exist_ok=True)
    output = Path('data/land-use')
    public = Path('public/data/land-use')
    public.mkdir(parents=True, exist_ok=True)
    zips = json.loads((output / 'watched-zips.json').read_text())
    zfile = cache / 'zctas.json'
    if not zfile.exists():
        features = []
        for offset in range(0, len(zips), 50):
            where = 'ZCTA5 IN (' + ','.join("'" + z + "'" for z in zips[offset:offset+50]) + ')'
            d = get(ZCTA + '/query', dict(f='geojson', where=where, outFields='ZCTA5', outSR=4326, geometryPrecision=6))
            assert not d.get('exceededTransferLimit'), 'Truncated ZCTA response'
            features.extend(d['features'])
        zfile.write_text(json.dumps(features))
    features = json.loads(zfile.read_text())
    found = {f['properties']['ZCTA5'] for f in features}
    assert found <= set(zips) and len(found) == len(features)
    scope = make_valid(union_all([make_valid(shape(f['geometry'])) for f in features]))
    prepared = prep(scope)
    (public / 'scope.geojson').write_text(json.dumps(dict(type='FeatureCollection', features=[dict(type='Feature', properties={}, geometry=mapping(scope))]), separators=(',', ':')))
    bounds = list(scope.bounds)
    idfile = cache / 'ids.json'
    if not idfile.exists():
        d = get(CMAP + '/query', dict(f='json', where='1=1', geometry=','.join(map(str,bounds)), geometryType='esriGeometryEnvelope', inSR=4326, spatialRel='esriSpatialRelIntersects', returnIdsOnly='true'))
        idfile.write_text(json.dumps(sorted(d['objectIds'])))
    ids = json.loads(idfile.read_text())
    chunks = [ids[i:i+1000] for i in range(0, len(ids), 1000)]
    def download(pair):
        i, batch = pair
        path = cache / f'cmap-{i:04d}.json.gz'
        if not path.exists():
            d = get(CMAP + '/query', dict(f='geojson', objectIds=','.join(map(str,batch)), outFields='OBJECTID,LANDUSE,LANDUSE2,FAC_NAME,MODIFIER', outSR=4326, geometryPrecision=6, returnGeometry='true'))
            assert not d.get('exceededTransferLimit'), f'Truncated page {i}'
            assert {f['properties']['OBJECTID'] for f in d['features']} == set(batch), f'Incomplete page {i}'
            temporary = path.with_suffix('.tmp')
            with gzip.open(temporary, 'wt', compresslevel=3) as compressed:
                json.dump(d, compressed, separators=(',', ':'))
            temporary.replace(path)
        return path
    print(f'{len(found)}/{len(zips)} ZIPs have Census ZCTAs; fetching {len(ids)} source features ({len(chunks)} pages)', flush=True)
    counts = Counter()
    names = set()
    seen = set()
    raw = cache / 'clipped.geojsonl.gz'
    last_written = None
    if args.resume_clipped and raw.exists():
        with gzip.open(raw, 'rt') as prior:
            for line in prior:
                f = json.loads(line)
                counts[f['properties']['code']] += 1
                if f['properties']['name']:
                    names.add(f['properties']['name'])
                last_written = f['id']
    resuming = last_written is not None
    null_geometry_ids = []
    with gzip.open(raw, 'at' if resuming else 'wt', compresslevel=3) as out, ThreadPoolExecutor(max_workers=4) as pool:
        for i, path in enumerate(pool.map(download, enumerate(chunks))):
            with gzip.open(path, 'rt') as compressed:
                page = json.load(compressed)
            for f in page['features']:
                props = f['properties']
                oid = props['OBJECTID']
                assert oid not in seen
                seen.add(oid)
                if f['geometry'] is None:
                    null_geometry_ids.append(oid)
                    continue
                if resuming:
                    if oid == last_written:
                        resuming = False
                    continue
                g = make_valid(shape(f['geometry']))
                if not prepared.intersects(g):
                    continue
                if not prepared.covers(g):
                    g = g.intersection(scope)
                if g.geom_type == 'GeometryCollection':
                    g = union_all([v for v in g.geoms if v.geom_type in ('Polygon', 'MultiPolygon')])
                if g.is_empty or g.geom_type not in ('Polygon', 'MultiPolygon'):
                    continue
                props = dict(code=props['LANDUSE'], secondary=props.get('LANDUSE2') or '', name=props.get('FAC_NAME') or '', modifier=props.get('MODIFIER') or '')
                counts[props['code']] += 1
                if props['name']:
                    names.add(props['name'])
                out.write(json.dumps(dict(type='Feature', id=oid, properties=props, geometry=mapping(g)), separators=(',', ':')) + '\n')
            if i % 20 == 0:
                print(f'Processed {i+1}/{len(chunks)} pages; {sum(counts.values())} clipped features', flush=True)
    assert seen == set(ids), 'Incomplete source download'
    assert not resuming, 'Resume marker missing from source'
    metadata = get(CMAP, {'f':'json'})
    (output / 'source-schema.json').write_text(json.dumps(metadata, indent=2) + '\n')
    archive = output / 'chicagoland-2023.pmtiles'
    # No feature dropping/coalescing: keep source classes, facility names, and stable IDs.
    # Tile simplification is zoom-dependent; overzoom z14 for close inspection.
    process = subprocess.Popen([shutil.which('tippecanoe') or 'tippecanoe', '-q', '-f', '-o', str(archive), '-l', 'landuse', '-Z', '7', '-z', '14', '--no-feature-limit', '--no-tile-size-limit', '--no-tiny-polygon-reduction', '--attribution=Chicago Metropolitan Agency for Planning (CMAP), 2023; U.S. Census Bureau ZCTAs'], stdin=subprocess.PIPE)
    with gzip.open(raw, 'rb') as stream:
        shutil.copyfileobj(stream, process.stdin)
    process.stdin.close()
    assert process.wait() == 0, 'Tile build failed'
    manifest = dict(source=CMAP, sourceYear=2023, retrievedAt=datetime.now(timezone.utc).isoformat(), boundarySource=ZCTA, watchedZipCount=len(zips), matchedZctaCount=len(found), missingZctas=sorted(set(zips)-found), bounds=bounds, sourceFeatures=len(ids), nullGeometryIds=null_geometry_ids, clippedFeatures=sum(counts.values()), countsByCode=dict(sorted(counts.items())), archiveBytes=archive.stat().st_size, archiveSha256=hashlib.sha256(archive.read_bytes()).hexdigest(), minzoom=7, maxzoom=14)
    (public / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (output / 'named-facilities.json').write_text(json.dumps(sorted(names), indent=2) + '\n')
    print(json.dumps(manifest, indent=2), flush=True)

if __name__ == '__main__':
    main()
