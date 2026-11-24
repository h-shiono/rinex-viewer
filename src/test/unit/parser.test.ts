import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
    RinexModel, cellsOnLine, findByLine, formatEpoch, fromString, navCellsOnLine, parseEpoch, parseRinex,
    summarizeNav, summarizeObs,
} from '../../parser';

const FIXTURES = path.resolve(__dirname, '../../../test/fixtures');

function load(name: string) {
    const src = fromString(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));
    return { src, model: parseRinex(src) };
}

function asObs(m: RinexModel) {
    assert.equal(m.kind, 'obs');
    return (m as Extract<RinexModel, { kind: 'obs' }>).obs;
}

function asNav(m: RinexModel) {
    assert.equal(m.kind, 'nav');
    return (m as Extract<RinexModel, { kind: 'nav' }>).nav;
}

test('epoch formatting keeps sub-second precision and handles 2-digit years', () => {
    assert.equal(formatEpoch(parseEpoch(' 98 12 31 23 59 59.5000000')), '1998-12-31 23:59:59.500');
    assert.equal(formatEpoch(parseEpoch(' 05  4  2  0  0  0.0000000')), '2005-04-02 00:00:00.000');
    assert.equal(formatEpoch(parseEpoch('2024 08 22 11 00  0.1234567')), '2024-08-22 11:00:00.1234567');
    assert.equal(parseEpoch('                         '), undefined);
    assert.equal(formatEpoch(undefined), '(invalid epoch)');
});

test('non-RINEX text is ignored', () => {
    const model = parseRinex(fromString('hello\nworld\n'));
    assert.equal(model.kind, 'other');
    assert.equal(model.header.endLine, -1);
});

test('RINEX 2.10 observation (RTKLIB sample)', () => {
    const { src, model } = load('v210_gps.05o');
    const obs = asObs(model);
    assert.equal(model.header.version, 2.1);
    assert.deepEqual(model.header.obsTypes.get('*')!.map((e) => e.code), ['L1', 'C1', 'L2', 'P2']);
    assert.equal(obs.epochs.length, 3);
    const ep = obs.epochs[0];
    assert.equal(formatEpoch(ep.time), '2005-04-02 00:00:00.000');
    assert.deepEqual(ep.sats.slice(0, 3), ['G03', 'G07', 'G08']);
    const cells = cellsOnLine(src, obs, ep, ep.headerEndLine + 1);
    assert.deepEqual(cells.map((c) => c.obsType), ['L1', 'C1', 'L2', 'P2']);
    assert.equal(cells[0].value, 55923622.16);
    assert.equal(cells[2].lli, '4'); // L2 under anti-spoofing
    assert.equal(cells[2].ssi, '');
});

test('RINEX 2.11 edge cases: continued obs types, >12 sats, event flag, CRLF, 1990s', () => {
    const { src, model } = load('v211_edge.99o');
    const obs = asObs(model);
    // 10th observation type is on the continuation line
    assert.deepEqual(model.header.obsTypes.get('*')!.map((e) => e.code),
        ['L1', 'L2', 'C1', 'P1', 'P2', 'D1', 'D2', 'S1', 'S2', 'C2']);
    assert.equal(obs.epochs.length, 2);
    assert.equal(obs.events.length, 1);
    assert.equal(obs.events[0].flag, 4);

    const [ep0, ep1] = obs.epochs;
    assert.equal(formatEpoch(ep0.time), '1998-12-31 23:59:59.500');
    assert.equal(ep0.sats.length, 13);
    assert.equal(ep0.sats[12], 'R01');
    assert.equal(ep0.headerEndLine, ep0.line + 1);
    assert.equal(ep0.linesPerSat, 2);
    assert.equal(ep0.endLine, ep0.headerEndLine + 26);

    // second line of the 13th satellite holds types 6..10
    const cells = cellsOnLine(src, obs, ep0, ep0.endLine);
    assert.equal(cells[0].sat, 'R01');
    assert.deepEqual(cells.map((c) => c.obsType), ['D1', 'D2', 'S1', 'S2', 'C2']);
    assert.equal(cells[4].value, 13009.125);

    assert.equal(formatEpoch(ep1.time), '1999-01-01 00:00:00.500');
    assert.deepEqual(ep1.sats, ['E11']);
    const first = cellsOnLine(src, obs, ep1, ep1.headerEndLine + 1)[0];
    assert.equal(first.lli, '1');

    const s = summarizeObs(obs);
    assert.equal(s.satelliteCount, 14);
    assert.equal(s.interval, 1);
});

