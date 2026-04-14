export async function GET() {
  try {
    const sheetId = "1EwSWZ9XsyRY_HBNq9elmEsN35wbvGZZ12Rn_7FJGD8o";
    const sheetName = "Adulwahab M Alshammari";

    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?sheet=${encodeURIComponent(
      sheetName
    )}&tqx=out:json`;

    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      return Response.json(
        { error: `Google Sheets request failed with status ${response.status}` },
        { status: 500 }
      );
    }

    const text = await response.text();
    const match = text.match(
      /google\.visualization\.Query\.setResponse\(([\s\S]*)\);?$/
    );

    if (!match) {
      return Response.json(
        { error: "Failed to parse Google Sheets response" },
        { status: 500 }
      );
    }

    const json = JSON.parse(match[1]);
    const table = json.table;
    const rows = table.rows || [];

    let currentBranch = "";

    const toText = (cell: any) => {
      if (!cell) return "";
      if (cell.f != null) return String(cell.f).trim();
      if (cell.v != null) return String(cell.v).trim();
      return "";
    };

    const toNumber = (cell: any) => {
      const raw = toText(cell)
        .replace(/٬/g, "")
        .replace(/,/g, "")
        .replace(/٫/g, ".")
        .replace(/%/g, "")
        .trim();
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    };

    const employees: Array<{
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
      uiRank?: number;
    }> = [];

    for (const row of rows) {
      const c = row.c || [];

      const region = toText(c[0]);        // A
      const shopCode = toText(c[1]);      // B
      const name = toText(c[2]);          // C
      const userName = toText(c[3]);      // D
      const totalTarget = toNumber(c[4]); // E
      const achieved = toNumber(c[10]);   // K
      const postpaid = toNumber(c[15]);   // P
      const prepaid = toNumber(c[17]);    // R

      const lowerName = name.toLowerCase();

      const isBranchHeader =
        !!name &&
        !userName &&
        (
          lowerName.includes("fbo") ||
          lowerName.includes("road") ||
          lowerName.includes("mall")
        );

      if (isBranchHeader) {
        currentBranch = name;
        continue;
      }

      const isEmployeeRow = !!name && !!userName;

      if (!isEmployeeRow) continue;

      const achievementPct =
        totalTarget > 0 ? (achieved / totalTarget) * 100 : 0;
      const prepPct = achieved > 0 ? (prepaid / achieved) * 100 : 0;
      const postPct = achieved > 0 ? (postpaid / achieved) * 100 : 0;

      employees.push({
        employee: name,
        branch: currentBranch || region || "Unknown",
        target: totalTarget,
        achieved,
        prep: prepaid,
        post: postpaid,
        achievementPct,
        prepPct,
        postPct,
        fiveG: 0,
        fiber: 0,
      });
    }

    const branchMap = new Map<
      string,
      {
        branch: string;
        target: number;
        achieved: number;
        prep: number;
        post: number;
        fiveG: number;
        fiber: number;
      }
    >();

    for (const emp of employees) {
      const existing = branchMap.get(emp.branch) || {
        branch: emp.branch,
        target: 0,
        achieved: 0,
        prep: 0,
        post: 0,
        fiveG: 0,
        fiber: 0,
      };

      existing.target += emp.target;
      existing.achieved += emp.achieved;
      existing.prep += emp.prep;
      existing.post += emp.post;
      existing.fiveG += emp.fiveG;
      existing.fiber += emp.fiber;

      branchMap.set(emp.branch, existing);
    }

    const branches = Array.from(branchMap.values())
      .map((b) => ({
        ...b,
        achievementPct: b.target > 0 ? (b.achieved / b.target) * 100 : 0,
        prepPct: b.achieved > 0 ? (b.prep / b.achieved) * 100 : 0,
        postPct: b.achieved > 0 ? (b.post / b.achieved) * 100 : 0,
      }))
      .sort((a, b) => b.achievementPct - a.achievementPct);

    const rankedEmployees = employees
      .sort((a, b) => {
        if (b.achievementPct !== a.achievementPct) {
          return b.achievementPct - a.achievementPct;
        }
        return b.achieved - a.achieved;
      })
      .map((emp, index) => ({
        ...emp,
        uiRank: index + 1,
      }));

    const totals = branches.reduce(
      (acc, b) => {
        acc.target += b.target;
        acc.achieved += b.achieved;
        acc.prep += b.prep;
        acc.post += b.post;
        acc.fiveG += b.fiveG;
        acc.fiber += b.fiber;
        return acc;
      },
      {
        target: 0,
        achieved: 0,
        prep: 0,
        post: 0,
        fiveG: 0,
        fiber: 0,
      }
    );

    return Response.json({
      branches,
      employees: rankedEmployees,
      totals: {
        ...totals,
        achievementPct: totals.target > 0 ? (totals.achieved / totals.target) * 100 : 0,
        prepPct: totals.achieved > 0 ? (totals.prep / totals.achieved) * 100 : 0,
        postPct: totals.achieved > 0 ? (totals.post / totals.achieved) * 100 : 0,
      },
      topEmployee: rankedEmployees[0] || null,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 }
    );
  }
}
