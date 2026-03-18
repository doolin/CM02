#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, '..', 'data', 'NIST_SP-800-53_rev5_catalog.json');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const jsonFlag = args.includes('--json');
const controlArg = args.find(a => !a.startsWith('--'));

if (!controlArg) {
  console.error('Usage: node scripts/extract-control.js <control-id> [--json]');
  console.error('  Examples: node scripts/extract-control.js cm-2');
  console.error('           node scripts/extract-control.js cm-2.2 --json');
  process.exit(1);
}

// Normalize the user-supplied ID.
// Users may type "cm-02", "CM-2", "cm-2.2", "CM-02(02)", etc.
// Catalog IDs look like "cm-2", "cm-2.2".
function normalizeId(raw) {
  let id = raw.toLowerCase().trim();
  // Convert parenthesized enhancement notation CM-02(02) -> cm-2.2
  const enhMatch = id.match(/^([a-z]{2})-0*(\d+)\(0*(\d+)\)$/);
  if (enhMatch) {
    return `${enhMatch[1]}-${enhMatch[2]}.${enhMatch[3]}`;
  }
  // Strip leading zeros from numeric parts: cm-02 -> cm-2, cm-02.02 -> cm-2.2
  id = id.replace(/(?<=-)0+(\d)/g, '$1');
  id = id.replace(/\.0+(\d)/g, '.$1');
  return id;
}

const controlId = normalizeId(controlArg);

// ---------------------------------------------------------------------------
// Load catalog and find control
// ---------------------------------------------------------------------------
const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));

function findControl(id) {
  for (const group of catalog.catalog.groups || []) {
    for (const ctrl of group.controls || []) {
      if (ctrl.id === id) return ctrl;
      // Check enhancements nested under this control
      for (const enh of ctrl.controls || []) {
        if (enh.id === id) return enh;
      }
    }
  }
  return null;
}

const control = findControl(controlId);
if (!control) {
  console.error(`Control "${controlId}" not found in catalog.`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get the sp800-53a label from a props array. */
function getLabel(props) {
  if (!props) return '';
  const p = props.find(x => x.name === 'label' && x.class === 'sp800-53a');
  return p ? p.value : '';
}

/** Build a map from param id -> { label, guidelineProse, paramLabel } */
function buildParamMap(params) {
  const map = {};
  for (const p of params || []) {
    const label = getLabel(p.props);
    const guidelineProse = (p.guidelines || []).map(g => g.prose).join(' ');
    map[p.id] = { label, guidelineProse, paramLabel: p.label || '' };
  }
  return map;
}

/** Resolve {{ insert: param, <id> }} placeholders using param map. */
function resolveInserts(prose, paramMap) {
  if (!prose) return '';
  return prose.replace(/\{\{\s*insert:\s*param,\s*([^}\s]+)\s*\}\}/g, (_match, paramId) => {
    const info = paramMap[paramId];
    if (info) {
      return `<${info.label} ${info.paramLabel}>`;
    }
    return `<${paramId}>`;
  });
}

/** Recursively collect leaf assessment-objective nodes (those with prose). */
function collectObjectives(parts, paramMap, results) {
  if (!parts) return;
  for (const p of parts) {
    if (p.name === 'assessment-objective') {
      if (p.prose) {
        // Leaf node with actual prose
        results.push({
          section: getLabel(p.props),
          text: resolveInserts(p.prose, paramMap),
        });
      }
      // Recurse into children regardless
      if (p.parts) {
        collectObjectives(p.parts, paramMap, results);
      }
    }
  }
}

/** Extract assessment methods (EXAMINE, INTERVIEW, TEST). */
function collectMethods(parts, paramMap) {
  const results = [];
  if (!parts) return results;
  for (const p of parts) {
    if (p.name === 'assessment-method') {
      const label = getLabel(p.props);
      // The method type is embedded in the label, e.g. "CM-02-Examine"
      // The nested part (assessment-objects) holds the prose listing.
      const objectsParts = (p.parts || []).filter(c => c.name === 'assessment-objects');
      const prose = objectsParts.map(o => resolveInserts(o.prose, paramMap)).join('\n\n');
      results.push({ section: label, text: prose });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Extract data
// ---------------------------------------------------------------------------
const paramMap = buildParamMap(control.params);

// ODP rows
const odpRows = (control.params || []).map(p => {
  const label = getLabel(p.props);
  const prose = (p.guidelines || []).map(g => g.prose).join(' ');
  return { section: label, text: prose };
});

// Assessment objectives
const objectiveRows = [];
const objPart = (control.parts || []).find(p => p.name === 'assessment-objective');
if (objPart) {
  // Start from the top-level assessment-objective; it may have prose itself
  // or only children. collectObjectives handles both.
  collectObjectives([objPart], paramMap, objectiveRows);
}

// Assessment methods
const methodRows = collectMethods(control.parts, paramMap);

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
const title = control.title;
const controlLabel = getLabel(control.props) || controlId.toUpperCase();

if (jsonFlag) {
  const output = {
    id: control.id,
    label: controlLabel,
    title,
    odps: odpRows,
    objectives: objectiveRows,
    methods: methodRows,
  };
  console.log(JSON.stringify(output, null, 2));
} else {
  // Markdown table output
  console.log(`# ${controlLabel}: ${title}`);
  console.log('');
  // Escape pipe characters in prose for markdown table safety
  const esc = (s) => s.replace(/\|/g, '\\|').replace(/\n/g, '<br>');

  console.log('| Section | NIST Text | Response |');
  console.log('|---------|-----------|----------|');
  for (const row of odpRows) {
    console.log(`| ${esc(row.section)} | ${esc(row.text)} | |`);
  }
  for (const row of objectiveRows) {
    console.log(`| ${esc(row.section)} | ${esc(row.text)} | |`);
  }
  for (const row of methodRows) {
    console.log(`| ${esc(row.section)} | ${esc(row.text)} | |`);
  }
}