test('RINEX 3.02 observation with CRLF (MALIB sample)', () => {
    const { src, model } = load('v302_mixed_crlf.obs');
    const obs = asObs(model);
    assert.equal(model.header.obsTypes.get('G')!.length, 16);
    assert.equal(model.header.obsTypes.get('G')![13].code, 'L5Q'); // continuation line
    assert.equal(obs.epochs.length, 2);
    const ep = obs.epochs[0];
    assert.ok(ep.sats.length > 10);
    assert.ok(!src.line(ep.line).endsWith('\r'));
    const line = ep.line + 1;
    const cells = cellsOnLine(src, obs, ep, line);
    assert.equal(cells[0].sat, ep.sats[0]);
    assert.equal(findByLine(obs.epochs, line), ep);
    assert.equal(findByLine(obs.epochs, ep.endLine + 1), obs.epochs[1]);
});

test('RINEX 2 GPS navigation', () => {
    const { src, model } = load('v2_gps.10n');
    const nav = asNav(model);
    assert.equal(nav.records.length, 3);
    const rec = nav.records[0];
    assert.equal(rec.sat, 'G01');
    assert.equal(rec.endLine - rec.dataLine, 7);
    assert.equal(formatEpoch(rec.time), '2010-07-02 00:00:00.000');
    const row0 = navCellsOnLine(src, nav, rec, rec.dataLine);
    assert.equal(row0[0].field?.[0], 'SV clock bias af0');
    assert.ok(Math.abs(row0[0].value - -0.13663712889e-3) < 1e-15);
    const row2 = navCellsOnLine(src, nav, rec, rec.dataLine + 2);
    assert.equal(row2[3].field?.[0], '√A');
    assert.ok(Math.abs(row2[3].value - 5154.79979706) < 1e-6);
});

test('RINEX 2 GLONASS navigation', () => {
    const nav = asNav(load('v201_glo.09g').model);
    assert.equal(nav.records.length, 2);
    assert.equal(nav.records[0].sat, 'R02');
    assert.equal(nav.records[0].msg, 'FDMA');
    assert.equal(nav.records[0].endLine - nav.records[0].dataLine, 3);
});

test('RINEX 3.02 navigation with blank-padded satellite ids', () => {
    const { src, model } = load('v302_mixed.nav');
    const nav = asNav(model);
    assert.deepEqual(nav.records.map((r) => r.sat), ['J07', 'J04', 'G11', 'J03', 'G15', 'G06']);
    const rec = nav.records[0];
    assert.equal(rec.endLine - rec.dataLine, 7);
    const row1 = navCellsOnLine(src, nav, rec, rec.dataLine + 1);
    assert.equal(row1[0].field?.[0], 'IODE');
    assert.equal(row1[0].value, 125);
});

test('RINEX 4.02 navigation: every record type has the expected line count', () => {
    const { src, model } = load('v402_mixed.rnx');
    const nav = asNav(model);
    // lines after the "> ..." line, verified against the DLR BRD400 file
    const expected: Record<string, number> = {
        'EPH G LNAV': 8, 'EPH G CNAV': 9, 'EPH J LNAV': 8, 'EPH J CNAV': 9, 'EPH J CNV2': 10,
        'EPH E INAV': 8, 'EPH E FNAV': 8, 'EPH C D1': 8, 'EPH C D2': 8, 'EPH C CNV1': 10,
        'EPH C CNV2': 10, 'EPH C CNV3': 9, 'EPH I LNAV': 8, 'EPH R FDMA': 5, 'EPH S SBAS': 4,
        'STO G LNAV': 2, 'EOP G CNVX': 3, 'ION G LNAV': 3, 'ION E IFNV': 2, 'ION C CNVX': 3,
    };
    const seen = new Map(nav.records.map((r) => [`${r.kind} ${r.sys} ${r.msg}`, r]));
    for (const [key, lines] of Object.entries(expected)) {
        const r = seen.get(key);
        assert.ok(r, `missing ${key}`);
        assert.equal(r.endLine - r.line, lines, key);
        // every field of every row must have a definition or be an explicit spare
        for (let l = r.dataLine; l <= r.endLine; l++) {
            for (const c of navCellsOnLine(src, nav, r, l)) {
                assert.ok(Number.isFinite(c.value) || (r.kind === 'STO' && c.row === 0), `${key} ${c.raw}`);
            }
        }
    }
    const glo = seen.get('EPH R FDMA')!;
    assert.equal(navCellsOnLine(src, nav, glo, glo.dataLine + 4)[2].field?.[0], 'URAI (F_T)');
    const sto = seen.get('STO G LNAV')!;
    assert.equal(navCellsOnLine(src, nav, sto, sto.dataLine)[0].raw.length, 4);
    const cnv2 = seen.get('EPH J CNV2')!;
    assert.equal(navCellsOnLine(src, nav, cnv2, cnv2.dataLine + 9)[0].field?.[0], 'Transmission time t_tm');

    assert.equal(seen.get('STO R FDMA')?.sat, 'R'); // satellite number left blank
    assert.equal(seen.get('ION J LNAV WIDE')?.sys, 'J');

    const s = summarizeNav(nav);
    assert.equal(s.messages.get('EPH G LNAV'), 1);
    assert.ok(s.ephemerisCount >= 15);
});
