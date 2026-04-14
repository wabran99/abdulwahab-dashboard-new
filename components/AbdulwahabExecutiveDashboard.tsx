'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Camera,
  Cable,
  Download,
  FileDown,
  RefreshCw,
  Search,
  Target,
  Trophy,
  Users,
  Wifi,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type Column = { id?: string; label?: string };
type RawRow = Record<string, string | number>;

type BranchSummary = {
  branch: string;
  target: number;
  achieved: number;
  prep: number;
  post: number;
  achievementPct: number;
  prepPct: number;
  postPct: number;
  fiveG: number;
  fiber: number;
};

type EmployeeRow = {
  employee: string;
  branch: string;
  target: number;
  achieved: number;
  prep: number;
  post: number;
  achievementPct: number;
  prepPct: number;
  postPct: number;
  fiveG: number;
  fiber: number;
  uiRank: number;
};

type DashboardData = {
  headers: string[];
  branches: BranchSummary[];
  employees: EmployeeRow[];
  totals: Omit<BranchSummary, 'branch'>;
  topEmployee: EmployeeRow | null;
};

const CONFIG = {
  sheetId: '1EwSWZ9XsyRY_HBNq9elmEsN35wbvGZZ12Rn_7FJGD8o',
  sheetName: 'Adulwahab M Alshammari',
  refreshMs: 60_000,
  title: 'Abdulwahab Team Executive Dashboard',
  subtitle: 'Live performance view powered by Google Sheets',
};

const COLUMN_ALIASES = {
  branch: ['branch', 'store', 'store name', 'branch name', 'location'],
  employee: ['employee', 'employee name', 'staff', 'staff name', 'advisor', 'salesperson', 'name'],
  target: ['target', 'sales target', 'monthly target', 'goal'],
  achieved: ['achieved', 'actual', 'sales', 'approved sales', 'achieved sales'],
  achievementPct: ['achievement %', 'achievement pct', 'ach %', 'achievement percentage'],
  prep: ['prep', 'prepaid', 'prep sales'],
  prepPct: ['prep %', 'prep pct', 'prepaid %'],
  post: ['post', 'postpaid', 'post sales'],
  postPct: ['post %', 'post pct', 'postpaid %'],
  rank: ['rank', 'ranking', 'position'],
  fiveG: ['5g', '5g sales', '5g achieved', '5g count'],
  fiber: ['fiber', 'fibre', 'fiber sales', 'fiber achieved', 'fiber count'],
};

