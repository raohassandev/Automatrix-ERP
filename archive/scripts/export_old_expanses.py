"""
Export every sheet from an XLSX file to CSV so you can copy/paste it into AutoMatrix ERP.

Run this from the repo root and optionally pass the input spreadsheet / output folder:

    python3 scripts/export_old_expanses.py -i Automatrix_ERP.xlsx -o data_exports/automatrix

Each sheet becomes `<output>/<SheetName>.csv` with raw rows (including headers).
"""

from __future__ import annotations

import argparse
import csv
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile

DEFAULT_INPUT = Path('Expanse.xlsx')
DEFAULT_OUTPUT = Path('data_exports')
NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
NS_REL_OFFICE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
NS_REL_PACKAGE = 'http://schemas.openxmlformats.org/package/2006/relationships'


def _col_ref_to_index(col_ref: str) -> int:
    col_ref = ''.join(ch for ch in col_ref if ch.isalpha())
    index = 0
    for ch in col_ref.upper():
        index = index * 26 + (ord(ch) - ord('A') + 1)
    return max(0, index - 1)


def _shared_strings(zf: ZipFile) -> list[str]:
    try:
        with zf.open('xl/sharedStrings.xml') as fp:
            root = ET.parse(fp).getroot()
    except KeyError:
        return []

    values = []
    for si in root.findall(f'.//{{{NS_MAIN}}}si'):
        values.append(''.join(t.text or '' for t in si.findall(f'.//{{{NS_MAIN}}}t')))
    return values


def _workbook_rels(zf: ZipFile) -> dict[str, str]:
    rels = {}
    with zf.open('xl/_rels/workbook.xml.rels') as fp:
        root = ET.parse(fp).getroot()
    for rel in root.findall(f'{{{NS_REL_PACKAGE}}}Relationship'):
        rels[rel.attrib['Id']] = rel.attrib['Target']
    return rels


def _rows_from_sheet(zf: ZipFile, target: str, shared_strings: list[str]) -> list[list[str]]:
    with zf.open(f'xl/{target}') as fp:
        root = ET.parse(fp).getroot()

    rows = []
    for row in root.findall(f'.//{{{NS_MAIN}}}row'):
        cells = {}
        max_index = -1
        for cell in row.findall(f'{{{NS_MAIN}}}c'):
            ref = cell.attrib.get('r', '')
            idx = _col_ref_to_index(ref)
            max_index = max(max_index, idx)
            value = cell.find(f'{{{NS_MAIN}}}v')
            text = ''
            if value is not None and value.text:
                if cell.attrib.get('t') == 's':
                    try:
                        text = shared_strings[int(value.text)]
                    except (ValueError, IndexError):
                        text = ''
                else:
                    text = value.text
            elif cell.find(f'{{{NS_MAIN}}}is') is not None:
                text = ''.join(r.text or '' for r in cell.findall(f'.//{{{NS_MAIN}}}t'))
            cells[idx] = text
        if max_index < 0:
            rows.append([])
            continue
        normalized = [cells.get(i, '') for i in range(max_index + 1)]
        rows.append(normalized)
    return rows


def main(input_path: Path | str = DEFAULT_INPUT, output_dir: Path | str = DEFAULT_OUTPUT) -> None:
    xlsx_file = Path(input_path)
    if not xlsx_file.exists():
        raise FileNotFoundError(f'{xlsx_file} not found in the current working directory.')

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    with ZipFile(xlsx_file) as zf:
        shared_strings = _shared_strings(zf)
        rels = _workbook_rels(zf)
        workbook = ET.parse(zf.open('xl/workbook.xml')).getroot()

        for sheet in workbook.findall(f'{{{NS_MAIN}}}sheets/{{{NS_MAIN}}}sheet'):
            name = sheet.attrib['name']
            rid = sheet.attrib.get(f'{{{NS_REL_OFFICE}}}id')
            target = rels.get(rid)
            if not target or not target.startswith('worksheets/'):
                continue
            rows = _rows_from_sheet(zf, target, shared_strings)
            file_path = output_path / f'{name}.csv'
            with file_path.open('w', newline='', encoding='utf-8') as csvfile:
                writer = csv.writer(csvfile)
                writer.writerows(rows)
            print(f'Exported {name} ({len(rows)} rows) → {file_path}')


def parse_args() -> tuple[Path, Path]:
    parser = argparse.ArgumentParser(
        description='Dump every sheet from a spreadsheet XLSX file into CSVs.'
    )
    parser.add_argument(
        '-i',
        '--input',
        type=Path,
        default=DEFAULT_INPUT,
        help='path to the source XLSX file (default: Expanse.xlsx)'
    )
    parser.add_argument(
        '-o',
        '--output',
        type=Path,
        default=DEFAULT_OUTPUT,
        help='directory where CSV files are written'
    )
    args = parser.parse_args()
    return args.input, args.output


if __name__ == '__main__':
    src, dst = parse_args()
    main(src, dst)
