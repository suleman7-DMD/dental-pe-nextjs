#!/usr/bin/env python3
"""Refresh src/data/office-geocodes.json from the live directory feed.

Geocodes every listed office that has no stored coordinates, or whose street the
validator corrected, with the free U.S. Census batch geocoder. Non-exact matches
are kept only when the matched ZIP and house number agree with the directory.

    python3 scripts/geocode-directory-offices.py [--feed URL]
"""
import argparse, csv, datetime, gzip, io, json, pathlib, re, urllib.request, uuid

OUT = pathlib.Path(__file__).resolve().parent.parent / 'src/data/office-geocodes.json'
CENSUS = 'https://geocoding.geo.census.gov/geocoder/locations/addressbatch'

def street(address):
    return re.split(r',|#|\b(?:suite|ste|unit|floor|fl|apt)\b', address, flags=re.I)[0].strip()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--feed', default='https://dental-pe-nextjs.vercel.app/api/directory-live')
    args = ap.parse_args()
    req = urllib.request.Request(args.feed, headers={'Accept-Encoding': 'gzip'})
    raw = urllib.request.urlopen(req, timeout=120).read()
    feed = json.loads(gzip.decompress(raw) if raw[:2] == b'\x1f\x8b' else raw)
    rows = {}
    for p in feed['visible']:
        wc = p.get('web_check') or {}
        moved = wc.get('effect') == 'open_corrected' and (wc.get('observed') or {}).get('address')
        # Rows already carrying a geocode are re-geocoded so the snapshot stays complete.
        if p.get('address') and (not p.get('latitude') or not p.get('longitude') or moved or p.get('coord_source')):
            rows[p['location_id']] = p
    buf = io.StringIO()
    csv.writer(buf).writerows([[k, street(p['address']), p.get('city') or '', 'IL', p.get('zip') or ''] for k, p in rows.items()])
    boundary = uuid.uuid4().hex
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="benchmark"\r\n\r\nPublic_AR_Current\r\n'
            f'--{boundary}\r\nContent-Disposition: form-data; name="addressFile"; filename="batch.csv"\r\n'
            f'Content-Type: text/csv\r\n\r\n{buf.getvalue()}\r\n--{boundary}--\r\n').encode()
    resp = urllib.request.urlopen(urllib.request.Request(CENSUS, data=body,
        headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}), timeout=900).read().decode()
    offices, rejected = {}, 0
    for r in csv.reader(io.StringIO(resp)):
        if len(r) < 6 or r[2] != 'Match':
            continue
        p, kind, matched = rows[r[0]], r[3], r[4]
        lon, lat = map(float, r[5].split(','))
        house = p['address'].split()[0].upper()
        if not (41.0 < lat < 42.6 and -88.8 < lon < -87.4) or (kind != 'Exact' and (
                matched.strip()[-5:] != p.get('zip') or not matched.upper().startswith(house + ' '))):
            rejected += 1
            continue
        offices[r[0]] = {'address': p['address'], 'lat': round(lat, 6), 'lon': round(lon, 6), 'precision': kind.lower()}
    meta = {'source': 'U.S. Census Geocoder batch (Public_AR_Current), address-range interpolation',
            'generated': datetime.date.today().isoformat(),
            'rule': 'Used only when the office has no stored coordinates or the validator corrected its street, and only while the directory address still equals `address`.',
            'script': 'scripts/geocode-directory-offices.py'}
    OUT.write_text(json.dumps({'meta': meta, 'offices': dict(sorted(offices.items()))}, separators=(',', ':')))
    print(f'{len(rows)} submitted · {len(offices)} kept · {rejected} rejected · {len(rows) - len(offices) - rejected} unmatched → {OUT}')

if __name__ == '__main__':
    main()