function normalizeKey(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[%]/g, ' pct ')
    .replace(/[_\-/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function toNumber(value: unknown) {
  if (typeof value === 'number') return value;
  if (value == null) return 0;
  const raw = String(value).replace(/٬/g, '').replace(/,/g, '').replace(/٫/g, '.').replace(/%/g, '').trim();
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: unknown) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(toNumber(value));
}

function formatPct(value: unknown) {
  return `${toNumber(value).toFixed(1)}%`;
}

function getCellValue(cell: { f?: string | number; v?: string | number } | null | undefined) {
  if (!cell) return '';
  if (cell.f != null) return cell.f;
  if (cell.v != null) return cell.v;
  return '';
}

function findColumnIndex(columns: Column[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeKey);
  return columns.findIndex((col) => {
    const normalized = normalizeKey(col.label || col.id || '');
    return normalizedAliases.some((alias) => normalized === alias || normalized.includes(alias));
  });
}

function buildRowObject(columns: Column[], row: { c?: Array<{ f?: string | number; v?: string | number } | null> }) {
  const values = row.c || [];
  const obj: RawRow = {};
  columns.forEach((col, index) => {
    const key = cleanText(col.label || col.id || `column_${index + 1}`);
    obj[key] = getCellValue(values[index]);
  });
  return obj;
}

async function fetchGoogleSheet(sheetId: string, sheetName: string) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?sheet=${encodeURIComponent(sheetName)}&tqx=out:json`;
  const response = await fetch(url, { cache: 'no-store' });
  const text = await response.text();
  const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);?$/s);

  if (!match) {
    throw new Error('Unable to parse Google Sheets response. Ensure the sheet is public as Viewer.');
  }

  const json = JSON.parse(match[1]) as {
    table: { cols: Column[]; rows: Array<{ c?: Array<{ f?: string | number; v?: string | number } | null> }> };
  };

  const columns = json.table.cols || [];
  const rows = (json.table.rows || []).map((row) => buildRowObject(columns, row));
  return { columns, rows };
}

function transformData(raw: { columns: Column[]; rows: RawRow[] }): DashboardData {
  const headers = raw.columns.map((c) => cleanText(c.label || c.id || ''));
  const indexMap = Object.fromEntries(
    Object.entries(COLUMN_ALIASES).map(([key, aliases]) => [key, findColumnIndex(raw.columns, aliases)])
  ) as Record<string, number>;

  const normalized = raw.rows
    .map((row) => {
      const read = (key: string) => {
        const index = indexMap[key];
        if (index == null || index < 0) return '';
        const header = headers[index];
        return row[header] ?? '';
      };

      const target = toNumber(read('target'));
      const achieved = toNumber(read('achieved'));
      const prep = toNumber(read('prep'));
      const post = toNumber(read('post'));
      const achievementPct = indexMap.achievementPct >= 0 ? toNumber(read('achievementPct')) : target > 0 ? (achieved / target) * 100 : 0;
      const prepPct = indexMap.prepPct >= 0 ? toNumber(read('prepPct')) : achieved > 0 ? (prep / achieved) * 100 : 0;
      const postPct = indexMap.postPct >= 0 ? toNumber(read('postPct')) : achieved > 0 ? (post / achieved) * 100 : 0;

      return {
        branch: cleanText(read('branch')),
        employee: cleanText(read('employee')),
        target,
        achieved,
        prep,
        post,
        achievementPct,
        prepPct,
        postPct,
        fiveG: toNumber(read('fiveG')),
        fiber: toNumber(read('fiber')),
      };
    })
    .filter((row) => row.branch || row.employee || row.target || row.achieved);

  const branchMap = new Map<string, BranchSummary>();
  const employeesBase = normalized.filter((row) => row.employee);

  normalized.forEach((row) => {
    if (!row.branch) return;
    const existing = branchMap.get(row.branch) || {
      branch: row.branch,
      target: 0,
      achieved: 0,
      prep: 0,
      post: 0,
      achievementPct: 0,
      prepPct: 0,
      postPct: 0,
      fiveG: 0,
      fiber: 0,
    };

    existing.target += row.target;
    existing.achieved += row.achieved;
    existing.prep += row.prep;
    existing.post += row.post;
    existing.fiveG += row.fiveG;
    existing.fiber += row.fiber;
    branchMap.set(row.branch, existing);
  });

  const branches = Array.from(branchMap.values())
    .map((branch) => ({
      ...branch,
      achievementPct: branch.target > 0 ? (branch.achieved / branch.target) * 100 : 0,
      prepPct: branch.achieved > 0 ? (branch.prep / branch.achieved) * 100 : 0,
      postPct: branch.achieved > 0 ? (branch.post / branch.achieved) * 100 : 0,
    }))
    .sort((a, b) => b.achievementPct - a.achievementPct);

  const employees = employeesBase
    .map((row) => ({
      ...row,
      achievementPct: row.target > 0 ? (row.achieved / row.target) * 100 : row.achievementPct,
    }))
    .sort((a, b) => (b.achievementPct === a.achievementPct ? b.achieved - a.achieved : b.achievementPct - a.achievementPct))
    .map((row, index) => ({ ...row, uiRank: index + 1 }));

  const totals = branches.reduce(
    (acc, branch) => {
      acc.target += branch.target;
      acc.achieved += branch.achieved;
      acc.prep += branch.prep;
      acc.post += branch.post;
      acc.fiveG += branch.fiveG;
      acc.fiber += branch.fiber;
      return acc;
    },
    {
      target: 0,
      achieved: 0,
      prep: 0,
      post: 0,
      achievementPct: 0,
      prepPct: 0,
      postPct: 0,
      fiveG: 0,
      fiber: 0,
    }
  );

  totals.achievementPct = totals.target > 0 ? (totals.achieved / totals.target) * 100 : 0;
  totals.prepPct = totals.achieved > 0 ? (totals.prep / totals.achieved) * 100 : 0;
  totals.postPct = totals.achieved > 0 ? (totals.post / totals.achieved) * 100 : 0;

  return {
    headers,
    branches,
    employees,
    totals,
    topEmployee: employees[0] || null,
  };
}

function StatCard({
  icon: Icon,
  label,
  value,
  subvalue,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-emerald-100/70">{label}</span>
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-2 text-emerald-200">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-3xl font-semibold tracking-tight text-white">{value}</div>
      {subvalue ? <div className="mt-2 text-sm text-emerald-100/70">{subvalue}</div> : null}
    </div>
  );
}

function MetricBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-sm text-emerald-50/90">
      <span className="mr-2 text-emerald-100/60">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

export default function AbdulwahabExecutiveDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [captureMode, setCaptureMode] = useState(false);
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const dashboardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setError('');
        const raw = await fetchGoogleSheet(CONFIG.sheetId, CONFIG.sheetName);
        const transformed = transformData(raw);
        if (!active) return;
        setData(transformed);
        setLastUpdated(new Date());
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load data.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    const timer = window.setInterval(load, CONFIG.refreshMs);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const branches = data?.branches ?? [];

  const selectedBranchData = useMemo(() => {
    if (!data || selectedBranch === 'ALL') return null;
    return data.branches.find((branch) => branch.branch === selectedBranch) || null;
  }, [data, selectedBranch]);

  const visibleEmployees = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.employees
      .filter((emp) => (selectedBranch === 'ALL' ? true : emp.branch === selectedBranch))
      .filter((emp) => (!q ? true : `${emp.employee} ${emp.branch}`.toLowerCase().includes(q)));
  }, [data, selectedBranch, search]);

  const summary = selectedBranchData || data?.totals;
  const topEmployee = visibleEmployees[0] || data?.topEmployee || null;

  async function downloadAsPng() {
    if (!dashboardRef.current) return;
    const canvas = await html2canvas(dashboardRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#052e16',
    });
    const link = document.createElement('a');
    link.download = `abdulwahab-dashboard-${selectedBranch === 'ALL' ? 'all' : selectedBranch}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  async function downloadAsPdf() {
    if (!dashboardRef.current) return;
    const canvas = await html2canvas(dashboardRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#052e16',
    });
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] });
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(`abdulwahab-dashboard-${selectedBranch === 'ALL' ? 'all' : selectedBranch}.pdf`);
  }

  return (
    <div className={`min-h-screen ${captureMode ? 'bg-[#052e16]' : 'bg-slate-950'}`}>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-0 top-0 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full bg-lime-400/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl p-6 lg:p-8">
        {!captureMode && (
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-1 text-xs font-medium uppercase tracking-[0.2em] text-emerald-200">
                Live Google Sheets
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white lg:text-5xl">{CONFIG.title}</h1>
              <p className="mt-2 max-w-3xl text-sm text-emerald-50/70 lg:text-base">{CONFIG.subtitle}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium text-white shadow-xl backdrop-blur-xl transition hover:bg-white/15"
              >
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
              <button
                onClick={() => setCaptureMode((v) => !v)}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-500/15 px-4 py-3 text-sm font-medium text-emerald-100 shadow-xl backdrop-blur-xl transition hover:bg-emerald-500/25"
              >
                <Camera className="h-4 w-4" /> {captureMode ? 'Exit Capture Mode' : 'Capture Mode'}
              </button>
              <button
                onClick={downloadAsPng}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium text-white shadow-xl backdrop-blur-xl transition hover:bg-white/15"
              >
                <Download className="h-4 w-4" /> PNG
              </button>
              <button
                onClick={downloadAsPdf}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium text-white shadow-xl backdrop-blur-xl transition hover:bg-white/15"
              >
                <FileDown className="h-4 w-4" /> PDF
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/10 p-8 text-white shadow-2xl backdrop-blur-xl">
            Loading live data from Google Sheets...
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-300/20 bg-rose-500/10 p-8 text-rose-100 shadow-2xl backdrop-blur-xl">
            <div className="text-lg font-semibold">Connection error</div>
            <div className="mt-2 text-sm opacity-90">{error}</div>
            <div className="mt-4 text-sm opacity-75">Set the Google Sheet to Anyone with the link → Viewer.</div>
          </div>
        ) : (
          <motion.div
            ref={dashboardRef}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="rounded-[2rem] border border-white/10 bg-white/10 p-5 shadow-[0_30px_120px_rgba(0,0,0,0.35)] backdrop-blur-2xl lg:p-8"
          >
            <div className="mb-8 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
              <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-emerald-600/30 via-emerald-500/10 to-transparent p-6 shadow-2xl">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-black/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-100/80">
                      Executive Overview
                    </div>
                    <h2 className="text-2xl font-semibold text-white lg:text-4xl">
                      {selectedBranch === 'ALL' ? 'All Abdulwahab Branches' : selectedBranch}
                    </h2>
                    <p className="mt-2 text-sm text-emerald-50/70">
                      Last update: {lastUpdated ? lastUpdated.toLocaleString() : '—'}
                    </p>
                  </div>

                  {topEmployee && (
                    <div className="min-w-[250px] rounded-3xl border border-amber-200/20 bg-amber-300/10 p-4 text-amber-50 shadow-2xl">
                      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-amber-100/80">
                        <Trophy className="h-4 w-4" /> Top Employee
                      </div>
                      <div className="text-xl font-semibold">{topEmployee.employee}</div>
                      <div className="mt-1 text-sm text-amber-100/70">{topEmployee.branch || 'No branch'}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <MetricBadge label="Achieved" value={formatNumber(topEmployee.achieved)} />
                        <MetricBadge label="Ach %" value={formatPct(topEmployee.achievementPct)} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <StatCard icon={Target} label="Target" value={formatNumber(summary?.target)} subvalue="Live from Google Sheets" />
                <StatCard icon={Building2} label="Achieved" value={formatNumber(summary?.achieved)} subvalue={formatPct(summary?.achievementPct)} />
              </div>
            </div>

            <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={Building2} label="Branches" value={String(branches.length)} subvalue="Abdulwahab team only" />
              <StatCard icon={Users} label="Employees" value={String(visibleEmployees.length)} subvalue={selectedBranch === 'ALL' ? 'All branches' : selectedBranch} />
              <StatCard icon={Wifi} label="Prep" value={formatNumber(summary?.prep)} subvalue={formatPct(summary?.prepPct)} />
              <StatCard icon={Cable} label="Post" value={formatNumber(summary?.post)} subvalue={formatPct(summary?.postPct)} />
            </div>

            <div className="mb-8 rounded-[2rem] border border-white/10 bg-black/10 p-5">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-lg font-semibold text-white">Branch Navigation</div>
                  <div className="mt-1 text-sm text-emerald-100/60">Switch between branches or keep the full team view.</div>
                </div>
                <div className="relative w-full max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-100/50" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search employee or branch"
                    className="w-full rounded-2xl border border-white/10 bg-white/10 py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-emerald-100/40"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {['ALL', ...branches.map((b) => b.branch)].map((branch) => {
                  const active = selectedBranch === branch;
                  return (
                    <button
                      key={branch}
                      onClick={() => setSelectedBranch(branch)}
                      className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                        active
                          ? 'border-emerald-300/20 bg-emerald-500/20 text-white shadow-xl'
                          : 'border-white/10 bg-white/5 text-emerald-50/80 hover:bg-white/10'
                      }`}
                    >
                      {branch === 'ALL' ? 'All Branches' : branch}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-8 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[2rem] border border-white/10 bg-black/10 p-5">
                <div className="mb-4 text-lg font-semibold text-white">Branch Summary</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-emerald-100/60">
                        <th className="px-4 py-3 font-medium">Branch</th>
                        <th className="px-4 py-3 font-medium">Target</th>
                        <th className="px-4 py-3 font-medium">Achieved</th>
                        <th className="px-4 py-3 font-medium">Ach %</th>
                        <th className="px-4 py-3 font-medium">Prep</th>
                        <th className="px-4 py-3 font-medium">Prep %</th>
                        <th className="px-4 py-3 font-medium">Post</th>
                        <th className="px-4 py-3 font-medium">Post %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {branches.map((branch) => (
                        <tr
                          key={branch.branch}
                          className={`border-b border-white/5 text-white/90 ${selectedBranch === branch.branch ? 'bg-emerald-500/10' : ''}`}
                        >
                          <td className="px-4 py-4 font-medium">{branch.branch}</td>
                          <td className="px-4 py-4">{formatNumber(branch.target)}</td>
                          <td className="px-4 py-4">{formatNumber(branch.achieved)}</td>
                          <td className="px-4 py-4">{formatPct(branch.achievementPct)}</td>
                          <td className="px-4 py-4">{formatNumber(branch.prep)}</td>
                          <td className="px-4 py-4">{formatPct(branch.prepPct)}</td>
                          <td className="px-4 py-4">{formatNumber(branch.post)}</td>
                          <td className="px-4 py-4">{formatPct(branch.postPct)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-black/10 p-5">
                <div className="text-lg font-semibold text-white">Scalable Metrics</div>
                <div className="mt-1 text-sm text-emerald-100/60">Ready for future KPIs like 5G and Fiber.</div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="text-sm text-emerald-100/60">5G</div>
                    <div className="mt-2 text-3xl font-semibold text-white">{formatNumber(summary?.fiveG)}</div>
                    <div className="mt-2 text-sm text-emerald-100/50">Auto-detected if present in the sheet</div>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="text-sm text-emerald-100/60">Fiber</div>
                    <div className="mt-2 text-3xl font-semibold text-white">{formatNumber(summary?.fiber)}</div>
                    <div className="mt-2 text-sm text-emerald-100/50">Auto-detected if present in the sheet</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-black/10 p-5">
              <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-lg font-semibold text-white">Employee Ranking</div>
                  <div className="mt-1 text-sm text-emerald-100/60">All employees included, sorted by performance with live progress bars.</div>
                </div>
                <div className="text-sm text-emerald-100/60">Showing {visibleEmployees.length} employees</div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-emerald-100/60">
                      <th className="px-4 py-3 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Employee</th>
                      <th className="px-4 py-3 font-medium">Branch</th>
                      <th className="px-4 py-3 font-medium">Target</th>
                      <th className="px-4 py-3 font-medium">Achieved</th>
                      <th className="px-4 py-3 font-medium">Ach %</th>
                      <th className="px-4 py-3 font-medium">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEmployees.map((emp, idx) => {
                      const width = Math.max(0, Math.min(emp.achievementPct, 100));
                      return (
                        <tr key={`${emp.employee}-${emp.branch}-${idx}`} className="border-b border-white/5 text-white/90">
                          <td className="px-4 py-4 font-medium text-emerald-200">{idx + 1}</td>
                          <td className="px-4 py-4 font-medium">{emp.employee || '—'}</td>
                          <td className="px-4 py-4 text-emerald-50/70">{emp.branch || '—'}</td>
                          <td className="px-4 py-4">{formatNumber(emp.target)}</td>
                          <td className="px-4 py-4">{formatNumber(emp.achieved)}</td>
                          <td className="px-4 py-4">{formatPct(emp.achievementPct)}</td>
                          <td className="min-w-[220px] px-4 py-4">
                            <div className="h-3 overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-lime-300 to-emerald-200"
                                style={{ width: `${width}%` }}
                              />
                            </div>
                            <div className="mt-2 text-xs text-emerald-100/60">{formatPct(emp.achievementPct)}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
