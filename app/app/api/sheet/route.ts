export async function GET() {
  try {
    const sheetId = "1EwSWZ9XsyRY_HBNq9elmEsN35wbvGZZ12Rn_7FJGD8o";
    const sheetName = "Adulwahab M Alshammari";

    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?sheet=${encodeURIComponent(sheetName)}&tqx=out:json`;

    const response = await fetch(url, {
      cache: "no-store",
    });

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

    return Response.json(json, { status: 200 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 }
    );
  }
}
