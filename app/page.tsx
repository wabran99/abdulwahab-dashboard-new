import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-white/5 p-10 shadow-2xl backdrop-blur-xl">
        <div className="mb-3 inline-flex rounded-full border border-emerald-300/20 bg-emerald-500/10 px-4 py-1 text-xs font-medium uppercase tracking-[0.2em] text-emerald-200">
          Ready to deploy
        </div>
        <h1 className="text-4xl font-semibold tracking-tight">Abdulwahab Team Dashboard</h1>
        <p className="mt-3 text-white/70">
          Open the live executive dashboard page connected to Google Sheets.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex rounded-2xl border border-emerald-300/20 bg-emerald-500/20 px-5 py-3 font-medium text-white transition hover:bg-emerald-500/30"
        >
          Open Dashboard
        </Link>
      </div>
    </main>
  );
}
