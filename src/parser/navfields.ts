/**
 * Field definitions of navigation records, per (record kind, system, message).
 *
 * Row 0 is the line carrying the satellite id and epoch (the values after the
 * epoch). Row n (n >= 1) is the n-th "BROADCAST ORBIT" (or data) line.
 * `null` marks spare / undocumented fields.
 */
export type Field = readonly [name: string, unit?: string] | null;
export type Rows = readonly (readonly Field[])[];

const S = 's';
const RAD = 'rad';
const RADS = 'rad/s';
const M = 'm';
const KM = 'km';
const KMS = 'km/s';
const KMS2 = 'km/s²';

const CLOCK: readonly Field[] = [['SV clock bias af0', S], ['SV clock drift af1', 's/s'], ['SV clock drift rate af2', 's/s²']];

/** Broadcast orbits 1-4 of Keplerian ephemerides (first field differs). */
function kepler(first: Field, toe: string, deltaN = 'Δn'): Field[][] {
    return [
        [first, ['Crs', M], [deltaN, RADS], ['M0', RAD]],
        [['Cuc', RAD], ['e (eccentricity)'], ['Cus', RAD], ['√A', '√m']],
        [[toe, S], ['Cic', RAD], ['Ω0', RAD], ['Cis', RAD]],
        [['i0', RAD], ['Crc', M], ['ω', RAD], ['Ω̇ (OMEGA DOT)', RADS]],
    ];
}

const GPS_LNAV: Rows = [
    CLOCK,
    ...kepler(['IODE'], 'Toe (s of GPS week)'),
    [['IDOT', RADS], ['Codes on L2 channel'], ['GPS week'], ['L2 P data flag']],
    [['SV accuracy (URA)', M], ['SV health'], ['TGD', S], ['IODC']],
    [['Transmission time (s of GPS week)', S], ['Fit interval', 'h']],
];

const QZS_LNAV: Rows = [
    ...GPS_LNAV.slice(0, 7),
    [['Transmission time (s of GPS week)', S], ['Fit interval flag']],
];

const GAL: Rows = [
    CLOCK,
    ...kepler(['IODnav'], 'Toe (s of GAL week)'),
    [['IDOT', RADS], ['Data sources'], ['GAL week'], null],
    [['SISA', M], ['SV health'], ['BGD E5a/E1', S], ['BGD E5b/E1', S]],
    [['Transmission time (s of GAL week)', S]],
];

const BDS_D1D2: Rows = [
    CLOCK,
    ...kepler(['AODE'], 'Toe (s of BDT week)'),
    [['IDOT', RADS], null, ['BDT week'], null],
    [['SV accuracy (URA)', M], ['SatH1'], ['TGD1 B1/B3', S], ['TGD2 B2/B3', S]],
    [['Transmission time (s of BDT week)', S], ['AODC']],
];

const IRN: Rows = [
    CLOCK,
    ...kepler(['IODEC'], 'Toe (s of IRN week)'),
    [['IDOT', RADS], null, ['IRN week'], null],
    [['User range accuracy', M], ['SV health'], ['TGD', S], null],
    [['Transmission time (s of IRN week)', S]],
];

const GLO_COMMON: Rows = [
    [['-τN (SV clock bias)', S], ['+γN (relative frequency bias)'], ['Message frame time tk', S]],
    [['X', KM], ['Ẋ', KMS], ['Ẍ', KMS2], ['Health (Bn)']],
    [['Y', KM], ['Ẏ', KMS], ['Ÿ', KMS2], ['Frequency number k']],
    [['Z', KM], ['Ż', KMS], ['Z̈', KMS2], ['Age of operation information E', 'days']],
];

const GLO: Rows = [
    ...GLO_COMMON,
    [['Status flags'], ['ΔτN (L1/L2 group delay difference)', S], ['URAI (F_T)'], ['Health flags']],
];

const SBAS: Rows = [
    [['SV clock bias aGf0', S], ['SV clock drift aGf1', 's/s'], ['Transmission time (s of GPS week)', S]],
    [['X', KM], ['Ẋ', KMS], ['Ẍ', KMS2], ['Health']],
    [['Y', KM], ['Ẏ', KMS], ['Ÿ', KMS2], ['Accuracy code (URA)']],
    [['Z', KM], ['Ż', KMS], ['Z̈', KMS2], ['IODN']],
];

/** GPS/QZSS CNAV and CNAV-2 (RINEX 4). */
const CNAV_HEAD: Rows = [
    CLOCK,
    ...kepler(['Ȧ', 'm/s'], 't_op (s of GPS week)', 'Δn0'),
    [['IDOT', RADS], ['Δṅ0', 'rad/s²'], ['URAI_NED0'], ['URAI_NED1']],
    [['URAI_ED'], ['SV health'], ['TGD', S], ['URAI_NED2']],
    [['ISC_L1CA', S], ['ISC_L2C', S], ['ISC_L5I5', S], ['ISC_L5Q5', S]],
];
const GPS_CNAV: Rows = [...CNAV_HEAD, [['Transmission time t_tm', S], ['WN_op'], null, null]];
const GPS_CNV2: Rows = [
    ...CNAV_HEAD,
    [['ISC_L1Cd', S], ['ISC_L1Cp', S], null, null],
    [['Transmission time t_tm', S], ['WN_op'], null, null],
];

