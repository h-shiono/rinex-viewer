/** Descriptions of observation codes and header labels used in hovers. */

export const SYSTEM_NAMES: Record<string, string> = {
    G: 'GPS',
    R: 'GLONASS',
    E: 'Galileo',
    C: 'BeiDou',
    J: 'QZSS',
    I: 'NavIC/IRNSS',
    S: 'SBAS',
    M: 'Mixed',
};

const BANDS: Record<string, Record<string, string>> = {
    G: { '1': 'L1', '2': 'L2', '5': 'L5' },
    R: { '1': 'G1', '2': 'G2', '3': 'G3', '4': 'G1a', '6': 'G2a' },
    E: { '1': 'E1', '5': 'E5a', '6': 'E6', '7': 'E5b', '8': 'E5(a+b)' },
    C: { '1': 'B1C/B1A', '2': 'B1I', '5': 'B2a', '6': 'B3', '7': 'B2I/B2b', '8': 'B2(a+b)' },
    J: { '1': 'L1', '2': 'L2', '5': 'L5', '6': 'L6' },
    I: { '1': 'L1', '5': 'L5', '9': 'S' },
    S: { '1': 'L1', '5': 'L5' },
};

const KINDS: Record<string, [string, string]> = {
    C: ['Pseudorange', 'm'],
    P: ['Pseudorange (P-code)', 'm'],
    L: ['Carrier phase', 'cycles'],
    D: ['Doppler', 'Hz'],
    S: ['Signal strength', 'dB-Hz'],
    X: ['Receiver channel number', ''],
};

/** Human readable description of an observation code, e.g. "C1C" for GPS. */
export function describeObsCode(code: string, sys: string): { kind: string; unit: string; band: string } {
    const [kind, unit] = KINDS[code.charAt(0)] ?? ['Observation', ''];
    const bandDigit = code.charAt(1);
    const band = BANDS[sys]?.[bandDigit] ?? `band ${bandDigit}`;
    return { kind, unit, band };
}

/** Loss of lock indicator bits. */
export function describeLli(lli: string): string {
    const v = parseInt(lli, 10);
    if (!Number.isFinite(v) || v === 0) {
        return lli === '' ? '' : '0: OK';
    }
    const bits: string[] = [];
    if (v & 1) { bits.push('lost lock (possible cycle slip)'); }
    if (v & 2) { bits.push('half-cycle ambiguity / opposite wavelength factor'); }
    if (v & 4) { bits.push('BOC tracking or AS on'); }
    return `${v}: ${bits.join(', ')}`;
}

/** Signal strength indicator (1-9). */
export function describeSsi(ssi: string): string {
    const v = parseInt(ssi, 10);
    if (!Number.isFinite(v)) {
        return '';
    }
    if (v === 0) { return '0: unknown / don\'t care'; }
    if (v === 1) { return '1: minimum possible'; }
    if (v === 5) { return '5: threshold for good tracking'; }
    if (v === 9) { return '9: maximum possible'; }
    return String(v);
}

export const HEADER_LABELS: Record<string, string> = {
    'RINEX VERSION / TYPE': 'Format version, file type and satellite system',
    'PGM / RUN BY / DATE': 'Program, agency and date of file creation',
    'COMMENT': 'Comment line',
    'MARKER NAME': 'Name of antenna marker',
    'MARKER NUMBER': 'Number of antenna marker',
    'MARKER TYPE': 'Type of the marker',
    'OBSERVER / AGENCY': 'Observer and agency',
    'REC # / TYPE / VERS': 'Receiver number, type and firmware version',
    'ANT # / TYPE': 'Antenna number and type',
    'APPROX POSITION XYZ': 'Approximate marker position (WGS84) [m]',
    'ANTENNA: DELTA H/E/N': 'Antenna height and horizontal eccentricity [m]',
    'ANTENNA: DELTA X/Y/Z': 'Antenna reference point position in body-fixed system [m]',
    'WAVELENGTH FACT L1/2': 'Wavelength factors for L1 and L2 (RINEX 2)',
    '# / TYPES OF OBSERV': 'Number and list of observation types (RINEX 2)',
    'SYS / # / OBS TYPES': 'Satellite system, number and list of observation types',
    'SIGNAL STRENGTH UNIT': 'Unit of the signal strength observations',
    'INTERVAL': 'Observation interval [s]',
    'TIME OF FIRST OBS': 'Time of first observation record and time system',
    'TIME OF LAST OBS': 'Time of last observation record and time system',
    'RCV CLOCK OFFS APPL': 'Receiver clock offset applied (1) or not (0)',
    'SYS / DCBS APPLIED': 'Differential code bias corrections applied',
    'SYS / PCVS APPLIED': 'Phase center variation corrections applied',
    'SYS / SCALE FACTOR': 'Scale factor applied to observations',
    'SYS / PHASE SHIFT': 'Phase shift correction used to generate phases consistent with reference signals',
    'GLONASS SLOT / FRQ #': 'GLONASS slot and frequency numbers',
    'GLONASS COD/PHS/BIS': 'GLONASS phase bias correction used to align code and phase observations',
    'LEAP SECONDS': 'Number of leap seconds since 6-Jan-1980',
    '# OF SATELLITES': 'Number of satellites for which observations are stored',
    'PRN / # OF OBS': 'PRN and number of observations for each type',
    'ION ALPHA': 'Ionosphere parameters A0-A3 of almanac (RINEX 2)',
    'ION BETA': 'Ionosphere parameters B0-B3 of almanac (RINEX 2)',
    'DELTA-UTC: A0,A1,T,W': 'Almanac parameters to compute time in UTC (RINEX 2)',
    'IONOSPHERIC CORR': 'Ionospheric correction parameters',
    'TIME SYSTEM CORR': 'Corrections to transform the system time to UTC or other time systems',
    'MERGED FILE': 'Number of merged navigation files',
    'DOI': 'Digital Object Identifier',
    'LICENSE OF USE': 'License of use',
    'STATION INFORMATION': 'Link to station information',
    'END OF HEADER': 'Last record in the header section',
};