/** BDS B-CNAV1/2/3 (RINEX 4). */
const BCNAV_HEAD: Rows = [
    CLOCK,
    ...kepler(['Ȧ', 'm/s'], 'Toe (s of BDT week)', 'Δn0'),
    [['IDOT', RADS], ['Δṅ0', 'rad/s²'], ['SatType (1: GEO, 2: IGSO, 3: MEO)'], ['t_op', S]],
    [['SISAI_oe'], ['SISAI_ocb'], ['SISAI_oc1'], ['SISAI_oc2']],
];
const BDS_CNV1: Rows = [
    ...BCNAV_HEAD,
    [['ISC_B1Cd', S], null, ['TGD_B1Cp', S], ['TGD_B2ap', S]],
    [['SISMAI'], ['Health'], ['Integrity flags'], ['IODC']],
    [['Transmission time t_tm', S], null, null, ['IODE']],
];
const BDS_CNV2: Rows = [
    ...BCNAV_HEAD,
    [null, ['ISC_B2ad', S], ['TGD_B1Cp', S], ['TGD_B2ap', S]],
    [['SISMAI'], ['Health'], ['Integrity flags'], ['IODC']],
    [['Transmission time t_tm', S], null, null, ['IODE']],
];
const BDS_CNV3: Rows = [
    ...BCNAV_HEAD,
    [['SISMAI'], ['Health'], ['Integrity flags'], ['TGD_B2bI', S]],
    [['Transmission time t_tm', S]],
];

const STO: Rows = [
    [['Time offset type'], ['SBAS ID'], ['UTC ID']],
    [['Transmission time t_tm', S], ['A0', S], ['A1', 's/s'], ['A2', 's/s²']],
];

const EOP: Rows = [
    [['xp', 'arcsec'], ['dxp/dt', 'arcsec/day'], ['d²xp/dt²', 'arcsec/day²']],
    [['yp', 'arcsec'], ['dyp/dt', 'arcsec/day'], ['d²yp/dt²', 'arcsec/day²']],
    [['Transmission time t_tm', S], ['ΔUT1', S], ['dΔUT1/dt', 's/day'], ['d²ΔUT1/dt²', 's/day²']],
];

const ION_KLOBUCHAR: Rows = [
    [['α0', S], ['α1', 's/semicircle'], ['α2', 's/semicircle²']],
    [['α3', 's/semicircle³'], ['β0', S], ['β1', 's/semicircle'], ['β2', 's/semicircle²']],
    [['β3', 's/semicircle³'], ['Region code'], null, null],
];
const ION_NEQUICK: Rows = [
    [['ai0', 'sfu'], ['ai1', 'sfu/deg'], ['ai2', 'sfu/deg²']],
    [['Ionospheric disturbance flags']],
];
const ION_BDGIM: Rows = [
    [['α1', 'TECu'], ['α2', 'TECu'], ['α3', 'TECu']],
    [['α4', 'TECu'], ['α5', 'TECu'], ['α6', 'TECu'], ['α7', 'TECu']],
    [['α8', 'TECu'], ['α9', 'TECu'], null, null],
];

/** Legacy (RINEX 2/3) message implied by the satellite system. */
export function legacyMessage(sys: string): string {
    switch (sys) {
        case 'R': return 'FDMA';
        case 'S': return 'SBAS';
        case 'E': return 'INAV/FNAV';
        case 'C': return 'D1/D2';
        default: return 'LNAV';
    }
}

/** Field layout for a record. Returns undefined when unknown. */
export function navRows(kind: string, sys: string, msg: string): Rows | undefined {
    if (kind === 'STO') {
        return STO;
    }
    if (kind === 'EOP') {
        return EOP;
    }
    if (kind === 'ION') {
        if (sys === 'E') {
            return ION_NEQUICK;
        }
        if (sys === 'C' && msg === 'CNVX') {
            return ION_BDGIM;
        }
        return ION_KLOBUCHAR;
    }
    switch (sys) {
        case 'G':
            return msg === 'CNAV' ? GPS_CNAV : msg === 'CNV2' ? GPS_CNV2 : GPS_LNAV;
        case 'J':
            return msg === 'CNAV' ? GPS_CNAV : msg === 'CNV2' ? GPS_CNV2 : QZS_LNAV;
        case 'E':
            return GAL;
        case 'C':
            return msg === 'CNV1' ? BDS_CNV1 : msg === 'CNV2' ? BDS_CNV2 : msg === 'CNV3' ? BDS_CNV3 : BDS_D1D2;
        case 'I':
            return IRN;
        case 'R':
            return GLO;
        case 'S':
            return SBAS;
    }
    return undefined;
}
